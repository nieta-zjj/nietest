"use client";

import { Card, CardBody, CardHeader } from "@heroui/react";

export default function DataManagementHomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">数据管理工作区</h1>
      <Card>
        <CardHeader>
          <h2 className="text-xl">主页</h2>
        </CardHeader>
        <CardBody>
          <p>数据管理工作区主页内容将在这里显示</p>
        </CardBody>
      </Card>
    </div>
  );
}
