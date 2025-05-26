"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Progress,
  Spinner,
  Button,
  Divider,
  Badge,
  ScrollShadow
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { getTasks } from "@/utils/apiClient";
import { TaskListItem, APIResponse } from "@/types/task";
import { TaskStatusChip } from "@/components/task/task-status-chip";
import { CustomProgress } from "@/components/ui/custom-progress";

export default function QueuePage() {
  const [queueTasks, setQueueTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);

  // 格式化时间
  const formatTime = (timeStr: string) => {
    return new Date(timeStr).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // 计算执行时间
  const getExecutionTime = (createdAt: string, completedAt?: string) => {
    const start = new Date(createdAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // 加载队列任务
  const loadQueueTasks = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // 获取正在执行和排队的任务
      const [processingRes, pendingRes] = await Promise.all([
        getTasks(1, 50, "processing", undefined, undefined),
        getTasks(1, 50, "pending", undefined, undefined)
      ]);

      const allTasks = [
        ...(processingRes.data.tasks || []),
        ...(pendingRes.data.tasks || [])
      ];

      // 按创建时间排序（最新的在前）
      allTasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setQueueTasks(allTasks);
      setTotal(allTasks.length);
    } catch (error) {
      console.error("加载队列任务失败:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 手动刷新
  const handleRefresh = () => {
    loadQueueTasks(true);
  };

  // 初始加载和定时刷新
  useEffect(() => {
    loadQueueTasks();
    const interval = setInterval(() => loadQueueTasks(true), 15000); // 改为15秒
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "processing":
        return "solar:play-circle-linear";
      case "pending":
        return "solar:clock-circle-linear";
      default:
        return "solar:question-circle-linear";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "processing":
        return "text-primary";
      case "pending":
        return "text-warning";
      default:
        return "text-default-400";
    }
  };

  return (
    <div className="w-full px-6 py-6">
      <div className="w-full space-y-6">
        {/* 页面标题 */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-medium mb-2">任务队列</h2>
            <p className="text-default-500 text-sm">实时显示正在执行和排队的任务（每15秒自动刷新）</p>
          </div>

          <div className="flex items-center gap-3 ml-6">
            <Button
              color="primary"
              variant="flat"
              size="sm"
              onPress={handleRefresh}
              isLoading={refreshing}
              startContent={!refreshing ? <Icon icon="solar:refresh-linear" /> : undefined}
            >
              {refreshing ? "刷新中..." : "刷新"}
            </Button>
          </div>
        </div>

        {/* 任务队列列表 */}
        <Card className="w-full">
          <CardBody className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner label="加载队列中..." />
              </div>
            ) : queueTasks.length === 0 ? (
              <div className="text-center py-12 text-default-400">
                <Icon icon="solar:sleep-linear" className="w-16 h-16 mx-auto mb-4" />
                <p className="text-lg">当前没有排队或执行中的任务</p>
                <p className="text-sm">所有任务都已完成</p>
              </div>
            ) : (
              <ScrollShadow className="max-h-[70vh]">
                <div className="space-y-3">
                  {queueTasks.map((task, index) => (
                    <div key={task.id} className="relative">
                      {/* 时间线连接线 */}
                      {index < queueTasks.length - 1 && (
                        <div className="absolute left-5 top-14 w-0.5 h-6 bg-default-200 z-0" />
                      )}

                      <Card className="relative z-10 hover:shadow-md transition-shadow w-full">
                        <CardBody className="p-4">
                          <div className="flex items-start gap-4">
                            {/* 状态图标 */}
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-default-100 flex items-center justify-center ${getStatusColor(task.status)}`}>
                              <Icon
                                icon={getStatusIcon(task.status)}
                                className={`w-5 h-5 ${task.status === 'processing' ? 'animate-pulse' : ''}`}
                              />
                            </div>

                            {/* 任务信息 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 pr-4">
                                  <h3 className="font-semibold text-lg truncate mb-1">{task.name}</h3>
                                  <div className="flex items-center gap-3 text-xs text-default-500">
                                    <span>
                                      <Icon icon="solar:user-linear" className="w-3 h-3 inline mr-1" />
                                      {task.username}
                                    </span>
                                    <span>
                                      <Icon icon="solar:calendar-linear" className="w-3 h-3 inline mr-1" />
                                      {formatTime(task.created_at)}
                                    </span>
                                    <span>
                                      <Icon icon="solar:clock-linear" className="w-3 h-3 inline mr-1" />
                                      {getExecutionTime(task.created_at, task.completed_at)}
                                    </span>
                                  </div>
                                </div>
                                <TaskStatusChip status={task.status} size="sm" />
                              </div>

                              {/* 进度信息 */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="text-default-600">
                                      进度:
                                    </span>
                                    {/* 显示格式：成功数(失败数)/总数 */}
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
                                      /{task.total_images} 张图片
                                    </span>
                                  </div>
                                  <span className="font-medium text-sm">{task.progress}%</span>
                                </div>
                                <CustomProgress
                                  total={task.total_images}
                                  completed={task.completed_images}
                                  failed={task.failed_images}
                                  size="sm"
                                  className="w-full"
                                />
                              </div>

                              {/* 任务ID - 完整显示并添加复制按钮 */}
                              <div className="mt-2 flex items-center">
                                <span className="text-xs text-default-400 font-mono">
                                  ID: {task.id}
                                </span>
                                <Button
                                  size="sm"
                                  variant="light"
                                  isIconOnly
                                  className="h-5 w-5 min-w-5 ml-2"
                                  onPress={() => {
                                    navigator.clipboard.writeText(task.id);
                                  }}
                                  title="复制任务ID"
                                >
                                  <Icon icon="solar:copy-linear" className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    </div>
                  ))}
                </div>
              </ScrollShadow>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
