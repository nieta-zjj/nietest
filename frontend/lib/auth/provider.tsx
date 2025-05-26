"use client";

import React, { ReactNode, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { AuthContext } from "./client";
import { getStorageItem, setStorageItem, removeStorageItem } from "./client-storage";
import { login as apiLogin, getCurrentUser as apiGetCurrentUser } from "@/utils/apiClient";

/**
 * 认证提供器属性接口
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * 认证上下文提供器组件
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();

  // 标记客户端渲染
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 获取用户信息
  const fetchUserInfo = async (): Promise<boolean> => {
    setError(null);
    try {
      console.log("正在获取用户信息...");
      const response = await apiGetCurrentUser();

      if (response.code === 200 && response.data) {
        console.log("获取用户信息成功:", response.data);
        // 将API返回的用户数据转换为应用中使用的User类型
        const userData = {
          id: response.data.id,
          username: response.data.username,
          email: response.data.username, // 后端API中没有单独的email字段，使用username
          roles: response.data.roles
        };
        setUser(userData);
        return true;
      } else {
        throw new Error(response.message || "获取用户信息失败");
      }
    } catch (err) {
      console.error("获取用户信息失败:", err);
      setError("获取用户信息失败");
      setUser(null);
      removeStorageItem("access_token");
      setToken(null);
      return false;
    }
  };

  // 登录方法
  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // 调用API登录
      const response = await apiLogin(email, password);

      if (response.code === 200 && response.data) {
        // 保存访问令牌
        const accessToken = response.data.access_token;
        setToken(accessToken);
        setStorageItem("access_token", accessToken);

        // 获取用户信息
        const success = await fetchUserInfo();
        return success;
      } else {
        throw new Error(response.message || "登录失败");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`登录失败: ${errorMessage}`);
      console.error("登录失败:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 退出登录方法
  const logout = () => {
    removeStorageItem("access_token");
    setToken(null);
    setUser(null);
    router.push("/login");
  };

  // 检查认证状态
  const checkAuth = async (): Promise<boolean> => {
    if (!token) return false;
    return await fetchUserInfo();
  };

  // 初始化时检查用户认证状态
  useEffect(() => {
    // 只在客户端执行，并且只执行一次
    if (isClient) {
      const initAuth = async () => {
        const storedToken = getStorageItem("access_token");

        if (storedToken) {
          setToken(storedToken);
          await fetchUserInfo();
        }
        setIsLoading(false);
      };

      initAuth();
    } else {
      // 服务器端渲染时，设置为非加载状态
      setIsLoading(false);
    }
  }, [isClient]);

  // 提供认证上下文
  const authState = {
    user,
    token,
    isLoading,
    error,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>;
};
