import type { IconSvgProps } from "./types";

import React from "react";

export const AcmeIcon: React.FC<IconSvgProps> = ({ size = 32, width, height, ...props }) => (
  <svg fill="none" height={size || height} viewBox="0 0 32 32" width={size || width} {...props}>
    {/* 实验室烧杯图标 */}
    <path
      d="M10 4C10 2.89543 10.8954 2 12 2H20C21.1046 2 22 2.89543 22 4V10.5C22 10.5 22 11 22.5 11.5L28 20C29.5 22.5 28 26 24.5 26H7.5C4 26 2.5 22.5 4 20L9.5 11.5C10 11 10 10.5 10 10.5V4Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* 液体 */}
    <path
      d="M10 14H22L19 20H13L10 14Z"
      fill="currentColor"
      fillOpacity="0.2"
    />

    {/* 气泡 */}
    <circle cx="14" cy="17" r="1" fill="currentColor" />
    <circle cx="18" cy="19" r="1" fill="currentColor" />
    <circle cx="16" cy="16" r="0.8" fill="currentColor" />
  </svg>
);
