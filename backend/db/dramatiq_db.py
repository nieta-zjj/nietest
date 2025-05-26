"""
Dramatiq数据库连接模块

提供Dramatiq工作进程使用的数据库连接初始化功能
避免循环导入问题
"""
import logging
import os
from peewee import DatabaseProxy
from playhouse.pool import PooledPostgresqlDatabase
from backend.core.config import settings

# 配置日志
logger = logging.getLogger(__name__)

# 创建一个新的数据库代理对象
dramatiq_db_proxy = DatabaseProxy()

def initialize_dramatiq_db():
    """
    为Dramatiq工作进程初始化数据库连接

    使用settings中的配置，确保配置一致性
    """
    # 从settings获取数据库配置
    db_host = settings.TEST_DB_HOST
    db_port = settings.TEST_DB_PORT
    db_name = settings.TEST_DB_NAME
    db_user = settings.TEST_DB_USER
    db_password = settings.TEST_DB_PASSWORD
    db_max_connections = max(settings.TEST_DB_MAX_CONNECTIONS, 20)  # 增加最大连接数
    db_stale_timeout = max(settings.TEST_DB_STALE_TIMEOUT, 600)     # 增加超时时间

    # 创建数据库连接
    logger.info(f"正在初始化Dramatiq数据库连接: {db_host}:{db_port}/{db_name}")
    test_db = PooledPostgresqlDatabase(
        db_name,
        user=db_user,
        password=db_password,
        host=db_host,
        port=db_port,
        max_connections=db_max_connections,
        stale_timeout=db_stale_timeout,
        timeout=30,                                                 # 连接超时30秒
        autorollback=True,
        autoconnect=True
    )

    # 初始化代理
    dramatiq_db_proxy.initialize(test_db)
    logger.info(f"Dramatiq数据库连接池已初始化: 最大连接数={db_max_connections}, 超时时间={db_stale_timeout}秒")

def close_dramatiq_db():
    """
    关闭Dramatiq数据库连接
    """
    try:
        if not dramatiq_db_proxy.is_closed():
            dramatiq_db_proxy.close()
            logger.info("Dramatiq数据库连接已关闭")
    except Exception as e:
        logger.error(f"关闭Dramatiq数据库连接时出错: {str(e)}")

def reconnect_dramatiq_db():
    """
    重新连接Dramatiq数据库
    """
    try:
        logger.info("正在重新连接Dramatiq数据库...")
        close_dramatiq_db()
        initialize_dramatiq_db()
        logger.info("Dramatiq数据库重新连接成功")
    except Exception as e:
        logger.error(f"重新连接Dramatiq数据库失败: {str(e)}")
        raise
