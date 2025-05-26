"""
通用模式模块

提供通用的响应模式
"""
from typing import Generic, TypeVar, Optional, Dict, Any
from pydantic import BaseModel, Field

from backend.utils.json_utils import sanitize_for_json

# 定义泛型类型变量
T = TypeVar('T')

class APIResponse(BaseModel, Generic[T]):
    """API响应模式"""
    code: int = Field(..., description="状态码")
    message: str = Field(..., description="响应消息")
    data: Optional[T] = Field(None, description="响应数据")

    def model_dump(self, **kwargs) -> Dict[str, Any]:
        """
        重写model_dump方法，确保特殊类型可以被序列化

        Returns:
            可序列化的字典
        """
        # 先调用父类的model_dump方法
        data = super().model_dump(**kwargs)
        # 处理特殊类型
        return sanitize_for_json(data)
