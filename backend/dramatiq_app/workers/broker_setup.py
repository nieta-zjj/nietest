"""
Dramatiq代理设置模块

初始化Dramatiq代理和中间件
"""
import logging
import dramatiq
from dramatiq.brokers.redis import RedisBroker
from dramatiq.middleware import CurrentMessage, Retries, TimeLimit

from backend.core.config import settings
from backend.dramatiq_app.middlewares.task_tracker import TaskTracker
from backend.dramatiq_app.middlewares.catch_exceptions import CatchExceptions
from backend.models.db.dramatiq_base import DramatiqBaseModel

# 配置日志
logger = logging.getLogger(__name__)

middlewares = [
    CurrentMessage(),
    Retries(min_backoff=1000, max_backoff=900000, max_retries=5),
    TimeLimit(time_limit=3600000),  # 默认时间限制为1小时
    TaskTracker(),
    CatchExceptions()
]

# 初始化Redis代理
broker = RedisBroker(
    url=settings.BROKER_REDIS_URL,
    middleware=middlewares,
    # 添加额外的Redis选项，提高稳定性
    socket_connect_timeout=10,
    socket_keepalive=True,
    retry_on_timeout=True,
    health_check_interval=30
)

# 设置全局代理
dramatiq.set_broker(broker)

# 初始化数据库连接
try:
    logger.info("正在初始化数据库连接...")
    DramatiqBaseModel.initialize_database()
    logger.info("数据库连接初始化成功")
except Exception as e:
    logger.error(f"数据库连接初始化失败: {str(e)}")
    raise

logger.info(f'设置Dramatiq代理: {settings.BROKER_REDIS_URL}')



