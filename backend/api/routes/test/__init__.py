"""
测试路由模块

提供测试相关的API路由
"""
from fastapi import APIRouter

from .tasks import router as tasks_router
from .matrix import router as matrix_router

# 创建主路由
router = APIRouter()

# 包含子路由
router.include_router(tasks_router, tags=["tasks"])
router.include_router(matrix_router, tags=["matrix"])