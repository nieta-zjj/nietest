"""
核心模块

提供应用核心功能
"""

from backend.core.config import settings
from backend.core.app import initialize_app, shutdown_app
from backend.core.security import get_password_hash, verify_password
from backend.core.auth import require_permission, require_role

# 保留延迟导入函数以兼容可能的旧代码
def get_app_functions():
    """延迟导入app相关功能"""
    return initialize_app, shutdown_app

__all__ = [
    "settings",
    "initialize_app",
    "shutdown_app",
    "get_app_functions",
    "get_password_hash",
    "verify_password",
    "require_permission",
    "require_role"
]