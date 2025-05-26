"use client";

import React, { useState, useEffect } from "react";
import { Card, CardBody, Chip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { getRunningTasks } from "@/utils/apiClient";
import { RunningTasksResponse, APIResponse } from "@/types/task";

interface RunningTasksOverviewProps {
    refreshInterval?: number;
}

export const RunningTasksOverview: React.FC<RunningTasksOverviewProps> = ({
    refreshInterval = 5000
}) => {
    const [runningTasks, setRunningTasks] = useState<RunningTasksResponse | null>(null);
    const [loading, setLoading] = useState(true);

    // 加载运行中的任务
    const loadRunningTasks = async () => {
        try {
            const response: APIResponse<RunningTasksResponse> = await getRunningTasks();
            if (response.code === 200) {
                setRunningTasks(response.data);
            }
        } catch (error) {
            console.error("加载运行中任务失败:", error);
        } finally {
            setLoading(false);
        }
    };

    // 初始加载和定时刷新
    useEffect(() => {
        loadRunningTasks();

        if (refreshInterval > 0) {
            const interval = setInterval(loadRunningTasks, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [refreshInterval]);

    // 格式化时间
    const formatTime = (timeStr: string) => {
        return new Date(timeStr).toLocaleString("zh-CN");
    };

    if (loading) {
        return (
            <Card>
                <CardBody className="flex items-center justify-center py-8">
                    <Spinner label="加载中..." />
                </CardBody>
            </Card>
        );
    }

    return (
        <Card>
            <CardBody>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Icon icon="solar:play-circle-linear" className="w-5 h-5 text-primary" />
                        <span className="font-semibold">运行中任务概览</span>
                    </div>
                    <Chip color="primary" variant="flat">
                        {runningTasks?.count || 0} 个任务
                    </Chip>
                </div>

                {!runningTasks || runningTasks.count === 0 ? (
                    <div className="text-center py-8 text-default-400">
                        <Icon icon="solar:sleep-linear" className="w-12 h-12 mx-auto mb-2" />
                        <p>当前没有运行中的任务</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {runningTasks.tasks.map((task) => (
                            <div
                                key={task.id}
                                className="flex items-center justify-between p-3 bg-default-50 rounded-lg"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{task.name}</span>
                                        <Chip color="primary" size="sm" variant="flat">
                                            运行中
                                        </Chip>
                                    </div>
                                    <p className="text-small text-default-400 mt-1">
                                        ID: {task.id.slice(0, 8)}... | 开始时间: {formatTime(task.created_at)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Icon icon="solar:refresh-linear" className="w-4 h-4 text-primary animate-spin" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardBody>
        </Card>
    );
};