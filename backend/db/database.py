"""
数据库连接模块

使用 Peewee 的 DatabaseProxy 对象管理数据库连接
"""
from peewee import DatabaseProxy

# 创建数据库代理对象
test_db_proxy = DatabaseProxy()
