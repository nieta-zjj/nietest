"use client";

import React, { useState, useEffect } from "react";
import { Card, CardBody, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { getTasks } from "@/utils/apiClient";
import { APIResponse } from "@/types/task";

interface TaskStatsProps {
    refreshInterval?: number;
}

interface TaskStats {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
}

export const TaskStats: React.FC<TaskStatsProps> = ({
    refreshInterval = 10000
}) => {
    const [stats, setStats] = useState<TaskStats | null>(null);
    const [loading, setLoading] = useState(true);

    // 加载任务统计
    const loadStats = async () => {
        try {
            // 并行获取各种状态的任务数量
            const [totalRes, pendingRes, runningRes, completedRes, failedRes, cancelledRes] = await Promise.all([
                getTasks(1, 1, undefined, undefined, undefined),
                getTasks(1, 1, "pending", undefined, undefined),
                getTasks(1, 1, "running", undefined, undefined),
                getTasks(1, 1, "completed", undefined, undefined),
                getTasks(1, 1, "failed", undefined, undefined),
                getTasks(1, 1, "cancelled", undefined, undefined)
            ]);

            const newStats: TaskStats = {
                total: totalRes.data.total,
                pending: pendingRes.data.total,
                running: runningRes.data.total,
                completed: completedRes.data.total,
                failed: failedRes.data.total,
                cancelled: cancelledRes.data.total
            };

            setStats(newStats);
        } catch (error) {
            console.error("加载任务统计失败:", error);
        } finally {
            setLoading(false);
        }
    };

    // 初始加载和定时刷新
    useEffect(() => {
        loadStats();

        if (refreshInterval > 0) {
            const interval = setInterval(loadStats, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [refreshInterval]);

    if (loading) {
        return (
            <Card>
                <CardBody className="flex items-center justify-center py-8">
                    <Spinner label="加载统计中..." />
                </CardBody>
            </Card>
        );
    }

    const statItems = [
        {
            key: "total",
            label: "总任务",
            value: stats?.total || 0,
            icon: "solar:document-text-linear",
            color: "text-default-600"
        },
        {
            key: "running",
            label: "运行中",
            value: stats?.running || 0,
            icon: "solar:play-circle-linear",
            color: "text-primary"
        },
        {
            key: "pending",
            label: "等待中",
            value: stats?.pending || 0,
            icon: "solar:clock-circle-linear",
            color: "text-warning"
        },
        {
            key: "completed",
            label: "已完成",
            value: stats?.completed || 0,
            icon: "solar:check-circle-linear",
            color: "text-success"
        },
        {
            key: "failed",
            label: "失败",
            value: stats?.failed || 0,
            icon: "solar:close-circle-linear",
            color: "text-danger"
        },
        {
            key: "cancelled",
            label: "已取消",
            value: stats?.cancelled || 0,
            icon: "solar:stop-circle-linear",
            color: "text-default-400"
        }
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {statItems.map((item) => (
                <Card key={item.key} className="border-small">
                    <CardBody className="text-center p-4">
                        <Icon
                            icon={item.icon}
                            className={`w-8 h-8 mx-auto mb-2 ${item.color}`}
                        />
                        <div className="text-2xl font-bold mb-1">{item.value}</div>
                        <div className="text-small text-default-500">{item.label}</div>
                    </CardBody>
                </Card>
            ))}
        </div>
    );
};