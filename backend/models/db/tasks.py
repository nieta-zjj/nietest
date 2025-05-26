"""
任务模型模块

定义与任务相关的数据库模型
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import List

from peewee import CharField, IntegerField, BooleanField, DateTimeField, ForeignKeyField, SmallIntegerField
from playhouse.postgres_ext import UUIDField, JSONField

from backend.models.db.base import BaseModel
from backend.models.db.user import User
from backend.models.prompt import Prompt
from backend.models.task_parameter import TaskParameter
from backend.models.variable_dimension import VariableDimension
from backend.models.db.extra_field import PydanticListField, PydanticModelField


class MakeApiQueue(str, Enum):
    """API队列模型"""
    PROD = ""
    OPS = "ops"
    DEV = "dev"


class TaskStatus(str, Enum):
    """任务状态枚举"""
    PENDING = "pending"       # 等待中
    PROCESSING = "processing" # 处理中
    COMPLETED = "completed"   # 已完成
    FAILED = "failed"         # 失败
    CANCELLED = "cancelled"   # 已取消


class SettingField(str, Enum):
    """设置字段枚举"""
    RATIO = "ratio"
    SEED = "seed"
    BATCH_SIZE = "batch_size"
    USER_POLISH = "use_polish"
    IS_LUMINA = "is_lumina"
    LUMINA_MODEL_NAME = "lumina_model_name"
    LUMINA_CFG = "lumina_cfg"
    LUMINA_STEP = "lumina_step"


class Task(BaseModel):
    """任务模型"""
    id = UUIDField(primary_key=True, default=uuid.uuid4)
    name = CharField(max_length=255)
    user = ForeignKeyField(User, backref='tasks')
    status = CharField(max_length=20, default=TaskStatus.PENDING.value)
    priority = SmallIntegerField(default=1)
    total_images = IntegerField(default=0)

    processed_images = IntegerField(default=0)
    progress = SmallIntegerField(default=0)

    # 新增：子任务统计字段
    completed_subtasks = IntegerField(default=0)  # 已完成的子任务数量
    failed_subtasks = IntegerField(default=0)     # 失败的子任务数量

    is_deleted = BooleanField(default=False)
    is_favorite = BooleanField(default=False)
    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(default=datetime.now)
    completed_at = DateTimeField(null=True)

    # 存储任务配置和变量信息
    prompts = PydanticListField(Prompt, default=[])

    # 存储变量ID与维度索引的映射关系
    variables = PydanticListField(VariableDimension, default=[])

    # 新增：变量映射 - 存储索引值对应的变量ID、变量名和所有变量值
    variables_map = JSONField(default={})

    # 使用PydanticModelField存储任务参数
    ratio = PydanticModelField(TaskParameter, default=TaskParameter(**{"type": 'ratio', "value": '1:1', "is_variable": False, "format": 'string'}))
    seed = PydanticModelField(TaskParameter, default=TaskParameter(**{"type": 'seed', "value": None, "is_variable": False, "format": 'int'}))
    batch_size = PydanticModelField(TaskParameter, default=TaskParameter(**{"type": 'batch_size', "value": 1, "is_variable": False, "format": 'int'}))
    use_polish = PydanticModelField(TaskParameter, default=TaskParameter(**{"type": 'use_polish', "value": False, "is_variable": False, "format": 'bool'}))
    is_lumina = PydanticModelField(TaskParameter, default=TaskParameter(**{"type": 'is_lumina', "value": False, "is_variable": False, "format": 'bool'}))
    lumina_model_name = PydanticModelField(TaskParameter, default=TaskParameter(**{"type": 'lumina_model_name', "value": None, "is_variable": False, "format": 'string'}))
    lumina_cfg = PydanticModelField(TaskParameter, default=TaskParameter(**{"type": 'lumina_cfg', "value": None, "is_variable": False, "format": 'float'}))
    lumina_step = PydanticModelField(TaskParameter, default=TaskParameter(**{"type": 'lumina_step', "value": None, "is_variable": False, "format": 'int'}))

    class Meta:
        table_name = 'nietest_tasks'
        indexes = (
            (('user',), False),  # 用户索引
            (('status',), False),  # 状态索引
            (('created_at',), False),  # 创建时间索引
            (('is_deleted',), False),  # 是否删除索引
            (('is_favorite',), False),  # 新增：收藏索引
        )
