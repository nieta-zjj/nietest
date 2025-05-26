"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Avatar,
  Button,
  ScrollShadow,
  Spacer,
  Switch,
} from "@heroui/react";
import { Icon } from "@iconify/react";


import Sidebar, { SidebarItem } from "../sidebar/sidebar";
import { WorkspaceMode } from "../sidebar/types";
import { workspaceModes } from "@/config/sidebar-config";
import { useAuth } from "@/lib/auth";
import { LoginModal } from "../login/login-modal";





interface AppSidebarLayoutProps {
  children: React.ReactNode;
}

export const AppSidebarLayout: React.FC<AppSidebarLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [currentMode, setCurrentMode] = useState<WorkspaceMode>(WorkspaceMode.DataManagement);
  const [selectedKey, setSelectedKey] = useState<string>("test");

  // 登录模态框状态
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // 使用主题钩子
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // 确保组件挂载后再渲染主题相关内容，避免服务端渲染不匹配
  useEffect(() => {
    setMounted(true);
  }, []);

  // 使用AuthContext获取用户信息
  const { user, logout } = useAuth();

  // 用户信息状态
  const isLoggedIn = !!user;
  const userName = user?.username || "";
  const userRole = user?.roles?.[0] || "请登录系统";

  // 获取用户头像显示字符
  const getUserAvatarChar = () => {
    if (!isLoggedIn || !userName) return "";

    // 如果用户名第一个字是"阿"，则返回第二个字
    if (userName.startsWith("阿") && userName.length > 1) {
      return userName.charAt(1);
    }

    // 否则返回第一个字
    return userName.charAt(0);
  };

  // AuthContext会自动处理用户登录状态检测

  // 获取当前模式的侧边栏配置
  const currentModeConfig = workspaceModes.find(m => m.key === currentMode);
  const sidebarItems = currentModeConfig?.items || [];

  // 从路径中提取当前选中的菜单项
  const getCurrentSelectedKey = React.useCallback(() => {
    const pathSegments = pathname.split('/').filter(Boolean);

    // 只处理模型测试工作区
    // 如果路径不是以/model-testing开头，默认选中测试页面
    if (pathSegments.length <= 1 || pathSegments[0] !== "model-testing") {
      return "test"; // 默认选中测试页面
    }

    // 如果有第二段路径，使用它作为key
    if (pathSegments.length > 1) {
      const secondSegment = pathSegments[1];

      // 直接查找匹配的菜单项key
      const matchingItem = sidebarItems.find(item => item.key === secondSegment);
      if (matchingItem) {
        return matchingItem.key;
      }

      // 如果没有直接匹配，尝试通过href匹配
      const matchingItemByHref = sidebarItems.find(item =>
        item.href === `/${pathSegments[0]}/${pathSegments[1]}`
      );
      if (matchingItemByHref) {
        return matchingItemByHref.key;
      }
    }

    // 默认返回测试页面
    return "test";
  }, [pathname, sidebarItems]);

  // 根据路径确定当前工作区模式和选中的菜单项
  React.useEffect(() => {
    // 暂时锁定在模型测试工作区
    setCurrentMode(WorkspaceMode.ModelTesting);

    // 如果不在模型测试工作区，重定向到测试页面
    if (!pathname.startsWith("/model-testing")) {
      router.push("/model-testing/test");
      return;
    }

    // 如果访问的是 /model-testing 根路径，重定向到测试页面（主页）
    if (pathname === "/model-testing") {
      router.push("/model-testing/test");
      return;
    }
  }, [pathname, router]);

  // 单独的useEffect来处理选中状态更新，确保sidebarItems已经加载
  React.useEffect(() => {
    if (sidebarItems.length > 0) {
      const newSelectedKey = getCurrentSelectedKey();
      console.log('路径变化:', pathname, '计算出的selectedKey:', newSelectedKey);
      setSelectedKey(newSelectedKey);
    }
  }, [pathname, sidebarItems, getCurrentSelectedKey]);

  // 初始化时设置正确的选中状态
  React.useEffect(() => {
    if (sidebarItems.length > 0) {
      const newSelectedKey = getCurrentSelectedKey();
      // 如果计算出的key与当前selectedKey不同，则更新
      if (newSelectedKey !== selectedKey) {
        console.log('初始化时重新计算selectedKey:', newSelectedKey, '当前selectedKey:', selectedKey);
        setSelectedKey(newSelectedKey);
      }
    }
  }, [sidebarItems, selectedKey, getCurrentSelectedKey]);

  // 处理侧边栏项目选择
  const handleSidebarSelect = (key: string) => {
    const selectedItem = sidebarItems.find(item => item.key === key);
    if (selectedItem?.href) {
      router.push(selectedItem.href);
    }
  };

  // 处理工作区切换 - 暂时锁定在模型测试工作区
  const handleWorkspaceChange = (mode: WorkspaceMode) => {
    // 暂时只允许模型测试工作区
    if (mode !== WorkspaceMode.ModelTesting) {
      return;
    }

    setCurrentMode(mode);
    router.push("/model-testing/test");
  };

  return (
    <div className="flex h-full">
      <div className="relative flex h-full w-72 flex-none flex-col border-r-small border-divider p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden">
              <img src="/web-icon.png" alt="nieta-model-lab" className="w-full h-full object-cover" />
            </div>
            <span className="text-small font-bold uppercase">nieta-model-lab</span>
          </div>

        </div>

        <Spacer y={8} />

        <div className="flex flex-col gap-4">
          <div
            className={`flex items-center gap-3 px-2 py-2 rounded-medium transition-colors ${!isLoggedIn ? "cursor-pointer hover:bg-default-100" : ""}`}
            onClick={() => {
              if (!isLoggedIn) {
                // 打开登录模态框
                setIsLoginModalOpen(true);
              }
            }}
          >
            <Avatar
              isBordered
              size="sm"
              showFallback
              name={getUserAvatarChar()}
            />
            <div className="flex flex-col">
              <p className="text-small font-medium text-default-600">{isLoggedIn ? userName : "未登录"}</p>
              <p className="text-tiny text-default-400">{isLoggedIn ? userRole : "点击此处登录"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-2 py-4 border-small border-default-200 dark:border-default-100 rounded-medium">
            <div className="relative h-10 w-10 flex-none rounded-full border-small border-default-300">
              <Icon
                className="ml-2 mt-2 text-default-500"
                icon="solar:test-tube-linear"
                width={24}
              />
            </div>
            <div className="ml-1 flex flex-col gap-y-0.5">
              <span className="text-medium font-medium">模型测试工作区</span>
              <span className="text-tiny text-default-400">当前仅支持模型测试功能</span>
            </div>
          </div>
        </div>

        <ScrollShadow className="-mr-6 h-full max-h-full py-6 pr-6">
          <Sidebar
            defaultSelectedKey={selectedKey}
            selectedKeys={[selectedKey]}
            isCompact={false} // 确保所有工作区的侧边栏都不是紧凑模式
            iconClassName="group-data-[selected=true]:text-primary-foreground"
            itemClasses={{
              base: "data-[selected=true]:bg-primary-400 dark:data-[selected=true]:bg-primary-300 data-[hover=true]:bg-default-300/20 dark:data-[hover=true]:bg-default-200/40",
              title: "group-data-[selected=true]:text-primary-foreground",
            }}
            className="w-full" // 确保侧边栏占满容器宽度
            items={sidebarItems}
            onSelect={(key) => {
              // 确保key是字符串类型
              const selectedKey = typeof key === 'string' ? key : String(key);
              setSelectedKey(selectedKey);
              handleSidebarSelect(selectedKey);
            }}
          />

        </ScrollShadow>

        <Spacer y={8} />

        <div className="mt-auto flex flex-col">
          {/* 主题切换按钮 */}
          <Button
            fullWidth
            className="justify-start text-default-500 data-[hover=true]:text-foreground"
            startContent={
              <Icon
                className="text-default-500"
                icon={mounted && theme === "dark" ? "solar:moon-linear" : "solar:sun-linear"}
                width={24}
              />
            }
            variant="light"
            onPress={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {mounted && theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
          </Button>

          {/* 帮助与信息按钮 */}
          <Button
            fullWidth
            className="justify-start text-default-500 data-[hover=true]:text-foreground"
            startContent={
              <Icon className="text-default-500" icon="solar:info-circle-line-duotone" width={24} />
            }
            variant="light"
          >
            帮助与信息
          </Button>

          {/* 登录/登出按钮 */}
          <Button
            className="justify-start text-default-500 data-[hover=true]:text-foreground"
            startContent={
              <Icon
                className={isLoggedIn ? "rotate-180 text-default-500" : "text-default-500"}
                icon={isLoggedIn ? "solar:minus-circle-line-duotone" : "solar:login-2-line-duotone"}
                width={24}
              />
            }
            variant="light"
            onPress={() => {
              if (isLoggedIn) {
                // 使用AuthContext的logout方法退出登录
                logout();
              } else {
                // 打开登录模态框
                setIsLoginModalOpen(true);
              }
            }}
          >
            {isLoggedIn ? "退出登录" : "登录系统"}
          </Button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>

      {/* 登录模态框 */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
};
