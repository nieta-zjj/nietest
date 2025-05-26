"use client";

import { Progress } from "@heroui/react";

interface TaskProgressBarProps {
    progress: number;
    processedImages: number;
    totalImages: number;
    size?: "sm" | "md" | "lg";
    showLabel?: boolean;
}

export const TaskProgressBar: React.FC<TaskProgressBarProps> = ({
    progress,
    processedImages,
    totalImages,
    size = "md",
    showLabel = true
}) => {
    const getProgressColor = (progress: number) => {
        if (progress === 100) return "success";
        if (progress >= 75) return "primary";
        if (progress >= 50) return "warning";
        return "default";
    };

    return (
        <div className="w-full">
            <Progress
                size={size}
                value={progress}
                color={getProgressColor(progress)}
                showValueLabel={showLabel}
                label={showLabel ? `${processedImages}/${totalImages} 张图片` : undefined}
                className="w-full"
            />
        </div>
    );
};