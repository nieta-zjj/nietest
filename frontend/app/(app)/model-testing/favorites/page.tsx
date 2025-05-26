"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardBody,
  Chip,
  Progress,
  Button,
  Pagination,
  Spinner,
  Tooltip
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { getFavoriteTasks, toggleTaskFavorite, getTask } from "@/utils/apiClient";
import { TaskListItem } from "@/types/task";
import { TaskStatusChip } from "@/components/task/task-status-chip";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export default function FavoritesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTasks, setTotalTasks] = useState(0);

  const pageSize = 20;

  // 从URL参数中读取页数
  useEffect(() => {
    const pageParam = searchParams.get('page');
    if (pageParam) {
      const pageNumber = parseInt(pageParam, 10);
      if (pageNumber > 0) {
        setCurrentPage(pageNumber);
      }
    }
  }, [searchParams]);

  // 更新URL中的页数参数
  const updatePageInUrl = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) {
      params.delete('page');
    } else {
      params.set('page', page.toString());
    }

    const newUrl = params.toString() ? `?${params.toString()}` : '';
    router.replace(`/model-testing/favorites${newUrl}`, { scroll: false });
  };

  // 处理页数变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updatePageInUrl(page);
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

  // 加载收藏任务列表
  const loadFavoriteTasks = async () => {
    try {
      setLoading(true);
      const response = await getFavoriteTasks(currentPage, pageSize);
      setTasks(response.data.tasks || []);
      setTotalPages(Math.ceil((response.data.total || 0) / pageSize));
      setTotalTasks(response.data.total || 0);
    } catch (error) {
      console.error("加载收藏任务失败:", error);
      toast.error("加载收藏任务失败");
    } finally {
      setLoading(false);
    }
  };

  // 页面加载或页码变化时重新加载
  useEffect(() => {
    loadFavoriteTasks();
  }, [currentPage]);

  return (
    <div className="w-full px-6 py-6">
      <div className="w-full space-y-6">
        {/* 页面标题和统计 */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-medium mb-4 pt-2 pb-4">收藏任务</h2>
            <p className="text-sm text-default-500 mb-4">
              共收藏了 {totalTasks} 个任务
            </p>
          </div>
        </div>

        {/* 任务列表 */}
        {!loading && tasks.length === 0 ? (
          <div className="text-center py-12 text-default-400">
            <Icon icon="solar:star-linear" className="w-16 h-16 mx-auto mb-4" />
            <p className="text-lg">还没有收藏任何任务</p>
            <p className="text-sm">在任务历史中点击星号图标即可收藏任务</p>
          </div>
        ) : (
          <>
            {/* 任务卡片网格 */}
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
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
                            <span className="text-default-600">
                              {task.processed_images}/{task.total_images} 张
                            </span>
                            <span className="font-medium">{task.progress}%</span>
                          </div>
                          <Progress
                            value={task.progress}
                            color={
                              task.status === "completed" ? "success" :
                                task.status === "failed" ? "danger" :
                                  task.status === "cancelled" ? "warning" :
                                    task.progress >= 50 ? "primary" : "secondary"
                            }
                            size="sm"
                            className="w-full"
                          />
                        </div>

                        {/* 任务ID */}
                        <div className="text-xs text-default-400 font-mono truncate">
                          ID: {task.id}
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex items-center gap-2 pt-2 border-t border-default-100">
                          <Tooltip content="取消收藏">
                            <Button
                              size="sm"
                              variant="flat"
                              isIconOnly
                              onPress={async () => {
                                try {
                                  await toggleTaskFavorite(task.id);
                                  // 重新加载收藏列表
                                  loadFavoriteTasks();
                                  toast.success("已取消收藏");
                                } catch (error) {
                                  console.error("取消收藏失败:", error);
                                  toast.error("操作失败");
                                }
                              }}
                            >
                              <Icon
                                icon="solar:star-bold"
                                className="w-4 h-4 text-warning"
                              />
                            </Button>
                          </Tooltip>

                          <Tooltip content="复用任务参数">
                            <Button
                              size="sm"
                              variant="flat"
                              isIconOnly
                              onPress={async () => {
                                try {
                                  // 获取任务详情
                                  const response = await getTask(task.id, false);
                                  const taskDetail = response.data;

                                  // 将任务详情存储到localStorage
                                  localStorage.setItem('reusedTask', JSON.stringify({
                                    id: task.id,
                                    name: task.name,
                                    detail: taskDetail
                                  }));

                                  // 跳转到测试页面
                                  router.push('/model-testing/test');
                                  toast.success(`已选择复用任务: ${task.name}`);
                                } catch (error) {
                                  console.error("获取任务详情失败:", error);
                                  toast.error("无法获取任务参数");
                                }
                              }}
                            >
                              <Icon icon="solar:copy-linear" className="w-4 h-4" />
                            </Button>
                          </Tooltip>

                          <Tooltip content="查看详情">
                            <Button
                              size="sm"
                              variant="flat"
                              isIconOnly
                              onPress={() => {
                                router.push(`/model-testing/history/${task.id}`);
                              }}
                            >
                              <Icon icon="solar:eye-linear" className="w-4 h-4" />
                            </Button>
                          </Tooltip>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))
              )}
            </div>

            {/* 加载指示器 */}
            {loading && tasks.length > 0 && (
              <div className="flex justify-center py-4">
                <div className="flex items-center gap-2 text-sm text-default-500">
                  <Spinner size="sm" />
                  <span>正在更新数据...</span>
                </div>
              </div>
            )}

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex justify-center">
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
          </>
        )}
      </div>
    </div>
  );
}
