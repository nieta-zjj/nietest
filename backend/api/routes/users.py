"""
用户管理路由模块

提供用户管理相关的API路由
"""
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from backend.api.schemas.user import UserCreate, UserResponse
from backend.api.schemas.common import APIResponse
from backend.api.deps import get_current_user, get_current_admin_user
from backend.models.db.user import User
from backend.services.user_service import (
    create_user, get_all_users, get_user_by_id, assign_roles
)
from backend.api.responses import JSONResponse

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由
router = APIRouter()

@router.get("/me", response_model=APIResponse[UserResponse])
async def read_users_me(current_user: User = Depends(get_current_user)):
    """
    获取当前登录用户的信息

    Args:
        current_user: 当前用户

    Returns:
        当前用户信息
    """
    return JSONResponse(
        content=APIResponse[UserResponse](
            code=200,
            message="success",
            data=UserResponse.model_validate(current_user)
        ).model_dump()
    )

@router.get("/{user_id}", response_model=APIResponse[UserResponse])
async def read_user(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    查询特定用户信息

    Args:
        user_id: 用户ID
        current_user: 当前用户

    Returns:
        用户信息

    Raises:
        HTTPException: 用户不存在或无权限
    """
    user = get_user_by_id(current_user, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在或无权限查看"
        )

    return JSONResponse(
        content=APIResponse[UserResponse](
            code=200,
            message="success",
            data=UserResponse.model_validate(user)
        ).model_dump()
    )

@router.get("/", response_model=APIResponse[List[UserResponse]])
async def read_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user)
):
    """
    获取用户列表 (需要管理员权限)

    Args:
        skip: 跳过的记录数
        limit: 返回的记录数
        current_user: 当前用户

    Returns:
        用户列表
    """
    users = get_all_users(current_user, skip=skip, limit=limit)

    return JSONResponse(
        content=APIResponse[List[UserResponse]](
            code=200,
            message="success",
            data=[UserResponse.model_validate(user) for user in users]
        ).model_dump()
    )

@router.post("/", response_model=APIResponse[UserResponse])
async def create_new_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_admin_user)
):
    """
    创建新用户 (需要管理员权限)

    Args:
        user_data: 用户创建数据
        current_user: 当前用户

    Returns:
        创建的用户

    Raises:
        HTTPException: 用户名已存在
    """
    try:
        user = create_user(
            username=user_data.username,
            password=user_data.password,
            roles=user_data.roles,
            current_user=current_user
        )
        return JSONResponse(
            content=APIResponse[UserResponse](
                code=200,
                message="用户创建成功",
                data=UserResponse.model_validate(user)
            ).model_dump()
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )

@router.put("/{user_id}/roles", response_model=APIResponse[UserResponse])
async def update_user_roles(
    user_id: str,
    roles: List[str],
    current_user: User = Depends(get_current_admin_user)
):
    """
    更新用户角色 (需要管理员权限)

    Args:
        user_id: 用户ID
        roles: 角色列表
        current_user: 当前用户

    Returns:
        更新后的用户

    Raises:
        HTTPException: 用户不存在或无权限
    """
    try:
        user = get_user_by_id(current_user, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )

        updated_user = assign_roles(current_user, user.username, roles)
        return JSONResponse(
            content=APIResponse[UserResponse](
                code=200,
                message="用户角色更新成功",
                data=UserResponse.model_validate(updated_user)
            ).model_dump()
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
