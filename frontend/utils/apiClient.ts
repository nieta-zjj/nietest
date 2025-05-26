"use client";

/**
 * API客户端工具
 *
 * 提供与后端API通信的方法
 */

// 获取API基础URL
export const getApiBaseUrl = (): string => {
  // 优先使用环境变量
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL;
  }

  // 其次使用.env文件中的配置（客户端无法直接访问.env文件，需要通过NEXT_PUBLIC_前缀暴露）
  // 这里作为备选方案，实际上应该在构建时将.env中的值注入到NEXT_PUBLIC_变量中

  // 最后使用默认值
  return "http://localhost:8000";
};

// 获取完整的API路径
export const getApiUrl = (path: string): string => {
  const baseUrl = getApiBaseUrl();
  // 确保路径以/开头
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};

// API请求选项接口
interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  isFormData?: boolean;
}

// 处理API响应
const handleResponse = async (response: Response) => {
  // 检查响应状态
  if (!response.ok) {
    // 尝试解析错误响应
    try {
      const errorData = await response.json();
      throw new Error(
        errorData.message || errorData.detail || `请求失败: ${response.status}`
      );
    } catch (e) {
      // 如果无法解析JSON，则使用状态文本
      throw new Error(`请求失败: ${response.status} ${response.statusText}`);
    }
  }

  // 解析成功响应
  return await response.json();
};

// 通用API请求方法
export const apiRequest = async (
  path: string,
  options: RequestOptions = {}
) => {
  const {
    method = "GET",
    headers = {},
    body,
    isFormData = false,
  } = options;

  // 获取访问令牌
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("access_token") : null;

  // 准备请求头
  const requestHeaders: Record<string, string> = {
    ...headers,
  };

  // 如果有令牌，添加授权头
  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }

  // 如果没有指定Content-Type且不是FormData，设置默认内容类型
  if (!isFormData && body &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams) &&
    !requestHeaders["Content-Type"]) {
    requestHeaders["Content-Type"] = "application/json";
  }

  // 准备请求选项
  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
    credentials: "include",
  };

  // 添加请求体
  if (body) {
    if (body instanceof FormData || body instanceof URLSearchParams) {
      requestOptions.body = body;
    } else {
      requestOptions.body = JSON.stringify(body);
    }
  }

  // 发送请求
  try {
    const response = await fetch(getApiUrl(path), requestOptions);
    return await handleResponse(response);
  } catch (error) {
    console.error("API请求错误:", error);
    throw error;
  }
};

// 登录方法
export const login = async (username: string, password: string) => {
  // 创建 URL 编码的表单数据
  const formBody = new URLSearchParams();
  formBody.append("username", username);
  formBody.append("password", password);
  formBody.append("grant_type", "password");

  // 发送登录请求
  return await apiRequest("api/v1/auth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody,
    isFormData: false,
  });
};

// 获取当前用户信息
export const getCurrentUser = async () => {
  return await apiRequest("api/v1/users/me");
};

// 获取用户列表
export const getUsers = async (skip = 0, limit = 100) => {
  return await apiRequest(`api/v1/users/?skip=${skip}&limit=${limit}`);
};

// 创建用户
export const createUser = async (userData: any) => {
  return await apiRequest("api/v1/users/", {
    method: "POST",
    body: userData,
  });
};

// 更新用户角色
export const updateUserRoles = async (userId: string, roles: string[]) => {
  return await apiRequest(`api/v1/users/${userId}/roles`, {
    method: "PUT",
    body: roles,
  });
};

// 提交测试任务
export const submitTestTask = async (taskData: any) => {
  return await apiRequest("api/v1/test/task", {
    method: "POST",
    body: taskData,
  });
};

// 获取任务列表
export const getTasks = async (
  page = 1,
  pageSize = 10,
  status?: string,
  username?: string,
  taskName?: string,
  favorite?: boolean,
  deleted?: boolean,
  minSubtasks?: number,
  maxSubtasks?: number,
  startDate?: string,
  endDate?: string
) => {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });

  if (status) {
    params.append("status", status);
  }

  if (username) {
    params.append("username", username);
  }

  if (taskName) {
    params.append("task_name", taskName);
  }

  if (favorite !== undefined) {
    params.append("favorite", favorite.toString());
  }

  if (deleted !== undefined) {
    params.append("deleted", deleted.toString());
  }

  if (minSubtasks !== undefined) {
    params.append("min_subtasks", minSubtasks.toString());
  }

  if (maxSubtasks !== undefined) {
    params.append("max_subtasks", maxSubtasks.toString());
  }

  if (startDate) {
    params.append("start_date", startDate);
  }

  if (endDate) {
    params.append("end_date", endDate);
  }

  return await apiRequest(`api/v1/test/tasks?${params.toString()}`);
};

// 获取任务详情
export const getTask = async (taskId: string, includeSubtasks = false) => {
  const params = new URLSearchParams({
    include_subtasks: includeSubtasks.toString(),
  });

  return await apiRequest(`api/v1/test/task/${taskId}?${params.toString()}`);
};

// 获取任务复用配置信息
export const getTaskReuseConfig = async (taskId: string) => {
  return await apiRequest(`api/v1/test/task/${taskId}/reuse-config`);
};

// 获取任务进度
export const getTaskProgress = async (taskId: string) => {
  return await apiRequest(`api/v1/test/task/${taskId}/progress`);
};

// 取消任务
export const cancelTask = async (taskId: string) => {
  return await apiRequest(`api/v1/test/task/${taskId}/cancel`, {
    method: "POST",
  });
};

// 获取运行中的任务
export const getRunningTasks = async () => {
  return await apiRequest("api/v1/test/running-tasks");
};

// 切换任务收藏状态
export const toggleTaskFavorite = async (taskId: string) => {
  return await apiRequest(`api/v1/test/task/${taskId}/favorite`, {
    method: "POST",
  });
};

// 获取收藏的任务列表
export const getFavoriteTasks = async (page = 1, pageSize = 10) => {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });

  return await apiRequest(`api/v1/test/favorite-tasks?${params.toString()}`);
};

// 切换任务删除状态
export const toggleTaskDelete = async (taskId: string) => {
  return await apiRequest(`api/v1/test/task/${taskId}/delete`, {
    method: "POST",
  });
};

// 更新任务子任务统计
export const updateTaskStats = async (taskId: string) => {
  return await apiRequest(`api/v1/test/task/${taskId}/update-stats`, {
    method: "POST",
  });
};

// 批量更新所有任务统计
export const batchUpdateTasksStats = async () => {
  return await apiRequest("api/v1/test/tasks/batch-update-stats", {
    method: "POST",
  });
};

// 获取任务统计信息
export const getTasksStats = async (
  username?: string,
  taskName?: string,
  favorite?: boolean,
  deleted?: boolean,
  minSubtasks?: number,
  maxSubtasks?: number,
  startDate?: string,
  endDate?: string
) => {
  const params = new URLSearchParams();

  if (username) {
    params.append("username", username);
  }

  if (taskName) {
    params.append("task_name", taskName);
  }

  if (favorite !== undefined) {
    params.append("favorite", favorite.toString());
  }

  if (deleted !== undefined) {
    params.append("deleted", deleted.toString());
  }

  if (minSubtasks !== undefined) {
    params.append("min_subtasks", minSubtasks.toString());
  }

  if (maxSubtasks !== undefined) {
    params.append("max_subtasks", maxSubtasks.toString());
  }

  if (startDate) {
    params.append("start_date", startDate);
  }

  if (endDate) {
    params.append("end_date", endDate);
  }

  const queryString = params.toString();
  return await apiRequest(`api/v1/test/tasks/stats${queryString ? `?${queryString}` : ''}`);
};

// 获取任务矩阵数据
export const getTaskMatrix = async (taskId: string) => {
  return await apiRequest(`api/v1/test/task/${taskId}/matrix`);
};

// 更新子任务评分
export const updateSubtaskRating = async (subtaskId: string, rating: number) => {
  return await apiRequest(`api/v1/test/subtask/${subtaskId}/rating`, {
    method: "POST",
    body: rating,
  });
};

// 获取子任务评分
export const getSubtaskRating = async (subtaskId: string) => {
  return await apiRequest(`api/v1/test/subtask/${subtaskId}/rating`);
};

// 添加子任务评价
export const addSubtaskEvaluation = async (subtaskId: string, evaluation: string) => {
  return await apiRequest(`api/v1/test/subtask/${subtaskId}/evaluation`, {
    method: "POST",
    body: evaluation,
  });
};

// 删除子任务评价
export const removeSubtaskEvaluation = async (subtaskId: string, evaluationIndex: number) => {
  return await apiRequest(`api/v1/test/subtask/${subtaskId}/evaluation/${evaluationIndex}`, {
    method: "DELETE",
  });
};
