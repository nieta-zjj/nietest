"""
用户服务模块

提供用户相关的业务逻辑
"""
import logging
from typing import List, Optional, Dict, Any, Set
from datetime import datetime

from backend.models.db.user import User, Role, Permission
from backend.core.security import get_password_hash
from backend.core.auth import require_permission

# 配置日志
logger = logging.getLogger(__name__)


def create_user(username: str, password: str, roles: List[str] = None, current_user: Optional[User] = None) -> User:
    """
    创建用户

    如果指定了current_user，则检查权限：
    - 创建普通用户不需要特殊权限
    - 创建高级用户、管理员或超级管理员需要GLOBAL_CREATE_USER权限

    Args:
        username: 用户名
        password: 密码
        roles: 角色列表，默认为普通用户
        current_user: 当前用户，如果为None则跳过权限检查（用于系统初始化）

    Returns:
        创建的用户对象

    Raises:
        ValueError: 用户名已存在
        PermissionError: 没有创建特定角色用户的权限
    """
    # 检查用户名是否已存在
    if User.select().where(User.username == username).exists():
        raise ValueError(f"用户名 {username} 已存在")

    # 设置默认角色
    if not roles:
        roles = [Role.USER.value]

    # 权限检查
    if current_user is not None:
        # 检查是否包含需要特殊权限的角色
        special_roles = [Role.PRO_USER.value, Role.MANAGER.value, Role.ADMIN.value]
        has_special_role = any(role in special_roles for role in roles)

        if has_special_role and not current_user.has_permission(Permission.GLOBAL_CREATE_USER):
            raise PermissionError(f"用户 {current_user.username} 没有创建特殊角色用户的权限")

        logger.info(f"用户 {current_user.username} 正在创建新用户 {username}")

    # 创建用户
    user = User.create(
        username=username,
        hashed_password=get_password_hash(password),
        roles=roles,
        is_active=True,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    logger.info(f"创建用户成功: {username}, 角色: {roles}")
    return user


@require_permission(Permission.GLOBAL_ASSIGN_PERMISSIONS)
def assign_roles(user: User, target_username: str, roles: List[str]) -> User:
    """
    分配角色

    Args:
        user: 当前用户（需要有分配权限的权限）
        target_username: 目标用户名
        roles: 角色列表

    Returns:
        更新后的用户对象
    """
    # 获取目标用户
    try:
        target_user = User.get(User.username == target_username)
    except User.DoesNotExist:
        raise ValueError(f"用户 {target_username} 不存在")

    # 更新角色
    target_user.roles = roles
    target_user.updated_at = datetime.now()
    target_user.save()

    logger.info(f"用户 {user.username} 为用户 {target_username} 分配角色: {roles}")
    return target_user


@require_permission([Permission.GLOBAL_ASSIGN_PERMISSIONS, Permission.GLOBAL_CREATE_USER])
def get_all_users(user: User, skip: int = 0, limit: int = 100) -> List[User]:
    """
    获取所有用户

    Args:
        user: 当前用户（需要有管理用户的权限）
        skip: 跳过的记录数
        limit: 返回的最大记录数

    Returns:
        用户列表
    """
    logger.info(f"用户 {user.username} 获取用户列表")
    return list(User.select().offset(skip).limit(limit))


def get_user_by_id(user: User, user_id: str) -> Optional[User]:
    """
    通过ID获取用户

    用户只能查看自己的信息，除非拥有管理权限

    Args:
        user: 当前用户
        user_id: 目标用户ID

    Returns:
        用户对象，如果不存在或无权限则返回 None
    """
    try:
        target_user = User.get_by_id(user_id)

        # 检查权限：用户只能查看自己的信息，除非拥有管理权限
        if str(user.id) == user_id or user.has_permission(Permission.GLOBAL_ASSIGN_PERMISSIONS) or user.has_permission(Permission.GLOBAL_CREATE_USER):
            return target_user
        else:
            logger.warning(f"用户 {user.username} 尝试查看用户 {user_id} 的信息，但没有权限")
            return None
    except User.DoesNotExist:
        return None


def get_user_permissions(user: User, target_username: str) -> Set[Permission]:
    """
    获取用户权限

    用户只能查看自己的权限，除非拥有管理权限

    Args:
        user: 当前用户
        target_username: 目标用户名

    Returns:
        权限集合，如果无权限则返回空集合
    """
    # 检查权限：用户只能查看自己的权限，除非拥有管理权限
    if user.username == target_username or user.has_permission(Permission.GLOBAL_ASSIGN_PERMISSIONS):
        try:
            target_user = User.get(User.username == target_username)
            return target_user.get_permissions()
        except User.DoesNotExist:
            logger.warning(f"用户 {target_username} 不存在")
            return set()
    else:
        logger.warning(f"用户 {user.username} 尝试查看用户 {target_username} 的权限，但没有权限")
        return set()


@require_permission(Permission.GLOBAL_CREATE_USER)
def create_admin_user(user: User, username: str, password: str) -> User:
    """
    创建管理员用户

    Args:
        user: 当前用户（需要有创建用户的权限）
        username: 用户名
        password: 密码

    Returns:
        创建的用户对象
    """
    return create_user(username, password, roles=[Role.ADMIN.value], current_user=user)
