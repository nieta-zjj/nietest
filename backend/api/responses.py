"""
响应模块

提供自定义的响应类
"""
from typing import Any, Dict, Optional, Union

from fastapi.responses import JSONResponse as FastAPIJSONResponse
from starlette.background import BackgroundTask

from backend.utils.json_utils import dumps


class JSONResponse(FastAPIJSONResponse):
    """
    自定义JSON响应类
    
    使用自定义的JSON编码器处理特殊类型
    """
    
    def render(self, content: Any) -> bytes:
        """
        渲染响应内容
        
        Args:
            content: 响应内容
            
        Returns:
            渲染后的字节
        """
        return dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        ).encode("utf-8")
