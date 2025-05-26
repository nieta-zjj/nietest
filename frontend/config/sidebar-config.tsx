import { SidebarItem } from "@/components/sidebar/sidebar";
import { WorkspaceMode, WorkspaceModeConfig } from "@/components/sidebar/types";
import { Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

/**
 * 数据管理工作区侧边栏配置
 */
const dataManagementItems: SidebarItem[] = [
  {
    key: "home",
    title: "主页",
    icon: "solar:home-2-linear",
    href: "/data-management",
  },
  {
    key: "collections",
    title: "集合",
    icon: "solar:folder-with-files-linear",
    href: "/data-management/collections",
  },
  {
    key: "tags",
    title: "标签",
    icon: "solar:tag-linear",
    href: "/data-management/tags",
  },
  {
    key: "upload",
    title: "上传",
    icon: "solar:upload-linear",
    href: "/data-management/upload",
  },
  {
    key: "process",
    title: "处理",
    icon: "solar:settings-linear",
    href: "/data-management/process",
  },
  {
    key: "export",
    title: "导出",
    icon: "solar:download-linear",
    href: "/data-management/export",
  },
];

/**
 * 模型测试工作区侧边栏配置
 */
const modelTestingItems: SidebarItem[] = [
  {
    key: "test",
    title: "测试",
    icon: "solar:test-tube-linear",
    href: "/model-testing/test",
  },
  {
    key: "queue",
    title: "队列",
    icon: "solar:list-linear",
    href: "/model-testing/queue",
  },
  {
    key: "history",
    title: "历史",
    icon: "solar:history-linear",
    href: "/model-testing/history",
  },
  {
    key: "favorites",
    title: "收藏",
    icon: "solar:star-linear",
    href: "/model-testing/favorites",
  },
];

/**
 * 模型训练工作区侧边栏配置
 */
const modelTrainingItems: SidebarItem[] = [
  {
    key: "home",
    title: "主页",
    icon: "solar:home-2-linear",
    href: "/model-training",
  },
];

/**
 * 工作区模式配置
 */
export const workspaceModes: WorkspaceModeConfig[] = [
  {
    key: WorkspaceMode.DataManagement,
    title: "数据管理工作区",
    icon: "solar:database-linear",
    items: dataManagementItems,
  },
  {
    key: WorkspaceMode.ModelTesting,
    title: "模型测试工作区",
    icon: "solar:test-tube-linear",
    items: modelTestingItems,
  },
  {
    key: WorkspaceMode.ModelTraining,
    title: "模型训练工作区",
    icon: "solar:chart-linear",
    items: modelTrainingItems,
  },
];
