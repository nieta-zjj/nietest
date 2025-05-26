"""
API路由模块

包含所有API路由的定义
"""
from fastapi import APIRouter

from .auth import router as auth_router
from .users import router as users_router
from .test import router as test_router

# 创建主路由
api_router = APIRouter()

# 包含各个子路由
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(test_router, prefix="/test", tags=["test"])  # 保持原有的/test前缀
