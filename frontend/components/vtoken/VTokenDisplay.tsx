"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

import { VTokenType } from "@/types/vtoken";
import { getPlaceholderSvg } from "@/utils/vtokenService";

interface VTokenDisplayProps {
    /** 令牌名称 */
    name: string;
    /** 令牌类型 */
    type: VTokenType;
    /** 头图URL */
    header_img?: string;
    /** 是否禁用 */
    isDisabled?: boolean;
    /** 点击关闭/变更回调 */
    onClose?: () => void;
}

/**
 * 令牌展示组件
 * 用于展示已选择的角色或元素
 */
const VTokenDisplay: React.FC<VTokenDisplayProps> = ({
    name,
    type,
    header_img,
    isDisabled = false,
    onClose,
}) => {
    // 图片加载错误处理
    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        (e.target as HTMLImageElement).src = getPlaceholderSvg(type);
    };

    return (
        <div className={`flex items-center gap-2 border border-default-200 dark:border-default-100 rounded-md p-2 ${isDisabled ? 'opacity-60' : ''}`}>
            {/* 头图 */}
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                <Image
                    alt={name}
                    className="w-full h-full object-cover"
                    height={32}
                    src={header_img || getPlaceholderSvg(type)}
                    width={32}
                    onError={handleImageError}
                />
            </div>

            {/* 名称 */}
            <div className="flex-grow truncate text-sm">
                {name}
            </div>

            {/* 关闭按钮改为更改按钮 */}
            {!isDisabled && onClose && (
                <Button
                    className="text-xs text-default-500 min-w-14 h-6 px-2"
                    size="sm"
                    variant="light"
                    onPress={onClose}
                >
                    更改
                </Button>
            )}
        </div>
    );
};

export default VTokenDisplay;