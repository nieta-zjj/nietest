"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    Button,
    Input,
    Card,
    Spinner,
    Pagination,
} from "@heroui/react";
import { Icon } from "@iconify/react";

import { SearchResultItem, SearchSelectItem } from "@/types/search";
import { searchCharacterOrElement, getPlaceholderSvg } from "@/utils/vtokenService";
import { VTokenType } from "@/types/vtoken";

/**
 * 令牌搜索模态框属性
 */
interface VTokenSearchModalProps {
    /** 模态框是否打开 */
    isOpen: boolean;
    /** 关闭模态框回调 */
    onClose: () => void;
    /** 选择项目回调 */
    onSelect: (item: SearchSelectItem) => void;
    /** 搜索类型 */
    type: VTokenType;
}

/**
 * 搜索类型配置
 */
const TYPE_CONFIG = {
    character: {
        title: "角色搜索",
        placeholder: "输入角色名称关键词",
        emptyText: "未找到相关角色，请尝试其他关键词",
        apiType: "oc",
    },
    element: {
        title: "元素搜索",
        placeholder: "输入元素名称关键词",
        emptyText: "未找到相关元素，请尝试其他关键词",
        apiType: "elementum",
    },
};

/**
 * 每页显示项目数
 */
const PAGE_SIZE = 12;

/**
 * 通用令牌搜索模态框组件
 * 可以搜索角色或元素
 */
const VTokenSearchModal: React.FC<VTokenSearchModalProps> = ({
    isOpen,
    onClose,
    onSelect,
    type,
}) => {
    // 状态定义
    const [keyword, setKeyword] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isFirstSearch, setIsFirstSearch] = useState(true);

    // 类型特定配置
    const config = useMemo(() => TYPE_CONFIG[type], [type]);

    // 搜索处理函数
    const doSearch = useCallback(
        async (searchKeyword: string, pageIndex: number) => {
            if (!searchKeyword.trim()) return;

            setIsLoading(true);
            setErrorMessage(null);

            try {
                // API页码从0开始，UI从1开始
                const apiPageIndex = pageIndex - 1;

                const response = await searchCharacterOrElement(
                    searchKeyword,
                    apiPageIndex,
                    PAGE_SIZE,
                    config.apiType as any
                );

                if (response.data) {
                    setSearchResults(response.data);
                    setTotalPages(response.metadata?.total_page_size || 1);
                    setTotalResults(response.metadata?.total_size || 0);
                } else if (response.error) {
                    setErrorMessage(`搜索${type === "character" ? "角色" : "元素"}失败: ${response.error}`);
                    setSearchResults([]);
                    setTotalPages(1);
                    setTotalResults(0);
                } else {
                    // 空结果
                    setSearchResults([]);
                    setTotalPages(1);
                    setTotalResults(0);
                }
            } catch (error) {
                console.error(`搜索${type === "character" ? "角色" : "元素"}失败:`, error);
                setErrorMessage(`搜索失败，请稍后重试`);
                setSearchResults([]);
                setTotalPages(1);
                setTotalResults(0);
            } finally {
                setIsLoading(false);
            }
        },
        [config.apiType, type]
    );

    // 确保总页数有效
    useEffect(() => {
        if (isNaN(totalPages) || totalPages <= 0) {
            setTotalPages(1);
        }
    }, [totalPages]);

    // 搜索按钮处理函数
    const handleSearch = useCallback(() => {
        if (!keyword.trim()) return;

        setPage(1);
        setIsFirstSearch(false);
        doSearch(keyword, 1);
    }, [keyword, doSearch]);

    // 键盘事件处理
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
                handleSearch();
            }
        },
        [handleSearch]
    );

    // 换页处理
    const handlePageChange = useCallback(
        (newPage: number) => {
            if (isLoading) return;

            // 确保页码有效
            const safePage = Math.max(1, Math.min(newPage, Math.max(1, totalPages)));

            if (safePage !== page) {
                setPage(safePage);
                doSearch(keyword, safePage);
            }
        },
        [isLoading, totalPages, page, keyword, doSearch]
    );

    // 选择项目
    const handleSelectItem = useCallback(
        (item: SearchResultItem) => {
            const selectItem: SearchSelectItem = {
                uuid: item.uuid,
                name: item.name,
                type: item.type,
                heat_score: item.heat_score,
                header_img: item.header_img,
            };

            onSelect(selectItem);
        },
        [onSelect]
    );

    // 分页信息
    const paginationInfo = useMemo(() => {
        if (isLoading) return "正在加载...";
        if (totalResults === 0 && !isFirstSearch) return "暂无结果";
        if (isFirstSearch) return "输入关键词开始搜索";

        return `共 ${totalResults} 个结果，当前第 ${page}/${totalPages} 页`;
    }, [isLoading, totalResults, isFirstSearch, page, totalPages]);

    // 图片加载错误处理
    const handleImageError = useCallback(
        (e: React.SyntheticEvent<HTMLImageElement>) => {
            (e.target as HTMLImageElement).src = getPlaceholderSvg(type);
        },
        [type]
    );

    return (
        <Modal
            hideCloseButton
            classNames={{
                base: "max-w-5xl h-[780px]",
                body: "p-0 h-[calc(100%-64px)]",
                header: "py-4 px-6 border-b border-default-100 dark:border-default-100/70",
                wrapper: "pt-[18px] pb-[18px]",
            }}
            isOpen={isOpen}
            size="3xl"
            onOpenChange={onClose}
        >
            <ModalContent>
                {() => (
                    <>
                        <ModalHeader className="flex justify-between items-center">
                            <div className="text-xl font-bold">{config.title}</div>
                            <Button
                                isIconOnly
                                className="rounded-full min-w-8 w-8 h-8 bg-default-100"
                                variant="light"
                                onPress={onClose}
                            >
                                <Icon icon="solar:close-circle-bold" width={20} />
                            </Button>
                        </ModalHeader>
                        <ModalBody className="p-4 overflow-hidden">
                            <div className="flex flex-col h-full space-y-4">
                                {/* 搜索区域 */}
                                <div className="flex gap-2 flex-shrink-0 mt-2">
                                    <Input
                                        className="flex-grow"
                                        placeholder={config.placeholder}
                                        size="sm"
                                        startContent={<Icon icon="solar:magnifer-linear" className="text-default-400 flex-shrink-0" />}
                                        value={keyword}
                                        onChange={(e) => setKeyword(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                    />
                                    <Button color="primary" size="sm" onPress={handleSearch}>
                                        搜索
                                    </Button>
                                </div>

                                {/* 错误消息 */}
                                {errorMessage && (
                                    <div className="text-danger text-sm py-2">{errorMessage}</div>
                                )}

                                {/* 搜索结果区域 */}
                                <div className="flex-grow flex flex-col overflow-hidden">
                                    {isLoading ? (
                                        <div className="flex items-center justify-center h-full">
                                            <Spinner size="lg" />
                                        </div>
                                    ) : isFirstSearch ? (
                                        <div className="flex flex-col items-center justify-center h-full text-default-400">
                                            <Icon icon="solar:magnifer-linear" width={40} />
                                            <p className="mt-2 text-center">输入关键词开始搜索</p>
                                        </div>
                                    ) : searchResults.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-default-400">
                                            <Icon icon="solar:emoji-sad-linear" width={40} />
                                            <p className="mt-2 text-center">{config.emptyText}</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 overflow-y-auto px-2 pb-2 flex-grow max-h-[550px]">
                                            {searchResults.map((item) => (
                                                <div key={item.uuid} className="flex flex-col">
                                                    <div
                                                        className="w-full cursor-pointer relative pb-[155%] bg-default-50 rounded-lg overflow-hidden border border-default-100 dark:border-default-100/70"
                                                        onClick={() => handleSelectItem(item)}
                                                    >
                                                        {/* 图片容器 */}
                                                        <div className="absolute inset-0">
                                                            <Image
                                                                alt={item.name}
                                                                src={item.header_img || getPlaceholderSvg(type)}
                                                                fill
                                                                style={{
                                                                    objectFit: "cover",
                                                                    objectPosition: "center top"
                                                                }}
                                                                onError={handleImageError}
                                                            />
                                                        </div>

                                                        {/* 热度标签 */}
                                                        <div className="absolute top-1 right-1 bg-danger text-white text-xs px-1.5 py-0.5 rounded-full flex items-center z-10">
                                                            <Icon icon="solar:heart-bold" className="mr-0.5" width={8} />
                                                            <span className="text-[10px]">{item.heat_score || 0}</span>
                                                        </div>

                                                        {/* 保存按钮 */}
                                                        {item.uuid === "存在按钮的ID" && (
                                                            <div className="absolute top-1 left-1 bg-primary text-white text-xs px-1.5 py-0.5 rounded-full flex items-center z-10">
                                                                <Icon icon="solar:bookmark-linear" className="mr-0.5" width={8} />
                                                                <span className="text-[10px]">存存</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* 名称显示 */}
                                                    <div className="mt-1 text-center">
                                                        <div className="text-xs font-medium truncate">
                                                            {item.name}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 分页区域 - 固定在底部 */}
                                    {!isFirstSearch && searchResults.length > 0 && (
                                        <div className="flex flex-col items-center mt-4 flex-shrink-0 py-2">
                                            <div className="text-xs text-gray-500 mb-2">{paginationInfo}</div>
                                            {totalPages > 1 && (
                                                <Pagination
                                                    isCompact
                                                    showControls
                                                    boundaries={3}
                                                    color="primary"
                                                    isDisabled={isLoading}
                                                    page={page}
                                                    siblings={1}
                                                    total={totalPages}
                                                    onChange={handlePageChange}
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </ModalBody>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
};

/**
 * 角色搜索模态框
 */
export const CharacterSearchModal: React.FC<Omit<VTokenSearchModalProps, "type">> = (props) => (
    <VTokenSearchModal {...props} type="character" />
);

/**
 * 元素搜索模态框
 */
export const ElementSearchModal: React.FC<Omit<VTokenSearchModalProps, "type">> = (props) => (
    <VTokenSearchModal {...props} type="element" />
);