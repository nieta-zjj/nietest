"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // 重定向到模型测试工作区的测试页面
    router.push("/model-testing/test");
  }, [router]);

  return null;
}
