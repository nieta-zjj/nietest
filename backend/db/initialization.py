"""
数据库初始化模块

提供数据库连接的初始化和关闭功能
"""
import logging
from playhouse.pool import PooledPostgresqlDatabase
from backend.core.config import settings
from backend.db.database import test_db_proxy

# 配置日志
logger = logging.getLogger(__name__)

def initialize_test_db():
    """
    初始化测试数据库连接

    使用配置中的测试数据库设置初始化数据库代理对象
    """
    test_db = PooledPostgresqlDatabase(
        settings.TEST_DB_NAME,
        user=settings.TEST_DB_USER,
        password=settings.TEST_DB_PASSWORD,
        host=settings.TEST_DB_HOST,
        port=settings.TEST_DB_PORT,
        max_connections=max(settings.TEST_DB_MAX_CONNECTIONS, 20),  # 增加最大连接数
        stale_timeout=max(settings.TEST_DB_STALE_TIMEOUT, 600),     # 增加超时时间到10分钟
        timeout=30,                                                 # 连接超时30秒
        autorollback=True,
        autoconnect=True
    )
    test_db_proxy.initialize(test_db)
    logger.info(f"数据库连接池已初始化: 最大连接数={max(settings.TEST_DB_MAX_CONNECTIONS, 20)}, 超时时间={max(settings.TEST_DB_STALE_TIMEOUT, 600)}秒")
    return test_db

def close_test_db():
    """
    关闭测试数据库连接
    """
    try:
        if not test_db_proxy.is_closed():
            test_db_proxy.close()
            logger.info("数据库连接已关闭")
    except Exception as e:
        logger.error(f"关闭数据库连接时出错: {str(e)}")

def reconnect_test_db():
    """
    重新连接数据库
    """
    try:
        logger.info("正在重新连接数据库...")
        close_test_db()
        initialize_test_db()
        logger.info("数据库重新连接成功")
    except Exception as e:
        logger.error(f"重新连接数据库失败: {str(e)}")
        raise
