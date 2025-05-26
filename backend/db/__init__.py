"""
数据库模块

提供数据库连接和管理功能
"""
# 导出数据库代理对象
from backend.db.database import test_db_proxy

# 注意：不再直接导入initialize_test_db和close_test_db函数
# 而是在需要的地方直接从backend.db.initialization导入
# 这样可以避免循环导入问题

__all__ = ['test_db_proxy']
