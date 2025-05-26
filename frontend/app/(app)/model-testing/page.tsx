"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ModelTestingRedirect() {
  const router = useRouter();

  useEffect(() => {
    // 将测试页面设为模型测试工作区的主页
    router.push("/model-testing/test");
  }, [router]);

  return null;
}
