"""
认证和授权模块

提供用户认证和权限检查功能
"""
import logging
from functools import wraps
from typing import Callable, List, Union, Optional
import peewee

from backend.models.db.user import User, Permission, Role
from backend.core.security import verify_password

# 配置日志
logger = logging.getLogger(__name__)


def require_permission(permission: Union[Permission, List[Permission]]):
    """
    权限检查装饰器

    用于检查用户是否具有指定权限

    Args:
        permission: 单个权限或权限列表，用户需要具有其中任意一个权限
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(user: User, *args, **kwargs):
            # 转换为列表
            permissions = [permission] if isinstance(permission, Permission) else permission

            # 检查用户是否具有任意一个指定权限
            for perm in permissions:
                if user.has_permission(perm):
                    return func(user, *args, **kwargs)

            # 没有权限，抛出异常
            raise PermissionError(f"用户 {user.username} 没有权限 {permissions}")

        return wrapper

    return decorator


def require_role(role: Union[Role, List[Role]]):
    """
    角色检查装饰器

    用于检查用户是否具有指定角色

    Args:
        role: 单个角色或角色列表，用户需要具有其中任意一个角色
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(user: User, *args, **kwargs):
            # 转换为列表
            roles = [role] if isinstance(role, Role) else role

            # 检查用户是否具有任意一个指定角色
            for r in roles:
                if user.has_role(r.value):
                    return func(user, *args, **kwargs)

            # 没有角色，抛出异常
            role_names = [r.value for r in roles]
            raise PermissionError(f"用户 {user.username} 没有角色 {role_names}")

        return wrapper

    return decorator


def get_user_by_username(username: str) -> Optional[User]:
    """
    通过用户名获取用户

    Args:
        username: 用户名

    Returns:
        用户对象，如果不存在则返回 None
    """
    try:
        # 确保数据库连接有效
        User.ensure_connection()

        # 查询用户
        return User.get(User.username == username)
    except User.DoesNotExist:
        return None
    except (peewee.InterfaceError, peewee.OperationalError, peewee.DatabaseError) as e:
        # 数据库连接错误，尝试重新连接后再次查询
        logger.error(f"数据库连接错误，尝试重新连接: {str(e)}")
        try:
            User.ensure_connection()
            return User.get(User.username == username)
        except User.DoesNotExist:
            return None
        except Exception as retry_error:
            logger.error(f"重新连接后仍然查询失败: {str(retry_error)}")
            raise e
    except Exception as e:
        logger.error(f"查询用户时发生未知错误: {str(e)}")
        raise


def authenticate_user(username: str, password: str) -> Optional[User]:
    """
    验证用户

    Args:
        username: 用户名
        password: 密码

    Returns:
        用户对象，如果验证失败则返回 None
    """
    user = get_user_by_username(username)
    if not user:
        return None

    if not verify_password(password, user.hashed_password):
        return None

    return user
