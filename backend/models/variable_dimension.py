"""
变量维度映射模型模块

提供变量ID与维度索引的映射关系模型
"""
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class VariableDimension(BaseModel):
    """变量维度映射模型，用于记录变量ID与维度索引的映射关系"""
    variable_id: str = Field(..., description="变量ID")
    dimension_index: int = Field(..., description="维度索引")
    variable_name: Optional[str] = Field(None, description="变量名称")
    variable_type: Optional[str] = Field(None, description="变量类型，如prompt、ratio等")
    
    model_config = {
        "extra": "allow",  # 允许额外字段
        "json_schema_extra": {
            "example": {
                "variable_id": "1",
                "dimension_index": 0,
                "variable_name": "提示词测试a",
                "variable_type": "prompt"
            }
        }
    }
