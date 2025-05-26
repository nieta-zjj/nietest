"use client";

import { Card, CardBody, CardHeader } from "@heroui/react";

export default function UploadPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">上传</h1>
      <Card>
        <CardHeader>
          <h2 className="text-xl">数据上传</h2>
        </CardHeader>
        <CardBody>
          <p>数据上传页面内容将在这里显示</p>
        </CardBody>
      </Card>
    </div>
  );
}
