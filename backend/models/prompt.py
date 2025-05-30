from enum import Enum
from typing import Dict, Any, Optional, Union, List
from pydantic import BaseModel, Field, field_validator, model_validator


class PromptType(str, Enum):
    """提示词类型枚举"""
    FREETEXT = "freetext"                    # 自由文本
    OC_VTOKEN_ADAPTOR = "oc_vtoken_adaptor"  # 角色类型
    ELEMENTUM = "elementum"                  # 元素类型


class ConstantPrompt(BaseModel):
    """常量提示词基础模型，用于非变量类型的提示词"""
    type: str = Field(..., description="提示词类型")
    value: str = Field(..., description="提示词值")
    weight: float = Field(1.0, description="权重")
    img_url: Optional[str] = Field(None, description="图片URL", exclude_unset=True)
    uuid: Optional[str] = Field(None, description="唯一标识符", exclude_unset=True)
    name: Optional[str] = Field(None, description="提示词名称", exclude_unset=True)

    @field_validator('type')
    def validate_type(cls, v):
        """验证提示词类型"""
        if v not in [t.value for t in PromptType]:
            raise ValueError(f"不支持的提示词类型: {v}")
        return v

    def expand(self) -> Dict[str, Any]:
        """扩展常量提示词为完整的字典

        Returns:
            扩展后的提示词字典
        """
        # 基本字段
        result = {
            "type": self.type,
            "value": self.value,
            "weight": self.weight,
        }

        # FREETEXT类型只需要基本字段
        if self.type == PromptType.FREETEXT.value:
            return result

        # 非FREETEXT类型需要额外字段
        result["name"] = self.name
        result["img_url"] = self.img_url

        # 根据类型添加额外字段
        if self.type in [PromptType.OC_VTOKEN_ADAPTOR.value, PromptType.ELEMENTUM.value]:
            # 硬编码的默认值，如 "domain": "", "parent": "", "sort_index": 0 等。是固定且必须的默认值。
            result.update({
                "uuid": self.value,
                "domain": "",
                "parent": "",
                "label": None,
                "sort_index": 0,
                "status": "IN_USE",
                "polymorphi_values": {},
                "sub_type": None
            })

        return result

    model_config = {
        "extra": "allow",  # 允许额外字段
        "json_schema_extra": {
            "example": {
                "type": "freetext",
                "value": "1girl, cute",
                "weight": 1.0
            }
        }
    }


class Prompt(ConstantPrompt):
    """通用提示词模型，扩展ConstantPrompt以支持变量类型"""
    # 覆盖value字段，使其可为空
    value: Optional[str] = Field(None, description="提示词值", exclude_unset=True)
    is_variable: Optional[bool] = Field(default=None, cription="是否为变量")

    # 变量提示词特有字段
    variable_id: Optional[str] = Field(None, description="变量ID", exclude_unset=True)
    variable_name: Optional[str] = Field(None, description="变量名称", exclude_unset=True)
    variable_values: Optional[List[ConstantPrompt]] = Field(None, description="变量值列表", exclude_unset=True)

    @model_validator(mode='after')
    def validate_by_variable_type(self):
        """根据is_variable验证字段"""
        if self.is_variable:
            if not self.variable_id or not self.variable_name:
                raise ValueError(
                    f"""变量提示词必须包含variable_id和variable_name,
                        value:{self.variable_id},
                        is_variable:{self.is_variable}
                        variable_name:{self.variable_name}
                        variable_id:{self.variable_id}
                        variable_values:{self.variable_values}
                        """
                )
            if not self.variable_values:
                raise ValueError(f"变量提示词必须包含variable_values")
        elif self.is_variable is False:
            if self.variable_values:
                raise ValueError("非变量提示词不能包含variable_values")
            if not self.value:
                raise ValueError("常量提示词必须包含value")
            # if self.type != PromptType.FREETEXT.value:
            #     if not self.name:
            #         raise ValueError("非text提示词的name字段不能为空")
            #     if not self.img_url:
            #         raise ValueError("非text提示词的img_url字段不能为空")
        else:
            pass
        return self

    def expand(self) -> Dict[str, Any]:
        """扩展提示词为完整的字典，重写父类方法以处理变量情况

        Returns:
            扩展后的提示词字典

        Raises:
            ValueError: 如果提示词是变量类型
        """
        # 验证是否为常量提示词
        if self.is_variable:
            raise ValueError("变量提示词无法扩展")

        # 对于非变量类型，调用父类的扩展方法
        return super().expand()

    model_config = {
        "extra": "allow",  # 允许额外字段
        "json_schema_extra": {
            "examples": [
                {
                    "type": "freetext",
                    "value": "1girl, cute",
                    "is_variable": False,
                    "weight": 1.0
                },
                {
                    "type": "freetext",
                    "is_variable": True,
                    "variable_id": "1",
                    "variable_name": "提示词测试a",
                    "variable_values": [
                        {
                            "type": "freetext",
                            "value": "1girl, blonde hair",
                            "weight": 1.0
                        },
                        {
                            "type": "freetext",
                            "value": "1girl, brown hair",
                            "weight": 1.0
                        }
                    ]
                }
            ]
        }
    }