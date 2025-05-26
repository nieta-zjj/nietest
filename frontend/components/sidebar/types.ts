import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

/**
 * 侧边栏项目类型枚举
 */
export enum SidebarItemType {
  Nest = "nest",
}

/**
 * 侧边栏项目接口
 */
export type SidebarItem = {
  key: string;
  title: string;
  icon?: string;
  href?: string;
  type?: SidebarItemType.Nest;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  items?: SidebarItem[];
  className?: string;
};

/**
 * 工作区模式枚举
 */
export enum WorkspaceMode {
  DataManagement = "data-management",
  ModelTesting = "model-testing",
  ModelTraining = "model-training",
}

/**
 * 工作区模式配置接口
 */
export interface WorkspaceModeConfig {
  key: WorkspaceMode;
  title: string;
  icon: string;
  items: SidebarItem[];
}
