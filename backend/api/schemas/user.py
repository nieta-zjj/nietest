"""
用户模式模块

提供用户相关的请求和响应模式
"""
from typing import List, Optional, Any
from datetime import datetime
import uuid
from pydantic import BaseModel, Field, field_validator

class UserBase(BaseModel):
    """用户基础模式"""
    username: str = Field(..., description="用户名")
    is_active: bool = Field(True, description="是否激活")

class UserCreate(UserBase):
    """用户创建模式"""
    password: str = Field(..., description="密码")
    roles: List[str] = Field(default=["user"], description="角色列表")

    @field_validator('password')
    def password_strength(cls, v):
        """验证密码强度"""
        if len(v) < 8:
            raise ValueError('密码长度必须至少为8个字符')
        return v

class UserUpdate(BaseModel):
    """用户更新模式"""
    username: Optional[str] = Field(None, description="用户名")
    password: Optional[str] = Field(None, description="密码")
    is_active: Optional[bool] = Field(None, description="是否激活")

    @field_validator('password')
    def password_strength(cls, v):
        """验证密码强度"""
        if v is not None and len(v) < 8:
            raise ValueError('密码长度必须至少为8个字符')
        return v

class UserResponse(UserBase):
    """用户响应模式"""
    id: str = Field(..., description="用户ID")
    roles: List[str] = Field(..., description="角色列表")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    model_config = {
        "from_attributes": True
    }

    @field_validator('id', mode='before')
    @classmethod
    def validate_id(cls, v):
        """将UUID转换为字符串"""
        if isinstance(v, uuid.UUID):
            return str(v)
        return v
