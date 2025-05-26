"use client";

import { Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { TaskStatus } from "@/types/task";

interface TaskStatusChipProps {
    status: string;
    size?: "sm" | "md" | "lg";
}

export const TaskStatusChip: React.FC<TaskStatusChipProps> = ({
    status,
    size = "sm"
}) => {
    const getStatusConfig = (status: string) => {
        switch (status.toLowerCase()) {
            case TaskStatus.PENDING:
                return {
                    color: "warning" as const,
                    icon: "solar:clock-circle-linear",
                    text: "等待中"
                };
            case "processing":
            case TaskStatus.RUNNING:
                return {
                    color: "primary" as const,
                    icon: "solar:play-circle-linear",
                    text: "运行中"
                };
            case TaskStatus.COMPLETED:
                return {
                    color: "success" as const,
                    icon: "solar:check-circle-linear",
                    text: "已完成"
                };
            case TaskStatus.FAILED:
                return {
                    color: "danger" as const,
                    icon: "solar:close-circle-linear",
                    text: "失败"
                };
            case TaskStatus.CANCELLED:
                return {
                    color: "default" as const,
                    icon: "solar:stop-circle-linear",
                    text: "已取消"
                };
            default:
                return {
                    color: "default" as const,
                    icon: "solar:question-circle-linear",
                    text: status
                };
        }
    };

    const config = getStatusConfig(status);

    return (
        <Chip
            color={config.color}
            size={size}
            variant="flat"
            startContent={<Icon icon={config.icon} className="w-4 h-4" />}
        >
            {config.text}
        </Chip>
    );
};