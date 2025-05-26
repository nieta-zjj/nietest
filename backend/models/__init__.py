# 从新位置导入所有模型
from backend.models.db import (
    BaseModel,
    User, Permission, ROLE_ADDITIONAL_PERMISSIONS, ROLE_HIERARCHY,
    Task, TaskStatus, MakeApiQueue, SettingField,
    Subtask, SubtaskStatus
)
from backend.models.prompt import Prompt, PromptType, ConstantPrompt
from backend.models.task_parameter import TaskParameter
from backend.models.variable import Variable

__all__ = [
    'BaseModel',
    'User', 'Permission', 'ROLE_ADDITIONAL_PERMISSIONS', 'ROLE_HIERARCHY',
    'Task', 'TaskStatus', 'MakeApiQueue', 'SettingField',
    'Subtask', 'SubtaskStatus',
    'Prompt', 'PromptType', 'ConstantPrompt',
    'TaskParameter', 'Variable'
]
