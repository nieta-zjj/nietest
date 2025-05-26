"use client";

import React, { useState, useEffect } from "react";
import {
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
    Pagination,
    Button,
    Select,
    SelectItem,
    Input,
    Card,
    CardBody,
    Spinner,
    Tooltip,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure,
    Chip
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { TaskStatusChip } from "@/components/task/task-status-chip";
import { TaskProgressBar } from "@/components/task/task-progress-bar";
import { getTasks, cancelTask, getTask } from "@/utils/apiClient";
import { TaskListItem, TaskDetailResponse, APIResponse } from "@/types/task";

interface TaskListProps {
    showRunningOnly?: boolean;
    refreshInterval?: number;
}

export const TaskList: React.FC<TaskListProps> = ({
    showRunningOnly = false,
    refreshInterval = 5000
}) => {
    const [tasks, setTasks] = useState<TaskListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [usernameFilter, setUsernameFilter] = useState<string>("");
    const [taskNameFilter, setTaskNameFilter] = useState<string>("");
    const [selectedTask, setSelectedTask] = useState<TaskDetailResponse | null>(null);

    const { isOpen, onOpen, onClose } = useDisclosure();

    // 格式化时间
    const formatTime = (timeStr: string) => {
        return new Date(timeStr).toLocaleString("zh-CN");
    };

    // 加载任务列表
    const loadTasks = async () => {
        try {
            const response: APIResponse<any> = await getTasks(
                page,
                pageSize,
                showRunningOnly ? "running" : statusFilter || undefined,
                usernameFilter || undefined,
                taskNameFilter || undefined
            );

            if (response.code === 200) {
                setTasks(response.data.tasks);
                setTotal(response.data.total);
            }
        } catch (error) {
            console.error("加载任务列表失败:", error);
        } finally {
            setLoading(false);
        }
    };

    // 查看任务详情
    const handleViewTask = async (taskId: string) => {
        try {
            const response: APIResponse<TaskDetailResponse> = await getTask(taskId, true);
            if (response.code === 200) {
                setSelectedTask(response.data);
                onOpen();
            }
        } catch (error) {
            console.error("获取任务详情失败:", error);
        }
    };

    // 取消任务
    const handleCancelTask = async (taskId: string) => {
        try {
            await cancelTask(taskId);
            loadTasks(); // 重新加载列表
        } catch (error) {
            console.error("取消任务失败:", error);
        }
    };

    // 初始加载和定时刷新
    useEffect(() => {
        loadTasks();

        if (refreshInterval > 0) {
            const interval = setInterval(loadTasks, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [page, statusFilter, usernameFilter, taskNameFilter, showRunningOnly]);

    const columns = [
        { key: "name", label: "任务名称" },
        { key: "username", label: "用户" },
        { key: "status", label: "状态" },
        { key: "progress", label: "进度" },
        { key: "created_at", label: "创建时间" },
        { key: "actions", label: "操作" }
    ];

    const renderCell = (task: TaskListItem, columnKey: string) => {
        switch (columnKey) {
            case "name":
                return (
                    <div className="flex flex-col">
                        <span className="font-medium">{task.name}</span>
                        <span className="text-tiny text-default-400">ID: {task.id.slice(0, 8)}...</span>
                    </div>
                );
            case "username":
                return <span className="text-small">{task.username}</span>;
            case "status":
                return <TaskStatusChip status={task.status} />;
            case "progress":
                return (
                    <div className="w-32">
                        <TaskProgressBar
                            progress={task.progress}
                            processedImages={task.processed_images}
                            totalImages={task.total_images}
                            size="sm"
                            showLabel={false}
                        />
                        <span className="text-tiny text-default-400">
                            {task.processed_images}/{task.total_images}
                        </span>
                    </div>
                );
            case "created_at":
                return (
                    <span className="text-small text-default-400">
                        {formatTime(task.created_at)}
                    </span>
                );
            case "actions":
                return (
                    <div className="flex gap-2">
                        <Tooltip content="查看详情">
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                onPress={() => handleViewTask(task.id)}
                            >
                                <Icon icon="solar:eye-linear" className="w-4 h-4" />
                            </Button>
                        </Tooltip>
                        {(task.status === "pending" || task.status === "running") && (
                            <Tooltip content="取消任务">
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    color="danger"
                                    onPress={() => handleCancelTask(task.id)}
                                >
                                    <Icon icon="solar:stop-linear" className="w-4 h-4" />
                                </Button>
                            </Tooltip>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-4">
            {/* 筛选器 */}
            {!showRunningOnly && (
                <Card>
                    <CardBody>
                        <div className="flex flex-col gap-4">
                            <div className="flex gap-4 items-end flex-wrap">
                                <Select
                                    label="状态筛选"
                                    placeholder="选择状态"
                                    className="w-48"
                                    selectedKeys={statusFilter ? [statusFilter] : []}
                                    onSelectionChange={(keys) => {
                                        const selected = Array.from(keys)[0] as string;
                                        setStatusFilter(selected || "");
                                    }}
                                >
                                    <SelectItem key="">全部状态</SelectItem>
                                    <SelectItem key="pending">等待中</SelectItem>
                                    <SelectItem key="running">运行中</SelectItem>
                                    <SelectItem key="completed">已完成</SelectItem>
                                    <SelectItem key="failed">失败</SelectItem>
                                    <SelectItem key="cancelled">已取消</SelectItem>
                                </Select>

                                <Input
                                    label="用户筛选"
                                    placeholder="输入用户名"
                                    className="w-48"
                                    value={usernameFilter}
                                    onChange={(e) => setUsernameFilter(e.target.value)}
                                    isClearable
                                />

                                <Input
                                    label="任务名搜索"
                                    placeholder="输入任务名关键词"
                                    className="w-48"
                                    value={taskNameFilter}
                                    onChange={(e) => setTaskNameFilter(e.target.value)}
                                    isClearable
                                    startContent={<Icon icon="solar:magnifying-glass-linear" className="w-4 h-4 text-default-400" />}
                                />

                                <Button
                                    color="primary"
                                    variant="flat"
                                    onPress={loadTasks}
                                    startContent={<Icon icon="solar:refresh-linear" />}
                                >
                                    刷新
                                </Button>
                            </div>

                            {/* 显示当前筛选条件 */}
                            {(statusFilter || usernameFilter || taskNameFilter) && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-small text-default-500">当前筛选:</span>
                                    {statusFilter && (
                                        <Chip
                                            size="sm"
                                            variant="flat"
                                            onClose={() => setStatusFilter("")}
                                        >
                                            状态: {statusFilter}
                                        </Chip>
                                    )}
                                    {usernameFilter && (
                                        <Chip
                                            size="sm"
                                            variant="flat"
                                            onClose={() => setUsernameFilter("")}
                                        >
                                            用户: {usernameFilter}
                                        </Chip>
                                    )}
                                    {taskNameFilter && (
                                        <Chip
                                            size="sm"
                                            variant="flat"
                                            onClose={() => setTaskNameFilter("")}
                                        >
                                            任务名: {taskNameFilter}
                                        </Chip>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="light"
                                        onPress={() => {
                                            setStatusFilter("");
                                            setUsernameFilter("");
                                            setTaskNameFilter("");
                                        }}
                                    >
                                        清除所有筛选
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardBody>
                </Card>
            )}

            {/* 任务表格 */}
            <Card>
                <CardBody className="p-0">
                    <Table aria-label="任务列表">
                        <TableHeader columns={columns}>
                            {(column) => (
                                <TableColumn key={column.key}>{column.label}</TableColumn>
                            )}
                        </TableHeader>
                        <TableBody
                            items={tasks}
                            isLoading={loading}
                            loadingContent={<Spinner label="加载中..." />}
                            emptyContent="暂无任务"
                        >
                            {(task) => (
                                <TableRow key={task.id}>
                                    {(columnKey) => (
                                        <TableCell>{renderCell(task, columnKey as string)}</TableCell>
                                    )}
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardBody>
            </Card>

            {/* 分页 */}
            {total > pageSize && (
                <div className="flex justify-center">
                    <Pagination
                        total={Math.ceil(total / pageSize)}
                        page={page}
                        onChange={setPage}
                        boundaries={3}
                        isCompact
                        showControls
                    />
                </div>
            )}

            {/* 任务详情模态框 */}
            <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
                <ModalContent>
                    <ModalHeader>
                        <div className="flex items-center gap-2">
                            <Icon icon="solar:document-text-linear" />
                            任务详情
                        </div>
                    </ModalHeader>
                    <ModalBody>
                        {selectedTask && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-small text-default-500">任务名称</span>
                                        <p className="font-medium">{selectedTask.name}</p>
                                    </div>
                                    <div>
                                        <span className="text-small text-default-500">用户</span>
                                        <p className="font-medium">{selectedTask.username}</p>
                                    </div>
                                    <div>
                                        <span className="text-small text-default-500">状态</span>
                                        <div className="mt-1">
                                            <TaskStatusChip status={selectedTask.status} />
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-small text-default-500">优先级</span>
                                        <p className="font-medium">{selectedTask.priority}</p>
                                    </div>
                                </div>

                                <div>
                                    <span className="text-small text-default-500">进度</span>
                                    <div className="mt-2">
                                        <TaskProgressBar
                                            progress={selectedTask.progress}
                                            processedImages={selectedTask.processed_images}
                                            totalImages={selectedTask.total_images}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-small text-default-500">创建时间</span>
                                        <p className="text-small">{formatTime(selectedTask.created_at)}</p>
                                    </div>
                                    <div>
                                        <span className="text-small text-default-500">更新时间</span>
                                        <p className="text-small">{formatTime(selectedTask.updated_at)}</p>
                                    </div>
                                </div>

                                {selectedTask.completed_at && (
                                    <div>
                                        <span className="text-small text-default-500">完成时间</span>
                                        <p className="text-small">{formatTime(selectedTask.completed_at)}</p>
                                    </div>
                                )}

                                {selectedTask.subtasks && selectedTask.subtasks.length > 0 && (
                                    <div>
                                        <span className="text-small text-default-500">子任务 ({selectedTask.subtasks.length})</span>
                                        <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                                            {selectedTask.subtasks.map((subtask) => (
                                                <div key={subtask.id} className="flex items-center justify-between p-2 bg-default-50 rounded">
                                                    <span className="text-small">{subtask.id.slice(0, 8)}...</span>
                                                    <TaskStatusChip status={subtask.status} size="sm" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button color="primary" onPress={onClose}>
                            关闭
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
};