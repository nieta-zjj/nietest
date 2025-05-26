"use client";

import { Card, CardBody, CardHeader } from "@heroui/react";

export default function CollectionsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">集合</h1>
      <Card>
        <CardHeader>
          <h2 className="text-xl">集合管理</h2>
        </CardHeader>
        <CardBody>
          <p>集合管理页面内容将在这里显示</p>
        </CardBody>
      </Card>
    </div>
  );
}
