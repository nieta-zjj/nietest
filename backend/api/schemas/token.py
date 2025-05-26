"""
令牌模式模块

提供令牌相关的响应模式
"""
from pydantic import BaseModel, Field

class Token(BaseModel):
    """令牌响应模式"""
    access_token: str = Field(..., description="访问令牌")
    token_type: str = Field(..., description="令牌类型")
    expires_in: int = Field(..., description="过期时间（秒）")
