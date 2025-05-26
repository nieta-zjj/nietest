"""
配置模块

存储应用的全局配置
"""
import os
from pathlib import Path
import socket
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent.parent / ".env"
print('env_path', env_path)

load_dotenv(env_path)

class Settings:
    """应用配置类"""
    def __init__(self):
        # API版本
        self.API_VERSION = "1.0.0"

        # 环境配置
        self.ENV = os.getenv("ENV", "dev")

        # 数据库配置
        self.TEST_DB_HOST = os.getenv("TEST_DB_HOST", "localhost")
        self.TEST_DB_PORT = int(os.getenv("TEST_DB_PORT", "5432"))
        self.TEST_DB_NAME = os.getenv("TEST_DB_NAME", "database")
        self.TEST_DB_USER = os.getenv("TEST_DB_USER", "postgres")
        self.TEST_DB_PASSWORD = os.getenv("TEST_DB_PASSWORD", "")

        # 数据库连接池配置
        self.TEST_DB_MAX_CONNECTIONS = int(os.getenv("TEST_DB_MAX_CONNECTIONS", "8"))
        self.TEST_DB_STALE_TIMEOUT = int(os.getenv("TEST_DB_STALE_TIMEOUT", "300"))

        # Redis配置
        self.BROKER_REDIS_URL = os.getenv("BROKER_REDIS_URL")

        # 队列配置
        # 主任务队列
        self.STANDARD_QUEUE = os.getenv("STANDARD_QUEUE", "nietest_master")  # 普通主任务队列
        self.LUMINA_QUEUE = os.getenv("LUMINA_QUEUE", "nietest_master_ops")  # Lumina主任务队列

        # 子任务队列
        self.SUBTASK_QUEUE = os.getenv("SUBTASK_QUEUE", "nietest_subtask")  # 普通子任务队列
        self.SUBTASK_OPS_QUEUE = os.getenv("SUBTASK_OPS_QUEUE", "nietest_subtask_ops")  # Lumina子任务队列

        # 容器信息
        self.CONTAINER_UUID = os.getenv("CONTAINER_UUID", socket.gethostname())
        self.DEPLOYMENT_UUID = os.getenv("DEPLOYMENT_UUID", "unknown")
        self.REGION = os.getenv("REGION", "unknown")

        # 跟踪配置
        self.ENABLE_TRACKING = False  # 禁用事件跟踪

        # 任务配置
        self.MAX_RETRIES = int(os.getenv("MAX_RETRIES", "0"))

        # 图像生成服务配置
        self.TEST_IMAGE_MAX_POLLING_ATTEMPTS = int(os.getenv("TEST_IMAGE_MAX_POLLING_ATTEMPTS", "30"))
        self.TEST_IMAGE_POLLING_INTERVAL = float(os.getenv("TEST_IMAGE_POLLING_INTERVAL", "2.0"))

        # 环境变量配置
        self.TEST_MAKE_API_TOKEN = os.getenv("TEST_MAKE_API_TOKEN")

        # JWT配置
        self.SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
        self.ALGORITHM = os.getenv("ALGORITHM", "HS256")
        self.ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 7天

        # 飞书机器人配置
        # 任务状态通知机器人（任务发送、开始、取消、失败、结束）
        self.FEISHU_TASK_WEBHOOK_URL = os.getenv("FEISHU_TASK_WEBHOOK_URL")
        # 错误调试机器人（其他错误和调试信息）
        self.FEISHU_DEBUG_WEBHOOK_URL = os.getenv("FEISHU_DEBUG_WEBHOOK_URL")
        # 保持向后兼容
        self.FEISHU_WEBHOOK_URL = os.getenv("FEISHU_WEBHOOK_URL")

        # 如果新的配置没有设置，使用旧的配置作为默认值
        if not self.FEISHU_TASK_WEBHOOK_URL:
            self.FEISHU_TASK_WEBHOOK_URL = self.FEISHU_WEBHOOK_URL
        if not self.FEISHU_DEBUG_WEBHOOK_URL:
            self.FEISHU_DEBUG_WEBHOOK_URL = self.FEISHU_WEBHOOK_URL

        # 前端地址配置
        self.FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")


# 创建全局设置实例
settings = Settings()
print('redis', settings.BROKER_REDIS_URL)

