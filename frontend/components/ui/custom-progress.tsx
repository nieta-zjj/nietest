"use client";

import React from "react";

interface CustomProgressProps {
    total: number;
    completed: number;
    failed: number;
    className?: string;
    size?: "sm" | "md" | "lg";
}

export const CustomProgress: React.FC<CustomProgressProps> = ({
    total,
    completed,
    failed,
    className,
    size = "sm"
}) => {
    // 计算百分比
    const completedPercent = total > 0 ? (completed / total) * 100 : 0;
    const failedPercent = total > 0 ? (failed / total) * 100 : 0;
    const remainingPercent = 100 - completedPercent - failedPercent;

    // 根据size设置高度
    const heightClass = {
        sm: "h-1",
        md: "h-2",
        lg: "h-3"
    }[size];

    return (
        <div className={`w-full bg-default-200 rounded-full overflow-hidden ${heightClass} ${className || ""}`}>
            <div className="flex h-full">
                {/* 成功部分 - 绿色 */}
                {completedPercent > 0 && (
                    <div
                        className="bg-success-500 transition-all duration-300"
                        style={{ width: `${completedPercent}%` }}
                    />
                )}

                {/* 失败部分 - 红色 */}
                {failedPercent > 0 && (
                    <div
                        className="bg-danger-500 transition-all duration-300"
                        style={{ width: `${failedPercent}%` }}
                    />
                )}

                {/* 剩余部分 - 灰色（等待/执行中） */}
                {remainingPercent > 0 && (
                    <div
                        className="bg-default-300 transition-all duration-300"
                        style={{ width: `${remainingPercent}%` }}
                    />
                )}
            </div>
        </div>
    );
};