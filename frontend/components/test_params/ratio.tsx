"use client";

import React from "react";
import { Select, SelectItem } from "@heroui/react";
import { BaseParamComponent } from "./BaseParam";
import { BaseParamProps, ParamValueType } from "./types";

// 默认比例选项
const RATIO_OPTIONS = [
    { key: "1:1", label: "1:1 - 方形" },
    { key: "4:3", label: "4:3 - 横向" },
    { key: "3:4", label: "3:4 - 纵向" },
    { key: "16:9", label: "16:9 - 宽屏" },
    { key: "9:16", label: "9:16 - 竖屏" }
];

interface RatioParamProps extends BaseParamProps {
    options?: typeof RATIO_OPTIONS;
}

/**
 * 图像比例参数组件
 */
export const RatioParam: React.FC<Partial<RatioParamProps>> = (props) => {
    const {
        value = "1:1",
        onChange = () => { },
        onVariableChange = () => { },
        isVariable = false,
        options = RATIO_OPTIONS,
        ...rest
    } = props;

    // 渲染选择框
    const renderInput = (currentValue: ParamValueType, onValueChange: (value: ParamValueType) => void) => {
        return (
            <Select
                size="sm"
                placeholder="选择图像比例"
                selectedKeys={[currentValue?.toString() || "1:1"]}
                onChange={(e) => onValueChange(e.target.value)}
                className="w-full"
                aria-label="图像比例选择器"
            >
                {options.map((option) => (
                    <SelectItem key={option.key}>
                        {option.label}
                    </SelectItem>
                ))}
            </Select>
        );
    };

    return (
        <BaseParamComponent
            label="比例"
            value={value}
            onChange={onChange}
            onVariableChange={onVariableChange}
            isVariable={isVariable}
            renderInput={renderInput}
            defaultValue="1:1"
            {...rest}
        />
    );
};