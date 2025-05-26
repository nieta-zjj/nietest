"""
测试任务提交Actor模块

接收任务数据，规范化和验证task，然后存储到数据库并发送到飞书通知
"""
import logging
import dramatiq
import time
import threading
from typing import List, Dict, Any, cast, Tuple, NamedTuple, Optional
from datetime import datetime, timedelta
import uuid
import itertools
from copy import deepcopy

from backend.core.config import settings

from backend.utils.feishu import feishu_notify, feishu_task_notify
from backend.utils.task_scheduler import TaskScheduler
from backend.models.db.dramatiq_base import DramatiqBaseModel
from backend.models.db.user import User
from backend.models.db.subtasks import Subtask, SubtaskStatus
from backend.models.db.tasks import Task, TaskStatus, SettingField
from backend.models.prompt import Prompt, ConstantPrompt
from backend.models.task_parameter import TaskParameter
from backend.models.variable_dimension import VariableDimension
# 不再直接导入test_run_subtask和test_run_lumina_subtask，使用custom_background服务代替
from backend.services.custom_background import get_background_service
from backend.services.task_service import check_and_update_task_completion
from backend.crud.task import task_crud

# 配置日志
logger = logging.getLogger(__name__)

def initialize_data(task_id: str, task_data: Dict[str, Any]):
    """初始化数据"""
    # 获取基本信息
    user_id = task_data["user_id"]
    task_name = task_data["name"]

    if not user_id:
        raise ValueError("用户ID不能为空")

    # 验证用户是否存在
    user = User.get_or_none(User.id == user_id)
    if not user:
        raise ValueError(f"用户不存在: {user_id}")

    dimensions = []

    # 为变量ID分配唯一的数字ID
    variable_id_counter = 0
    variable_id_mapping = {}  # 原始variable_id -> 数字ID的映射

    # 处理提示词
    prompts = []
    for prompt_data in task_data["prompts"]:
        if prompt_data['is_variable']:
            original_variable_id = prompt_data['variable_id']

            # 如果variable_id不是纯数字，重新分配数字ID
            if not isinstance(original_variable_id, int) and not (isinstance(original_variable_id, str) and original_variable_id.isdigit()):
                if original_variable_id not in variable_id_mapping:
                    variable_id_mapping[original_variable_id] = str(variable_id_counter)
                    variable_id_counter += 1
                numeric_variable_id = variable_id_mapping[original_variable_id]
                logger.info(f"重置variable_id: {original_variable_id} -> {numeric_variable_id}")
            else:
                numeric_variable_id = str(original_variable_id)

            variable_values = []
            for var_value in prompt_data['variable_values']:
                variable_values.append(
                    ConstantPrompt(
                        type = var_value['type'],
                        value = var_value['value'],
                        weight = var_value['weight'],
                        img_url = var_value.get('img_url', None),
                        uuid = var_value.get('uuid', None),
                        name = var_value.get('name', None)
                    ))
            prompt_obj = Prompt(
                type = prompt_data['type'],
                value = '',
                weight = 1.0,
                is_variable = True,
                variable_id = numeric_variable_id,  # 使用数字ID
                variable_name = prompt_data['variable_name'],
                variable_values = variable_values
            )
            dimensions.append(len(variable_values))
        else:
            if prompt_data['type'] == 'freetext':
                prompt_obj = Prompt(
                    type = prompt_data['type'],
                    value = prompt_data['value'],
                    weight = prompt_data['weight'],
                    is_variable = False,
                )
            else:
                prompt_obj = Prompt(
                    type = prompt_data['type'],
                    value = prompt_data['value'],
                    weight = prompt_data['weight'],
                    is_variable = False,
                    name = prompt_data.get('name', None),
                    img_url = prompt_data.get('img_url', None),
                    uuid = prompt_data.get('uuid', None)
                )
        prompts.append(prompt_obj)

    normal_parameters = [
        'ratio',
        'seed',
        'use_polish',
        'is_lumina',
        'lumina_model_name',
        'lumina_cfg',
        'lumina_step'
    ]

    tmp_parameters = {}

    for param_name in normal_parameters:
        param_data = task_data[param_name]
        if param_data['is_variable']:
            original_variable_id = param_data['variable_id']

            # 如果variable_id不是纯数字，重新分配数字ID
            if not isinstance(original_variable_id, int) and not (isinstance(original_variable_id, str) and original_variable_id.isdigit()):
                if original_variable_id not in variable_id_mapping:
                    variable_id_mapping[original_variable_id] = str(variable_id_counter)
                    variable_id_counter += 1
                numeric_variable_id = variable_id_mapping[original_variable_id]
                logger.info(f"重置variable_id: {original_variable_id} -> {numeric_variable_id}")
            else:
                numeric_variable_id = str(original_variable_id)

            tmp_parameters[param_name] = TaskParameter(
                type = param_data['type'],
                value = '',
                is_variable = True,
                format = param_data['format'],
                variable_id = numeric_variable_id,  # 使用数字ID
                variable_name = param_data['variable_name'],
                variable_values = param_data['variable_values']
            )
            dimensions.append(len(param_data['variable_values']))
        else:
            tmp_parameters[param_name] = TaskParameter(
                type = param_data['type'],
                value = param_data['value'],
                is_variable = False,
                format = param_data['format']
            )

    total_images = 1
    for dimension_value in dimensions:
        total_images = dimension_value * total_images

    # 生成任务ID或使用传入的ID
    final_task_id = uuid.UUID(task_id) if task_id else uuid.uuid4()

    # 记录variable_id映射信息
    if variable_id_mapping:
        logger.info(f"Variable ID 映射表: {variable_id_mapping}")

    # 创建任务对象
    task_obj_data = {
        "id": final_task_id,
        "name": task_name,
        "user": user,
        "status": TaskStatus.PENDING.value,
        "priority": task_data.get("priority", 1),
        "prompts": prompts,
        "total_images": total_images,
        "is_favorite": False,  # 新创建的任务默认不收藏
        "variables_map": {},   # 变量映射初始为空字典，后续在create_subtasks_from_task中填充
        **tmp_parameters,
    }

    # 开始数据库事务并创建任务
    from backend.db.database import test_db_proxy
    with test_db_proxy.atomic():
        task_obj = Task.create(**task_obj_data)

    # 准备飞书通知详情
    details = {
        #"json配置": task_data,
        "预计生成图像数": total_images
    }

    # 生成前端详细页面URL
    frontend_url = f"{settings.FRONTEND_BASE_URL}/model-testing/history/{task_obj.id}"

    # 发送飞书通知
    feishu_task_notify(
        event_type="task_submitted",
        task_id=str(task_obj.id),
        task_name=task_name,
        submitter=user.username,
        details=details,
        message="任务已提交到测试系统",
        frontend_url=frontend_url
    )

    return task_obj


def insert_master_task_to_db(task_obj: Task):
    """插入主任务到数据库"""
    from backend.db.database import test_db_proxy
    with test_db_proxy.atomic():
        task_obj.save()


def insert_subtasks_to_db(subtasks: List[Subtask]):
    """
    批量插入子任务到数据库

    Args:
        subtasks: 子任务列表
    """
    if not subtasks:
        logger.warning("没有子任务需要插入数据库")
        return

    logger.info(f"开始批量插入 {len(subtasks)} 个子任务到数据库")

    from backend.db.database import test_db_proxy

    # 使用事务批量插入子任务
    with test_db_proxy.atomic():
        # 使用批量插入以提高性能
        # 每批次插入100个子任务
        batch_size = 100
        for i in range(0, len(subtasks), batch_size):
            batch = subtasks[i:i+batch_size]
            Subtask.bulk_create(batch, batch_size=batch_size)

    logger.info(f"成功批量插入 {len(subtasks)} 个子任务到数据库")


def send_subtasks_to_dramatiq(subtasks: List[Subtask]):
    """
    将子任务发送到Dramatiq队列进行处理，并根据任务类型添加延迟
    使用dramatiq的延迟任务能力，一次性发送所有任务

    Args:
        subtasks: 子任务列表
    """
    if not subtasks:
        logger.warning("没有子任务需要发送到Dramatiq")
        return

    logger.info(f"开始将 {len(subtasks)} 个子任务发送到Dramatiq队列")

    # 记录发送开始时间
    start_time = datetime.now()

    # 获取后台任务服务实例
    background_service = get_background_service()

    # 将子任务分为Lumina任务和普通任务
    lumina_subtasks = [subtask for subtask in subtasks if subtask.is_lumina]
    normal_subtasks = [subtask for subtask in subtasks if not subtask.is_lumina]

    # 处理Lumina任务
    if lumina_subtasks:
        logger.info(f"开始处理 {len(lumina_subtasks)} 个Lumina子任务")

        # 计算累积延迟时间（毫秒）
        accumulated_delay_ms = 0

        # 按照延迟规则发送Lumina任务
        for i, subtask in enumerate(lumina_subtasks):
            # 计算当前任务的延迟时间（秒）
            delay_seconds = TaskScheduler.calculate_lumina_delay(i)

            # 累加延迟时间（转换为毫秒）
            accumulated_delay_ms += int(delay_seconds * 1000)

            background_service.enqueue(
                actor_name="test_run_lumina_subtask",
                kwargs={"subtask_id": str(subtask.id)},
                queue_name=settings.SUBTASK_OPS_QUEUE,
                delay=accumulated_delay_ms
            )

    # 处理普通任务
    if normal_subtasks:
        logger.info(f"开始处理 {len(normal_subtasks)} 个普通子任务")

        # 计算累积延迟时间（毫秒）
        accumulated_delay_ms = 0

        # 按照延迟规则发送普通任务
        for i, subtask in enumerate(normal_subtasks):
            # 计算当前任务的延迟时间（秒）
            delay_seconds = TaskScheduler.calculate_normal_delay(i)

            # 累加延迟时间（转换为毫秒）
            accumulated_delay_ms += int(delay_seconds * 1000)

            background_service.enqueue(
                actor_name="test_run_subtask",
                kwargs={"subtask_id": str(subtask.id)},
                queue_name=settings.SUBTASK_QUEUE,
                delay=accumulated_delay_ms
            )

    # 计算发送耗时
    elapsed_time = (datetime.now() - start_time).total_seconds()
    logger.info(f"成功将 {len(subtasks)} 个子任务发送到Dramatiq队列，耗时: {elapsed_time:.2f}秒")


def check_recent_running_tasks(current_task: Task = None) -> int:
    """
    检查是否有10分钟内提交且正在执行的父任务

    对于Lumina任务，同时只允许一个主任务运行

    Args:
        current_task: 当前任务对象，用于检查是否为Lumina任务

    Returns:
        10分钟内提交且正在执行的任务数量
    """
    try:
        # 确保数据库连接是活跃的
        from backend.db.database import test_db_proxy
        if test_db_proxy.is_closed():
            logger.info("数据库连接已关闭，尝试重新连接")
            test_db_proxy.connect()

        # 查询所有正在执行的任务
        all_running_tasks = list(Task.select().where(
            Task.status == TaskStatus.PROCESSING.value
        ))

        # 检查当前任务是否为Lumina任务
        is_current_task_lumina = False
        if current_task:
            # 检查is_lumina参数
            is_lumina_param = current_task.is_lumina
            if is_lumina_param and (is_lumina_param.is_variable or is_lumina_param.value):
                is_current_task_lumina = True
                logger.info(f"当前任务 {current_task.id} 是Lumina任务")

        # 如果当前任务是Lumina任务，检查是否有其他正在执行的Lumina任务
        if is_current_task_lumina:
            for task in all_running_tasks:
                # 跳过当前任务
                if current_task and str(task.id) == str(current_task.id):
                    continue

                # 检查任务是否为Lumina任务
                is_lumina_param = task.is_lumina
                if is_lumina_param and (is_lumina_param.is_variable or is_lumina_param.value):
                    logger.info(f"检测到正在执行的Lumina任务 {task.id}，当前Lumina任务 {current_task.id} 需要等待")
                    return 1  # 有其他Lumina任务正在执行，返回1表示需要等待

        # 检查是否有10分钟内提交的任务
        ten_minutes_ago = datetime.now() - timedelta(minutes=10)
        recent_running_tasks = sum(1 for task in all_running_tasks if task.created_at > ten_minutes_ago)

        logger.info(f"检测到 {len(all_running_tasks)} 个正在执行的任务，其中 {recent_running_tasks} 个是10分钟内提交的")
        return recent_running_tasks
    except Exception as e:
        logger.error(f"检查最近运行任务时出错: {str(e)}")
        # 尝试重新初始化数据库连接
        try:
            DramatiqBaseModel.initialize_database()
            logger.info("已尝试重新初始化数据库连接")
        except Exception as db_error:
            logger.error(f"重新初始化数据库连接失败: {str(db_error)}")
        return 0  # 出错时返回0，允许任务继续


def wait_for_execution_slot(task_obj: Task) -> bool:
    """
    等待执行槽位，直到没有10分钟内提交的正在执行的任务
    对于Lumina任务，同时只允许一个主任务运行

    Args:
        task_obj: 任务对象

    Returns:
        是否成功获取执行槽位
    """
    check_interval = 30  # 每30秒检查一次
    max_wait_time = 3600  # 最长等待时间（秒）
    total_wait_time = 0

    logger.info(f"任务 {task_obj.id} 开始等待执行槽位")

    while total_wait_time < max_wait_time:
        # 检查任务是否被取消
        # 重新查询数据库获取最新状态
        current_task = Task.get_or_none(Task.id == task_obj.id)
        if current_task and current_task.status == TaskStatus.CANCELLED.value:
            logger.info(f"任务 {task_obj.id} 已被取消，停止等待执行槽位")
            return False

        # 检查是否有10分钟内提交的正在执行的任务，并传递当前任务对象
        recent_running_tasks = check_recent_running_tasks(current_task=task_obj)

        if recent_running_tasks == 0:
            # 没有10分钟内提交的正在执行的任务，可以执行
            logger.info(f"任务 {task_obj.id} 获取到执行槽位，可以开始执行")
            return True

        # 有10分钟内提交的正在执行的任务，等待
        logger.info(f"任务 {task_obj.id} 检测到 {recent_running_tasks} 个10分钟内提交的正在执行的任务，等待 {check_interval} 秒后重试")
        time.sleep(check_interval)
        total_wait_time += check_interval

    # 超过最长等待时间
    logger.warning(f"任务 {task_obj.id} 等待执行槽位超时，已等待 {total_wait_time} 秒")
    return False


def update_task_status(task_obj: Task, status: str):
    """
    更新任务状态

    Args:
        task_obj: 任务对象
        status: 新状态
    """
    logger.info(f"更新任务 {task_obj.id} 状态为 {status}")

    from backend.db.database import test_db_proxy
    with test_db_proxy.atomic():
        task_obj.status = status
        task_obj.updated_at = datetime.now()

        # 如果是开始处理，更新开始时间
        if status == TaskStatus.PROCESSING.value:
            task_obj.started_at = datetime.now()

        # 如果是完成或失败，更新完成时间
        if status in [TaskStatus.COMPLETED.value, TaskStatus.FAILED.value, TaskStatus.CANCELLED.value]:
            task_obj.completed_at = datetime.now()

        task_obj.save()

    logger.info(f"任务 {task_obj.id} 状态已更新为 {status}")


def update_task_progress(task_id: str) -> bool:
    """
    更新任务进度，计算已处理的子任务数量并更新进度

    Args:
        task_id: 任务ID

    Returns:
        是否所有子任务都已完成
    """
    try:
        # 获取任务
        task = Task.get_or_none(Task.id == task_id)
        if not task:
            logger.warning(f"任务不存在: {task_id}")
            return False

        # 获取任务的所有子任务
        subtasks = list(Subtask.select().where(Subtask.task == task_id))

        if not subtasks:
            logger.warning(f"任务 {task_id} 没有子任务")
            return False

        # 计算子任务状态
        total_subtasks = len(subtasks)
        completed_subtasks = sum(1 for s in subtasks if s.status == SubtaskStatus.COMPLETED.value)
        failed_subtasks = sum(1 for s in subtasks if s.status == SubtaskStatus.FAILED.value)
        cancelled_subtasks = sum(1 for s in subtasks if s.status == SubtaskStatus.CANCELLED.value)

        # 计算已处理的子任务数量
        processed_subtasks = completed_subtasks + failed_subtasks + cancelled_subtasks

        # 更新任务的processed_images字段
        task.processed_images = processed_subtasks

        # 计算进度百分比
        if task.total_images > 0:
            task.progress = int((processed_subtasks / task.total_images) * 100)
        else:
            task.progress = 0

        # 保存更新
        from backend.db.database import test_db_proxy
        with test_db_proxy.atomic():
            task.updated_at = datetime.now()
            task.save()

        logger.info(f"任务 {task_id} 进度已更新: {task.progress}%, 已处理: {processed_subtasks}/{total_subtasks}")

        # 返回是否所有子任务都已完成
        return processed_subtasks == total_subtasks
    except Exception as e:
        logger.error(f"更新任务进度时出错: {task_id}, 错误: {str(e)}")
        return False


def cleanup_cancelled_task(task_id: str):
    """
    清理被取消的任务，包括：
    1. 移除Redis中等待的子任务
    2. 更新数据库中等待的子任务状态为CANCELLED

    Args:
        task_id: 任务ID
    """
    logger.info(f"开始清理被取消的任务 {task_id}")

    try:
        # 获取后台任务服务实例来访问Redis broker
        background_service = get_background_service()
        broker = background_service.broker

        # 获取任务的所有子任务
        subtasks = list(Subtask.select().where(Subtask.task == task_id))

        if not subtasks:
            logger.warning(f"任务 {task_id} 没有子任务需要清理")
            return

        # 统计需要清理的子任务
        pending_subtasks = []
        processing_subtasks = []

        for subtask in subtasks:
            if subtask.status == SubtaskStatus.PENDING.value:
                pending_subtasks.append(subtask)
            elif subtask.status == SubtaskStatus.PROCESSING.value:
                processing_subtasks.append(subtask)

        logger.info(f"任务 {task_id} 清理统计: 等待中={len(pending_subtasks)}, 处理中={len(processing_subtasks)}")

        # 1. 清理Redis中等待的子任务
        redis_cleaned_count = 0

        # 获取Redis客户端
        redis_client = broker.client

        # 需要检查的队列列表
        queues_to_check = [
            (settings.SUBTASK_QUEUE, "test_run_subtask"),
            (settings.SUBTASK_OPS_QUEUE, "test_run_lumina_subtask")
        ]

        for queue_name, actor_name in queues_to_check:
            try:
                # 检查普通队列和延迟队列
                queue_names_to_clean = [
                    f"dramatiq:{queue_name}",  # 普通队列
                    f"dramatiq:{queue_name}.DQ"  # 延迟队列
                ]

                for redis_queue_name in queue_names_to_clean:
                    try:
                        # 获取队列中的所有消息
                        messages = redis_client.lrange(redis_queue_name, 0, -1)

                        for message in messages:
                            try:
                                # 解码消息内容
                                message_str = message.decode('utf-8') if isinstance(message, bytes) else str(message)

                                # 检查消息是否包含该任务的子任务ID
                                task_related = False
                                for subtask in pending_subtasks:
                                    subtask_id_str = str(subtask.id)
                                    if subtask_id_str in message_str:
                                        task_related = True
                                        break

                                if task_related:
                                    # 从队列中移除该消息
                                    removed = redis_client.lrem(redis_queue_name, 1, message)
                                    if removed > 0:
                                        redis_cleaned_count += removed
                                        logger.debug(f"从Redis队列 {redis_queue_name} 移除了与任务 {task_id} 相关的消息")

                            except Exception as msg_error:
                                logger.warning(f"处理Redis消息时出错: {str(msg_error)}")

                    except Exception as queue_error:
                        logger.warning(f"清理Redis队列 {redis_queue_name} 时出错: {str(queue_error)}")

            except Exception as redis_error:
                logger.warning(f"清理队列 {queue_name} 时出错: {str(redis_error)}")

        # 2. 更新数据库中等待的子任务状态为CANCELLED
        db_updated_count = 0
        from backend.db.database import test_db_proxy

        with test_db_proxy.atomic():
            for subtask in pending_subtasks:
                try:
                    subtask.status = SubtaskStatus.CANCELLED.value
                    subtask.error = "父任务已取消"
                    subtask.updated_at = datetime.now()
                    subtask.save()
                    db_updated_count += 1
                except Exception as db_error:
                    logger.error(f"更新子任务 {subtask.id} 状态时出错: {str(db_error)}")

        logger.info(f"任务 {task_id} 清理完成: Redis清理={redis_cleaned_count}, 数据库更新={db_updated_count}")

        # 发送任务取消通知
        try:
            task = Task.get_or_none(Task.id == task_id)
            if task:
                # 生成前端详细页面URL
                frontend_url = f"{settings.FRONTEND_BASE_URL}/model-testing/history/{task_id}"

                feishu_task_notify(
                    event_type='task_cancelled',
                    task_id=str(task_id),
                    task_name=task.name,
                    submitter=task.user.username if task.user else "未知用户",
                    details={
                        "清理的等待任务数": len(pending_subtasks),
                        "处理中任务数": len(processing_subtasks),
                        "Redis清理数": redis_cleaned_count,
                        "数据库更新数": db_updated_count
                    },
                    message="任务已取消，相关子任务已清理",
                    frontend_url=frontend_url
                )
        except Exception as notify_error:
            logger.warning(f"发送任务取消通知失败: {str(notify_error)}")

    except Exception as e:
        logger.error(f"清理被取消的任务 {task_id} 时出错: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())


def monitor_subtasks_completion(task_id: str):
    """
    监控子任务完成情况，每10秒检查一次，直到所有子任务都完成或失败
    如果检测到任务被取消，会停止轮询并进行清理工作

    Args:
        task_id: 任务ID
    """
    logger.info(f"开始监控任务 {task_id} 的子任务完成情况")

    try:
        # 初始化数据库连接
        DramatiqBaseModel.initialize_database()

        # 同时初始化BaseModel使用的test_db_proxy，因为User、Task、Subtask等模型继承自BaseModel
        try:
            from backend.core.app import initialize_app
            initialize_app()
            logger.info("BaseModel数据库连接已初始化")
        except Exception as base_init_error:
            logger.error(f"初始化BaseModel数据库连接失败: {str(base_init_error)}")
            raise

        # 获取任务
        task = Task.get_or_none(Task.id == task_id)
        if not task:
            logger.warning(f"任务不存在: {task_id}")
            return

        # 监控循环
        while True:
            # 检查任务是否已被取消或处于其他终止状态
            # 重新查询数据库获取最新状态
            current_task = Task.get_or_none(Task.id == task_id)
            if not current_task:
                logger.warning(f"任务 {task_id} 不存在，停止监控")
                return

            if current_task.status == TaskStatus.CANCELLED.value:
                logger.info(f"检测到任务 {task_id} 已被取消，开始清理工作")
                # 执行清理工作
                cleanup_cancelled_task(task_id)
                logger.info(f"任务 {task_id} 取消清理完成，停止监控")
                return

            if current_task.status in [TaskStatus.FAILED.value, TaskStatus.COMPLETED.value]:
                logger.info(f"任务 {task_id} 已处于终止状态: {current_task.status}，停止监控")
                return

            # 更新任务进度并检查是否所有子任务都已完成
            all_subtasks_completed = update_task_progress(task_id)

            if all_subtasks_completed:
                logger.info(f"任务 {task_id} 的所有子任务都已处理完成，检查最终状态")
                # 使用task_service中的函数检查并更新任务状态
                check_and_update_task_completion(task_id)
                break

            # 等待10秒后再次检查
            time.sleep(10)

        logger.info(f"任务 {task_id} 监控完成")
    except Exception as e:
        logger.error(f"监控任务 {task_id} 子任务完成情况时出错: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())


class ActiveVariable(NamedTuple):
    """
    代表一个活动变量，仅包含其 ID 和可能的取值。
    在 `active_variables_list` 中的索引即为其"维度索引"或"增序数字"。
    """
    variable_id: str | None     # 此变量在原始Task中的ID
    possible_values: List[Any]  # 此变量所有可能的取值
    # 注意：这里不包含如何应用此变量的指令。应用逻辑会在填充时动态查找。


def create_subtasks_from_task(task_obj: Task) -> List[Subtask]:
    """
    根据给定的 Task 对象生成所有可能的 Subtask 对象。

    核心逻辑：
    1. 创建 `active_variables_list`：每个元素定义一个变量（通过 `variable_id` 识别）
       及其可能的取值。列表的索引（0, 1, 2...）就是"维度索引"。
    2. 创建子任务的"基础模板"（包含所有固定配置）。
    3. 使用 `itertools.product` 生成所有可能的"空间坐标" (即 `subtask.variable_indices`)。
       该坐标的每个元素是对应"维度索引"的变量所选值的索引。
    4. 对于每个空间坐标，从基础模板开始。对坐标中的每个维度：
       a. 获取该维度对应的 `variable_id` 和选定的值。
       b. 在模板中查找与此 `variable_id` 关联的"挖空"位置，并填充值。
    """
    subtasks_to_create: List[Subtask] = []

    # 1. 创建 `active_variables_list`
    #    此列表的顺序定义了"维度索引"与 `variable_id` 的映射关系。
    active_variables_list: List[ActiveVariable] = []

    # 清空任务的变量维度映射列表，准备重新填充
    task_obj.variables = []

    # 创建variables_map字典
    variables_map = {}

    # 1a. 从任务的提示词 (prompts) 中收集活动变量
    for prompt_in_task in task_obj.prompts:
        if prompt_in_task.is_variable:
            # 添加到活动变量列表
            active_variables_list.append(
                ActiveVariable(
                    variable_id=prompt_in_task.variable_id,
                    possible_values=prompt_in_task.variable_values # List of ConstantPrompt
                )
            )

            # 记录变量ID与维度索引的映射关系
            dimension_index = len(active_variables_list) - 1
            task_obj.variables.append(
                VariableDimension(
                    variable_id=prompt_in_task.variable_id,
                    dimension_index=dimension_index,
                    variable_name=prompt_in_task.variable_name,
                    variable_type="prompt"
                )
            )

            # 构建variables_map - 提示词类型的变量
            variable_values = []
            for const_prompt in prompt_in_task.variable_values:
                # 将ConstantPrompt对象转换为字典
                variable_values.append(const_prompt.model_dump())

            variables_map[str(dimension_index)] = {
                "variable_id": prompt_in_task.variable_id,
                "variable_name": prompt_in_task.variable_name,
                "variable_type": "prompt",
                "values": variable_values
            }

            logger.info(f"任务 {task_obj.id}: 添加提示词变量到variables_map - dimension_index: {dimension_index}, variable_id: {prompt_in_task.variable_id}")

    # 1b. 从任务的可配置参数中收集活动变量
    configurable_parameters_names: List[str] = [
        SettingField.RATIO.value,
        SettingField.SEED.value,
        SettingField.USER_POLISH.value,
        SettingField.IS_LUMINA.value,
        SettingField.LUMINA_MODEL_NAME.value,
        SettingField.LUMINA_CFG.value,
        SettingField.LUMINA_STEP.value,
    ]
    for param_name in configurable_parameters_names:
        param_task_model: TaskParameter = getattr(task_obj, param_name)
        if param_task_model.is_variable:
            # 添加到活动变量列表
            active_variables_list.append(
                ActiveVariable(
                    variable_id=param_task_model.variable_id,
                    possible_values=param_task_model.variable_values # List of simple values
                )
            )

            # 记录变量ID与维度索引的映射关系
            dimension_index = len(active_variables_list) - 1
            task_obj.variables.append(
                VariableDimension(
                    variable_id=param_task_model.variable_id,
                    dimension_index=dimension_index,
                    variable_name=param_task_model.variable_name,
                    variable_type=param_name
                )
            )

            # 构建variables_map - 参数类型的变量
            variables_map[str(dimension_index)] = {
                "variable_id": param_task_model.variable_id,
                "variable_name": param_task_model.variable_name,
                "variable_type": param_name,
                "values": param_task_model.variable_values  # 简单值列表
            }

    # 将variables_map保存到任务对象
    task_obj.variables_map = variables_map

    # 保存更新后的任务对象
    from backend.db.database import test_db_proxy
    try:
        with test_db_proxy.atomic():
            task_obj.save()
    except Exception as save_error:
        raise

    # 2. 创建子任务的"基础模板"
    # 基础提示词列表 (对于 Subtask 的 JSONField，最终需要是字典列表)
    # 先用固定提示词的 Pydantic 模型填充，变量提示词位置留空或用标记
    base_prompts_for_subtask_template: List[Dict[str, Any] | None] = [None] * len(task_obj.prompts)
    for i, prompt_in_task in enumerate(task_obj.prompts):
        if not prompt_in_task.is_variable: # 如果是固定提示词
            base_prompts_for_subtask_template[i] = prompt_in_task.model_dump()
        # else: 变量提示词的位置会在填充时被覆盖，所以这里是 None

    # 基础参数字典
    base_params_for_subtask_template: Dict[str, Any] = {}
    for param_name in configurable_parameters_names:
        param_task_model: TaskParameter = getattr(task_obj, param_name)
        if not param_task_model.is_variable: # 如果是固定参数
            base_params_for_subtask_template[param_name] = param_task_model.value
        # else: 变量参数的值会在填充时被覆盖

    base_params_for_subtask_template[SettingField.BATCH_SIZE.value] = task_obj.batch_size.value

    # 3. 遍历所有"空间坐标"组合
    index_ranges = [range(len(active_var.possible_values)) for active_var in active_variables_list]

    # 如果没有变量，仍然需要创建一个子任务
    if not active_variables_list:
        # 为没有变量的任务创建一个子任务
        final_prompts_for_subtask = []
        for prompt_dict in base_prompts_for_subtask_template:
            if prompt_dict is not None and prompt_dict.get('value'):
                final_prompts_for_subtask.append(prompt_dict)

        subtask_payload = {
            "task": task_obj,
            "variable_indices": [],  # 没有变量时为空列表
            "prompts": final_prompts_for_subtask,
            **base_params_for_subtask_template
        }

        subtask = Subtask(**subtask_payload)
        subtasks_to_create.append(subtask)
    else:
        # 有变量时的正常流程
        for spatial_coordinates_tuple in itertools.product(*index_ranges):
            # 为当前子任务深拷贝基础模板
            current_subtask_prompts_list = deepcopy(base_prompts_for_subtask_template)
            current_subtask_params_dict = deepcopy(base_params_for_subtask_template)

            # 3a. 根据当前空间坐标点 (`spatial_coordinates_tuple`) 填充变量值
            #     `dimension_idx` 即为"维度索引" (0, 1, 2, ...)，
            #     它对应 `active_variables_list` 中的索引。
            for dimension_idx, chosen_value_index_for_this_dim in enumerate(spatial_coordinates_tuple):
                active_var_info = active_variables_list[dimension_idx]
                current_variable_id = active_var_info.variable_id
                chosen_value = active_var_info.possible_values[chosen_value_index_for_this_dim]

                # 在子任务模板中查找此 variable_id 并应用/替换值

                variable_applied = False
                # 尝试在提示词中应用
                for i, original_task_prompt in enumerate(task_obj.prompts):
                    if original_task_prompt.is_variable and original_task_prompt.variable_id == current_variable_id:
                        # `chosen_value` 此时应该是一个 ConstantPrompt 对象
                        if not isinstance(chosen_value, ConstantPrompt):
                            logger.error(f"Mismatched type for prompt variable {current_variable_id}. Expected ConstantPrompt, got {type(chosen_value)}")
                            # Potentially raise error or skip
                            continue
                        current_subtask_prompts_list[i] = chosen_value.model_dump()
                        variable_applied = True
                        break # variable_id 在 prompts 中是唯一的

                if variable_applied:
                    continue

                # 尝试在参数中应用
                for param_name_candidate in configurable_parameters_names:
                    original_task_param: TaskParameter = getattr(task_obj, param_name_candidate)
                    if original_task_param.is_variable and original_task_param.variable_id == current_variable_id:
                        current_subtask_params_dict[param_name_candidate] = chosen_value
                        variable_applied = True
                        break # variable_id 在 parameters 中是唯一的 (且与prompts中的不同)

                if not variable_applied:
                    logger.warning(f"Task {task_obj.id}: Variable ID '{current_variable_id}' from active_variables_list "
                                   f"was not found or applied to any part of the subtask template.")

            final_prompts_for_subtask: List[Dict[str, Any]]
            if not task_obj.prompts:
                final_prompts_for_subtask = []
            else:
                # 确保所有 None (代表变量提示词的原始位置) 都被填充了
                if any(p_dict is None for i, p_dict in enumerate(current_subtask_prompts_list) if task_obj.prompts[i].is_variable):
                    # 找到未填充的变量提示词
                    missing_vars = []
                    for i, p_dict in enumerate(current_subtask_prompts_list):
                        if task_obj.prompts[i].is_variable and p_dict is None:
                            missing_vars.append(task_obj.prompts[i].variable_id)
                    logger.error(
                        f"任务 {task_obj.id}, 子任务 (空间坐标: {spatial_coordinates_tuple}): "
                        f"部分变量提示词未被填充: {missing_vars}. 当前提示词列表: {current_subtask_prompts_list}"
                    )
                    # 这通常指示逻辑错误，比如 active_variables_list 和 task_obj 的变量定义不匹配
                    # 或者 variable_id 在填充时没有正确匹配
                    raise ValueError("逻辑错误：并非所有变量提示词槽都为子任务填充完毕。")

                # 过滤掉None值和value为空的提示词
                def is_valid_prompt(p_dict):
                    if p_dict is None:
                        return False
                    # 检查value字段是否为空
                    value = p_dict.get('value')
                    if value is None or value == "":
                        return False
                    return True

                # 记录过滤前后的提示词数量
                original_count = len([p for p in current_subtask_prompts_list if p is not None])
                final_prompts_for_subtask = [p for p in current_subtask_prompts_list if is_valid_prompt(p)]
                filtered_count = len(final_prompts_for_subtask)

                if original_count != filtered_count:
                    logger.info(f"任务 {task_obj.id}, 子任务 (空间坐标: {spatial_coordinates_tuple}): "
                               f"过滤掉 {original_count - filtered_count} 个空值提示词，"
                               f"最终保留 {filtered_count} 个有效提示词")
                # 如果允许某些提示词在某些子任务中完全不存在（而不是仅值不同），则上面的None检查需要调整

            # 4. 准备 Subtask 数据并创建对象
            subtask_payload = {
                "task": task_obj,
                "variable_indices": list(spatial_coordinates_tuple),
                "prompts": final_prompts_for_subtask, # 确保这里的prompts是List[Dict]
                **current_subtask_params_dict
            }

            subtask = Subtask(**subtask_payload)
            subtasks_to_create.append(subtask)

    return subtasks_to_create

@dramatiq.actor(
    queue_name="test_master",  # 使用标准队列
    max_retries=settings.MAX_RETRIES,
    time_limit=3600000,  # 3600秒 (1小时)，考虑到可能需要等待执行槽位
)
def test_submit_master(task_id: str, task_data: Dict[str, Any]):
    """
    测试任务提交Actor，验证任务数据并存储到数据库，并将子任务发送到Dramatiq队列

    流程：
    1. 初始化任务数据并以pending状态保存到数据库
    2. 创建子任务并保存到数据库
    3. 等待执行槽位（10分钟内没有其他正在执行的任务）
    4. 获取到执行槽位后，更新任务状态为processing并发送子任务到队列

    Args:
        task_id: 任务ID（可能会被替换为数据库生成的ID）
        task_data: 任务数据
    """
    logger.info(f"[{task_id}] 测试任务提交开始执行")

    # 确保数据库连接正确初始化
    try:
        # 初始化DramatiqBaseModel的数据库连接
        DramatiqBaseModel.initialize_database()
        logger.info(f"[{task_id}] DramatiqBaseModel数据库连接已初始化")

        # 同时初始化BaseModel使用的test_db_proxy，因为User、Task、Subtask等模型继承自BaseModel
        try:
            from backend.core.app import initialize_app
            initialize_app()
            logger.info("BaseModel数据库连接已初始化")
        except Exception as base_init_error:
            logger.error(f"初始化BaseModel数据库连接失败: {str(base_init_error)}")
            raise

    except Exception as db_init_error:
        logger.error(f"[{task_id}] 数据库初始化失败: {str(db_init_error)}")
        raise

    try:
        # 初始化任务数据（此时任务状态为pending）
        task_obj = initialize_data(task_id, task_data)

        # 插入主任务到数据库
        insert_master_task_to_db(task_obj)

        # 发送飞书通知 - 任务已提交
        try:
            # 生成前端详细页面URL
            frontend_url = f"{settings.FRONTEND_BASE_URL}/model-testing/history/{task_obj.id}"

            feishu_task_notify(
                event_type="task_submitted",
                task_id=str(task_obj.id),
                task_name=task_obj.name,
                submitter=task_obj.user.username if task_obj.user else None,
                details={
                    "状态": "等待中",
                },
                message="任务已提交，等待执行槽位",
                frontend_url=frontend_url
            )
        except Exception as e:
            # 飞书通知失败不影响主流程
            logger.warning(f"发送飞书通知失败: {str(e)}")

        # 创建子任务
        subtasks_to_create = create_subtasks_from_task(task_obj)

        # 刷新任务对象以确保variables_map已更新
        # 重新查询数据库获取最新数据
        updated_task = Task.get_or_none(Task.id == task_obj.id)
        if updated_task:
            task_obj = updated_task
        logger.info(f"[{task_id}] 子任务创建完成，variables_map已更新: {len(task_obj.variables_map)} 个变量")

        # 批量插入子任务到数据库
        insert_subtasks_to_db(subtasks_to_create)

        # 等待执行槽位（10分钟内没有其他正在执行的任务）
        if not wait_for_execution_slot(task_obj):
            # 如果无法获取执行槽位（超时或任务被取消）
            # 重新查询数据库获取最新状态
            current_task = Task.get_or_none(Task.id == task_obj.id)

            # 如果任务已被取消，直接返回
            if current_task and current_task.status == TaskStatus.CANCELLED.value:
                logger.info(f"[{task_id}] 任务已被取消，不再继续处理")
                return {
                    "status": "cancelled",
                    "task_id": str(task_obj.id),
                    "message": "任务已被取消"
                }

            # 如果是因为超时无法获取执行槽位，将任务标记为失败
            update_task_status(task_obj, TaskStatus.FAILED.value)
            error_msg = "等待执行槽位超时，无法执行任务"
            logger.error(f"[{task_id}] {error_msg}")

            # 发送飞书通知
            try:
                # 生成前端详细页面URL
                frontend_url = f"{settings.FRONTEND_BASE_URL}/model-testing/history/{task_obj.id}"

                feishu_task_notify(
                    event_type="task_failed",
                    task_id=str(task_obj.id),
                    task_name=task_obj.name,
                    submitter=task_obj.user.username if task_obj.user else None,
                    details={
                        "错误信息": error_msg,
                    },
                    message="任务等待执行槽位超时",
                    frontend_url=frontend_url
                )
            except Exception as notify_error:
                logger.warning(f"发送飞书通知失败: {str(notify_error)}")

            return {
                "status": "failed",
                "task_id": str(task_obj.id),
                "message": error_msg
            }

        # 获取到执行槽位，更新任务状态为处理中
        update_task_status(task_obj, TaskStatus.PROCESSING.value)

        # 将子任务发送到Dramatiq队列
        send_subtasks_to_dramatiq(subtasks_to_create)

        # 记录任务提交完成
        logger.info(f"[{task_id}] 测试任务提交完成，已创建并发送 {len(subtasks_to_create)} 个子任务")

        # 发送飞书通知 - 任务开始处理
        try:
            # 生成前端详细页面URL
            frontend_url = f"{settings.FRONTEND_BASE_URL}/model-testing/history/{task_obj.id}"

            feishu_task_notify(
                event_type="task_processing",
                task_id=str(task_obj.id),
                task_name=task_obj.name,
                submitter=task_obj.user.username if task_obj.user else None,
                details={
                    "子任务数量": len(subtasks_to_create),
                    "普通子任务数": sum(1 for s in subtasks_to_create if not s.is_lumina),
                    "Lumina子任务数": sum(1 for s in subtasks_to_create if s.is_lumina),
                },
                message="任务已开始处理",
                frontend_url=frontend_url
            )
        except Exception as e:
            # 飞书通知失败不影响主流程
            logger.warning(f"发送飞书通知失败: {str(e)}")

        # 启动子任务监控线程
        logger.info(f"[{task_id}] 启动子任务监控线程")
        # 使用线程而不是直接调用，避免阻塞当前任务
        monitor_thread = threading.Thread(
            target=monitor_subtasks_completion,
            args=(str(task_obj.id),),
            daemon=True  # 设置为守护线程，主线程结束时自动结束
        )
        monitor_thread.start()
        logger.info(f"[{task_id}] 子任务监控线程已启动")

        return {
            "status": "success",
            "task_id": str(task_obj.id),
            "subtask_count": len(subtasks_to_create)
        }

    except Exception as e:
        # 记录错误
        import traceback
        error_msg = f"任务提交失败: {str(e)}"
        error_details = traceback.format_exc()
        logger.error(f"[{task_id}] {error_msg}\n{error_details}")

        # 尝试更新任务状态为失败
        try:
            if 'task_obj' in locals():
                update_task_status(task_obj, TaskStatus.FAILED.value)
        except Exception as update_error:
            logger.error(f"更新任务状态失败: {str(update_error)}")

        # 尝试发送飞书通知
        try:
            if 'task_obj' in locals():
                # 生成前端详细页面URL
                frontend_url = f"{settings.FRONTEND_BASE_URL}/model-testing/history/{task_obj.id}"

                feishu_task_notify(
                    event_type="task_failed",
                    task_id=str(task_obj.id),
                    task_name=task_obj.name,
                    submitter=task_obj.user.username if task_obj.user else None,
                    details={
                        "错误信息": error_msg,
                    },
                    message="任务提交失败",
                    frontend_url=frontend_url
                )
        except Exception as notify_error:
            # 飞书通知失败不影响主流程
            logger.warning(f"发送飞书通知失败: {str(notify_error)}")

        # 重新抛出异常，让dramatiq处理重试逻辑
        raise

