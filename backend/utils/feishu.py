"""
飞书通知工具模块

该模块提供了发送飞书通知的功能，支持两个不同的机器人：
1. 任务状态通知机器人：用于任务发送、开始、取消、失败、结束等状态通知
2. 错误调试机器人：用于其他错误和调试信息
"""

import logging
import threading
import requests
from datetime import datetime
from typing import Optional

from backend.core.config import settings

# 配置日志
logger = logging.getLogger(__name__)


def feishu_task_notify(event_type: str, task_id: str = None, task_name: str = None,
                      submitter: str = None, details: dict = None, message: str = None,
                      frontend_url: str = None):
    """
    发送任务状态飞书通知（使用任务状态通知机器人）

    Args:
        event_type: 事件类型，如'task_submitted', 'task_completed', 'task_failed'
        task_id: 任务ID
        task_name: 任务名称
        submitter: 提交者
        details: 详细信息字典
        message: 额外消息
        frontend_url: 前端详细页面URL
    """
    threading.Thread(target=_send_feishu_task_notify,
                    args=(event_type, task_id, task_name, submitter, details, message, frontend_url)).start()


def feishu_debug_notify(message: str, error_type: str = "system_error", details: dict = None):
    """
    发送错误调试飞书通知（使用错误调试机器人）

    Args:
        message: 错误消息
        error_type: 错误类型
        details: 详细信息字典
    """
    threading.Thread(target=_send_feishu_debug_notify,
                    args=(message, error_type, details)).start()


def feishu_notify(event_type: str, task_id: str = None, task_name: str = None,
               submitter: str = None, details: dict = None, message: str = None):
    """
    发送飞书通知（保持向后兼容）

    Args:
        event_type: 事件类型，如'task_submitted', 'task_completed', 'task_failed'
        task_id: 任务ID
        task_name: 任务名称
        submitter: 提交者
        details: 详细信息字典
        message: 额外消息
    """
    # 根据事件类型决定使用哪个机器人
    task_events = [
        'task_submitted', 'task_processing', 'task_completed',
        'task_failed', 'task_partial_completed', 'task_cancelled'
    ]

    if event_type in task_events:
        feishu_task_notify(event_type, task_id, task_name, submitter, details, message)
    else:
        feishu_debug_notify(message or f"{event_type} 事件", event_type, details)


def _send_feishu_task_notify(event_type: str, task_id: str = None, task_name: str = None,
                            submitter: str = None, details: dict = None, message: str = None,
                            frontend_url: str = None):
    """
    实际发送任务状态飞书通知的函数

    Args:
        event_type: 事件类型
        task_id: 任务ID
        task_name: 任务名称
        submitter: 提交者
        details: 详细信息字典
        message: 额外消息
        frontend_url: 前端详细页面URL
    """
    try:
        webhook_url = settings.FEISHU_TASK_WEBHOOK_URL
        if not webhook_url:
            logger.warning("任务状态通知机器人的Webhook URL未配置，跳过通知")
            return

        # 构建通知标题
        title_map = {
            'task_submitted': '🆕 任务已提交',
            'task_processing': '⏳ 任务处理中',
            'task_completed': '✅ 任务已完成',
            'task_failed': '❌ 任务失败',
            'task_partial_completed': '⚠️ 任务部分完成',
            'task_cancelled': '🚫 任务已取消',
            'test': '🔍 测试通知'
        }

        title = title_map.get(event_type, f'📢 {event_type}')

        # 构建通知内容
        content_lines = [title]

        if task_id:
            content_lines.append(f"任务ID: {task_id}")

        if task_name:
            content_lines.append(f"任务名称: {task_name}")

        if submitter:
            content_lines.append(f"提交者: {submitter}")

        # 添加详细信息
        if details:
            for key, value in details.items():
                content_lines.append(f"{key}: {value}")

        # 添加前端链接
        if frontend_url:
            content_lines.append(f"查看详情: {frontend_url}")

        # 添加额外消息
        if message:
            content_lines.append(f"\n{message}")

        # 添加时间戳
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        content_lines.append(f"\n时间: {timestamp}")

        # 合并所有内容
        full_content = "\n".join(content_lines)

        headers = {
            'Content-Type': 'application/json',
        }
        content = {
            "msg_type": "text",
            "content": {
                "text": full_content,
            }
        }

        response = requests.post(webhook_url, headers=headers, json=content)
        logger.debug(f"任务状态飞书通知发送结果: {response.status_code}, {response.text}")
    except Exception as e:
        logger.error(f"发送任务状态飞书通知失败: {str(e)}")


def _send_feishu_debug_notify(message: str, error_type: str = "system_error", details: dict = None):
    """
    实际发送错误调试飞书通知的函数

    Args:
        message: 错误消息
        error_type: 错误类型
        details: 详细信息字典
    """
    try:
        webhook_url = settings.FEISHU_DEBUG_WEBHOOK_URL
        if not webhook_url:
            logger.warning("错误调试机器人的Webhook URL未配置，跳过通知")
            return

        # 构建通知标题
        title_map = {
            'system_error': '🔥 系统错误',
            'database_error': '💾 数据库错误',
            'api_error': '🌐 API错误',
            'worker_error': '⚙️ 工作进程错误',
            'debug': '🐛 调试信息',
            'warning': '⚠️ 警告'
        }

        title = title_map.get(error_type, f'📢 {error_type}')

        # 构建通知内容
        content_lines = [title]
        content_lines.append(f"消息: {message}")

        # 添加详细信息
        if details:
            for key, value in details.items():
                content_lines.append(f"{key}: {value}")

        # 添加时间戳
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        content_lines.append(f"\n时间: {timestamp}")

        # 合并所有内容
        full_content = "\n".join(content_lines)

        headers = {
            'Content-Type': 'application/json',
        }
        content = {
            "msg_type": "text",
            "content": {
                "text": full_content,
            }
        }

        response = requests.post(webhook_url, headers=headers, json=content)
        logger.debug(f"错误调试飞书通知发送结果: {response.status_code}, {response.text}")
    except Exception as e:
        logger.error(f"发送错误调试飞书通知失败: {str(e)}")


# 保持向后兼容的函数
def _send_feishu_notify(event_type: str, task_id: str = None, task_name: str = None,
                       submitter: str = None, details: dict = None, message: str = None):
    """
    实际发送飞书通知的函数（保持向后兼容）
    """
    feishu_notify(event_type, task_id, task_name, submitter, details, message)
