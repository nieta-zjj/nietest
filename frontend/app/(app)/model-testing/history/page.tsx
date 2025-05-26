"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardBody,
  Chip,
  Progress,
  Button,
  Input,
  Select,
  SelectItem,
  Pagination,
  Badge,
  Spinner,
  Tooltip,
  Tabs,
  Tab,
  Switch
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { getTasks, toggleTaskFavorite, getTask, toggleTaskDelete, getTasksStats } from "@/utils/apiClient";
import { reuseTaskSettings } from "@/utils/taskReuseService";
import { TaskListItem, APIResponse } from "@/types/task";
import { TaskStatusChip } from "@/components/task/task-status-chip";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CustomProgress } from "@/components/ui/custom-progress";

export default function HistoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTasks, setTotalTasks] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);
  const [processingCount, setProcessingCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // 筛选状态
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [usernameFilter, setUsernameFilter] = useState("");
  const [taskNameFilter, setTaskNameFilter] = useState("");
  const [favoriteFilter, setFavoriteFilter] = useState<string>("");
  const [deletedFilter, setDeletedFilter] = useState<string>("");
  const [minSubtasks, setMinSubtasks] = useState<string>("");
  const [maxSubtasks, setMaxSubtasks] = useState<string>("");
  const [dateRange, setDateRange] = useState<any>(null);

  const pageSize = 20;

  // 添加初始化标识，避免重复API调用
  const [isInitialized, setIsInitialized] = useState(false);

  // 从URL参数中读取页数和筛选条件，并且初始化完成后立即加载数据
  useEffect(() => {
    const pageParam = searchParams.get('page');
    const statusParam = searchParams.get('status');
    const usernameParam = searchParams.get('username');
    const taskNameParam = searchParams.get('taskName');
    const favoriteParam = searchParams.get('favorite');
    const deletedParam = searchParams.get('deleted');
    const minSubtasksParam = searchParams.get('minSubtasks');
    const maxSubtasksParam = searchParams.get('maxSubtasks');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // 批量设置状态
    let needsUpdate = false;

    if (pageParam) {
      const pageNumber = parseInt(pageParam, 10);
      if (pageNumber > 0) {
        setCurrentPage(pageNumber);
        needsUpdate = true;
      }
    }

    if (statusParam) {
      setStatusFilter(statusParam);
      needsUpdate = true;
    }

    if (usernameParam) {
      setUsernameFilter(usernameParam);
      needsUpdate = true;
    }

    if (taskNameParam) {
      setTaskNameFilter(taskNameParam);
      needsUpdate = true;
    }

    if (favoriteParam) {
      setFavoriteFilter(favoriteParam);
      needsUpdate = true;
    }

    if (deletedParam) {
      setDeletedFilter(deletedParam);
      needsUpdate = true;
    }

    if (minSubtasksParam) {
      setMinSubtasks(minSubtasksParam);
      needsUpdate = true;
    }

    if (maxSubtasksParam) {
      setMaxSubtasks(maxSubtasksParam);
      needsUpdate = true;
    }

    if (startDateParam && endDateParam) {
      try {
        const startDate = new Date(startDateParam);
        const endDate = new Date(endDateParam);
        setDateRange({
          start: {
            year: startDate.getFullYear(),
            month: startDate.getMonth() + 1,
            day: startDate.getDate()
          },
          end: {
            year: endDate.getFullYear(),
            month: endDate.getMonth() + 1,
            day: endDate.getDate()
          }
        });
        needsUpdate = true;
      } catch (error) {
        console.error('解析日期参数失败:', error);
      }
    }

    // 标记初始化完成，这将触发loadTasks
    setIsInitialized(true);
  }, [searchParams]);

  // 更新URL中的所有参数
  const updateUrlParams = (updates: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || value === 1 && key === 'page') {
        params.delete(key);
      } else {
        params.set(key, value.toString());
      }
    });

    const newUrl = params.toString() ? `?${params.toString()}` : '';
    router.replace(`/model-testing/history${newUrl}`, { scroll: false });
  };

  // 处理页数变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updateUrlParams({ page });
  };

  // 处理状态筛选变化
  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    updateUrlParams({ status, page: 1 });
    setCurrentPage(1);
  };

  // 处理用户名筛选变化
  const handleUsernameFilterChange = (username: string) => {
    setUsernameFilter(username);
    updateUrlParams({ username, page: 1 });
    setCurrentPage(1);
  };

  // 处理任务名筛选变化
  const handleTaskNameFilterChange = (taskName: string) => {
    setTaskNameFilter(taskName);
    updateUrlParams({ taskName, page: 1 });
    setCurrentPage(1);
  };

  // 处理收藏筛选变化
  const handleFavoriteFilterChange = (favorite: string) => {
    setFavoriteFilter(favorite);
    updateUrlParams({ favorite, page: 1 });
    setCurrentPage(1);
  };

  // 处理删除状态筛选变化
  const handleDeletedFilterChange = (deleted: string) => {
    setDeletedFilter(deleted);
    updateUrlParams({ deleted, page: 1 });
    setCurrentPage(1);
  };

  // 处理子任务数量筛选变化
  const handleSubtasksFilterChange = (min: string, max: string) => {
    setMinSubtasks(min);
    setMaxSubtasks(max);
    updateUrlParams({ minSubtasks: min, maxSubtasks: max, page: 1 });
    setCurrentPage(1);
  };

  // 处理日期范围筛选变化
  const handleDateRangeChange = (range: any) => {
    setDateRange(range);
    if (range && range.start && range.end) {
      const startDate = new Date(range.start.year, range.start.month - 1, range.start.day);
      const endDate = new Date(range.end.year, range.end.month - 1, range.end.day);
      updateUrlParams({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        page: 1
      });
    } else {
      updateUrlParams({ startDate: null, endDate: null, page: 1 });
    }
    setCurrentPage(1);
  };

  // 格式化时间
  const formatTime = (timeStr: string) => {
    return new Date(timeStr).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // 加载任务统计
  const loadTasksStats = async () => {
    try {
      // 准备统计API参数
      const statsParams: any = {
        username: usernameFilter || undefined,
        taskName: taskNameFilter || undefined,
        favorite: favoriteFilter === "favorite" ? true : undefined,
        deleted: deletedFilter === "deleted" ? true : false, // 默认不显示已删除的任务
        minSubtasks: minSubtasks ? parseInt(minSubtasks) : undefined,
        maxSubtasks: maxSubtasks ? parseInt(maxSubtasks) : undefined
      };

      // 添加日期范围参数
      if (dateRange && dateRange.start && dateRange.end) {
        const startDate = new Date(dateRange.start.year, dateRange.start.month - 1, dateRange.start.day);
        const endDate = new Date(dateRange.end.year, dateRange.end.month - 1, dateRange.end.day);
        statsParams.startDate = startDate.toISOString().split('T')[0];
        statsParams.endDate = endDate.toISOString().split('T')[0];
      }

      // 调用统计API
      const statsResponse = await getTasksStats(
        statsParams.username,
        statsParams.taskName,
        statsParams.favorite,
        statsParams.deleted,
        statsParams.minSubtasks,
        statsParams.maxSubtasks,
        statsParams.startDate,
        statsParams.endDate
      );

      // 更新统计数据
      if (statsResponse.data) {
        setTotalTasks(statsResponse.data.total || 0);
        setSuccessCount(statsResponse.data.completed || 0);
        setFailedCount(statsResponse.data.failed || 0);
        setCancelledCount(statsResponse.data.cancelled || 0);
        setProcessingCount(statsResponse.data.processing || 0);
        setPendingCount(statsResponse.data.pending || 0);
      }
    } catch (error) {
      console.error("加载任务统计失败:", error);
    }
  };

  // 加载任务列表
  const loadTasks = async () => {
    try {
      setLoading(true);

      // 准备API参数
      const apiParams: any = {
        page: currentPage,
        pageSize,
        status: statusFilter || undefined,
        username: usernameFilter || undefined,
        taskName: taskNameFilter || undefined,
        favorite: favoriteFilter === "favorite" ? true : undefined,
        deleted: deletedFilter === "deleted" ? true : false, // 默认不显示已删除的任务
        minSubtasks: minSubtasks ? parseInt(minSubtasks) : undefined,
        maxSubtasks: maxSubtasks ? parseInt(maxSubtasks) : undefined
      };

      // 添加日期范围参数
      if (dateRange && dateRange.start && dateRange.end) {
        const startDate = new Date(dateRange.start.year, dateRange.start.month - 1, dateRange.start.day);
        const endDate = new Date(dateRange.end.year, dateRange.end.month - 1, dateRange.end.day);
        apiParams.startDate = startDate.toISOString().split('T')[0];
        apiParams.endDate = endDate.toISOString().split('T')[0];
      }

      // 调用API，传递所有参数
      const response = await getTasks(
        apiParams.page,
        apiParams.pageSize,
        apiParams.status,
        apiParams.username,
        apiParams.taskName,
        apiParams.favorite,
        apiParams.deleted,
        apiParams.minSubtasks,
        apiParams.maxSubtasks,
        apiParams.startDate,
        apiParams.endDate
      );

      // 直接使用后端返回的数据，不再进行客户端筛选
      setTasks(response.data.tasks || []);
      setTotalPages(Math.ceil((response.data.total || 0) / pageSize));

      // 同时加载统计数据
      await loadTasksStats();
    } catch (error) {
      console.error("加载任务列表失败:", error);
    } finally {
      setLoading(false);
    }
  };

  // 清除所有筛选条件
  const clearFilters = () => {
    setStatusFilter("");
    setUsernameFilter("");
    setTaskNameFilter("");
    setFavoriteFilter("");
    setDeletedFilter("");
    setMinSubtasks("");
    setMaxSubtasks("");
    setDateRange(null);
    setCurrentPage(1);
    updateUrlParams({
      status: null,
      username: null,
      taskName: null,
      favorite: null,
      deleted: null,
      minSubtasks: null,
      maxSubtasks: null,
      startDate: null,
      endDate: null,
      page: 1
    });
  };

  // 初始加载
  useEffect(() => {
    if (isInitialized) {
      loadTasks();
    }
  }, [isInitialized]);

  // 当筛选条件或分页改变时重新加载数据
  useEffect(() => {
    // 只有在初始化完成后才响应筛选条件的变化
    if (isInitialized) {
      loadTasks();
    }
  }, [isInitialized, currentPage, statusFilter, usernameFilter, taskNameFilter, favoriteFilter, deletedFilter, minSubtasks, maxSubtasks, dateRange]);

  return (
    <div className="w-full h-full flex flex-col px-6 py-6">
      <div className="flex-1 flex flex-col space-y-6 min-h-0">
        {/* 页面标题、统计和筛选区 */}
        <div className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-medium mb-3 pt-2 pb-2">任务历史</h2>

              {/* 统计徽章 */}
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <Badge content={totalTasks} color="default" size="lg">
                  <Chip variant="flat" color="default" size="sm">
                    <Icon icon="solar:list-linear" className="w-4 h-4 mr-1" />
                    总计
                  </Chip>
                </Badge>

                <Badge content={successCount} color="success" size="lg">
                  <Chip variant="flat" color="success" size="sm">
                    <Icon icon="solar:check-circle-linear" className="w-4 h-4 mr-1" />
                    成功
                  </Chip>
                </Badge>

                <Badge content={failedCount} color="danger" size="lg">
                  <Chip variant="flat" color="danger" size="sm">
                    <Icon icon="solar:close-circle-linear" className="w-4 h-4 mr-1" />
                    失败
                  </Chip>
                </Badge>

                <Badge content={cancelledCount} color="warning" size="lg">
                  <Chip variant="flat" color="warning" size="sm">
                    <Icon icon="solar:stop-circle-linear" className="w-4 h-4 mr-1" />
                    取消
                  </Chip>
                </Badge>

                <Badge content={processingCount} color="primary" size="lg">
                  <Chip variant="flat" color="primary" size="sm">
                    <Icon icon="solar:play-circle-linear" className="w-4 h-4 mr-1" />
                    执行中
                  </Chip>
                </Badge>

                <Badge content={pendingCount} color="secondary" size="lg">
                  <Chip variant="flat" color="secondary" size="sm">
                    <Icon icon="solar:clock-circle-linear" className="w-4 h-4 mr-1" />
                    排队中
                  </Chip>
                </Badge>
              </div>
            </div>
          </div>

          {/* 筛选器 */}
          <div className="flex flex-wrap items-center gap-3 p-4">
            {/* 状态筛选 - 改为Tab样式 */}
            <div className="flex items-center gap-2 min-w-[400px]">
              <Tabs
                size="sm"
                aria-label="任务状态筛选"
                selectedKey={statusFilter}
                onSelectionChange={(key) => {
                  handleStatusFilterChange(key.toString());
                }}
                classNames={{
                  base: "w-full",
                  tabList: "gap-1 w-full",
                  tab: "h-7 px-3 py-0",
                  cursor: "h-7"
                }}
              >
                <Tab key="" title="全部" />
                <Tab key="completed" title="已完成" />
                <Tab key="failed" title="已失败" />
                <Tab key="cancelled" title="已取消" />
                <Tab key="processing" title="执行中" />
                <Tab key="pending" title="排队中" />
              </Tabs>
            </div>

            {/* 任务搜索 */}
            <div className="flex items-center gap-2 min-w-[200px]">
              <span className="text-sm font-medium text-nowrap">任务搜索</span>
              <Input
                size="sm"
                placeholder="按名称搜索"
                value={taskNameFilter}
                onChange={(e) => {
                  handleTaskNameFilterChange(e.target.value);
                }}
                startContent={<Icon icon="solar:magnifer-linear" className="text-default-400" />}
                className="w-48"
              />
            </div>

            {/* 用户筛选 */}
            <div className="flex items-center gap-2 min-w-[150px]">
              <span className="text-sm font-medium text-nowrap">用户筛选</span>
              <Input
                size="sm"
                placeholder="输入用户名"
                value={usernameFilter}
                onChange={(e) => {
                  handleUsernameFilterChange(e.target.value);
                }}
                startContent={<Icon icon="solar:user-linear" className="text-default-400" />}
                className="w-32"
              />
            </div>

            {/* 收藏筛选 - 改为布尔框 */}
            <div className="flex items-center gap-2 min-w-[80px]">
              <span className="text-sm font-medium text-nowrap">收藏</span>
              <Switch
                size="sm"
                isSelected={favoriteFilter === "favorite"}
                onValueChange={(checked) => {
                  handleFavoriteFilterChange(checked ? "favorite" : "");
                }}
                aria-label="只显示收藏的任务"
              />
            </div>

            {/* 删除状态筛选 */}
            <div className="flex items-center gap-2 min-w-[80px]">
              <span className="text-sm font-medium text-nowrap">删除</span>
              <Switch
                size="sm"
                isSelected={deletedFilter === "deleted"}
                onValueChange={(checked) => {
                  handleDeletedFilterChange(checked ? "deleted" : "");
                }}
                aria-label="显示已删除的任务"
              />
            </div>

            {/* 子任务数量筛选 */}
            <div className="flex items-center gap-2 min-w-[200px]">
              <span className="text-sm font-medium text-nowrap">子任务数量</span>
              <div className="flex items-center gap-1">
                <Input
                  size="sm"
                  type="number"
                  placeholder="最小值"
                  value={minSubtasks}
                  onChange={(e) => {
                    handleSubtasksFilterChange(e.target.value, maxSubtasks);
                  }}
                  className="w-20"
                  min="0"
                />
                <span className="text-sm text-default-400">-</span>
                <Input
                  size="sm"
                  type="number"
                  placeholder="最大值"
                  value={maxSubtasks}
                  onChange={(e) => {
                    handleSubtasksFilterChange(minSubtasks, e.target.value);
                  }}
                  className="w-20"
                  min="0"
                />
              </div>
            </div>

            {/* 时间筛选 - 增加宽度 */}
            <div className="flex items-center gap-2 min-w-[300px]">
              <span className="text-sm font-medium text-nowrap">时间筛选</span>
              <div className="flex items-center gap-1">
                <Input
                  size="sm"
                  type="date"
                  placeholder="开始日期"
                  className="w-32"
                  value={dateRange?.start ? `${dateRange.start.year}-${String(dateRange.start.month).padStart(2, '0')}-${String(dateRange.start.day).padStart(2, '0')}` : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value) {
                      const date = new Date(value);
                      const startCalendar = {
                        year: date.getFullYear(),
                        month: date.getMonth() + 1,
                        day: date.getDate()
                      };
                      handleDateRangeChange({
                        start: startCalendar,
                        end: dateRange?.end || startCalendar
                      });
                    }
                  }}
                />
                <span className="text-sm text-default-400">至</span>
                <Input
                  size="sm"
                  type="date"
                  placeholder="结束日期"
                  className="w-32"
                  value={dateRange?.end ? `${dateRange.end.year}-${String(dateRange.end.month).padStart(2, '0')}-${String(dateRange.end.day).padStart(2, '0')}` : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value) {
                      const date = new Date(value);
                      const endCalendar = {
                        year: date.getFullYear(),
                        month: date.getMonth() + 1,
                        day: date.getDate()
                      };
                      handleDateRangeChange({
                        start: dateRange?.start || endCalendar,
                        end: endCalendar
                      });
                    }
                  }}
                />
              </div>
            </div>

            {/* 快速选择和清除按钮 */}
            <div className="flex items-center gap-2 ml-auto">
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => {
                    const today = new Date();
                    const todayCalendar = {
                      year: today.getFullYear(),
                      month: today.getMonth() + 1,
                      day: today.getDate()
                    };
                    handleDateRangeChange({ start: todayCalendar, end: todayCalendar });
                  }}
                >
                  今天
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => {
                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayCalendar = {
                      year: yesterday.getFullYear(),
                      month: yesterday.getMonth() + 1,
                      day: yesterday.getDate()
                    };
                    handleDateRangeChange({ start: yesterdayCalendar, end: yesterdayCalendar });
                  }}
                >
                  昨天
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => {
                    const today = new Date();
                    const lastWeek = new Date(today);
                    lastWeek.setDate(lastWeek.getDate() - 7);
                    const todayCalendar = {
                      year: today.getFullYear(),
                      month: today.getMonth() + 1,
                      day: today.getDate()
                    };
                    const lastWeekCalendar = {
                      year: lastWeek.getFullYear(),
                      month: lastWeek.getMonth() + 1,
                      day: lastWeek.getDate()
                    };
                    handleDateRangeChange({ start: lastWeekCalendar, end: todayCalendar });
                  }}
                >
                  最近7天
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => {
                    const today = new Date();
                    const lastMonth = new Date(today);
                    lastMonth.setDate(lastMonth.getDate() - 30);
                    const todayCalendar = {
                      year: today.getFullYear(),
                      month: today.getMonth() + 1,
                      day: today.getDate()
                    };
                    const lastMonthCalendar = {
                      year: lastMonth.getFullYear(),
                      month: lastMonth.getMonth() + 1,
                      day: lastMonth.getDate()
                    };
                    handleDateRangeChange({ start: lastMonthCalendar, end: todayCalendar });
                  }}
                >
                  最近30天
                </Button>
              </div>
              <Button
                size="sm"
                variant="flat"
                color="danger"
                startContent={<Icon icon="solar:refresh-linear" />}
                onPress={clearFilters}
              >
                清除筛选
              </Button>
            </div>
          </div>
        </div>

        {/* 任务列表 */}
        {!loading && tasks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center text-default-400 bg-default-50 rounded-lg border border-default-200 p-8">
            <div>
              <Icon icon="solar:file-text-linear" className="w-16 h-16 mx-auto mb-4" />
              <p className="text-lg">没有找到匹配的任务</p>
              <p className="text-sm">尝试调整筛选条件</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 bg-default-50 rounded-lg border border-default-200 overflow-hidden">
            {/* 任务卡片网格 */}
            <div className={`flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 auto-rows-max overflow-y-auto p-4 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              {loading && tasks.length === 0 ? (
                // 首次加载时显示骨架屏
                Array.from({ length: 8 }).map((_, index) => (
                  <Card key={index} className="animate-pulse">
                    <CardBody className="p-4">
                      <div className="space-y-3">
                        <div className="h-4 bg-default-200 rounded w-3/4"></div>
                        <div className="h-3 bg-default-200 rounded w-1/2"></div>
                        <div className="h-3 bg-default-200 rounded w-2/3"></div>
                        <div className="h-2 bg-default-200 rounded w-full"></div>
                        <div className="h-8 bg-default-200 rounded w-full"></div>
                      </div>
                    </CardBody>
                  </Card>
                ))
              ) : (
                tasks.map((task) => (
                  <Card key={task.id} className="hover:shadow-lg transition-shadow">
                    <CardBody className="p-4">
                      <div className="space-y-3">
                        {/* 任务标题和状态 */}
                        <div className="flex items-start justify-between">
                          <h3 className="font-semibold text-sm truncate flex-1 pr-2">
                            {task.name}
                          </h3>
                          <TaskStatusChip status={task.status} size="sm" />
                        </div>

                        {/* 用户和时间信息 */}
                        <div className="space-y-1 text-xs text-default-500">
                          <div className="flex items-center">
                            <Icon icon="solar:user-linear" className="w-3 h-3 mr-1" />
                            <span className="truncate">{task.username}</span>
                          </div>
                          <div className="flex items-center">
                            <Icon icon="solar:calendar-linear" className="w-3 h-3 mr-1" />
                            <span>{formatTime(task.created_at)}</span>
                          </div>
                        </div>

                        {/* 进度信息 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1">
                              <span className="text-default-600">进度:</span>
                              <span className="text-success-600 font-medium">
                                {task.completed_images}
                              </span>
                              {task.failed_images > 0 && (
                                <>
                                  <span className="text-default-400">(</span>
                                  <span className="text-danger-600 font-medium">
                                    {task.failed_images}
                                  </span>
                                  <span className="text-default-400">)</span>
                                </>
                              )}
                              <span className="text-default-500">
                                /{task.total_images} 张
                              </span>
                            </div>
                            <span className="font-medium">{task.progress}%</span>
                          </div>
                          <CustomProgress
                            total={task.total_images}
                            completed={task.completed_images}
                            failed={task.failed_images}
                            size="sm"
                            className="w-full"
                          />
                        </div>

                        {/* 任务ID */}
                        <div className="flex items-center">
                          <span className="text-xs text-default-400 font-mono truncate">
                            ID: {task.id}
                          </span>
                          <Tooltip content="复制任务ID">
                            <Button
                              size="sm"
                              variant="light"
                              isIconOnly
                              className="h-4 w-4 min-w-4 ml-1"
                              onPress={() => {
                                navigator.clipboard.writeText(task.id);
                              }}
                            >
                              <Icon icon="solar:copy-linear" className="w-3 h-3" />
                            </Button>
                          </Tooltip>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex items-center justify-between pt-2 border-t border-default-100">
                          <div className="flex items-center gap-2">
                            <Tooltip content="收藏任务">
                              <Button
                                size="sm"
                                variant="flat"
                                isIconOnly
                                onPress={async () => {
                                  try {
                                    await toggleTaskFavorite(task.id);
                                    // 重新加载任务列表以更新收藏状态
                                    loadTasks();
                                    toast.success(task.is_favorite ? "取消收藏成功" : "收藏成功");
                                  } catch (error) {
                                    console.error("切换收藏状态失败:", error);
                                    toast.error("操作失败");
                                  }
                                }}
                              >
                                <Icon
                                  icon={task.is_favorite ? "solar:star-bold" : "solar:star-linear"}
                                  className={`w-4 h-4 ${task.is_favorite ? "text-warning" : ""}`}
                                />
                              </Button>
                            </Tooltip>

                            <Tooltip content={task.is_deleted ? "恢复任务" : "删除任务"}>
                              <Button
                                size="sm"
                                variant="flat"
                                isIconOnly
                                onPress={async () => {
                                  try {
                                    await toggleTaskDelete(task.id);
                                    // 重新加载任务列表以更新删除状态
                                    loadTasks();
                                    toast.success(task.is_deleted ? "恢复任务成功" : "删除任务成功");
                                  } catch (error) {
                                    console.error("切换删除状态失败:", error);
                                    toast.error("操作失败");
                                  }
                                }}
                              >
                                <Icon
                                  icon={task.is_deleted ? "solar:refresh-linear" : "solar:trash-bin-minimalistic-linear"}
                                  className={`w-4 h-4 ${task.is_deleted ? "text-success" : "text-danger"}`}
                                />
                              </Button>
                            </Tooltip>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="flat"
                              onPress={async () => {
                                try {
                                  // 使用新的复用服务
                                  const result = await reuseTaskSettings(task.id);

                                  if (result.success) {
                                    // 检查是否为旧格式任务
                                    if (result.data?.is_old_format) {
                                      // 弹出警告对话框
                                      const shouldContinue = confirm(
                                        "警告：这是一个旧格式的任务数据。\n\n" +
                                        "复用后的参数可能需要手动检查和调整，请在提交前仔细核对所有参数设置。\n\n" +
                                        "确定要继续复用这个任务吗？"
                                      );

                                      if (!shouldContinue) {
                                        // 用户取消，清除已保存的复用数据
                                        const { clearReusedTaskData } = await import("@/utils/taskReuseService");
                                        clearReusedTaskData();
                                        return;
                                      }
                                    }

                                    // 跳转到测试页面
                                    router.push('/model-testing/test');
                                    toast.success(`已选择复用任务: ${task.name}${result.data?.is_old_format ? ' (旧格式任务，请检查参数)' : ''}`);
                                  } else {
                                    toast.error(result.message || "复用任务失败");
                                  }
                                } catch (error) {
                                  console.error("复用任务失败:", error);
                                  toast.error("复用任务失败");
                                }
                              }}
                            >
                              复用
                            </Button>

                            <Button
                              size="sm"
                              variant="flat"
                              onPress={() => {
                                router.push(`/model-testing/history/${task.id}`);
                              }}
                            >
                              查看详情
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 固定在底部的分页 */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 flex justify-center pt-6 border-t border-default-100 bg-background/80 backdrop-blur-sm">
          <Pagination
            total={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            boundaries={3}
            isCompact
            showControls
            showShadow
            color="primary"
          />
        </div>
      )}
    </div>
  );
}
