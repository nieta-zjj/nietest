"""
任务服务模块

处理任务相关的业务逻辑
"""
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import logging

from backend.models.db.tasks import Task, TaskStatus, MakeApiQueue
from backend.models.db.subtasks import Subtask, SubtaskStatus
from backend.models.prompt import Prompt, ConstantPrompt
from backend.models.task_parameter import TaskParameter
from backend.crud.task import task_crud
from backend.crud.subtask import subtask_crud
from backend.utils.feishu import feishu_task_notify
from backend.core.config import settings

# 配置日志
logger = logging.getLogger(__name__)


class SettingField:
    """通用设置字段模型"""
    def __init__(self, value: Any = None, is_variable: bool = False, variable_id: Optional[str] = None):
        """
        初始化设置字段

        Args:
            value: 字段值
            is_variable: 是否为变量
            variable_id: 变量ID
        """
        self.value = value
        self.is_variable = is_variable
        self.variable_id = variable_id

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SettingField':
        """
        从字典创建设置字段

        Args:
            data: 字典数据

        Returns:
            设置字段对象
        """
        return cls(
            value=data.get('value'),
            is_variable=data.get('is_variable', False),
            variable_id=data.get('variable_id')
        )

    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典

        Returns:
            字典表示
        """
        return {
            'value': self.value,
            'is_variable': self.is_variable,
            'variable_id': self.variable_id
        }


def validate_setting(setting: Dict[str, Any]) -> TaskParameter:
    """
    验证设置字段格式，确保所需键存在，并转换为TaskParameter对象

    Args:
        setting: 设置字段字典

    Returns:
        处理后的TaskParameter对象

    Raises:
        ValueError: 当设置无效时抛出
    """
    # 确保必需的键存在
    if not isinstance(setting, dict):
        setting = {}

    # 准备TaskParameter所需的参数
    params = {
        'type': setting.get('type', ''),
        'value': setting.get('value'),
        'is_variable': setting.get('is_variable', False),
        'format': setting.get('format')
    }

    # 当设置为变量时，确保variable_id和variable_name不为空
    if params['is_variable']:
        if not setting.get('variable_id'):
            raise ValueError("当设置为变量时，variable_id不能为空")
        if not setting.get('variable_name'):
            raise ValueError("当设置为变量时，variable_name不能为空")

        params['variable_id'] = setting.get('variable_id')
        params['variable_name'] = setting.get('variable_name')

        # 如果有variable_values，添加到参数中
        if 'variable_values' in setting:
            params['variable_values'] = setting.get('variable_values')
    else:
        # 当设置为非变量时，确保value不为空（除非是可选字段）
        if params['value'] is None and params['type'] not in ['lumina_model_name', 'lumina_cfg', 'lumina_step']:
            raise ValueError(f"当设置为非变量时，value不能为空: {params['type']}")

        # 非变量类型不能有variable_values
        if 'variable_values' in setting:
            raise ValueError("非变量设置不能包含variable_values")

    # 创建并返回TaskParameter对象
    try:
        return TaskParameter(**params)
    except Exception as e:
        raise ValueError(f"无法创建TaskParameter对象: {str(e)}")


def validate_prompts(prompts: List[Dict[str, Any]]) -> List[Prompt]:
    """
    验证提示词列表，确保格式正确，并转换为Prompt对象

    Args:
        prompts: 提示词列表

    Returns:
        处理后的Prompt对象列表

    Raises:
        ValueError: 当提示词格式不正确时
    """
    if not isinstance(prompts, list):
        raise ValueError("prompts必须是列表类型")

    if len(prompts) == 0:
        raise ValueError("prompts不能为空")

    validated_prompts = []

    for i, prompt_data in enumerate(prompts):
        try:
            # 使用Prompt类验证每个提示词，并创建Prompt对象
            prompt_obj = Prompt(**prompt_data)
            validated_prompts.append(prompt_obj)
        except Exception as e:
            raise ValueError(f"第{i+1}个提示词无效: {str(e)}")

    return validated_prompts


def create_task(user_id: str, name: str, settings: Dict[str, Any]) -> Optional[Task]:
    """
    创建新任务

    Args:
        user_id: 用户ID
        name: 任务名称
        settings: 任务设置

    Returns:
        创建的任务，如果创建失败则返回None
    """
    try:
        # 验证必要的设置
        prompts = validate_prompts(settings.get('prompts', []))
        ratio = validate_setting(settings.get('ratio', {}))
        seed = validate_setting(settings.get('seed', {}))
        batch_size = validate_setting(settings.get('batch_size', {}))
        use_polish = validate_setting(settings.get('use_polish', {}))

        # 验证Lumina相关设置
        is_lumina = validate_setting(settings.get('is_lumina', {}))
        lumina_model_name = validate_setting(settings.get('lumina_model_name', {}))
        lumina_cfg = validate_setting(settings.get('lumina_cfg', {}))
        lumina_step = validate_setting(settings.get('lumina_step', {}))

        # 创建任务
        task_data = {
            'name': name,
            'user': user_id,
            'status': TaskStatus.PENDING.value,
            'make_api_queue': settings.get('make_api_queue', MakeApiQueue.PROD.value),
            'priority': settings.get('priority', 1),
            'prompts': prompts,
            'ratio': ratio,
            'seed': seed,
            'batch_size': batch_size,
            'use_polish': use_polish,
            'is_lumina': is_lumina,
            'lumina_model_name': lumina_model_name,
            'lumina_cfg': lumina_cfg,
            'lumina_step': lumina_step
        }

        task = task_crud.create(obj_in=task_data)
        return task
    except Exception as e:
        # 获取完整的错误栈信息
        import traceback
        error_stack = traceback.format_exc()
        logger.error(f"创建任务失败: {str(e)}\n错误栈: {error_stack}")
        return None


def update_task_status(task_id: str, status: str) -> Optional[Task]:
    """
    更新任务状态

    Args:
        task_id: 任务ID
        status: 新状态

    Returns:
        更新后的任务，如果更新失败则返回None
    """
    try:
        task = task_crud.get(id=task_id)
        if not task:
            logger.warning(f"任务不存在: {task_id}")
            return None

        # 如果设置为已完成状态，更新完成时间
        if status == TaskStatus.COMPLETED.value:
            update_data = {
                'status': status,
                'completed_at': datetime.now()
            }
        else:
            update_data = {'status': status}

        updated_task = task_crud.update(db_obj=task, obj_in=update_data)
        return updated_task
    except Exception as e:
        logger.error(f"更新任务状态失败: {str(e)}")
        return None


# 更多任务相关的业务逻辑函数可在此添加

def cancel_task(task_id: str) -> Tuple[bool, str]:
    """
    取消任务及其所有未完成的子任务

    只允许取消处于等待中(PENDING)状态的任务，不允许取消正在执行(PROCESSING)的任务

    Args:
        task_id: 任务ID

    Returns:
        (成功标志, 消息)
    """
    try:
        # 获取任务
        task = task_crud.get(id=task_id)
        if not task:
            logger.warning(f"任务不存在: {task_id}")
            return False, "任务不存在"

        # 检查任务状态
        if task.status == TaskStatus.PROCESSING.value:
            logger.warning(f"任务 {task_id} 正在执行中，不允许取消")
            return False, "任务正在执行中，不允许取消"

        # 如果任务已经是终止状态，则不需要取消
        if task.status in [TaskStatus.COMPLETED.value, TaskStatus.FAILED.value, TaskStatus.CANCELLED.value]:
            logger.warning(f"任务 {task_id} 已经是终止状态: {task.status}，无法取消")
            return False, f"任务已经是终止状态: {task.status}，无法取消"

        # 只允许取消等待中的任务
        if task.status != TaskStatus.PENDING.value:
            logger.warning(f"任务 {task_id} 状态为 {task.status}，不是等待中状态，无法取消")
            return False, f"只能取消等待中的任务，当前任务状态为: {task.status}"

        # 更新任务状态为已取消
        update_data = {
            'status': TaskStatus.CANCELLED.value,
            'completed_at': datetime.now()
        }
        updated_task = task_crud.update(db_obj=task, obj_in=update_data)

        if not updated_task:
            logger.error(f"更新任务 {task_id} 状态为已取消失败")
            return False, "更新任务状态失败"

        # 获取所有未完成的子任务
        pending_subtasks = list(Subtask.select().where(
            (Subtask.task == task_id) &
            (Subtask.status.not_in([SubtaskStatus.COMPLETED.value, SubtaskStatus.FAILED.value, SubtaskStatus.CANCELLED.value]))
        ))

        # 更新所有未完成的子任务状态为已取消
        cancelled_count = 0
        for subtask in pending_subtasks:
            updated_subtask = subtask_crud.update_status(
                id=subtask.id,
                status=SubtaskStatus.CANCELLED.value,
                error="父任务已取消"
            )
            if updated_subtask:
                cancelled_count += 1

        logger.info(f"任务 {task_id} 已取消，同时取消了 {cancelled_count} 个子任务")
        return True, f"任务已取消，同时取消了 {cancelled_count} 个子任务"
    except Exception as e:
        import traceback
        error_stack = traceback.format_exc()
        logger.error(f"取消任务 {task_id} 失败: {str(e)}\n错误栈: {error_stack}")
        return False, f"取消任务失败: {str(e)}"

# 此函数已移除，改为直接在API路由中发送任务到dramatiq

def check_and_update_task_completion(task_id: str) -> bool:
    """
    检查任务的所有子任务是否已完成或失败，并更新任务状态

    Args:
        task_id: 任务ID

    Returns:
        是否更新了任务状态
    """
    try:
        # 获取任务
        task = task_crud.get(id=task_id)
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

        logger.info(f"任务 {task_id} 子任务状态: 总数={total_subtasks}, 已完成={completed_subtasks}, "
                   f"失败={failed_subtasks}, 已取消={cancelled_subtasks}")

        # 生成前端详细页面URL
        frontend_url = f"{settings.FRONTEND_BASE_URL}/model-testing/history/{task_id}"

        # 如果所有子任务都已处理完成
        if processed_subtasks == total_subtasks:
            # 如果所有子任务都失败，则任务失败
            if failed_subtasks == total_subtasks:
                logger.warning(f"任务 {task_id} 的所有子任务都失败，将任务标记为失败")
                update_task_status(task_id, TaskStatus.FAILED.value)

                # 发送任务失败通知
                feishu_task_notify(
                    event_type='task_failed',
                    task_id=str(task_id),
                    task_name=task.name,
                    submitter=task.user.username if task.user else "未知用户",
                    details={
                        "失败数": f"{failed_subtasks}/{total_subtasks}",
                        "失败阶段": "任务执行阶段"
                    },
                    message="所有子任务均失败，请检查任务配置和服务状态",
                    frontend_url=frontend_url
                )
                return True
            # 如果所有子任务都被取消，则任务取消
            elif cancelled_subtasks == total_subtasks:
                logger.warning(f"任务 {task_id} 的所有子任务都被取消，将任务标记为取消")
                update_task_status(task_id, TaskStatus.CANCELLED.value)

                # 发送任务取消通知
                feishu_task_notify(
                    event_type='task_cancelled',
                    task_id=str(task_id),
                    task_name=task.name,
                    submitter=task.user.username if task.user else "未知用户",
                    details={
                        "取消数": f"{cancelled_subtasks}/{total_subtasks}"
                    },
                    message="所有子任务均被取消",
                    frontend_url=frontend_url
                )
                return True
            # 如果有一些子任务成功，则任务完成
            elif completed_subtasks > 0:
                logger.info(f"任务 {task_id} 的子任务已全部处理完成，将任务标记为完成")
                update_task_status(task_id, TaskStatus.COMPLETED.value)

                # 根据是否有失败的子任务决定发送哪种通知
                if failed_subtasks > 0:
                    # 发送任务部分完成通知
                    feishu_task_notify(
                        event_type='task_partial_completed',
                        task_id=str(task_id),
                        task_name=task.name,
                        submitter=task.user.username if task.user else "未知用户",
                        details={
                            "成功数": f"{completed_subtasks}/{total_subtasks}",
                            "失败数": f"{failed_subtasks}/{total_subtasks}",
                            "生成图片数": completed_subtasks
                        },
                        message="任务已部分完成，但有部分子任务失败",
                        frontend_url=frontend_url
                    )
                else:
                    # 发送任务完全成功通知
                    feishu_task_notify(
                        event_type='task_completed',
                        task_id=str(task_id),
                        task_name=task.name,
                        submitter=task.user.username if task.user else "未知用户",
                        details={
                            "完成数": f"{completed_subtasks}/{total_subtasks}",
                            "生成图片数": completed_subtasks
                        },
                        message="所有任务已成功完成",
                        frontend_url=frontend_url
                    )
                return True
            # 其他情况（所有子任务都是失败或取消的组合）
            else:
                logger.warning(f"任务 {task_id} 的子任务都是失败或取消状态，将任务标记为失败")
                update_task_status(task_id, TaskStatus.FAILED.value)

                # 发送任务失败通知
                feishu_task_notify(
                    event_type='task_failed',
                    task_id=str(task_id),
                    task_name=task.name,
                    submitter=task.user.username if task.user else "未知用户",
                    details={
                        "失败数": f"{failed_subtasks}/{total_subtasks}",
                        "取消数": f"{cancelled_subtasks}/{total_subtasks}"
                    },
                    message="任务执行失败，所有子任务都是失败或取消状态",
                    frontend_url=frontend_url
                )
                return True

        # 更新任务进度
        task_crud.update_progress(task_id)
        return False
    except Exception as e:
        logger.error(f"检查任务完成状态时出错: {task_id}, 错误: {str(e)}")
        return False