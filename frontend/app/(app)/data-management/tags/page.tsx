"use client";

import { Card, CardBody, CardHeader } from "@heroui/react";

export default function TagsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">标签</h1>
      <Card>
        <CardHeader>
          <h2 className="text-xl">标签管理</h2>
        </CardHeader>
        <CardBody>
          <p>标签管理页面内容将在这里显示</p>
        </CardBody>
      </Card>
    </div>
  );
}
