"""
任务跟踪中间件

跟踪任务执行状态并记录事件
"""
import logging
import time
from dramatiq import Middleware, Message
from dramatiq.middleware import TimeLimitExceeded


# 配置日志
logger = logging.getLogger(__name__)

# 简单的事件跟踪函数，仅记录日志
def track_event(event_name, params):
    """
    记录事件日志

    Args:
        event_name: 事件名称
        params: 事件参数
    """
    logger.debug(f"事件: {event_name}, 参数: {params}")

class TaskTracker(Middleware):
    """
    任务跟踪中间件

    跟踪任务执行状态并记录事件
    """

    def before_process_message(self, broker, message):
        """
        消息处理前的回调函数

        Args:
            broker: 消息代理
            message: 消息对象
        """
        # 记录处理开始时间
        message.processing_start_time = time.time() * 1000

        # 获取任务ID
        task_id = message.kwargs.get("task_id", "未知")

        # 记录日志
        logger.info(f"[{task_id}] 开始处理任务: {message.actor_name}")

        # 记录事件
        event_name = 'task.dramatiq.before_process_message'
        params = {
            'actor_name': message.actor_name,
            'queue_name': message.queue_name,
            'task_id': task_id,
            'duration': int(time.time() * 1000 - message.message_timestamp),
        }
        track_event(event_name, params)

        return message

    def after_process_message(self, broker, message, *, result=None, exception=None):
        """
        消息处理后的回调函数

        Args:
            broker: 消息代理
            message: 消息对象
            result: 处理结果
            exception: 处理异常
        """
        # 计算处理时间
        processing_time = int(time.time() * 1000 - message.processing_start_time)

        # 获取任务ID
        task_id = message.kwargs.get("task_id", "未知")

        # 记录日志
        if exception:
            if isinstance(exception, TimeLimitExceeded):
                logger.error(f"[{task_id}] 任务处理超时: {message.actor_name}, 耗时: {processing_time}ms")
            else:
                logger.error(f"[{task_id}] 任务处理失败: {message.actor_name}, 耗时: {processing_time}ms, 错误: {str(exception)}")
        else:
            logger.info(f"[{task_id}] 任务处理完成: {message.actor_name}, 耗时: {processing_time}ms")

        # 记录事件
        event_name = 'task.dramatiq.after_process_message'
        params = {
            'actor_name': message.actor_name,
            'queue_name': message.queue_name,
            'task_id': task_id,
            'processing_time': processing_time,
            'success': exception is None,
            'error': str(exception) if exception else None,
        }
        track_event(event_name, params)
