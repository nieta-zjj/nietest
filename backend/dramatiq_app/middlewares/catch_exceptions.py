"""
异常捕获中间件

捕获任务执行过程中的异常并记录，同时发送飞书通知
"""
import logging
import traceback
from dramatiq import Middleware
from backend.utils.feishu import feishu_notify

# 配置日志
logger = logging.getLogger(__name__)

class CatchExceptions(Middleware):
    """
    异常捕获中间件

    捕获任务执行过程中的异常并记录，同时发送飞书通知
    """

    def after_process_message(self, broker, message, *, result=None, exception=None):
        """
        消息处理后的回调函数

        Args:
            broker: 消息代理
            message: 消息对象
            result: 处理结果
            exception: 处理异常
        """
        if exception:
            # 获取任务ID
            task_id = message.kwargs.get("task_id", "未知")

            # 获取任务名称
            task_name = message.actor_name

            # 获取完整的错误栈信息
            error_stack = traceback.format_exc()

            # 记录错误日志
            logger.error(f"[{task_id}] 任务执行异常: {task_name}")
            logger.error(f"[{task_id}] 错误信息: {str(exception)}")
            logger.error(f"[{task_id}] 错误栈: {error_stack}")

            # 记录重试信息
            is_final_failure = False
            if message.options.get("retries", 0) < message.options.get("max_retries", 0):
                logger.info(f"[{task_id}] 任务将重试: {task_name}, 当前重试次数: {message.options.get('retries', 0)}")
            else:
                logger.error(f"[{task_id}] 任务达到最大重试次数，将不再重试: {task_name}")
                is_final_failure = True

            # 只有在最终失败时才发送飞书通知，避免大量重试消息
            if is_final_failure:
                # 准备详细信息
                details = {
                    "Actor": task_name,
                    "重试次数": f"{message.options.get('retries', 0)}/{message.options.get('max_retries', 0)}",
                    "队列": message.queue_name
                }

                # 发送飞书通知
                feishu_notify(
                    event_type="system_error",
                    task_id=task_id,
                    task_name=task_name,
                    details=details,
                    message=f"错误信息: {str(exception)}\n\n错误栈: {error_stack}"
                )
