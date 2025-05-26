"""子任务模型模块"""
import uuid
from datetime import datetime
from enum import Enum
from peewee import CharField, IntegerField, BooleanField, DateTimeField, ForeignKeyField, TextField, SmallIntegerField, FloatField
from playhouse.postgres_ext import UUIDField, JSONField, ArrayField
import json

from backend.models.db.base import BaseModel
from backend.models.db.tasks import Task


class SubtaskStatus(str, Enum):
    """子任务状态枚举"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Subtask(BaseModel):
    """子任务模型"""
    id = UUIDField(primary_key=True, default=uuid.uuid4)
    task = ForeignKeyField(Task, backref='subtasks')
    status = CharField(max_length=20, default=SubtaskStatus.PENDING.value)
    variable_indices = ArrayField(IntegerField)         # 子任务在父任务变量空间中的位置

    prompts = JSONField()                               # 提示词列表

    ratio = CharField(max_length=10, default='1:1')     # 图片宽高比
    seed = IntegerField(null=True)                      # 随机种子
    use_polish = BooleanField(default=False)            # 是否使用polish
    batch_size = IntegerField(default=1)                # 批量大小

    is_lumina = BooleanField(default=False)             # 是否使用lumina
    lumina_model_name = CharField(max_length=255, null=True)  # 模型名称
    lumina_cfg = FloatField(null=True)                         # 控制生成多样性（仅对lumina生效）
    lumina_step = IntegerField(null=True)                      # 步数（仅对lumina生效）

    timeout_retry_count = SmallIntegerField(default=0)  # 超时重试次数
    error_retry_count = SmallIntegerField(default=0)    # 错误重试次数
    error = TextField(null=True)                        # 最后一次错误信息

    created_at = DateTimeField(default=datetime.now)
    updated_at = DateTimeField(default=datetime.now)
    started_at = DateTimeField(null=True)
    completed_at = DateTimeField(null=True)

    result = TextField(null=True)                       # url文本
    rating = SmallIntegerField(default=0)               # 1-5评分, 0为未评分
    evaluation = ArrayField(TextField, default=[])       # 文本评价列表

    class Meta:
        table_name = 'nietest_subtasks'
        indexes = (
            (('task',), False),
            (('status',), False),
            (('created_at',), False),
            (('rating',), False),
        )

    def to_dict(self):
        """将模型实例转换为字典"""
        data = {
            'id': str(self.id),
            'task_id': str(self.task.id) if self.task else None,
            'status': self.status,
            'variable_indices': self.variable_indices,
            'prompts': self.prompts,
            'ratio': self.ratio,
            'seed': self.seed,
            'use_polish': self.use_polish,
            'batch_size': self.batch_size,
            'is_lumina': self.is_lumina,
            'lumina_model_name': self.lumina_model_name,
            'lumina_cfg': self.lumina_cfg,
            'lumina_step': self.lumina_step,
            'timeout_retry_count': self.timeout_retry_count,
            'error_retry_count': self.error_retry_count,
            'error': self.error,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'result': self.result,
            'rating': self.rating,
            'evaluation': self.evaluation,
        }
        return data

    def to_json(self):
        """将模型实例转换为 JSON 字符串"""
        return json.dumps(self.to_dict(), ensure_ascii=False)