"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
    Card,
    CardBody,
    CardHeader,
    Button,
    Chip,
    Spinner,
    Select,
    SelectItem,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Image,
    Slider,
    Tabs,
    Tab,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";

import { getTask, getTaskMatrix, updateSubtaskRating, getSubtaskRating, addSubtaskEvaluation, removeSubtaskEvaluation } from "@/utils/apiClient";
import { SubtaskResponse } from "@/types/task";
import { TaskStatusChip } from "@/components/task/task-status-chip";
import { CustomProgress } from "@/components/ui/custom-progress";
import SimpleTableView from "@/components/history/SimpleTableView";

// 导入简单表格样式
import "@/styles/simple-table.css";

// 导入类型定义
import type {
    APIResponse,
    TaskDetailResponse,
    MatrixData,
    TableCellData,
    TableRowData,
    DimensionFilter
} from "@/types/task";

// 占位图片URL
const PLACEHOLDER_IMAGE_URL = "/placeholder-image.png";

// 获取调整尺寸后的图片URL
const getResizedImageUrl = (url: string, size: number): string => {
    if (!url) return url;
    if (url.includes("x-oss-process=")) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}x-oss-process=image/resize,l_${size}/quality,q_80/format,webp`;
};

export default function TaskDetailPage() {
    const router = useRouter();
    const params = useParams();
    const taskId = params.id as string;

    // 基础状态
    const [task, setTask] = useState<TaskDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 折叠状态管理
    const [isTaskInfoCollapsed, setIsTaskInfoCollapsed] = useState(true);
    const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(false);

    // 矩阵数据和表格状态
    const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
    const [matrixLoading, setMatrixLoading] = useState(false);
    const [xAxis, setXAxis] = useState<string | null>(null);
    const [yAxis, setYAxis] = useState<string | null>(null);
    const [availableVariables, setAvailableVariables] = useState<string[]>([]);
    const [names, setVariableNames] = useState<Record<string, string>>({});
    const [dimensionFilters, setDimensionFilters] = useState<DimensionFilter[]>([]);
    const [filterableDimensions, setFilterableDimensions] = useState<string[]>([]);
    const [tableData, setTableData] = useState<TableRowData[]>([]);
    const [tableScale, setTableScale] = useState<number>(100);
    const [hasBatchTag, setHasBatchTag] = useState<boolean>(false);

    // 全屏和图片预览状态
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);
    const [currentImageUrl, setCurrentImageUrl] = useState<string>("");
    const [currentImageTitle, setCurrentImageTitle] = useState<string>("");
    const [currentImageUrls, setCurrentImageUrls] = useState<string[]>([]);
    const [isGridView, setIsGridView] = useState<boolean>(false);
    const [currentCellData, setCurrentCellData] = useState<TableCellData | null>(null);
    const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState<boolean>(false);
    const [currentRating, setCurrentRating] = useState<number>(0);
    const [currentEvaluations, setCurrentEvaluations] = useState<string[]>([]);
    const [newEvaluation, setNewEvaluation] = useState<string>("");

    // 引用
    const fullscreenElementRef = useRef<HTMLDivElement | null>(null);
    const dataLoadedRef = useRef<boolean>(false);
    const urlCache = useRef<Record<string, string>>({});

    // 格式化时间
    const formatTime = (timeStr: string) => {
        return new Date(timeStr).toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
    };

    // 获取网格列数
    const getGridColumns = (imageCount: number): string => {
        if (imageCount <= 1) return "grid-cols-1";
        if (imageCount <= 4) return "grid-cols-2";
        if (imageCount <= 9) return "grid-cols-3";
        if (imageCount <= 16) return "grid-cols-4";
        return "grid-cols-5";
    };

    // 根据批次图片数量确定图片尺寸
    const getImageSizeByBatchCount = (imageCount: number): number => {
        if (imageCount <= 1) return 720;
        if (imageCount <= 4) return 360;
        if (imageCount <= 9) return 240;
        if (imageCount <= 16) return 180;
        return 120;
    };

    // 加载任务详情
    const loadTaskDetail = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getTask(taskId, true);
            setTask(response.data);
        } catch (err) {
            console.error("加载任务详情失败:", err);
            setError("加载任务详情失败");
            toast.error("加载任务详情失败");
        } finally {
            setLoading(false);
        }
    };

    // 加载矩阵数据
    const loadMatrixData = async (forceRefresh = false) => {
        if (dataLoadedRef.current && !forceRefresh) return;

        try {
            setMatrixLoading(true);
            const response = await getTaskMatrix(taskId);
            const data = response.data as MatrixData;

            setMatrixData(data);

            // 处理变量数据
            if (data.variables_map) {
                const variables = Object.keys(data.variables_map).filter(key => {
                    const variable = data.variables_map![key];
                    return variable.name && variable.name.trim() !== '';
                });

                setAvailableVariables(variables);

                const names: Record<string, string> = {};
                variables.forEach(key => {
                    const variable = data.variables_map![key];
                    names[key] = variable.name || key;
                });
                setVariableNames(names);

                // 设置默认的X和Y轴
                if (variables.length >= 2 && !xAxis && !yAxis) {
                    setXAxis(variables[0]);
                    setYAxis(variables[1]);
                } else if (variables.length === 1 && !xAxis && !yAxis) {
                    // 对于单变量任务，默认选择X轴
                    setXAxis(variables[0]);
                }

                // 分析坐标键来检测其他变化的维度
                const existingKeys = Object.keys(data.coordinates_by_indices || {});
                const sampleKey = existingKeys[0];
                const totalDimensions = sampleKey ? sampleKey.split(",").length : 0;

                console.log("坐标键分析:", {
                    totalKeys: existingKeys.length,
                    sampleKey,
                    totalDimensions,
                    availableVariables: variables.length
                });

                // 设置可筛选的维度（除了X和Y轴的其他维度）
                const currentXDim = xAxis ? parseInt(xAxis.substring(1)) : -1;
                const currentYDim = yAxis ? parseInt(yAxis.substring(1)) : -1;

                // 基于总维度数量和已有变量创建可筛选维度列表
                const allFilterableDimensions = new Set<string>();

                // 添加variables_map中的维度（除了当前选择的X/Y轴）
                variables.filter(v => v !== xAxis && v !== yAxis).forEach(v => {
                    allFilterableDimensions.add(v);
                });

                // 添加其他可能的维度（基于坐标键的总维度数）
                for (let i = 0; i < totalDimensions; i++) {
                    const dimKey = `v${i}`;
                    if (i !== currentXDim && i !== currentYDim) {
                        allFilterableDimensions.add(dimKey);
                    }
                }

                const filterable = Array.from(allFilterableDimensions);
                setFilterableDimensions(filterable);

                // 为每个可筛选维度创建变量信息（如果不存在的话）
                const extendedVariableNames = { ...names };
                filterable.forEach(dimension => {
                    if (!extendedVariableNames[dimension]) {
                        const dimIndex = parseInt(dimension.substring(1));
                        // 从坐标键中分析这个维度的可用值
                        const dimensionValues = new Set<number>();
                        existingKeys.forEach(key => {
                            const coords = key.split(",").map(c => parseInt(c));
                            if (coords[dimIndex] !== undefined && coords[dimIndex] !== -1) {
                                dimensionValues.add(coords[dimIndex]);
                            }
                        });
                        const availableValues = Array.from(dimensionValues).sort((a, b) => a - b);
                        extendedVariableNames[dimension] = `维度${dimIndex} (${availableValues.length}个选项)`;
                    }
                });
                setVariableNames(extendedVariableNames);

                // 初始化筛选器（每个维度选择第一个可用值）
                const defaultFilters = filterable.map(dimension => {
                    const dimIndex = parseInt(dimension.substring(1));
                    // 从坐标键中获取这个维度的第一个可用值
                    const dimensionValues = new Set<number>();
                    existingKeys.forEach(key => {
                        const coords = key.split(",").map(c => parseInt(c));
                        if (coords[dimIndex] !== undefined && coords[dimIndex] !== -1) {
                            dimensionValues.add(coords[dimIndex]);
                        }
                    });
                    const availableValues = Array.from(dimensionValues).sort((a, b) => a - b);
                    return {
                        dimension,
                        valueIndex: availableValues.length > 0 ? availableValues[0] : 0
                    };
                });
                setDimensionFilters(defaultFilters);
            }

            dataLoadedRef.current = true;
        } catch (err) {
            console.error("加载矩阵数据失败:", err);
            setError("加载矩阵数据失败");
        } finally {
            setMatrixLoading(false);
        }
    };

    // 生成表格数据的函数
    const generateTableData = useCallback(() => {
        if (!matrixData || !matrixData.coordinates_by_indices) {
            setTableData([]);
            return;
        }

        // 分析可用的坐标数据，构建空间坐标系统
        const coordinateKeys = Object.keys(matrixData.coordinates_by_indices);
        if (coordinateKeys.length === 0) {
            setTableData([]);
            return;
        }

        console.log("构建空间坐标系统...");
        console.log("可用坐标键:", coordinateKeys.slice(0, 10)); // 显示前10个作为示例

        // 解析坐标空间的维度结构
        const sampleKey = coordinateKeys[0];
        const totalDimensions = sampleKey ? sampleKey.split(",").length : 0;
        console.log("检测到的坐标空间维度数:", totalDimensions);

        // 分析每个维度的可用值范围
        const dimensionRanges: Record<number, Set<number>> = {};
        coordinateKeys.forEach(key => {
            const coords = key.split(",").map(c => parseInt(c));
            coords.forEach((coord, dimIndex) => {
                if (!isNaN(coord) && coord >= 0) { // 只考虑有效的坐标值
                    if (!dimensionRanges[dimIndex]) {
                        dimensionRanges[dimIndex] = new Set();
                    }
                    dimensionRanges[dimIndex].add(coord);
                }
            });
        });

        console.log("空间坐标系统维度分析:");
        Object.entries(dimensionRanges).forEach(([dimIndex, values]) => {
            const sortedValues = Array.from(values).sort((a, b) => a - b);
            console.log(`  维度${dimIndex}: [${sortedValues.join(', ')}] (${sortedValues.length}个值)`);
        });

        // 获取X轴和Y轴的变量信息
        const xVariable = xAxis ? matrixData.variables_map?.[xAxis] : null;
        const yVariable = yAxis ? matrixData.variables_map?.[yAxis] : null;

        // 至少需要一个有效的变量进行表格显示
        if (!xVariable && !yVariable) {
            console.log("未选择有效的X轴或Y轴变量");
            setTableData([]);
            return;
        }

        // 智能坐标匹配函数：简化版本（后端统一返回简化格式）
        const findCoordinateUrl = (targetCoords: Record<string, number>): { url: string; isError: boolean; errorMessage?: string; subtaskId?: string; cellData?: any } => {
            // 构建目标坐标键 - 只包含有效的坐标维度
            const coordPairs: [number, number][] = [];
            Object.entries(targetCoords).forEach(([varKey, index]) => {
                const dimIndex = parseInt(varKey.substring(1)); // v0 -> 0, v1 -> 1
                coordPairs.push([dimIndex, index]);
            });

            // 应用维度筛选条件
            dimensionFilters.forEach(filter => {
                if (filter.valueIndex !== null) {
                    const dimIndex = parseInt(filter.dimension.substring(1));
                    coordPairs.push([dimIndex, filter.valueIndex]);
                }
            });

            // 按维度索引排序，确保坐标顺序正确
            coordPairs.sort((a, b) => a[0] - b[0]);

            // 构建简化坐标键（只包含连续的有效维度）
            const coordValues: string[] = [];
            for (let i = 0; i < coordPairs.length; i++) {
                const [dimIndex, value] = coordPairs[i];
                // 确保维度是连续的（从0开始）
                if (dimIndex === i) {
                    coordValues.push(value.toString());
                } else {
                    // 如果维度不连续，停止构建
                    break;
                }
            }

            if (coordValues.length === 0) {
                return { url: "", isError: false };
            }

            const coordinateKey = coordValues.join(",");
            const foundData = matrixData.coordinates_by_indices?.[coordinateKey];

            // 处理新的对象格式
            if (foundData && typeof foundData === 'object') {
                const url = (foundData as any).url || "";
                const subtaskId = (foundData as any).subtask_id;

                // 检查是否是错误类型
                if (url.startsWith("ERROR: ")) {
                    const errorMessage = url.substring(7); // 移除 "ERROR: " 前缀
                    console.log(`坐标查找: ${JSON.stringify(targetCoords)} -> ${coordinateKey} -> 错误: ${errorMessage.substring(0, 50)}...`);
                    return {
                        url: "",
                        isError: true,
                        errorMessage,
                        subtaskId,
                        cellData: foundData
                    };
                }

                console.log(`坐标查找: ${JSON.stringify(targetCoords)} -> ${coordinateKey} -> ${url ? '找到' : '未找到'}`);
                return {
                    url,
                    isError: false,
                    subtaskId,
                    cellData: foundData
                };
            }

            // 兼容旧格式（字符串）
            if (typeof foundData === 'string') {
                if (foundData.startsWith("ERROR: ")) {
                    const errorMessage = foundData.substring(7);
                    return { url: "", isError: true, errorMessage };
                }
                return { url: foundData, isError: false };
            }

            return { url: "", isError: false };
        };

        const newTableData: TableRowData[] = [];

        // 降维显示逻辑：根据选择的XY轴生成二维表格
        if (xVariable && !yVariable) {
            // 单维度表格：只有X轴
            console.log("构建单维度表格 (仅X轴)");
            const row: TableRowData = {
                key: "single-row",
                rowTitle: "结果"
            };

            xVariable.values.forEach((xValue, xIndex) => {
                const xDimension = parseInt(xAxis!.substring(1));
                const targetCoords = { [`v${xDimension}`]: xIndex };
                const { url, isError, errorMessage, subtaskId, cellData } = findCoordinateUrl(targetCoords);

                const cellDataObject: TableCellData = {
                    url: url,
                    xValue: xValue.value,
                    yValue: "",
                    coordinates: targetCoords,
                    hasValidImage: !!url,
                    errorMessage: isError ? errorMessage : undefined
                };

                // 如果有cellData，添加额外信息
                if (cellData) {
                    (cellDataObject as any).subtaskId = subtaskId;
                    (cellDataObject as any).rating = cellData.rating || 0;
                    (cellDataObject as any).evaluation = cellData.evaluation || [];
                    (cellDataObject as any).status = cellData.status;
                }

                row[xValue.value] = cellDataObject;
            });

            newTableData.push(row);
        }
        else if (yVariable && !xVariable) {
            // 单维度表格：只有Y轴
            console.log("构建单维度表格 (仅Y轴)");
            yVariable.values.forEach((yValue, yIndex) => {
                const yDimension = parseInt(yAxis!.substring(1));
                const targetCoords = { [`v${yDimension}`]: yIndex };
                const { url, isError, errorMessage, subtaskId, cellData } = findCoordinateUrl(targetCoords);

                const row: TableRowData = {
                    key: `row-${yIndex}`,
                    rowTitle: yValue.value
                };

                const cellDataObject: TableCellData = {
                    url: url,
                    xValue: "",
                    yValue: yValue.value,
                    coordinates: targetCoords,
                    hasValidImage: !!url,
                    errorMessage: isError ? errorMessage : undefined
                };

                // 如果有cellData，添加额外信息
                if (cellData) {
                    (cellDataObject as any).subtaskId = subtaskId;
                    (cellDataObject as any).rating = cellData.rating || 0;
                    (cellDataObject as any).evaluation = cellData.evaluation || [];
                    (cellDataObject as any).status = cellData.status;
                }

                row["result"] = cellDataObject;
                newTableData.push(row);
            });
        }
        else if (xVariable && yVariable) {
            // 二维表格：XY轴降维显示
            console.log("构建二维表格 (XY轴降维)");
            const xDimension = parseInt(xAxis!.substring(1));
            const yDimension = parseInt(yAxis!.substring(1));

            yVariable.values.forEach((yValue, yIndex) => {
                const row: TableRowData = {
                    key: `row-${yIndex}`,
                    rowTitle: yValue.value
                };

                xVariable.values.forEach((xValue, xIndex) => {
                    const targetCoords = {
                        [`v${xDimension}`]: xIndex,
                        [`v${yDimension}`]: yIndex
                    };
                    const { url, isError, errorMessage, subtaskId, cellData } = findCoordinateUrl(targetCoords);

                    const cellDataObject: TableCellData = {
                        url: url,
                        xValue: xValue.value,
                        yValue: yValue.value,
                        coordinates: targetCoords,
                        hasValidImage: !!url,
                        errorMessage: isError ? errorMessage : undefined
                    };

                    // 如果有cellData，添加额外信息
                    if (cellData) {
                        (cellDataObject as any).subtaskId = subtaskId;
                        (cellDataObject as any).rating = cellData.rating || 0;
                        (cellDataObject as any).evaluation = cellData.evaluation || [];
                        (cellDataObject as any).status = cellData.status;
                    }

                    row[xValue.value] = cellDataObject;
                });

                newTableData.push(row);
            });
        }

        // 输出表格构建结果
        console.log("空间坐标系统表格构建完成:");
        console.log(`- 总维度数: ${totalDimensions}`);
        console.log(`- X轴维度: ${xAxis ? `${xAxis} (维度${parseInt(xAxis.substring(1))})` : '未选择'}`);
        console.log(`- Y轴维度: ${yAxis ? `${yAxis} (维度${parseInt(yAxis.substring(1))})` : '未选择'}`);
        console.log(`- 生成行数: ${newTableData.length}`);
        console.log(`- 可用坐标数: ${coordinateKeys.length}`);

        // 统计有效图片数量
        let validImageCount = 0;
        newTableData.forEach(row => {
            Object.entries(row).forEach(([key, value]) => {
                if (key !== 'key' && key !== 'rowTitle' && typeof value === 'object' && value.hasValidImage) {
                    validImageCount++;
                }
            });
        });
        console.log(`- 有效图片数: ${validImageCount}`);

        setTableData(newTableData);
    }, [matrixData, xAxis, yAxis, dimensionFilters]);

    // 图片预览函数
    const viewImageInModal = (imageUrl: string, title: string = "", cellData?: TableCellData) => {
        setCurrentImageUrl(imageUrl);
        setCurrentImageTitle(title);
        setCurrentImageUrls([imageUrl]);
        setCurrentCellData(cellData || null);
        setIsGridView(false);
        setIsImageModalOpen(true);

        // 如果有子任务ID，加载评分和评价
        const subtaskId = (cellData as any)?.subtaskId;
        if (subtaskId) {
            loadSubtaskRatingAndEvaluation(subtaskId);
        } else {
            // 重置评分和评价
            setCurrentRating(0);
            setCurrentEvaluations([]);
        }
    };

    const viewMultipleImagesInModal = (urls: string[], title: string = "", cellData?: TableCellData) => {
        if (!hasBatchTag || urls.length <= 1) {
            viewImageInModal(urls[0], title, cellData);
            return;
        }

        setCurrentImageUrl(urls[0]);
        setCurrentImageTitle(title);
        setCurrentImageUrls(urls);
        setCurrentCellData(cellData || null);
        setIsGridView(false);
        setIsImageModalOpen(true);

        // 如果有子任务ID，加载评分和评价
        const subtaskId = (cellData as any)?.subtaskId;
        if (subtaskId) {
            loadSubtaskRatingAndEvaluation(subtaskId);
        } else {
            // 重置评分和评价
            setCurrentRating(0);
            setCurrentEvaluations([]);
        }
    };

    // 加载子任务评分和评价
    const loadSubtaskRatingAndEvaluation = async (subtaskId: string) => {
        try {
            const response = await getSubtaskRating(subtaskId);
            setCurrentRating(response.data.rating || 0);
            setCurrentEvaluations(response.data.evaluation || []);
        } catch (error) {
            console.error("加载子任务评分和评价失败:", error);
            toast.error("加载评分和评价失败");
        }
    };

    // 保存评分的函数
    const saveRating = async (rating: number) => {
        const subtaskId = (currentCellData as any)?.subtaskId;
        if (!subtaskId) {
            toast.error("无法获取子任务ID");
            return;
        }

        try {
            await updateSubtaskRating(subtaskId, rating);
            setCurrentRating(rating);
            toast.success(`评分已保存: ${rating}星`);
        } catch (error) {
            console.error("保存评分失败:", error);
            toast.error("保存评分失败");
        }
    };

    // 添加评价的函数
    const addEvaluation = async () => {
        const subtaskId = (currentCellData as any)?.subtaskId;
        if (!subtaskId) {
            toast.error("无法获取子任务ID");
            return;
        }

        if (!newEvaluation.trim()) {
            return;
        }

        try {
            const response = await addSubtaskEvaluation(subtaskId, newEvaluation.trim());
            setCurrentEvaluations(response.data.evaluation);
            setNewEvaluation("");
            toast.success('评价已添加');
        } catch (error) {
            console.error("添加评价失败:", error);
            toast.error("添加评价失败");
        }
    };

    // 删除评价的函数
    const removeEvaluation = async (index: number) => {
        const subtaskId = (currentCellData as any)?.subtaskId;
        if (!subtaskId) {
            toast.error("无法获取子任务ID");
            return;
        }

        try {
            const response = await removeSubtaskEvaluation(subtaskId, index);
            setCurrentEvaluations(response.data.evaluation);
            toast.success('评价已删除');
        } catch (error) {
            console.error("删除评价失败:", error);
            toast.error("删除评价失败");
        }
    };

    // 处理维度筛选变化
    const handleDimensionFilterChange = (dimension: string, valueIndex: number | null) => {
        setDimensionFilters(prev => {
            const updated = prev.map(filter =>
                filter.dimension === dimension
                    ? { ...filter, valueIndex }
                    : filter
            );
            return updated;
        });
    };

    // 处理缩放变更
    const handleScaleChange = (newScale: number) => {
        setTableScale(newScale);
    };

    // 全屏切换
    const toggleFullscreen = () => {
        if (!isFullscreen) {
            // 进入全屏
            if (fullscreenElementRef.current) {
                if (fullscreenElementRef.current.requestFullscreen) {
                    fullscreenElementRef.current.requestFullscreen();
                }
            }
        } else {
            // 退出全屏
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    // 监听全屏状态变化
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, []);

    // 初始化
    useEffect(() => {
        if (taskId) {
            loadTaskDetail();
            loadMatrixData();
        }
    }, [taskId]);

    // 当轴或筛选条件变化时重新生成表格数据
    useEffect(() => {
        generateTableData();
    }, [generateTableData]);

    // 更新可筛选维度和重置筛选器
    useEffect(() => {
        const filterable = availableVariables.filter(v => v !== xAxis && v !== yAxis);
        setFilterableDimensions(filterable);

        // 当XY轴变化时，重置筛选器以确保表格正确刷新
        if (matrixData && (xAxis || yAxis)) {
            const existingKeys = Object.keys(matrixData.coordinates_by_indices || {});
            const defaultFilters = filterable.map(dimension => {
                const dimIndex = parseInt(dimension.substring(1));
                // 从坐标键中获取这个维度的第一个可用值
                const dimensionValues = new Set<number>();
                existingKeys.forEach(key => {
                    const coords = key.split(",").map(c => parseInt(c));
                    if (coords[dimIndex] !== undefined && coords[dimIndex] !== -1) {
                        dimensionValues.add(coords[dimIndex]);
                    }
                });
                const availableValues = Array.from(dimensionValues).sort((a, b) => a - b);
                return {
                    dimension,
                    valueIndex: availableValues.length > 0 ? availableValues[0] : 0
                };
            });
            setDimensionFilters(defaultFilters);

            // 清空URL缓存，确保重新计算坐标
            urlCache.current = {};

            console.log(`轴变化触发重置: X=${xAxis}, Y=${yAxis}, 筛选器=${defaultFilters.length}个`);
        }
    }, [availableVariables, xAxis, yAxis, matrixData]);

    // 星级评分组件
    const StarRating = ({ rating, onRatingChange }: { rating: number; onRatingChange: (rating: number) => void }) => {
        const [hoverRating, setHoverRating] = useState<number>(0);

        return (
            <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Icon
                        key={star}
                        icon="solar:star-bold"
                        width={20}
                        className={`cursor-pointer transition-colors ${star <= (hoverRating || rating)
                            ? "text-warning-400"
                            : "text-default-300"
                            }`}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => onRatingChange(star)}
                    />
                ))}
                <span className="text-sm text-default-500 ml-2">
                    {rating > 0 ? `${rating}/5` : "未评分"}
                </span>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Spinner size="lg" />
                    <p className="text-default-500">加载任务详情中...</p>
                </div>
            </div>
        );
    }

    if (error || !task) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                    <Icon icon="solar:file-text-linear" className="w-16 h-16 mx-auto mb-4 text-default-400" />
                    <p className="text-lg text-default-600 mb-2">加载失败</p>
                    <p className="text-sm text-default-400 mb-4">{error || "任务不存在"}</p>
                    <Button color="primary" onPress={() => router.back()}>
                        返回
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col px-6 py-4">
            <div className="flex-1 flex flex-col space-y-2 min-h-0">
                {/* 页面标题和操作 */}
                <div className="flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="flat"
                            startContent={<Icon icon="solar:arrow-left-linear" />}
                            onPress={() => router.back()}
                        >
                            返回
                        </Button>
                        <div>
                            <h1 className="text-2xl font-semibold">{task.name}</h1>
                            <p className="text-sm text-default-500">任务详情</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <TaskStatusChip status={task.status} />
                        <Button
                            variant="flat"
                            startContent={<Icon icon="solar:refresh-linear" />}
                            onPress={() => {
                                loadTaskDetail();
                                loadMatrixData(true);
                            }}
                        >
                            刷新
                        </Button>
                    </div>
                </div>

                {/* 任务信息卡片 */}
                <Card className="flex-shrink-0">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between w-full">
                            <h3 className="text-lg font-medium">基本信息</h3>
                            <Button
                                size="sm"
                                variant="light"
                                isIconOnly
                                onPress={() => setIsTaskInfoCollapsed(!isTaskInfoCollapsed)}
                            >
                                <Icon
                                    icon={isTaskInfoCollapsed ? "solar:alt-arrow-down-linear" : "solar:alt-arrow-up-linear"}
                                    width={16}
                                />
                            </Button>
                        </div>
                    </CardHeader>
                    {!isTaskInfoCollapsed && (
                        <CardBody className="space-y-3 pt-0">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <p className="text-sm text-default-500">用户</p>
                                    <p className="text-sm">{task.username}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-default-500">创建时间</p>
                                    <p className="text-sm">{formatTime(task.created_at)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-default-500">总进度</p>
                                    <p className="text-sm">{task.processed_images}/{task.total_images} ({task.progress}%)</p>
                                </div>
                            </div>

                            <CustomProgress
                                total={task.total_images}
                                completed={task.processed_images}
                                failed={0}
                                size="md"
                                className="w-full"
                            />
                        </CardBody>
                    )}
                </Card>

                {/* XY表格设置 */}
                {availableVariables.length >= 1 && (
                    <Card className="flex-shrink-0">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between w-full">
                                <h3 className="text-lg font-medium flex items-center gap-2">
                                    <Icon icon="solar:chart-2-linear" width={20} />
                                    轴向设置
                                </h3>
                                <Button
                                    size="sm"
                                    variant="light"
                                    isIconOnly
                                    onPress={() => setIsSettingsCollapsed(!isSettingsCollapsed)}
                                >
                                    <Icon
                                        icon={isSettingsCollapsed ? "solar:alt-arrow-down-linear" : "solar:alt-arrow-up-linear"}
                                        width={16}
                                    />
                                </Button>
                            </div>
                        </CardHeader>
                        {!isSettingsCollapsed && (
                            <CardBody className="pt-0">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Select
                                        className="w-full"
                                        label="X轴"
                                        placeholder="选择X轴变量"
                                        selectedKeys={xAxis ? [xAxis] : []}
                                        onSelectionChange={(keys) => {
                                            const keysArray = Array.from(keys);
                                            if (keysArray.length > 0) {
                                                const newXAxis = keysArray[0] as string;
                                                if (newXAxis === yAxis) {
                                                    setYAxis("");
                                                }
                                                setXAxis(newXAxis);
                                            } else {
                                                setXAxis("");
                                            }
                                        }}
                                    >
                                        {availableVariables.map((variable) => (
                                            <SelectItem key={variable}>
                                                {`${variable}: ${names[variable] || ""}`}
                                            </SelectItem>
                                        ))}
                                    </Select>
                                    <Select
                                        className="w-full"
                                        label="Y轴"
                                        placeholder="选择Y轴变量"
                                        selectedKeys={yAxis ? [yAxis] : []}
                                        onSelectionChange={(keys) => {
                                            const keysArray = Array.from(keys);
                                            if (keysArray.length > 0) {
                                                const newYAxis = keysArray[0] as string;
                                                if (newYAxis === xAxis) {
                                                    setXAxis("");
                                                }
                                                setYAxis(newYAxis);
                                            } else {
                                                setYAxis("");
                                            }
                                        }}
                                    >
                                        {availableVariables.map((variable) => (
                                            <SelectItem
                                                key={variable}
                                                className={variable === xAxis ? "opacity-50 pointer-events-none" : ""}
                                            >
                                                {`${variable}: ${names[variable] || ""}`}
                                            </SelectItem>
                                        ))}
                                    </Select>
                                </div>

                                {/* 其他维度筛选 */}
                                {filterableDimensions.length > 0 && (
                                    <div className="mt-4">
                                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                            <Icon icon="solar:filter-linear" width={14} />
                                            固定其他维度
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                            {filterableDimensions.map((dimension) => {
                                                const varData = matrixData?.variables_map?.[dimension];
                                                const currentFilter = dimensionFilters.find(f => f.dimension === dimension);
                                                const currentValueIndex = currentFilter?.valueIndex;

                                                // 如果是variables_map中的维度，使用原有逻辑
                                                if (varData?.values && varData.values.length > 0) {
                                                    return (
                                                        <Select
                                                            key={`filter-${dimension}`}
                                                            className="w-full"
                                                            label={`${names[dimension] || dimension}`}
                                                            placeholder={`选择值`}
                                                            selectedKeys={currentValueIndex !== null ? [`${currentValueIndex}`] : ['0']}
                                                            onSelectionChange={(keys) => {
                                                                const keysArray = Array.from(keys);
                                                                if (keysArray.length > 0) {
                                                                    const valueIndex = parseInt(keysArray[0] as string);
                                                                    handleDimensionFilterChange(dimension, valueIndex);
                                                                }
                                                            }}
                                                        >
                                                            {varData.values.map((value, index) => (
                                                                <SelectItem key={`${index}`}>
                                                                    {value.value}
                                                                </SelectItem>
                                                            ))}
                                                        </Select>
                                                    );
                                                }

                                                // 如果是虚拟维度，从坐标键中提取可用值
                                                const dimIndex = parseInt(dimension.substring(1));
                                                const existingKeys = Object.keys(matrixData?.coordinates_by_indices || {});
                                                const dimensionValues = new Set<number>();

                                                existingKeys.forEach(key => {
                                                    const coords = key.split(",").map(c => parseInt(c));
                                                    if (coords[dimIndex] !== undefined && coords[dimIndex] !== -1) {
                                                        dimensionValues.add(coords[dimIndex]);
                                                    }
                                                });

                                                const availableValues = Array.from(dimensionValues).sort((a, b) => a - b);

                                                if (availableValues.length === 0) return null;

                                                return (
                                                    <Select
                                                        key={`filter-${dimension}`}
                                                        className="w-full"
                                                        label={`${names[dimension] || dimension}`}
                                                        placeholder={`选择值`}
                                                        selectedKeys={currentValueIndex !== null ? [`${currentValueIndex}`] : ['0']}
                                                        onSelectionChange={(keys) => {
                                                            const keysArray = Array.from(keys);
                                                            if (keysArray.length > 0) {
                                                                const valueIndex = parseInt(keysArray[0] as string);
                                                                handleDimensionFilterChange(dimension, valueIndex);
                                                            }
                                                        }}
                                                    >
                                                        {availableValues.map((value) => (
                                                            <SelectItem key={`${value}`}>
                                                                {value}
                                                            </SelectItem>
                                                        ))}
                                                    </Select>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </CardBody>
                        )}
                    </Card>
                )}

                {/* 结果表格 */}
                {(xAxis || yAxis) && tableData && tableData.length > 0 && (
                    <div className="flex-1 flex flex-col min-h-0">
                        <Card className="flex-1 flex flex-col min-h-0">
                            <CardBody className="flex-1 overflow-hidden p-0">
                                <div
                                    ref={fullscreenElementRef}
                                    className={`${isFullscreen ? "fullscreen-table" : ""}`}
                                    style={{
                                        maxWidth: "100%",
                                        height: isFullscreen ? "100vh" : "calc(100vh - 250px)",
                                        position: "relative",
                                        padding: "0"
                                    }}
                                >
                                    <SimpleTableView
                                        tableData={tableData}
                                        columnValues={(() => {
                                            if (!tableData || tableData.length === 0) return [];
                                            const cols = Object.keys(tableData[0]).filter(key => key !== "key" && key !== "rowTitle");
                                            return cols;
                                        })()}
                                        xAxis={xAxis}
                                        yAxis={yAxis}
                                        tableScale={tableScale}
                                        hasBatchTag={hasBatchTag}
                                        onViewImage={viewImageInModal}
                                        onViewMultipleImages={viewMultipleImagesInModal}
                                        onScaleChange={handleScaleChange}
                                    />
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                )}

                {/* 无表格数据提示 */}
                {(xAxis || yAxis) && (!tableData || tableData.length === 0) && (
                    <Card>
                        <CardBody>
                            <div className="text-center p-8">
                                <Icon icon="solar:table-linear" className="w-16 h-16 mx-auto mb-4 text-default-300" />
                                <h4 className="text-lg font-medium mb-2">无法构建空间坐标系统表格</h4>
                                <p className="text-default-500 mb-4">从coordinates_by_indices中无法找到匹配的坐标数据</p>
                                <div className="text-left max-w-md mx-auto">
                                    <p className="text-default-400 text-sm mb-3">可能的原因：</p>
                                    <ul className="text-default-400 text-sm list-disc list-inside space-y-1">
                                        <li>所选维度组合在坐标空间中没有对应的数据点</li>
                                        <li>coordinates_by_indices中的坐标格式与预期不匹配</li>
                                        <li>任务的子任务尚未完成，缺少坐标数据</li>
                                        <li>其他维度的筛选条件过于严格，排除了所有可能的组合</li>
                                    </ul>
                                    <div className="mt-4 p-3 bg-default-100 rounded-md">
                                        <p className="text-xs text-default-600 font-medium mb-1">调试建议：</p>
                                        <p className="text-xs text-default-500">
                                            • 尝试选择不同的XY轴维度组合<br />
                                            • 放宽或清除其他维度的筛选条件<br />
                                            • 查看浏览器控制台的坐标匹配日志
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                )}

                {/* 无变量提示 */}
                {availableVariables.length === 0 && (
                    <Card>
                        <CardBody>
                            <div className="text-center p-8">
                                <Icon icon="solar:chart-2-linear" className="w-16 h-16 mx-auto mb-4 text-default-300" />
                                <h4 className="text-lg font-medium mb-2">无法构建空间坐标系统</h4>
                                <p className="text-default-500">此任务没有足够的维度变量来创建空间坐标表格</p>
                                <div className="mt-4 text-sm text-default-400">
                                    <p>空间坐标系统需要：</p>
                                    <ul className="list-disc list-inside mt-2">
                                        <li>至少一个有效的变量维度</li>
                                        <li>variables_map中包含变量定义</li>
                                        <li>coordinates_by_indices中包含坐标数据</li>
                                    </ul>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                )}
            </div>

            {/* 图片查看模态框 */}
            <Modal isOpen={isImageModalOpen} size="full" onClose={() => setIsImageModalOpen(false)}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-semibold">{currentImageTitle || "图片查看"}</h3>
                                    {isGridView && (
                                        <p className="text-xs text-default-500 mt-1">
                                            批量图片: {currentImageUrls.length} 张
                                        </p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    {currentImageUrls.length > 1 && hasBatchTag && (
                                        <Button
                                            color="primary"
                                            size="sm"
                                            startContent={
                                                <Icon
                                                    icon={
                                                        isGridView
                                                            ? "solar:square-single-linear"
                                                            : "solar:square-multiple-linear"
                                                    }
                                                    width={16}
                                                />
                                            }
                                            variant="bordered"
                                            onPress={() => setIsGridView(!isGridView)}
                                        >
                                            {isGridView ? "单张查看" : "网格查看"}
                                        </Button>
                                    )}
                                </div>
                            </ModalHeader>
                            <ModalBody className="p-4 overflow-auto">
                                <div className="flex gap-4 h-full">
                                    {/* 图片显示区域 */}
                                    <div className="flex-1 bg-default-900 rounded-lg p-4 flex items-center justify-center" style={{ minHeight: "60vh" }}>
                                        {!isGridView && currentImageUrl && (
                                            <Image
                                                alt={currentImageTitle}
                                                className="max-w-full max-h-full object-contain"
                                                height="auto"
                                                src={currentImageUrl || PLACEHOLDER_IMAGE_URL}
                                                style={{ maxHeight: "70vh", objectFit: "contain" }}
                                                width="auto"
                                            />
                                        )}

                                        {isGridView && currentImageUrls.length > 0 && hasBatchTag && (
                                            <div
                                                className={`grid gap-4 w-full ${getGridColumns(currentImageUrls.length)}`}
                                                style={{ gridAutoRows: "minmax(300px, auto)" }}
                                            >
                                                {currentImageUrls.map((url, index) => (
                                                    <div
                                                        key={index}
                                                        className="relative overflow-hidden border border-default-200 cursor-pointer flex items-center justify-center bg-default-50 rounded-lg"
                                                        style={{ minHeight: "300px" }}
                                                        onClick={() => {
                                                            setCurrentImageUrl(url);
                                                            setIsGridView(false);
                                                        }}
                                                    >
                                                        <Image
                                                            alt={`${currentImageTitle} - 批次 ${index + 1}`}
                                                            className="object-contain max-w-full max-h-full"
                                                            height="auto"
                                                            src={
                                                                getResizedImageUrl(
                                                                    url,
                                                                    getImageSizeByBatchCount(currentImageUrls.length)
                                                                ) || PLACEHOLDER_IMAGE_URL
                                                            }
                                                            style={{ objectFit: "contain" }}
                                                            width="auto"
                                                        />
                                                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center">
                                                            批次 {index + 1}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* 信息面板 */}
                                    <div className="w-96 flex flex-col gap-4">
                                        {/* 坐标信息 */}
                                        {currentCellData && (
                                            <Card>
                                                <CardHeader className="pb-3">
                                                    <h4 className="text-medium font-semibold flex items-center gap-2">
                                                        <Icon icon="solar:map-point-linear" width={18} />
                                                        坐标信息
                                                    </h4>
                                                </CardHeader>
                                                <CardBody className="pt-0 space-y-3">
                                                    {xAxis && currentCellData.xValue && (
                                                        <div>
                                                            <p className="text-sm text-default-500">X轴 ({names[xAxis] || xAxis})</p>
                                                            <p className="text-sm font-medium">{currentCellData.xValue}</p>
                                                        </div>
                                                    )}
                                                    {yAxis && currentCellData.yValue && (
                                                        <div>
                                                            <p className="text-sm text-default-500">Y轴 ({names[yAxis] || yAxis})</p>
                                                            <p className="text-sm font-medium">{currentCellData.yValue}</p>
                                                        </div>
                                                    )}
                                                    {currentCellData.coordinates && Object.keys(currentCellData.coordinates).length > 0 && (
                                                        <div>
                                                            <p className="text-sm text-default-500 mb-2">完整坐标</p>
                                                            <div className="space-y-1">
                                                                {Object.entries(currentCellData.coordinates).map(([dim, value]) => (
                                                                    <div key={dim} className="flex justify-between items-center text-xs bg-default-100 p-2 rounded">
                                                                        <span className="text-default-600">{names[dim] || dim}</span>
                                                                        <span className="font-mono">{value}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </CardBody>
                                            </Card>
                                        )}

                                        {/* 评分 */}
                                        <Card>
                                            <CardHeader className="pb-3">
                                                <h4 className="text-medium font-semibold flex items-center gap-2">
                                                    <Icon icon="solar:star-linear" width={18} />
                                                    评分
                                                </h4>
                                            </CardHeader>
                                            <CardBody className="pt-0">
                                                <StarRating
                                                    rating={currentRating}
                                                    onRatingChange={saveRating}
                                                />
                                            </CardBody>
                                        </Card>

                                        {/* 评价 */}
                                        <Card>
                                            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                                                <h4 className="text-medium font-semibold flex items-center gap-2">
                                                    <Icon icon="solar:chat-round-line-linear" width={18} />
                                                    评价
                                                </h4>
                                                <Button
                                                    size="sm"
                                                    color="primary"
                                                    variant="flat"
                                                    onPress={() => setIsEvaluationModalOpen(true)}
                                                >
                                                    管理评价
                                                </Button>
                                            </CardHeader>
                                            <CardBody className="pt-0">
                                                {currentEvaluations.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {currentEvaluations.slice(0, 3).map((evaluation, index) => (
                                                            <Chip key={index} size="sm" variant="flat">
                                                                {evaluation.length > 20 ? `${evaluation.substring(0, 20)}...` : evaluation}
                                                            </Chip>
                                                        ))}
                                                        {currentEvaluations.length > 3 && (
                                                            <Chip size="sm" variant="flat" className="text-default-500">
                                                                +{currentEvaluations.length - 3} 更多
                                                            </Chip>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-default-500">暂无评价</p>
                                                )}
                                            </CardBody>
                                        </Card>
                                    </div>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button
                                    color="primary"
                                    startContent={<Icon icon="solar:close-circle-linear" width={18} />}
                                    variant="bordered"
                                    onPress={onClose}
                                >
                                    关闭
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* 评价管理模态框 */}
            <Modal isOpen={isEvaluationModalOpen} size="2xl" onClose={() => setIsEvaluationModalOpen(false)}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <Icon icon="solar:chat-round-line-linear" width={20} />
                                    管理评价
                                </h3>
                            </ModalHeader>
                            <ModalBody className="space-y-4">
                                {/* 添加新评价 */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">添加新评价</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newEvaluation}
                                            onChange={(e) => setNewEvaluation(e.target.value)}
                                            placeholder="输入评价内容..."
                                            className="flex-1 px-3 py-2 border border-default-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    addEvaluation();
                                                }
                                            }}
                                        />
                                        <Button
                                            color="primary"
                                            onPress={addEvaluation}
                                            isDisabled={!newEvaluation.trim()}
                                        >
                                            添加
                                        </Button>
                                    </div>
                                </div>

                                {/* 现有评价列表 */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">现有评价</label>
                                    {currentEvaluations.length > 0 ? (
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {currentEvaluations.map((evaluation, index) => (
                                                <div key={index} className="flex items-center gap-2 p-3 bg-default-50 rounded-lg">
                                                    <span className="flex-1 text-sm">{evaluation}</span>
                                                    <Button
                                                        isIconOnly
                                                        size="sm"
                                                        color="danger"
                                                        variant="light"
                                                        onPress={() => removeEvaluation(index)}
                                                    >
                                                        <Icon icon="solar:trash-bin-trash-linear" width={16} />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-default-500 text-center py-4">暂无评价</p>
                                    )}
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button
                                    color="primary"
                                    variant="bordered"
                                    onPress={onClose}
                                >
                                    完成
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}