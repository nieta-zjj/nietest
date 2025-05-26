"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// 导入客户端存储工具
import { getStorageItem, setStorageItem, removeStorageItem } from "./client-storage";

// 用户类型定义
export interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
}

// 认证上下文接口
export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
}

// 创建认证上下文
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 使用认证上下文的钩子
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth 必须在 AuthProvider 内部使用");
  }

  return context;
};

// 注意：所有实现逻辑已移至provider.tsx文件中
