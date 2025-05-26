"use client";

import { Card, CardBody, CardHeader } from "@heroui/react";

export default function ExportPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">导出</h1>
      <Card>
        <CardHeader>
          <h2 className="text-xl">数据导出</h2>
        </CardHeader>
        <CardBody>
          <p>数据导出页面内容将在这里显示</p>
        </CardBody>
      </Card>
    </div>
  );
}
