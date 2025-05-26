"use client";

import React from "react";
import { Button, useDisclosure } from "@heroui/react";
import { Icon } from "@iconify/react";

import VTokenDisplay from "@/components/vtoken/VTokenDisplay";
import {
    CharacterSearchModal,
    ElementSearchModal,
} from "@/components/vtoken/VTokenSearchModal";
import { VTokenSelectorProps } from "@/types/vtoken";
import { SearchSelectItem } from "@/types/search";

/**
 * 令牌选择器组件
 * 用于选择角色或元素，并显示当前选中的项目
 */
const VTokenSelector: React.FC<VTokenSelectorProps> = ({
    name,
    type,
    header_img,
    onChange,
    onSelectItem,
    className = "",
    disabled = false,
}) => {
    // 搜索模态框控制
    const { isOpen, onOpen, onClose } = useDisclosure();

    // 处理项目选择
    const handleSelect = (item: SearchSelectItem) => {
        onChange(item.name);
        onSelectItem?.(item);
        onClose();
    };

    // 搜索模态框组件
    const SearchModal = type === "character" ? CharacterSearchModal : ElementSearchModal;

    return (
        <div className={`w-full ${className}`}>
            {name ? (
                <VTokenDisplay
                    header_img={header_img}
                    isDisabled={disabled}
                    name={name}
                    type={type}
                    onClose={disabled ? undefined : onOpen}
                />
            ) : (
                <Button
                    className="w-full"
                    color="primary"
                    isDisabled={disabled}
                    size="sm"
                    variant="flat"
                    startContent={<Icon icon={type === "character" ? "solar:user-linear" : "solar:magic-stick-3-linear"} />}
                    onPress={onOpen}
                >
                    {type === "character" ? "选择角色" : "选择元素"}
                </Button>
            )}

            <SearchModal isOpen={isOpen} onClose={onClose} onSelect={handleSelect} />
        </div>
    );
};

export default VTokenSelector;