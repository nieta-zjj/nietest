"""
任务统计服务

提供任务完成后的子任务统计功能
"""
import logging
from typing import Tuple

from backend.crud.task import task_crud
from backend.crud.subtask import subtask_crud
from backend.models.db.subtasks import SubtaskStatus
from backend.models.db.tasks import TaskStatus

logger = logging.getLogger(__name__)


def update_task_subtask_stats(task_id: str) -> Tuple[bool, str]:
    """
    更新任务的子任务统计信息

    Args:
        task_id: 任务ID

    Returns:
        Tuple[bool, str]: (是否成功, 消息)
    """
    try:
        # 获取任务
        task = task_crud.get(id=task_id)
        if not task:
            return False, f"任务不存在: {task_id}"

        # 获取该任务的所有子任务
        subtasks = list(subtask_crud.get_by_task(task_id))

        if not subtasks:
            logger.warning(f"任务 {task_id} 没有子任务")
            return True, "任务没有子任务，无需统计"

        # 统计各状态的子任务数量
        completed_count = 0
        failed_count = 0

        for subtask in subtasks:
            if subtask.status == SubtaskStatus.COMPLETED.value:
                completed_count += 1
            elif subtask.status == SubtaskStatus.FAILED.value:
                failed_count += 1

        # 更新任务的统计字段
        task.completed_subtasks = completed_count
        task.failed_subtasks = failed_count
        task.save()

        logger.info(f"任务 {task_id} 子任务统计更新完成: 完成={completed_count}, 失败={failed_count}")
        return True, f"统计更新完成: 完成={completed_count}, 失败={failed_count}"

    except Exception as e:
        error_msg = f"更新任务 {task_id} 子任务统计失败: {str(e)}"
        logger.error(error_msg)
        return False, error_msg


def batch_update_all_task_stats() -> Tuple[bool, str]:
    """
    批量更新所有任务的子任务统计信息

    Returns:
        Tuple[bool, str]: (是否成功, 消息)
    """
    try:
        # 获取所有已完成或失败的任务
        from backend.models.db.tasks import Task

        tasks = list(Task.select().where(
            Task.status.in_([TaskStatus.COMPLETED.value, TaskStatus.FAILED.value])
        ))

        updated_count = 0
        failed_count = 0

        for task in tasks:
            success, message = update_task_subtask_stats(str(task.id))
            if success:
                updated_count += 1
            else:
                failed_count += 1
                logger.error(f"更新任务 {task.id} 统计失败: {message}")

        result_msg = f"批量更新完成: 成功={updated_count}, 失败={failed_count}"
        logger.info(result_msg)
        return True, result_msg

    except Exception as e:
        error_msg = f"批量更新任务统计失败: {str(e)}"
        logger.error(error_msg)
        return False, error_msg


def auto_update_task_stats_on_completion(task_id: str) -> None:
    """
    在任务完成时自动更新子任务统计

    Args:
        task_id: 任务ID
    """
    try:
        # 获取任务
        task = task_crud.get(id=task_id)
        if not task:
            logger.warning(f"任务不存在: {task_id}")
            return

        # 只有在任务完成或失败时才更新统计
        if task.status in [TaskStatus.COMPLETED.value, TaskStatus.FAILED.value]:
            success, message = update_task_subtask_stats(task_id)
            if success:
                logger.info(f"任务 {task_id} 完成后自动更新统计: {message}")
            else:
                logger.error(f"任务 {task_id} 完成后自动更新统计失败: {message}")

    except Exception as e:
        logger.error(f"任务 {task_id} 完成后自动更新统计异常: {str(e)}")