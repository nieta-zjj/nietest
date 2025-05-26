"use client";

/**
 * 客户端存储工具
 * 
 * 提供安全的客户端存储操作，确保在服务器端渲染时不会出错
 */

// 获取存储项
export const getStorageItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    // 在服务器端或localStorage不可用时返回null
    return null;
  }
};

// 设置存储项
export const setStorageItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // 在服务器端或localStorage不可用时忽略错误
    console.warn(`无法设置存储项 ${key}:`, error);
  }
};

// 移除存储项
export const removeStorageItem = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    // 在服务器端或localStorage不可用时忽略错误
    console.warn(`无法移除存储项 ${key}:`, error);
  }
};
