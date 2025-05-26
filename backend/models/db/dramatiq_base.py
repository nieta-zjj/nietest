"""
Dramatiq基础模型模块

为Dramatiq工作进程提供基础模型类
"""
import logging
from peewee import Model
from backend.db.dramatiq_db import dramatiq_db_proxy

# 配置日志
logger = logging.getLogger(__name__)


class DramatiqBaseModel(Model):
    """
    Dramatiq工作进程使用的基础db模型类
    使用dramatiq_db_proxy作为数据库连接
    """
    class Meta:
        database = dramatiq_db_proxy

    @classmethod
    def initialize_database(cls):
        """
        确保数据库连接已设置
        """
        from backend.db.dramatiq_db import initialize_dramatiq_db
        initialize_dramatiq_db()

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
                logger.warning("Dramatiq数据库代理未初始化")
                return False

            # 检查连接是否关闭
            if cls._meta.database.is_closed():
                logger.warning("Dramatiq数据库连接已关闭")
                return False

            # 尝试执行一个简单的查询来测试连接
            try:
                cls._meta.database.execute_sql("SELECT 1")
                return True
            except Exception as e:
                logger.warning(f"Dramatiq数据库连接测试失败: {str(e)}")
                return False

        except Exception as e:
            logger.error(f"检查Dramatiq数据库连接时发生错误: {str(e)}")
            return False

    @classmethod
    def ensure_connection(cls):
        """
        确保数据库连接有效，如果无效则尝试重新连接
        """
        if not cls.check_database_connected():
            logger.info("Dramatiq数据库连接无效，尝试重新连接...")
            from backend.db.dramatiq_db import reconnect_dramatiq_db
            try:
                reconnect_dramatiq_db()
                logger.info("Dramatiq数据库重新连接成功")
                return True
            except Exception as e:
                logger.error(f"Dramatiq数据库重新连接失败: {str(e)}")
                return False
        return True
