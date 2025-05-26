import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

/**
 * 类型定义索引文件
 * 统一导出所有类型定义
 */

export * from './search';
export * from './api';
export * from './vtoken';
export * from './task';
