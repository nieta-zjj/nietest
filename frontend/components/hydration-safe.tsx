"use client";

import React, { ReactNode, useEffect, useState } from "react";

interface HydrationSafeProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * HydrationSafe组件
 *
 * 用于解决服务器端渲染和客户端渲染不匹配的问题
 * 特别是当浏览器扩展修改DOM时
 */
export function HydrationSafe({ children, fallback }: HydrationSafeProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // 在服务器端渲染或初始客户端渲染时，返回fallback或null
  if (!isClient) {
    return fallback || null;
  }

  // 在客户端渲染后，返回children
  return <>{children}</>;
}
