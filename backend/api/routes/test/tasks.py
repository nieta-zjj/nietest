"""
任务路由模块

提供任务相关的API路由
"""
from typing import Dict, Any, List, Optional
import time
import uuid
import json
import traceback
from fastapi import APIRouter, Depends, HTTPException, Body, BackgroundTasks, Query, Path
from datetime import datetime, timedelta

from backend.api.schemas.common import APIResponse
from backend.api.schemas.test import (
    TaskProgressResponse, TaskDetailResponse, TaskListResponse,
    TaskListItem, SubtaskResponse, RunningTasksResponse, RunningTaskResponse
)
from backend.api.deps import get_current_user
from backend.models.db.user import User
from backend.models.db.tasks import Task, TaskStatus
from backend.models.db.subtasks import Subtask, SubtaskStatus
from backend.api.responses import JSONResponse
from backend.crud.task import task_crud
from backend.crud.subtask import subtask_crud
from backend.services.task_service import cancel_task as service_cancel_task
from backend.services.custom_background import get_background_service
from backend.services.task_stats_service import update_task_subtask_stats, batch_update_all_task_stats
from backend.services.old_task_reuse import is_old_format_user, generate_old_task_reuse_config

# 配置日志
import logging
logger = logging.getLogger(__name__)

# 创建路由
router = APIRouter()

# 队列配置
QUEUE_NAME = "test_master"  # 任务队列名称


def submit_task_to_dramatiq(task_id: str, task_data: Dict[str, Any]):
    """
    后台任务：提交任务到Dramatiq队列

    使用自定义后台任务服务将任务提交到Dramatiq队列，堵塞逻辑已移至test_submit_master中
    """
    try:
        # 确保数据库连接是活跃的
        from backend.db.database import test_db_proxy
        if test_db_proxy.is_closed():
            logger.info("[后台任务] 数据库连接已关闭，尝试重新连接")
            test_db_proxy.connect()

        # 使用自定义后台任务服务提交任务到Dramatiq队列
        start_time = time.time()

        # 获取后台任务服务实例
        background_service = get_background_service()

        # 发送任务到队列
        background_service.enqueue(
            actor_name="test_submit_master",
            kwargs={"task_id": task_id, "task_data": task_data},
            queue_name=QUEUE_NAME
        )

        total_time = time.time() - start_time
        logger.info(f"[后台任务] 任务 {task_id} 已提交到Dramatiq队列，总耗时: {total_time:.4f}秒")
    except Exception as e:
        error_stack = traceback.format_exc()
        logger.error(f"[后台任务] 提交任务 {task_id} 到Dramatiq出错: {str(e)}\n错误栈: {error_stack}")


@router.post("/task", response_model=APIResponse[Dict[str, Any]])
async def submit_task(
    task_data: Dict[str, Any] = Body(...),
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_user)
):
    """
    提交任务到Dramatiq进行处理（后台异步方式）

    使用FastAPI的BackgroundTasks在响应返回后异步提交任务到Dramatiq

    Args:
        task_data: 任务数据
        background_tasks: 后台任务对象
        current_user: 当前用户

    Returns:
        任务ID和提交状态
    """
    try:
        start_time = time.time()

        # 添加用户ID到任务数据
        task_data["user_id"] = str(current_user.id)

        # 如果没有提供任务名称，使用时间点作为任务名
        if "name" not in task_data:
            task_data["name"] = "无标题任务" + datetime.now().strftime("%Y%m%d_%H%M%S")

        # 生成任务ID
        task_id = str(uuid.uuid4())

        # 添加到后台任务
        background_tasks.add_task(submit_task_to_dramatiq, task_id, task_data)

        # 记录处理时间
        total_time = time.time() - start_time
        logger.info(f"任务 {task_id} 已加入后台队列，总耗时: {total_time:.4f}秒")

        # 立即返回响应
        return JSONResponse(
            content=APIResponse[Dict[str, Any]](
                code=200,
                message="任务已加入后台队列，将异步提交到Dramatiq进行处理",
                data={
                    "task_id": task_id,
                    "queue": QUEUE_NAME
                }
            ).model_dump(),
            background=background_tasks
        )
    except Exception as e:
        # 获取完整的错误栈信息
        error_stack = traceback.format_exc()
        logger.error(f"提交任务到Dramatiq出错: {str(e)}\n错误栈: {error_stack}")

        # 在响应中包含错误栈信息
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"提交任务到Dramatiq出错: {str(e)}",
                "error_stack": error_stack
            }
        )


@router.get("/tasks/stats", response_model=APIResponse[Dict[str, int]])
async def get_tasks_stats(
    username: Optional[str] = Query(None, description="用户名过滤"),
    task_name: Optional[str] = Query(None, description="任务名搜索（部分匹配）"),
    favorite: Optional[bool] = Query(None, description="收藏状态过滤"),
    deleted: Optional[bool] = Query(None, description="删除状态过滤"),
    min_subtasks: Optional[int] = Query(None, description="最小子任务数量"),
    max_subtasks: Optional[int] = Query(None, description="最大子任务数量"),
    start_date: Optional[str] = Query(None, description="开始日期 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)")
):
    """
    获取任务统计信息

    Args:
        username: 用户名过滤
        task_name: 任务名搜索（部分匹配）
        favorite: 收藏状态过滤
        deleted: 删除状态过滤
        min_subtasks: 最小子任务数量
        max_subtasks: 最大子任务数量
        start_date: 开始日期
        end_date: 结束日期

    Returns:
        各种状态的任务统计信息
    """
    try:
        # 确保数据库连接是活跃的
        from backend.db.database import test_db_proxy

        # 重新初始化数据库连接以确保状态正确
        try:
            from backend.db.initialization import reconnect_test_db
            reconnect_test_db()
        except Exception as reconnect_error:
            logger.warning(f"重新连接数据库失败，尝试直接连接: {str(reconnect_error)}")
            if test_db_proxy.is_closed():
                test_db_proxy.connect()

        try:
            # 构建基础查询
            base_query = Task.select()

            # 添加删除状态过滤
            if deleted is not None:
                base_query = base_query.where(Task.is_deleted == deleted)
            else:
                # 默认不显示已删除的任务
                base_query = base_query.where(Task.is_deleted == False)

            # 添加收藏状态过滤
            if favorite is not None:
                base_query = base_query.where(Task.is_favorite == favorite)

            # 添加用户名过滤
            if username:
                base_query = base_query.join(User).where(User.username == username)

            # 添加任务名搜索（部分匹配）
            if task_name:
                base_query = base_query.where(Task.name.contains(task_name))

            # 添加子任务数量范围过滤
            if min_subtasks is not None:
                base_query = base_query.where(Task.total_images >= min_subtasks)

            if max_subtasks is not None:
                base_query = base_query.where(Task.total_images <= max_subtasks)

            # 添加日期范围过滤
            if start_date:
                try:
                    from datetime import datetime
                    start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
                    base_query = base_query.where(Task.created_at >= start_datetime)
                except ValueError:
                    logger.warning(f"无效的开始日期格式: {start_date}")

            if end_date:
                try:
                    from datetime import datetime, timedelta
                    end_datetime = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
                    base_query = base_query.where(Task.created_at < end_datetime)
                except ValueError:
                    logger.warning(f"无效的结束日期格式: {end_date}")

            # 计算各状态的数量
            stats = {
                'total': base_query.count(),
                'completed': base_query.where(Task.status == 'completed').count(),
                'failed': base_query.where(Task.status == 'failed').count(),
                'cancelled': base_query.where(Task.status == 'cancelled').count(),
                'processing': base_query.where(Task.status == 'processing').count(),
                'pending': base_query.where(Task.status == 'pending').count()
            }

            return APIResponse[Dict[str, int]](
                code=200,
                message="success",
                data=stats
            )

        except Exception as query_error:
            logger.error(f"查询任务统计失败: {str(query_error)}")
            return APIResponse[Dict[str, int]](
                code=500,
                message=f"查询任务统计失败: {str(query_error)}",
                data={}
            )

    except Exception as e:
        logger.error(f"获取任务统计失败: {str(e)}")
        return APIResponse[Dict[str, int]](
            code=500,
            message=f"获取任务统计失败: {str(e)}",
            data={}
        )


@router.get("/tasks", response_model=APIResponse[TaskListResponse])
async def get_tasks(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页大小"),
    status: Optional[str] = Query(None, description="任务状态过滤"),
    username: Optional[str] = Query(None, description="用户名过滤"),
    task_name: Optional[str] = Query(None, description="任务名搜索（部分匹配）"),
    favorite: Optional[bool] = Query(None, description="收藏状态过滤"),
    deleted: Optional[bool] = Query(None, description="删除状态过滤"),
    min_subtasks: Optional[int] = Query(None, description="最小子任务数量"),
    max_subtasks: Optional[int] = Query(None, description="最大子任务数量"),
    start_date: Optional[str] = Query(None, description="开始日期 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)")
):
    """
    获取任务列表

    Args:
        page: 页码
        page_size: 每页大小
        status: 任务状态过滤
        username: 用户名过滤
        task_name: 任务名搜索（部分匹配）
        favorite: 收藏状态过滤
        deleted: 删除状态过滤
        min_subtasks: 最小子任务数量
        max_subtasks: 最大子任务数量
        start_date: 开始日期
        end_date: 结束日期

    Returns:
        任务列表及分页信息
    """
    try:
        # 确保数据库连接是活跃的
        from backend.db.database import test_db_proxy

        # 重新初始化数据库连接以确保状态正确
        try:
            from backend.db.initialization import reconnect_test_db
            reconnect_test_db()
        except Exception as reconnect_error:
            logger.warning(f"重新连接数据库失败，尝试直接连接: {str(reconnect_error)}")
            if test_db_proxy.is_closed():
                test_db_proxy.connect()

        # 计算偏移量
        offset = (page - 1) * page_size

        # 直接执行查询，不使用事务包装
        task_list = []
        total = 0

        try:
            # 构建查询条件
            query = Task.select()

            # 添加删除状态过滤
            if deleted is not None:
                query = query.where(Task.is_deleted == deleted)
            else:
                # 默认不显示已删除的任务
                query = query.where(Task.is_deleted == False)

            # 添加收藏状态过滤
            if favorite is not None:
                query = query.where(Task.is_favorite == favorite)

            # 添加状态过滤
            if status:
                query = query.where(Task.status == status)

            # 添加用户名过滤
            if username:
                query = query.join(User).where(User.username == username)

            # 添加任务名搜索（部分匹配）
            if task_name:
                query = query.where(Task.name.contains(task_name))

            # 添加子任务数量范围过滤
            if min_subtasks is not None:
                query = query.where(Task.total_images >= min_subtasks)

            if max_subtasks is not None:
                query = query.where(Task.total_images <= max_subtasks)

            # 添加日期范围过滤
            if start_date:
                try:
                    from datetime import datetime
                    start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
                    query = query.where(Task.created_at >= start_datetime)
                except ValueError:
                    logger.warning(f"无效的开始日期格式: {start_date}")

            if end_date:
                try:
                    from datetime import datetime, timedelta
                    end_datetime = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
                    query = query.where(Task.created_at < end_datetime)
                except ValueError:
                    logger.warning(f"无效的结束日期格式: {end_date}")

            # 计算总数
            total = query.count()

            # 获取分页数据
            tasks = list(query.order_by(Task.created_at.desc()).limit(page_size).offset(offset))

            # 构建响应数据
            for task in tasks:
                # 获取用户名
                task_username = task.user.username if task.user else "未知用户"

                # 直接使用task表中的统计字段，不再进行实时计算以提高性能
                completed_images = getattr(task, 'completed_subtasks', 0)
                failed_images = getattr(task, 'failed_subtasks', 0)

                # 如果统计字段为空，使用processed_images作为completed_images，避免子任务查询
                if completed_images == 0 and failed_images == 0:
                    completed_images = task.processed_images
                    failed_images = max(0, task.total_images - task.processed_images) if task.status == 'failed' else 0

                # 构建任务项，包含子任务状态统计
                task_item = TaskListItem(
                    id=str(task.id),
                    name=task.name,
                    username=task_username,
                    status=task.status,
                    total_images=task.total_images,
                    processed_images=task.processed_images,
                    completed_images=completed_images,
                    failed_images=failed_images,
                    progress=task.progress,
                    created_at=task.created_at,
                    updated_at=task.updated_at,
                    completed_at=task.completed_at,
                    is_favorite=getattr(task, 'is_favorite', False),  # 安全获取is_favorite字段
                    is_deleted=getattr(task, 'is_deleted', False)  # 安全获取is_deleted字段
                )
                task_list.append(task_item)
        except Exception as query_error:
            logger.error(f"查询执行出错: {str(query_error)}")
            raise

        # 构建响应
        response = TaskListResponse(
            tasks=task_list,
            total=total,
            page=page,
            page_size=page_size
        )

        return APIResponse[TaskListResponse](
            code=200,
            message="获取任务列表成功",
            data=response
        )
    except Exception as e:
        # 获取完整的错误栈信息
        error_stack = traceback.format_exc()
        logger.error(f"获取任务列表出错: {str(e)}\n错误栈: {error_stack}")

        # 在响应中包含错误栈信息
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"获取任务列表出错: {str(e)}",
                "error_stack": error_stack
            }
        )


@router.get("/task/{task_id}", response_model=APIResponse[TaskDetailResponse])
async def get_task(
    task_id: str = Path(..., description="任务ID"),
    include_subtasks: bool = Query(False, description="是否包含子任务")
):
    """
    获取任务详情

    Args:
        task_id: 任务ID
        include_subtasks: 是否包含子任务

    Returns:
        任务详情
    """
    try:
        # 确保数据库连接是活跃的
        from backend.db.database import test_db_proxy
        if test_db_proxy.is_closed():
            logger.info("数据库连接已关闭，尝试重新连接")
            test_db_proxy.connect()

        # 使用事务包装查询，确保连接稳定
        try:
            with test_db_proxy.atomic():
                # 获取任务
                task = task_crud.get(id=task_id)
                if not task:
                    raise HTTPException(
                        status_code=404,
                        detail={"message": f"任务不存在: {task_id}"}
                    )

                # 获取子任务（如果需要）
                subtasks_data = None
                if include_subtasks:
                    subtasks = list(subtask_crud.get_by_task(task_id))
                    # 将UUID字段转换为字符串，然后进行模型验证
                    subtasks_data = []
                    for subtask in subtasks:
                        # 将subtask对象转换为字典，并确保UUID字段为字符串
                        subtask_dict = {
                            'id': str(subtask.id),
                            'task_id': str(subtask.task_id),
                            'status': subtask.status,
                            'variable_indices': subtask.variable_indices,
                            'ratio': subtask.ratio,
                            'seed': subtask.seed,
                            'use_polish': subtask.use_polish,
                            'batch_size': subtask.batch_size,
                            'is_lumina': subtask.is_lumina,
                            'lumina_model_name': subtask.lumina_model_name,
                            'lumina_cfg': subtask.lumina_cfg,
                            'lumina_step': subtask.lumina_step,
                            'error': subtask.error,
                            'result': subtask.result,
                            'created_at': subtask.created_at,
                            'updated_at': subtask.updated_at,
                            'started_at': subtask.started_at,
                            'completed_at': subtask.completed_at
                        }
                        subtasks_data.append(SubtaskResponse.model_validate(subtask_dict))

                # 构建响应数据
                response = TaskDetailResponse(
                    id=str(task.id),
                    name=task.name,
                    user_id=str(task.user.id),
                    username=task.user.username,
                    status=task.status,
                    priority=task.priority,
                    total_images=task.total_images,
                    processed_images=task.processed_images,
                    progress=task.progress,
                    created_at=task.created_at,
                    updated_at=task.updated_at,
                    completed_at=task.completed_at,
                    prompts=[prompt.model_dump() for prompt in task.prompts],
                    ratio=task.ratio.model_dump(),
                    seed=task.seed.model_dump(),
                    batch_size=task.batch_size.model_dump(),
                    use_polish=task.use_polish.model_dump(),
                    is_lumina=task.is_lumina.model_dump(),
                    lumina_model_name=task.lumina_model_name.model_dump(),
                    lumina_cfg=task.lumina_cfg.model_dump(),
                    lumina_step=task.lumina_step.model_dump(),
                    subtasks=subtasks_data
                )
        except HTTPException:
            # 直接重新抛出HTTP异常
            raise
        except Exception as query_error:
            logger.error(f"查询执行出错: {str(query_error)}")
            raise

        return APIResponse[TaskDetailResponse](
            code=200,
            message="获取任务详情成功",
            data=response
        )
    except HTTPException:
        # 直接重新抛出HTTP异常
        raise
    except Exception as e:
        # 获取完整的错误栈信息
        error_stack = traceback.format_exc()
        logger.error(f"获取任务详情出错: {str(e)}\n错误栈: {error_stack}")

        # 尝试重新初始化数据库连接
        try:
            from backend.db.initialization import reconnect_test_db
            reconnect_test_db()
            logger.info("已尝试重新初始化数据库连接")
        except Exception as db_error:
            logger.error(f"重新初始化数据库连接失败: {str(db_error)}")

        # 在响应中包含错误栈信息
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"获取任务详情出错: {str(e)}",
                "error_stack": error_stack
            }
        )


@router.get("/task/{task_id}/progress", response_model=APIResponse[TaskProgressResponse])
async def get_task_progress(
    task_id: str = Path(..., description="任务ID")
):
    """
    获取任务进度

    Args:
        task_id: 任务ID

    Returns:
        任务进度信息
    """
    try:
        # 确保数据库连接是活跃的
        from backend.db.database import test_db_proxy
        if test_db_proxy.is_closed():
            logger.info("数据库连接已关闭，尝试重新连接")
            test_db_proxy.connect()

        # 使用事务包装查询，确保连接稳定
        try:
            with test_db_proxy.atomic():
                # 获取任务
                task = task_crud.get(id=task_id)
                if not task:
                    raise HTTPException(
                        status_code=404,
                        detail={"message": f"任务不存在: {task_id}"}
                    )

                # 更新任务进度
                task = task_crud.update_progress(task_id)

                # 构建响应数据
                response = TaskProgressResponse(
                    id=str(task.id),
                    name=task.name,
                    status=task.status,
                    total_images=task.total_images,
                    processed_images=task.processed_images,
                    progress=task.progress,
                    created_at=task.created_at,
                    updated_at=task.updated_at,
                    completed_at=task.completed_at
                )
        except HTTPException:
            # 直接重新抛出HTTP异常
            raise
        except Exception as query_error:
            logger.error(f"查询执行出错: {str(query_error)}")
            raise

        return APIResponse[TaskProgressResponse](
            code=200,
            message="获取任务进度成功",
            data=response
        )
    except HTTPException:
        # 直接重新抛出HTTP异常
        raise
    except Exception as e:
        # 获取完整的错误栈信息
        error_stack = traceback.format_exc()
        logger.error(f"获取任务进度出错: {str(e)}\n错误栈: {error_stack}")

        # 尝试重新初始化数据库连接
        try:
            from backend.db.initialization import reconnect_test_db
            reconnect_test_db()
            logger.info("已尝试重新初始化数据库连接")
        except Exception as db_error:
            logger.error(f"重新初始化数据库连接失败: {str(db_error)}")

        # 在响应中包含错误栈信息
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"获取任务进度出错: {str(e)}",
                "error_stack": error_stack
            }
        )


@router.post("/task/{task_id}/cancel", response_model=APIResponse[Dict[str, Any]])
async def cancel_task(
    task_id: str = Path(..., description="任务ID")
):
    """
    取消任务及其所有未完成的子任务

    Args:
        task_id: 任务ID

    Returns:
        取消结果
    """
    try:
        # 确保数据库连接是活跃的
        from backend.db.database import test_db_proxy
        if test_db_proxy.is_closed():
            logger.info("数据库连接已关闭，尝试重新连接")
            test_db_proxy.connect()

        # 调用服务层函数取消任务
        success, message = service_cancel_task(task_id)

        if not success:
            raise HTTPException(
                status_code=400,
                detail={"message": message}
            )

        return APIResponse[Dict[str, Any]](
            code=200,
            message="任务取消成功",
            data={"task_id": task_id, "message": message}
        )
    except HTTPException:
        # 直接重新抛出HTTP异常
        raise
    except Exception as e:
        # 获取完整的错误栈信息
        error_stack = traceback.format_exc()
        logger.error(f"取消任务出错: {str(e)}\n错误栈: {error_stack}")

        # 尝试重新初始化数据库连接
        try:
            from backend.db.initialization import reconnect_test_db
            reconnect_test_db()
            logger.info("已尝试重新初始化数据库连接")
        except Exception as db_error:
            logger.error(f"重新初始化数据库连接失败: {str(db_error)}")

        # 在响应中包含错误栈信息
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"取消任务出错: {str(e)}",
                "error_stack": error_stack
            }
        )


@router.get("/running-tasks", response_model=APIResponse[RunningTasksResponse])
async def get_running_tasks():
    """
    获取所有正在执行的任务列表（不限时间范围）

    Returns:
        正在执行的任务列表
    """
    try:
        # 确保数据库连接是活跃的
        from backend.db.database import test_db_proxy
        if test_db_proxy.is_closed():
            logger.info("数据库连接已关闭，尝试重新连接")
            test_db_proxy.connect()

        # 使用事务包装查询，确保连接稳定
        running_tasks = []
        try:
            with test_db_proxy.atomic():
                # 执行查询 - 获取所有状态为"processing"的任务，不限时间范围
                running_tasks_query = Task.select().where(
                    Task.status == TaskStatus.PROCESSING.value
                )

                # 立即获取所有结果，避免游标超时
                tasks = list(running_tasks_query)

                # 构建响应数据
                for task in tasks:
                    running_task = RunningTaskResponse(
                        id=str(task.id),
                        name=task.name,
                        status=task.status,
                        created_at=task.created_at,
                        updated_at=task.updated_at
                    )
                    running_tasks.append(running_task)
        except Exception as query_error:
            logger.error(f"查询执行出错: {str(query_error)}")
            raise

        # 构建响应
        response = RunningTasksResponse(
            tasks=running_tasks,
            count=len(running_tasks)
        )

        return APIResponse[RunningTasksResponse](
            code=200,
            message="获取正在执行的任务列表成功",
            data=response
        )
    except Exception as e:
        # 获取完整的错误栈信息
        error_stack = traceback.format_exc()
        logger.error(f"获取正在执行的任务列表出错: {str(e)}\n错误栈: {error_stack}")

        # 尝试重新初始化数据库连接
        try:
            from backend.db.initialization import reconnect_test_db
            reconnect_test_db()
            logger.info("已尝试重新初始化数据库连接")
        except Exception as db_error:
            logger.error(f"重新初始化数据库连接失败: {str(db_error)}")

        # 在响应中包含错误栈信息
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"获取正在执行的任务列表出错: {str(e)}",
                "error_stack": error_stack
            }
        )


@router.post("/task/{task_id}/favorite", response_model=APIResponse[Dict[str, Any]])
async def toggle_task_favorite(
    task_id: str = Path(..., description="任务ID"),
    current_user: User = Depends(get_current_user)
):
    """
    切换任务的收藏状态

    Args:
        task_id: 任务ID
        current_user: 当前用户

    Returns:
        收藏状态
    """
    try:
        # 确保数据库连接是活跃的
        from backend.db.database import test_db_proxy

        # 重新初始化数据库连接以确保状态正确
        try:
            from backend.db.initialization import reconnect_test_db
            reconnect_test_db()
        except Exception as reconnect_error:
            logger.warning(f"重新连接数据库失败，尝试直接连接: {str(reconnect_error)}")
            if test_db_proxy.is_closed():
                test_db_proxy.connect()

        # 直接执行查询和更新，不使用事务包装
        try:
            # 获取任务
            task = task_crud.get(id=task_id)
            if not task:
                raise HTTPException(
                    status_code=404,
                    detail={"message": f"任务不存在: {task_id}"}
                )

            # 切换收藏状态
            task.is_favorite = not getattr(task, 'is_favorite', False)
            task.updated_at = datetime.now()
            task.save()

            return APIResponse[Dict[str, Any]](
                code=200,
                message="收藏状态切换成功",
                data={
                    "task_id": task_id,
                    "is_favorite": task.is_favorite
                }
            )
        except HTTPException:
            raise
        except Exception as query_error:
            logger.error(f"查询执行出错: {str(query_error)}")
            raise

    except HTTPException:
        raise
    except Exception as e:
        error_stack = traceback.format_exc()
        logger.error(f"切换收藏状态出错: {str(e)}\n错误栈: {error_stack}")
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"切换收藏状态出错: {str(e)}",
                "error_stack": error_stack
            }
        )


@router.get("/favorite-tasks", response_model=APIResponse[TaskListResponse])
async def get_favorite_tasks(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页大小"),
    current_user: User = Depends(get_current_user)
):
    """
    获取收藏的任务列表

    Args:
        page: 页码
        page_size: 每页大小
        current_user: 当前用户

    Returns:
        收藏的任务列表及分页信息
    """
    try:
        # 确保数据库连接是活跃的
        from backend.db.database import test_db_proxy

        # 重新初始化数据库连接以确保状态正确
        try:
            from backend.db.initialization import reconnect_test_db
            reconnect_test_db()
        except Exception as reconnect_error:
            logger.warning(f"重新连接数据库失败，尝试直接连接: {str(reconnect_error)}")
            if test_db_proxy.is_closed():
                test_db_proxy.connect()

        # 计算偏移量
        offset = (page - 1) * page_size

        # 直接执行查询，不使用事务包装
        task_list = []
        total = 0

        try:
            # 构建查询条件 - 只查询收藏的任务
            query = Task.select().where(
                (Task.is_deleted == False) &
                (Task.is_favorite == True)
            )

            # 计算总数
            total = query.count()

            # 获取分页数据
            tasks = list(query.order_by(Task.created_at.desc()).limit(page_size).offset(offset))

            # 构建响应数据
            for task in tasks:
                # 获取用户名
                task_username = task.user.username if task.user else "未知用户"

                # 直接使用task表中的统计字段，不再进行实时计算以提高性能
                completed_images = getattr(task, 'completed_subtasks', 0)
                failed_images = getattr(task, 'failed_subtasks', 0)

                # 如果统计字段为空，使用processed_images作为completed_images，避免子任务查询
                if completed_images == 0 and failed_images == 0:
                    completed_images = task.processed_images
                    failed_images = max(0, task.total_images - task.processed_images) if task.status == 'failed' else 0

                # 构建任务项，包含子任务状态统计
                task_item = TaskListItem(
                    id=str(task.id),
                    name=task.name,
                    username=task_username,
                    status=task.status,
                    total_images=task.total_images,
                    processed_images=task.processed_images,
                    completed_images=completed_images,
                    failed_images=failed_images,
                    progress=task.progress,
                    created_at=task.created_at,
                    updated_at=task.updated_at,
                    completed_at=task.completed_at,
                    is_favorite=getattr(task, 'is_favorite', True),  # 收藏列表中的任务默认为收藏状态
                    is_deleted=getattr(task, 'is_deleted', False)  # 安全获取is_deleted字段
                )
                task_list.append(task_item)
        except Exception as query_error:
            logger.error(f"查询执行出错: {str(query_error)}")
            raise

        # 构建响应
        response = TaskListResponse(
            tasks=task_list,
            total=total,
            page=page,
            page_size=page_size
        )

        return APIResponse[TaskListResponse](
            code=200,
            message="获取收藏任务列表成功",
            data=response
        )
    except Exception as e:
        error_stack = traceback.format_exc()
        logger.error(f"获取收藏任务列表出错: {str(e)}\n错误栈: {error_stack}")
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"获取收藏任务列表出错: {str(e)}",
                "error_stack": error_stack
            }
        )


@router.post("/task/{task_id}/delete", response_model=APIResponse[Dict[str, Any]])
async def toggle_task_delete(
    task_id: str = Path(..., description="任务ID"),
    current_user: User = Depends(get_current_user)
):
    """
    切换任务的删除状态（软删除）

    Args:
        task_id: 任务ID
        current_user: 当前用户

    Returns:
        删除状态
    """
    try:
        # 确保数据库连接是活跃的
        from backend.db.database import test_db_proxy

        # 重新初始化数据库连接以确保状态正确
        try:
            from backend.db.initialization import reconnect_test_db
            reconnect_test_db()
        except Exception as reconnect_error:
            logger.warning(f"重新连接数据库失败，尝试直接连接: {str(reconnect_error)}")
            if test_db_proxy.is_closed():
                test_db_proxy.connect()

        # 直接执行查询和更新，不使用事务包装
        try:
            # 获取任务
            task = task_crud.get(id=task_id)
            if not task:
                raise HTTPException(
                    status_code=404,
                    detail={"message": f"任务不存在: {task_id}"}
                )

            # 切换删除状态
            task.is_deleted = not getattr(task, 'is_deleted', False)
            task.updated_at = datetime.now()
            task.save()

            return APIResponse[Dict[str, Any]](
                code=200,
                message="删除状态切换成功",
                data={
                    "task_id": task_id,
                    "is_deleted": task.is_deleted
                }
            )
        except HTTPException:
            raise
        except Exception as query_error:
            logger.error(f"查询执行出错: {str(query_error)}")
            raise

    except HTTPException:
        raise
    except Exception as e:
        error_stack = traceback.format_exc()
        logger.error(f"切换删除状态出错: {str(e)}\n错误栈: {error_stack}")
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"切换删除状态出错: {str(e)}",
                "error_stack": error_stack
            }
        )


@router.post("/task/{task_id}/update-stats", response_model=APIResponse[Dict[str, Any]])
async def update_task_stats(
    task_id: str = Path(..., description="任务ID"),
    current_user: User = Depends(get_current_user)
):
    """
    更新指定任务的子任务统计信息

    Args:
        task_id: 任务ID
        current_user: 当前用户

    Returns:
        更新结果
    """
    try:
        # 确保数据库连接是活跃的
        from backend.db.database import test_db_proxy
        if test_db_proxy.is_closed():
            logger.info("数据库连接已关闭，尝试重新连接")
            test_db_proxy.connect()

        # 更新任务统计
        success, message = update_task_subtask_stats(task_id)

        if not success:
            raise HTTPException(
                status_code=400,
                detail={"message": message}
            )

        return APIResponse[Dict[str, Any]](
            code=200,
            message="任务统计更新成功",
            data={
                "task_id": task_id,
                "message": message
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        error_stack = traceback.format_exc()
        logger.error(f"更新任务统计出错: {str(e)}\n错误栈: {error_stack}")
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"更新任务统计出错: {str(e)}",
                "error_stack": error_stack
            }
        )


@router.post("/tasks/batch-update-stats", response_model=APIResponse[Dict[str, Any]])
async def batch_update_tasks_stats(
    current_user: User = Depends(get_current_user)
):
    """
    批量更新所有任务统计
    """
    try:
        # 确保数据库连接是活跃的
        from backend.db.database import test_db_proxy
        if test_db_proxy.is_closed():
            test_db_proxy.connect()

        updated_count = batch_update_all_task_stats()

        return JSONResponse(
            content=APIResponse[Dict[str, Any]](
                code=200,
                message="批量更新任务统计信息成功",
                data={
                    "updated_count": updated_count,
                    "timestamp": datetime.now().isoformat()
                }
            ).model_dump()
        )

    except Exception as e:
        error_message = f"批量更新任务统计信息失败: {str(e)}"
        logger.error(error_message)
        raise HTTPException(status_code=500, detail=error_message)


@router.post("/subtask/{subtask_id}/rating", response_model=APIResponse[Dict[str, Any]])
async def update_subtask_rating(
    subtask_id: str = Path(..., description="子任务ID"),
    rating: int = Body(..., description="评分 (1-5)"),
    current_user: User = Depends(get_current_user)
):
    """
    更新子任务评分

    Args:
        subtask_id: 子任务ID
        rating: 评分 (1-5)
        current_user: 当前用户

    Returns:
        更新结果
    """
    try:
        # 确保数据库连接是活跃的
        from backend.db.database import test_db_proxy
        if test_db_proxy.is_closed():
            test_db_proxy.connect()

        # 验证评分范围
        if not 1 <= rating <= 5:
            raise HTTPException(status_code=400, detail="评分必须在1-5之间")

        # 获取子任务
        try:
            subtask = Subtask.get(Subtask.id == subtask_id)
        except Subtask.DoesNotExist:
            raise HTTPException(status_code=404, detail=f"子任务 {subtask_id} 不存在")

        # 更新评分
        subtask.rating = rating
        subtask.updated_at = datetime.now()
        subtask.save()

        logger.info(f"用户 {current_user.username} 更新子任务 {subtask_id} 评分为 {rating}")

        return JSONResponse(
            content=APIResponse[Dict[str, Any]](
                code=200,
                message="评分更新成功",
                data={
                    "subtask_id": subtask_id,
                    "rating": rating,
                    "updated_at": subtask.updated_at.isoformat()
                }
            ).model_dump()
        )

    except HTTPException:
        raise
    except Exception as e:
        error_message = f"更新子任务评分失败: {str(e)}"
        logger.error(error_message)
        raise HTTPException(status_code=500, detail=error_message)


@router.get("/subtask/{subtask_id}/rating", response_model=APIResponse[Dict[str, Any]])
async def get_subtask_rating(
    subtask_id: str = Path(..., description="子任务ID"),
    current_user: User = Depends(get_current_user)
):
    """
    获取子任务评分

    Args:
        subtask_id: 子任务ID
        current_user: 当前用户

    Returns:
        评分信息
    """
    try:
        # 确保数据库连接是活跃的
        from backend.db.database import test_db_proxy
        if test_db_proxy.is_closed():
            test_db_proxy.connect()

        # 获取子任务
        try:
            subtask = Subtask.get(Subtask.id == subtask_id)
        except Subtask.DoesNotExist:
            raise HTTPException(status_code=404, detail=f"子任务 {subtask_id} 不存在")

        return JSONResponse(
            content=APIResponse[Dict[str, Any]](
                code=200,
                message="获取评分成功",
                data={
                    "subtask_id": subtask_id,
                    "rating": subtask.rating,
                    "evaluation": subtask.evaluation
                }
            ).model_dump()
        )

    except HTTPException:
        raise
    except Exception as e:
        error_message = f"获取子任务评分失败: {str(e)}"
        logger.error(error_message)
        raise HTTPException(status_code=500, detail=error_message)


@router.post("/subtask/{subtask_id}/evaluation", response_model=APIResponse[Dict[str, Any]])
async def add_subtask_evaluation(
    subtask_id: str = Path(..., description="子任务ID"),
    evaluation: str = Body(..., description="评价内容"),
    current_user: User = Depends(get_current_user)
):
    """
    添加子任务评价

    Args:
        subtask_id: 子任务ID
        evaluation: 评价内容
        current_user: 当前用户

    Returns:
        添加结果
    """
    try:
        # 确保数据库连接是活跃的
        from backend.db.database import test_db_proxy
        if test_db_proxy.is_closed():
            test_db_proxy.connect()

        # 验证评价内容
        if not evaluation.strip():
            raise HTTPException(status_code=400, detail="评价内容不能为空")

        # 获取子任务
        try:
            subtask = Subtask.get(Subtask.id == subtask_id)
        except Subtask.DoesNotExist:
            raise HTTPException(status_code=404, detail=f"子任务 {subtask_id} 不存在")

        # 添加评价
        current_evaluations = subtask.evaluation or []
        current_evaluations.append(evaluation.strip())

        subtask.evaluation = current_evaluations
        subtask.updated_at = datetime.now()
        subtask.save()

        logger.info(f"用户 {current_user.username} 为子任务 {subtask_id} 添加评价: {evaluation}")

        return JSONResponse(
            content=APIResponse[Dict[str, Any]](
                code=200,
                message="评价添加成功",
                data={
                    "subtask_id": subtask_id,
                    "evaluation": current_evaluations,
                    "updated_at": subtask.updated_at.isoformat()
                }
            ).model_dump()
        )

    except HTTPException:
        raise
    except Exception as e:
        error_message = f"添加子任务评价失败: {str(e)}"
        logger.error(error_message)
        raise HTTPException(status_code=500, detail=error_message)


@router.delete("/subtask/{subtask_id}/evaluation/{evaluation_index}", response_model=APIResponse[Dict[str, Any]])
async def remove_subtask_evaluation(
    subtask_id: str = Path(..., description="子任务ID"),
    evaluation_index: int = Path(..., description="评价索引"),
    current_user: User = Depends(get_current_user)
):
    """
    删除子任务评价

    Args:
        subtask_id: 子任务ID
        evaluation_index: 评价索引
        current_user: 当前用户

    Returns:
        删除结果
    """
    try:
        # 确保数据库连接是活跃的
        from backend.db.database import test_db_proxy
        if test_db_proxy.is_closed():
            test_db_proxy.connect()

        # 获取子任务
        try:
            subtask = Subtask.get(Subtask.id == subtask_id)
        except Subtask.DoesNotExist:
            raise HTTPException(status_code=404, detail=f"子任务 {subtask_id} 不存在")

        # 验证索引
        current_evaluations = subtask.evaluation or []
        if not 0 <= evaluation_index < len(current_evaluations):
            raise HTTPException(status_code=400, detail="评价索引无效")

        # 删除评价
        removed_evaluation = current_evaluations.pop(evaluation_index)

        subtask.evaluation = current_evaluations
        subtask.updated_at = datetime.now()
        subtask.save()

        logger.info(f"用户 {current_user.username} 删除子任务 {subtask_id} 的评价: {removed_evaluation}")

        return JSONResponse(
            content=APIResponse[Dict[str, Any]](
                code=200,
                message="评价删除成功",
                data={
                    "subtask_id": subtask_id,
                    "removed_evaluation": removed_evaluation,
                    "evaluation": current_evaluations,
                    "updated_at": subtask.updated_at.isoformat()
                }
            ).model_dump()
        )

    except HTTPException:
        raise
    except Exception as e:
        error_message = f"删除子任务评价失败: {str(e)}"
        logger.error(error_message)
        raise HTTPException(status_code=500, detail=error_message)


@router.get("/task/{task_id}/reuse-config", response_model=APIResponse[Dict[str, Any]])
async def get_task_reuse_config(
    task_id: str = Path(..., description="任务ID")
):
    """
    获取任务的复用配置信息（用于任务复用功能）

    与获取任务详情接口不同，此接口专门返回前端复用任务时需要的配置信息，
    包括提示词、参数设置等，但不包括子任务、进度等运行时信息。

    Args:
        task_id: 任务ID

    Returns:
        任务的复用配置信息
    """
    try:
        # 确保数据库连接是活跃的
        from backend.db.database import test_db_proxy
        if test_db_proxy.is_closed():
            logger.info("数据库连接已关闭，尝试重新连接")
            test_db_proxy.connect()

        # 使用事务包装查询，确保连接稳定
        try:
            with test_db_proxy.atomic():
                # 获取任务
                task = task_crud.get(id=task_id)
                if not task:
                    raise HTTPException(
                        status_code=404,
                        detail={"message": f"任务不存在: {task_id}"}
                    )

                # 检查是否为需要特殊处理的旧格式用户数据
                user_id = str(task.user.id) if task.user else ""
                if is_old_format_user(user_id):
                    logger.info(f"检测到旧格式用户 {user_id} 的任务 {task_id}，使用特殊处理逻辑")
                    # 使用旧格式数据处理逻辑
                    reuse_config = generate_old_task_reuse_config(task)
                else:
                    # 使用新格式数据处理逻辑（原有逻辑）
                    reuse_config = {
                        "task_id": str(task.id),
                        "task_name": task.name,
                        "name": f"复用-{task.name}",  # 前端显示用的新任务名
                        "prompts": [prompt.model_dump() for prompt in task.prompts],
                        "ratio": task.ratio.model_dump() if task.ratio else None,
                        "seed": task.seed.model_dump() if task.seed else None,
                        "use_polish": task.use_polish.model_dump() if task.use_polish else None,
                        "is_lumina": task.is_lumina.model_dump() if task.is_lumina else None,
                        "lumina_model_name": task.lumina_model_name.model_dump() if task.lumina_model_name else None,
                        "lumina_cfg": task.lumina_cfg.model_dump() if task.lumina_cfg else None,
                        "lumina_step": task.lumina_step.model_dump() if task.lumina_step else None,
                        "priority": task.priority,
                        "created_at": task.created_at,
                        "original_username": task.user.username if task.user else "未知用户",
                        "is_old_format": False
                    }

        except HTTPException:
            # 直接重新抛出HTTP异常
            raise
        except Exception as query_error:
            logger.error(f"查询执行出错: {str(query_error)}")
            raise

        return APIResponse[Dict[str, Any]](
            code=200,
            message="获取任务复用配置成功",
            data=reuse_config
        )
    except HTTPException:
        # 直接重新抛出HTTP异常
        raise
    except Exception as e:
        # 获取完整的错误栈信息
        error_stack = traceback.format_exc()
        logger.error(f"获取任务复用配置出错: {str(e)}\n错误栈: {error_stack}")

        # 在响应中包含错误栈信息
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"获取任务复用配置出错: {str(e)}",
                "error_stack": error_stack
            }
        )