/**
 * 任务相关类型定义
 */

/**
 * 任务状态枚举
 */
export enum TaskStatus {
    PENDING = "pending",
    RUNNING = "running",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled"
}

/**
 * 子任务状态枚举
 */
export enum SubtaskStatus {
    PENDING = "pending",
    RUNNING = "running",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled"
}

/**
 * 子任务响应接口
 */
export interface SubtaskResponse {
    id: string;
    task_id: string;
    status: string;
    variable_indices: number[];
    ratio: string;
    seed?: number;
    use_polish: boolean;
    batch_size: number;
    is_lumina: boolean;
    lumina_model_name?: string;
    lumina_cfg?: number;
    lumina_step?: number;
    error?: string;
    result?: string;
    created_at: string;
    updated_at: string;
    started_at?: string;
    completed_at?: string;
}

/**
 * 任务进度响应接口
 */
export interface TaskProgressResponse {
    id: string;
    name: string;
    status: string;
    total_images: number;
    processed_images: number;
    progress: number;
    created_at: string;
    updated_at: string;
    completed_at?: string;
}

/**
 * 任务详情响应接口
 */
export interface TaskDetailResponse extends TaskProgressResponse {
    user_id: string;
    username: string;
    priority: number;
    prompts: Array<Record<string, any>>;
    ratio: Record<string, any>;
    seed: Record<string, any>;
    batch_size: Record<string, any>;
    use_polish: Record<string, any>;
    is_lumina: Record<string, any>;
    lumina_model_name: Record<string, any>;
    lumina_cfg: Record<string, any>;
    lumina_step: Record<string, any>;
    subtasks?: SubtaskResponse[];
}

/**
 * 任务列表项接口
 */
export interface TaskListItem {
    id: string;
    name: string;
    username: string;
    status: string;
    total_images: number;
    processed_images: number;
    completed_images: number;
    failed_images: number;
    progress: number;
    created_at: string;
    updated_at: string;
    completed_at?: string;
    is_favorite?: boolean;
    is_deleted?: boolean;
}

/**
 * 任务列表响应接口
 */
export interface TaskListResponse {
    tasks: TaskListItem[];
    total: number;
    page: number;
    page_size: number;
    stats?: {
        total: number;
        completed: number;
        failed: number;
        cancelled: number;
        processing: number;
        pending: number;
    };
}

/**
 * 运行中任务响应接口
 */
export interface RunningTaskResponse {
    id: string;
    name: string;
    status: string;
    created_at: string;
    updated_at: string;
}

/**
 * 运行中任务列表响应接口
 */
export interface RunningTasksResponse {
    tasks: RunningTaskResponse[];
    count: number;
}

/**
 * API响应包装接口
 */
export interface APIResponse<T> {
    code: number;
    message: string;
    data: T;
}

/**
 * 空间坐标系统相关类型定义
 */

/**
 * 变量值接口 - 坐标系统中单个维度的值
 */
export interface MatrixDataVariableValue {
    id: string;
    value: string;
    type?: string;
}

/**
 * 变量定义接口 - 坐标系统中的单个维度
 */
export interface MatrixDataVariable {
    name: string;
    values: MatrixDataVariableValue[];
    values_count: number;
    tag_id?: string;
}

/**
 * 空间坐标系统数据接口
 */
export interface MatrixData {
    task_id: string;
    task_name: string;
    created_at: string;
    variables_map?: Record<string, MatrixDataVariable>; // 维度定义映射 (v0, v1, v2, ...)
    coordinates_by_indices?: Record<string, string>; // 空间坐标到图片URL的映射，统一使用简化格式 (例如 "0,1,2" -> "image_url")
}

/**
 * 表格单元格数据接口 - 降维显示的单个单元格
 */
export interface TableCellData {
    url: string;
    urls?: string[];
    xValue: string;
    yValue: string;
    coordinates: Record<string, number>; // 该单元格在空间坐标系统中的位置 (例如 {v0: 0, v1: 1})
    hasValidImage: boolean;
    errorMessage?: string; // 当子任务失败时显示的错误信息
}

/**
 * 表格行数据接口 - 降维显示的单行
 */
export interface TableRowData {
    key: string;
    rowTitle: string;
    [columnKey: string]: TableCellData | string; // 动态列，键为X轴值，值为单元格数据
}

/**
 * 维度筛选器接口 - 用于固定非XY轴的维度
 */
export interface DimensionFilter {
    dimension: string; // 维度标识 (例如 "v2")
    valueIndex: number | null; // 在该维度上固定的值索引
}