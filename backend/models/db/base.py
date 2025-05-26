"""
基础模型模块

定义所有模型的基类
"""
import logging
from peewee import Model
from backend.db import test_db_proxy

# 配置日志
logger = logging.getLogger(__name__)


class BaseModel(Model):
    """
    基础db模型类，所有db模型都应该继承这个类
    """
    class Meta:
        # 延迟初始化数据库连接
        # 在应用启动时通过initialize_database设置
        database = test_db_proxy

    @classmethod
    def initialize_database(cls):
        """
        确保数据库连接已设置

        注意：此方法不再执行实际的初始化，
        只是为了兼容现有代码而保留
        """
        # 数据库连接已在应用启动时通过 initialize_app() 初始化
        # 此方法仅作为兼容层保留
        pass

    @classmethod
    def check_database_connected(cls):
        """
        检查数据库连接是否已建立并且未关闭

        Returns:
            bool: 数据库连接是否有效
        """
        try:
            # 检查数据库代理是否已初始化
            if cls._meta.database is None:
                logger.warning("数据库代理未初始化")
                return False

            # 检查连接是否关闭
            if cls._meta.database.is_closed():
                logger.warning("数据库连接已关闭")
                return False

            # 尝试执行一个简单的查询来测试连接
            try:
                cls._meta.database.execute_sql("SELECT 1")
                return True
            except Exception as e:
                logger.warning(f"数据库连接测试失败: {str(e)}")
                return False

        except Exception as e:
            logger.error(f"检查数据库连接时发生错误: {str(e)}")
            return False

    @classmethod
    def ensure_connection(cls):
        """
        确保数据库连接有效，如果无效则尝试重新连接
        """
        if not cls.check_database_connected():
            logger.info("数据库连接无效，尝试重新连接...")
            from backend.db.initialization import reconnect_test_db
            try:
                reconnect_test_db()
                logger.info("数据库重新连接成功")
                return True
            except Exception as e:
                logger.error(f"数据库重新连接失败: {str(e)}")
                return False
        return True
