"""
测试模块响应模式

提供测试相关的API响应模式
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class SubtaskResponse(BaseModel):
    """子任务响应模式"""
    id: str = Field(..., description="子任务ID")
    task_id: str = Field(..., description="父任务ID")
    status: str = Field(..., description="子任务状态")
    variable_indices: List[int] = Field(..., description="变量索引")
    ratio: str = Field(..., description="图片宽高比")
    seed: Optional[int] = Field(None, description="随机种子")
    use_polish: bool = Field(..., description="是否使用polish")
    batch_size: int = Field(..., description="批量大小")
    is_lumina: bool = Field(..., description="是否使用lumina")
    lumina_model_name: Optional[str] = Field(None, description="lumina模型名称")
    lumina_cfg: Optional[float] = Field(None, description="lumina cfg参数")
    lumina_step: Optional[int] = Field(None, description="lumina步数")
    error: Optional[str] = Field(None, description="错误信息")
    result: Optional[str] = Field(None, description="结果URL")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    started_at: Optional[datetime] = Field(None, description="开始时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")

    model_config = {
        "from_attributes": True
    }


class TaskProgressResponse(BaseModel):
    """任务进度响应模式"""
    id: str = Field(..., description="任务ID")
    name: str = Field(..., description="任务名称")
    status: str = Field(..., description="任务状态")
    total_images: int = Field(..., description="总图像数")
    processed_images: int = Field(..., description="已处理图像数")
    progress: int = Field(..., description="进度百分比")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")

    model_config = {
        "from_attributes": True
    }


class TaskDetailResponse(TaskProgressResponse):
    """任务详情响应模式"""
    user_id: str = Field(..., description="用户ID")
    username: str = Field(..., description="用户名")
    priority: int = Field(..., description="优先级")
    prompts: List[Dict[str, Any]] = Field(..., description="提示词列表")
    ratio: Dict[str, Any] = Field(..., description="图片宽高比参数")
    seed: Dict[str, Any] = Field(..., description="随机种子参数")
    batch_size: Dict[str, Any] = Field(..., description="批量大小参数")
    use_polish: Dict[str, Any] = Field(..., description="是否使用polish参数")
    is_lumina: Dict[str, Any] = Field(..., description="是否使用lumina参数")
    lumina_model_name: Dict[str, Any] = Field(..., description="lumina模型名称参数")
    lumina_cfg: Dict[str, Any] = Field(..., description="lumina cfg参数")
    lumina_step: Dict[str, Any] = Field(..., description="lumina步数参数")
    subtasks: Optional[List[SubtaskResponse]] = Field(None, description="子任务列表")

    model_config = {
        "from_attributes": True
    }


class TaskListItem(BaseModel):
    """任务列表项响应模式"""
    id: str = Field(..., description="任务ID")
    name: str = Field(..., description="任务名称")
    username: str = Field(..., description="用户名")
    status: str = Field(..., description="任务状态")
    total_images: int = Field(..., description="总图片数")
    processed_images: int = Field(..., description="已处理图片数")
    completed_images: int = Field(0, description="已完成的子任务数")
    failed_images: int = Field(0, description="失败的子任务数")
    progress: int = Field(..., description="进度百分比")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")
    is_favorite: Optional[bool] = Field(False, description="是否收藏")
    is_deleted: Optional[bool] = Field(False, description="是否删除")

    model_config = {
        "from_attributes": True
    }


class TaskListResponse(BaseModel):
    """任务列表响应模式"""
    tasks: List[TaskListItem] = Field(..., description="任务列表")
    total: int = Field(..., description="总任务数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页大小")

    model_config = {
        "from_attributes": True
    }


class RunningTaskResponse(BaseModel):
    """运行中任务响应模式"""
    id: str = Field(..., description="任务ID")
    name: str = Field(..., description="任务名称")
    status: str = Field(..., description="任务状态")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    model_config = {
        "from_attributes": True
    }


class RunningTasksResponse(BaseModel):
    """运行中任务列表响应模式"""
    tasks: List[RunningTaskResponse] = Field(..., description="运行中任务列表")
    count: int = Field(..., description="运行中任务数量")

    model_config = {
        "from_attributes": True
    }
