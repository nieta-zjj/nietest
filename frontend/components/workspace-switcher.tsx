"use client";

import React, { useState } from "react";
import { Select, SelectItem, SelectSection } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";

import { WorkspaceMode, WorkspaceModeConfig } from "@/components/sidebar";
import { workspaceModes } from "@/config/sidebar-config";

interface WorkspaceSwitcherProps {
  currentMode: WorkspaceMode;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ currentMode }) => {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<WorkspaceMode>(currentMode);

  // 根据模式获取首页路径
  const getHomePath = (mode: WorkspaceMode): string => {
    const modeConfig = workspaceModes.find(m => m.key === mode);
    if (!modeConfig) return "/";
    
    const homeItem = modeConfig.items.find(item => item.key === "home");
    return homeItem?.href || `/${mode}`;
  };

  // 处理模式切换
  const handleModeChange = (mode: WorkspaceMode) => {
    setSelectedMode(mode);
    const path = getHomePath(mode);
    router.push(path);
  };

  return (
    <Select
      disableSelectorIconRotation
      aria-label="选择工作区"
      className="w-full"
      classNames={{
        trigger:
          "min-h-14 bg-transparent border-small border-default-200 dark:border-default-100 data-[hover=true]:border-default-500 dark:data-[hover=true]:border-default-200 data-[hover=true]:bg-transparent",
      }}
      defaultSelectedKeys={[selectedMode]}
      items={workspaceModes}
      placeholder="选择工作区"
      renderValue={(items) => {
        return items.map((item) => (
          <div key={item.key} className="ml-1 flex flex-col gap-y-0.5">
            <span className="text-tiny leading-4">{item.data?.title}</span>
          </div>
        ));
      }}
      selectorIcon={
        <Icon color="hsl(var(--heroui-default-500))" icon="lucide:chevrons-up-down" />
      }
      startContent={
        <div className="relative h-10 w-10 flex-none rounded-full border-small border-default-300">
          {workspaceModes.find(m => m.key === selectedMode)?.icon && (
            <Icon
              className="ml-2 mt-2 text-default-500"
              icon={workspaceModes.find(m => m.key === selectedMode)?.icon || ""}
              width={24}
            />
          )}
        </div>
      }
      onSelectionChange={(keys) => {
        const key = Array.from(keys)[0] as WorkspaceMode;
        if (key) {
          handleModeChange(key);
        }
      }}
    >
      {(mode) => (
        <SelectItem key={mode.key} textValue={mode.title}>
          <div className="flex flex-row items-center gap-2">
            <Icon className="text-default-500" icon={mode.icon} width={20} />
            <span>{mode.title}</span>
          </div>
        </SelectItem>
      )}
    </Select>
  );
};
