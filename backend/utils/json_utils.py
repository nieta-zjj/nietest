"""
JSON工具模块

提供JSON序列化和反序列化的工具函数
"""
import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

class CustomJSONEncoder(json.JSONEncoder):
    """
    自定义JSON编码器，处理特殊类型
    
    支持以下类型的序列化:
    - UUID: 转换为字符串
    - datetime: 转换为ISO格式字符串
    - 具有to_dict方法的对象: 调用to_dict方法
    - 具有__dict__属性的对象: 使用__dict__属性
    """
    
    def default(self, obj: Any) -> Any:
        """
        处理特殊类型的序列化
        
        Args:
            obj: 要序列化的对象
            
        Returns:
            可序列化的对象
        """
        if isinstance(obj, uuid.UUID):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        if hasattr(obj, 'to_dict'):
            return obj.to_dict()
        if hasattr(obj, '__dict__'):
            return obj.__dict__
        return super().default(obj)


def dumps(obj: Any, **kwargs) -> str:
    """
    将对象序列化为JSON字符串
    
    Args:
        obj: 要序列化的对象
        **kwargs: 传递给json.dumps的其他参数
        
    Returns:
        JSON字符串
    """
    return json.dumps(obj, cls=CustomJSONEncoder, **kwargs)


def loads(s: Union[str, bytes], **kwargs) -> Any:
    """
    将JSON字符串反序列化为对象
    
    Args:
        s: JSON字符串
        **kwargs: 传递给json.loads的其他参数
        
    Returns:
        反序列化后的对象
    """
    return json.loads(s, **kwargs)


def sanitize_for_json(data: Any) -> Any:
    """
    递归地处理数据结构，将不可JSON序列化的类型转换为可序列化的类型
    
    Args:
        data: 要处理的数据
        
    Returns:
        处理后的数据
    """
    if isinstance(data, dict):
        return {k: sanitize_for_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_for_json(item) for item in data]
    elif isinstance(data, uuid.UUID):
        return str(data)
    elif isinstance(data, datetime):
        return data.isoformat()
    elif hasattr(data, 'to_dict'):
        return sanitize_for_json(data.to_dict())
    elif hasattr(data, '__dict__') and not isinstance(data, type):
        return sanitize_for_json(data.__dict__)
    else:
        return data
