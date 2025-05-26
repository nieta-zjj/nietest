"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { ScrollShadow, Spacer } from "@heroui/react";

import Sidebar from "@/components/sidebar/sidebar";
import { WorkspaceMode } from "@/components/sidebar";
import { workspaceModes } from "@/config/sidebar-config";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const [currentMode, setCurrentMode] = useState<WorkspaceMode>(WorkspaceMode.DataManagement);
  const [currentKey, setCurrentKey] = useState<string>("home");

  // 根据路径确定当前工作区模式和选中的菜单项
  useEffect(() => {
    // 从路径中提取工作区模式
    let mode = WorkspaceMode.DataManagement;
    let key = "home";

    if (pathname.startsWith("/model-testing")) {
      mode = WorkspaceMode.ModelTesting;
      // 提取子路径作为key
      const subPath = pathname.split("/")[2];
      if (subPath) {
        key = subPath;
      } else {
        key = "test"; // 默认选中测试页面
      }
    } else if (pathname.startsWith("/model-training")) {
      mode = WorkspaceMode.ModelTraining;
      key = "home";
    } else if (pathname.startsWith("/data-management")) {
      // 提取子路径作为key
      const subPath = pathname.split("/")[2];
      if (subPath) {
        key = subPath;
      } else {
        key = "home";
      }
    }

    setCurrentMode(mode);
    setCurrentKey(key);
  }, [pathname]);

  // 获取当前模式的侧边栏配置
  const currentModeConfig = workspaceModes.find(m => m.key === currentMode);
  const sidebarItems = currentModeConfig?.items || [];

  return (
    <div className="flex h-full">
      {/* 侧边栏 */}
      <div className="w-64 h-full border-r border-divider bg-content1 flex flex-col">
        <div className="p-4">
          <WorkspaceSwitcher currentMode={currentMode} />
        </div>
        <ScrollShadow className="flex-grow px-2">
          <Sidebar
            defaultSelectedKey={currentKey}
            iconClassName="group-data-[selected=true]:text-primary"
            itemClasses={{
              base: "data-[selected=true]:bg-primary-100 dark:data-[selected=true]:bg-primary-900/30 data-[hover=true]:bg-default-100/50",
              title: "group-data-[selected=true]:text-primary",
            }}
            items={sidebarItems}
          />
        </ScrollShadow>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-auto">
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
