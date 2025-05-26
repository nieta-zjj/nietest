import React, { useState, useEffect, useRef, useMemo } from "react";
import { Icon } from "@iconify/react";
import { Button, Image, Slider } from "@heroui/react";
import type { TableCellData } from "@/types/task";

// 图片URL处理函数
const getResizedImageUrl = (url: string, size: number): string => {
    if (!url) return url;
    if (url.includes("x-oss-process=")) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}x-oss-process=image/resize,l_${size}/quality,q_80/format,webp`;
};

// 排序方向类型
type SortDirection = 'asc' | 'desc' | null;

// 排序状态接口
interface SortState {
    column: string | null;
    direction: SortDirection;
}

interface SimpleTableViewProps {
    tableData: any[];
    columnValues: string[];
    xAxis: string | null;
    yAxis: string | null;
    tableScale: number;
    hasBatchTag: boolean;
    onViewImage: (url: string, title: string, cellData?: TableCellData) => void;
    onViewMultipleImages: (urls: string[], title: string, cellData?: TableCellData) => void;
    onScaleChange?: (scale: number) => void;
}

// 懒加载图片组件
const LazyImage: React.FC<{
    src: string;
    alt: string;
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void;
}> = ({ src, alt, className, style, onClick }) => {
    const imgRef = useRef<HTMLDivElement>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.1 }
        );

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, []);

    const handleError = () => {
        setHasError(true);
        setIsLoaded(true);
    };

    return (
        <div
            ref={imgRef}
            className={`relative cursor-pointer ${className || ''}`}
            style={style}
            onClick={onClick}
        >
            {!isLoaded && !hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-default-50">
                    <Icon icon="solar:refresh-linear" className="animate-spin text-default-400" width={24} />
                </div>
            )}

            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-default-50 text-xs text-default-500">
                    <div className="text-center">
                        <Icon icon="solar:danger-triangle-linear" className="w-5 h-5 mx-auto mb-1 text-danger" />
                        <span>图片加载失败</span>
                    </div>
                </div>
            )}

            {isInView && !hasError && (
                <img
                    alt={alt}
                    className={isLoaded ? "opacity-100 max-w-full max-h-full" : "opacity-0"}
                    src={src}
                    style={{
                        objectFit: "contain",
                        width: "auto",
                        height: "auto",
                        transition: "opacity 0.2s ease",
                    }}
                    onError={handleError}
                    onLoad={() => setIsLoaded(true)}
                />
            )}
        </div>
    );
};

export const SimpleTableView: React.FC<SimpleTableViewProps> = ({
    tableData,
    columnValues,
    xAxis,
    yAxis,
    tableScale,
    hasBatchTag,
    onViewImage,
    onViewMultipleImages,
    onScaleChange,
}) => {
    // 表格容器引用
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // 全屏状态
    const [isFullscreen, setIsFullscreen] = useState(false);

    // 内部缩放状态（用于全屏时的独立缩放）
    const [internalScale, setInternalScale] = useState(100);

    // 排序状态
    const [sortState, setSortState] = useState<SortState>({
        column: null,
        direction: null
    });

    // 获取当前使用的缩放值
    const currentScale = isFullscreen ? internalScale : tableScale;

    // 全屏切换
    const toggleFullscreen = () => {
        if (!isFullscreen) {
            // 进入全屏
            setInternalScale(tableScale); // 继承当前缩放
            setIsFullscreen(true);
        } else {
            // 退出全屏
            setIsFullscreen(false);
            if (onScaleChange) {
                onScaleChange(internalScale); // 将全屏时的缩放值同步回父组件
            }
        }
    };

    // 缩放处理
    const handleScaleChange = (newScale: number) => {
        const clampedScale = Math.max(50, Math.min(200, newScale));

        if (isFullscreen) {
            setInternalScale(clampedScale);
        } else if (onScaleChange) {
            onScaleChange(clampedScale);
        }
    };

    // 键盘事件处理
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isFullscreen) {
                if (e.key === 'Escape') {
                    toggleFullscreen();
                } else if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    handleScaleChange(currentScale + 10);
                } else if (e.key === '-') {
                    e.preventDefault();
                    handleScaleChange(currentScale - 10);
                } else if (e.key === '0') {
                    e.preventDefault();
                    handleScaleChange(100);
                }
            }
        };

        if (isFullscreen) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFullscreen, currentScale]);

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

    // 判断字符串是否为数字
    const isNumeric = (str: string): boolean => {
        return !isNaN(parseFloat(str)) && isFinite(Number(str));
    };

    // 排序函数
    const sortData = (data: any[], column: string, direction: SortDirection): any[] => {
        if (!column || !direction) return data;

        return [...data].sort((a, b) => {
            let valueA: string = column === 'rowTitle' ? a[column] : '';
            let valueB: string = column === 'rowTitle' ? b[column] : '';

            // 如果不是rowTitle列，则需要从单元格数据中提取值
            if (column !== 'rowTitle') {
                valueA = a[column]?.xValue || a[column]?.yValue || '';
                valueB = b[column]?.xValue || b[column]?.yValue || '';
            }

            // 检查是否为数字
            const isANumeric = isNumeric(valueA);
            const isBNumeric = isNumeric(valueB);

            // 如果两者都是数字，按数字大小排序
            if (isANumeric && isBNumeric) {
                return direction === 'asc'
                    ? Number(valueA) - Number(valueB)
                    : Number(valueB) - Number(valueA);
            }

            // 否则按字母顺序排序
            return direction === 'asc'
                ? valueA.localeCompare(valueB)
                : valueB.localeCompare(valueA);
        });
    };

    // 切换排序
    const toggleSort = (column: string) => {
        setSortState(prevState => {
            if (prevState.column === column) {
                const newDirection = prevState.direction === 'asc' ? 'desc' :
                    prevState.direction === 'desc' ? null : 'asc';
                return { column: newDirection ? column : null, direction: newDirection };
            } else {
                return { column, direction: 'asc' };
            }
        });
    };

    // 应用排序的表格数据
    const sortedTableData = useMemo(() => {
        return sortData(tableData, sortState.column || '', sortState.direction);
    }, [tableData, sortState]);

    // 限制显示的行数，避免表格过长
    const maxDisplayRows = 20;
    const displayTableData = sortedTableData.slice(0, maxDisplayRows);
    const hasMoreRows = sortedTableData.length > maxDisplayRows;

    // 复制到剪贴板功能
    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            // 可以添加一个简单的提示，这里先省略
        } catch (err) {
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    };

    // 渲染复制图标
    const renderCopyIcon = (text: string) => {
        return (
            <div
                title="复制"
                className="inline-block"
            >
                <Icon
                    icon="solar:copy-linear"
                    width={14}
                    className="opacity-50 hover:opacity-100 cursor-pointer transition-opacity"
                    onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(text);
                    }}
                />
            </div>
        );
    };

    // 渲染单元格
    const renderCell = (row: any, colKey: string) => {
        const cellData = row[colKey] as TableCellData;

        if (!cellData || typeof cellData === 'string') {
            return null;
        }

        const { url, urls, hasValidImage, errorMessage } = cellData;
        const cellTitle = `${row.rowTitle}-${colKey}`;

        // 如果有错误信息，显示错误状态
        if (errorMessage) {
            return (
                <div className="w-full h-full flex flex-col items-center justify-center bg-default-50 p-2">
                    <div className="text-center">
                        <div className="text-xs text-default-400 mb-1">无图片</div>
                        <div
                            className="text-xs text-default-500 cursor-pointer hover:text-default-700 transition-colors"
                            title={errorMessage}
                        >
                            {errorMessage.length > 12 ? `${errorMessage.substring(0, 12)}...` : errorMessage}
                        </div>
                    </div>
                </div>
            );
        }

        if (hasValidImage) {
            // 有图片的单元格
            return (
                <div className="w-full h-full">
                    {urls && urls.length > 1 && hasBatchTag ? (
                        // 多图显示网格
                        <div
                            className={`grid gap-1 ${getGridColumns(urls.length)} w-full h-full bg-default-50 overflow-hidden`}
                            style={{ gridAutoRows: "1fr" }}
                        >
                            {urls.map((imgUrl, index) => (
                                <div
                                    key={index}
                                    className="relative overflow-hidden cursor-pointer bg-default-50"
                                    onClick={() => onViewImage(imgUrl, `${cellTitle} - 批次 ${index + 1}`, cellData)}
                                >
                                    <div className="w-full h-full flex items-center justify-center">
                                        <LazyImage
                                            alt={`${cellTitle} - 批次 ${index + 1}`}
                                            className="max-w-full max-h-full"
                                            src={getResizedImageUrl(
                                                imgUrl,
                                                getImageSizeByBatchCount(urls.length)
                                            )}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        // 单图显示
                        <div
                            className="w-full h-full bg-default-50 overflow-hidden cursor-pointer"
                            onClick={() => {
                                urls && urls.length > 0
                                    ? onViewMultipleImages(urls, cellTitle, cellData)
                                    : onViewImage(url, cellTitle, cellData);
                            }}
                        >
                            <div className="w-full h-full flex items-center justify-center">
                                <LazyImage
                                    alt={cellTitle}
                                    className="max-w-full max-h-full"
                                    src={getResizedImageUrl(url, getImageSizeByBatchCount(1))}
                                />
                            </div>
                        </div>
                    )}
                </div>
            );
        } else {
            // 无图片的单元格
            return (
                <div className="w-full h-full">
                    <div className="w-full h-full flex items-center justify-center bg-default-50 overflow-hidden">
                        <div className="text-center p-4">
                            <div className="flex flex-col items-center">
                                <Icon icon="solar:missing-circular-linear" className="w-8 h-8 text-default-300 mb-2" />
                                <p className="text-default-500 text-sm font-medium">未找到图片</p>
                                <div className="mt-2 text-default-400 text-xs space-y-1">
                                    {xAxis && (
                                        <p title={`${xAxis}:${cellData?.xValue || colKey.replace(/#\d+$/, "")}`}>
                                            {(() => {
                                                const text = `${xAxis}:${cellData?.xValue || colKey.replace(/#\d+$/, "")}`;
                                                return text.length > 8 ? `${text.substring(0, 8)}...` : text;
                                            })()}
                                        </p>
                                    )}
                                    {yAxis && (
                                        <p title={`${yAxis}:${cellData?.yValue || row.rowTitle.replace(/#\d+$/, "")}`}>
                                            {(() => {
                                                const text = `${yAxis}:${cellData?.yValue || row.rowTitle.replace(/#\d+$/, "")}`;
                                                return text.length > 8 ? `${text.substring(0, 8)}...` : text;
                                            })()}
                                        </p>
                                    )}
                                    <p className="text-default-300 mt-1">无匹配数据</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
    };

    // 渲染排序图标
    const renderSortIcon = (column: string) => {
        if (sortState.column !== column) {
            return <Icon icon="solar:sort-bold" width={14} className="opacity-50" />;
        }

        if (sortState.direction === 'asc') {
            return <Icon icon="solar:sort-by-up-bold" width={14} />;
        } else if (sortState.direction === 'desc') {
            return <Icon icon="solar:sort-by-down-bold" width={14} />;
        }

        return <Icon icon="solar:sort-bold" width={14} className="opacity-50" />;
    };

    // 计算表格统计信息
    const tableStats = useMemo(() => {
        let totalCells = 0;
        let cellsWithImages = 0;
        let cellsWithErrors = 0;
        let cellsEmpty = 0;

        tableData.forEach(row => {
            columnValues.forEach(colKey => {
                totalCells++;
                const cellData = row[colKey] as TableCellData;

                if (cellData && typeof cellData === 'object') {
                    if (cellData.errorMessage) {
                        cellsWithErrors++;
                    } else if (cellData.hasValidImage) {
                        cellsWithImages++;
                    } else {
                        cellsEmpty++;
                    }
                } else {
                    cellsEmpty++;
                }
            });
        });

        return {
            totalCells,
            cellsWithImages,
            cellsWithErrors,
            cellsEmpty,
            rows: tableData.length,
            columns: columnValues.length
        };
    }, [tableData, columnValues]);

    // 缩放控制器组件
    const ScaleController = () => (
        <div className="flex items-center gap-2 w-full max-w-xs">
            <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => handleScaleChange(currentScale - 10)}
                isDisabled={currentScale <= 50}
                title="缩小"
                className="flex-shrink-0 min-w-6 w-6 h-6 text-base font-bold"
            >
                -
            </Button>
            <div className="flex-1 min-w-0 px-2">
                <Slider
                    size="md"
                    step={10}
                    minValue={50}
                    maxValue={200}
                    value={currentScale}
                    onChange={(value) => {
                        const newScale = Array.isArray(value) ? value[0] : value;
                        handleScaleChange(newScale);
                    }}
                    className="w-full"
                    aria-label="缩放比例"
                    showTooltip={false}
                />
            </div>
            <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => handleScaleChange(currentScale + 10)}
                isDisabled={currentScale >= 200}
                title="放大"
                className="flex-shrink-0 min-w-6 w-6 h-6 text-base font-bold"
            >
                +
            </Button>
            <div className="flex items-center gap-1 min-w-fit flex-shrink-0 px-1">
                <span className="text-xs text-default-700 font-mono whitespace-nowrap font-medium">
                    {currentScale}%
                </span>
            </div>
            <Button
                size="sm"
                variant="light"
                onPress={() => handleScaleChange(100)}
                title="重置缩放"
                className="flex-shrink-0 text-xs px-2"
            >
                重置
            </Button>
        </div>
    );

    // 全屏工具栏
    const FullscreenToolbar = () => (
        <div className="absolute top-0 left-0 right-0 z-50 bg-default-100/90 backdrop-blur-sm border-b border-default-200 p-3">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="text-sm font-medium text-default-700">表格视图</span>
                    <div className="flex items-center gap-2 text-xs text-default-500">
                        <span>{`${tableStats.rows} × ${tableStats.columns}`}</span>
                        <span>•</span>
                        <span>{`${tableStats.cellsWithImages} 有图片`}</span>
                        {tableStats.cellsWithErrors > 0 && (
                            <>
                                <span>•</span>
                                <span className="text-danger-600">{`${tableStats.cellsWithErrors} 错误`}</span>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="flex-1 max-w-sm">
                        <ScaleController />
                    </div>
                    <div className="text-xs text-default-500 hidden lg:block">
                        ESC 退出 | +/- 缩放 | 0 重置
                    </div>
                    <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={toggleFullscreen}
                        title="退出全屏 (ESC)"
                        className="flex-shrink-0"
                    >
                        <Icon icon="solar:quit-fullscreen-square-linear" width={16} />
                    </Button>
                </div>
            </div>
        </div>
    );

    if (!tableData || tableData.length === 0) {
        return (
            <div className="flex items-center justify-center p-8 text-default-500">
                <div className="text-center">
                    <Icon icon="solar:table-linear" className="w-16 h-16 mx-auto mb-4" />
                    <p>暂无表格数据</p>
                </div>
            </div>
        );
    }

    // 表格内容
    const tableContent = (
        <div
            ref={tableContainerRef}
            className="simple-table-wrapper flex-1 overflow-auto"
            style={{
                width: "100%",
                height: "100%",
            }}
        >
            <div
                style={{
                    transform: `scale(${currentScale / 100})`,
                    transformOrigin: "top left",
                    transition: "transform 0.2s ease",
                    width: `${100 / (currentScale / 100)}%`,
                    height: `${100 / (currentScale / 100)}%`,
                }}
            >
                <table className="simple-matrix-table">
                    <thead>
                        <tr>
                            <th
                                className={`header-cell sortable ${sortState.column === 'rowTitle' ?
                                    (sortState.direction === 'asc' ? 'sorted-asc' : sortState.direction === 'desc' ? 'sorted-desc' : '') : ''}`}
                                onClick={() => toggleSort('rowTitle')}
                            >
                                <div className="flex items-center justify-center">
                                    <span
                                        title={(() => {
                                            const headerText = xAxis && yAxis
                                                ? `${xAxis} / ${yAxis}`
                                                : xAxis
                                                    ? `${xAxis}`
                                                    : yAxis
                                                        ? `${yAxis}`
                                                        : "";
                                            return headerText.length > 24 ? headerText : undefined;
                                        })()}
                                    >
                                        {(() => {
                                            const headerText = xAxis && yAxis
                                                ? `${xAxis} / ${yAxis}`
                                                : xAxis
                                                    ? `${xAxis}`
                                                    : yAxis
                                                        ? `${yAxis}`
                                                        : "";
                                            return headerText.length > 24 ? `${headerText.substring(0, 24)}...` : headerText;
                                        })()}
                                    </span>
                                    <span className="sort-icon ml-1">
                                        {renderCopyIcon(xAxis && yAxis
                                            ? `${xAxis} / ${yAxis}`
                                            : xAxis
                                                ? `${xAxis}`
                                                : yAxis
                                                    ? `${yAxis}`
                                                    : "")}
                                    </span>
                                </div>
                            </th>
                            {columnValues.map((colKey) => (
                                <th
                                    key={colKey}
                                    className={`header-cell sortable ${sortState.column === colKey ?
                                        (sortState.direction === 'asc' ? 'sorted-asc' : sortState.direction === 'desc' ? 'sorted-desc' : '') : ''}`}
                                    onClick={() => toggleSort(colKey)}
                                >
                                    <div className="flex items-center justify-center">
                                        <span
                                            title={colKey.length > 24 ? colKey : undefined}
                                        >
                                            {colKey.length > 24 ? `${colKey.substring(0, 24)}...` : colKey}
                                        </span>
                                        <span className="sort-icon ml-1">
                                            {renderCopyIcon(colKey)}
                                        </span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedTableData.map((row, rowIndex) => (
                            <tr key={row.key || rowIndex}>
                                <td className="row-title-cell">
                                    {((row.rowTitle as string) || "").length > 8
                                        ? `${(row.rowTitle as string).substring(0, 8)}...`
                                        : row.rowTitle as string}
                                </td>
                                {columnValues.map((colKey) => (
                                    <td key={colKey} className="data-cell">
                                        {renderCell(row, colKey)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    // 全屏模式
    if (isFullscreen) {
        return (
            <div className="fixed inset-0 z-50 bg-white flex flex-col">
                <FullscreenToolbar />
                <div className="flex-1 pt-12 overflow-hidden">
                    {tableContent}
                </div>
            </div>
        );
    }

    // 正常模式
    return (
        <div className="flex flex-col h-full">
            {/* 工具栏 */}
            <div className="flex items-center justify-between p-3 bg-default-50 border-b border-default-200 flex-shrink-0 gap-4">
                <div className="flex items-center gap-3 flex-1 max-w-md">
                    <ScaleController />
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={toggleFullscreen}
                        title="全屏显示"
                    >
                        <Icon icon="solar:full-screen-square-linear" width={16} />
                    </Button>
                </div>
            </div>

            {tableContent}

            {/* 表格信息显示 */}
            <div className="p-3 bg-default-50 border-t border-default-200 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-4">
                    <span className="text-xs text-default-600">
                        <Icon icon="solar:table-linear" className="inline w-3 h-3 mr-1" />
                        {`${tableStats.rows} 行 × ${tableStats.columns} 列`}
                    </span>
                    <span className="text-xs text-success-600">
                        <Icon icon="solar:gallery-minimalistic-linear" className="inline w-3 h-3 mr-1" />
                        {`${tableStats.cellsWithImages} 有图片`}
                    </span>
                    {tableStats.cellsWithErrors > 0 && (
                        <span className="text-xs text-danger-600">
                            <Icon icon="solar:danger-triangle-linear" className="inline w-3 h-3 mr-1" />
                            {`${tableStats.cellsWithErrors} 错误`}
                        </span>
                    )}
                    {tableStats.cellsEmpty > 0 && (
                        <span className="text-xs text-default-500">
                            <Icon icon="solar:file-remove-linear" className="inline w-3 h-3 mr-1" />
                            {`${tableStats.cellsEmpty} 空白`}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-default-500">
                        {`共 ${tableStats.totalCells} 个单元格`}
                    </span>
                    {sortState.column && (
                        <span className="text-xs text-primary-600">
                            <Icon icon="solar:sort-linear" className="inline w-3 h-3 mr-1" />
                            {`按 ${sortState.column === 'rowTitle' ? '行标题' : sortState.column} ${sortState.direction === 'asc' ? '升序' : '降序'
                                }`}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SimpleTableView;