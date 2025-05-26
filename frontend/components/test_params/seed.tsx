"use client";

import React from "react";
import { Input } from "@heroui/react";
import { BaseParamComponent } from "./BaseParam";
import { NumberParamProps, ParamValueType } from "./types";

/**
 * 种子参数组件
 */
export const SeedParam: React.FC<Partial<NumberParamProps>> = (props) => {
    const {
        value = 1,
        onChange = () => { },
        onVariableChange = () => { },
        isVariable = false,
        min = 0,
        max = Number.MAX_SAFE_INTEGER,
        step = 1,
        ...rest
    } = props;

    // 渲染输入框
    const renderInput = (currentValue: ParamValueType, onValueChange: (value: ParamValueType) => void) => {
        // 确保值是数字
        const numValue = typeof currentValue === 'number' ? currentValue : parseInt(String(currentValue || "0"));

        return (
            <Input
                size="sm"
                type="number"
                placeholder="随机种子"
                value={numValue.toString()}
                onChange={(e) => {
                    const newValue = parseInt(e.target.value);
                    if (!isNaN(newValue) && newValue >= min && (max === undefined || newValue <= max)) {
                        onValueChange(newValue);
                    }
                }}
                className="w-full"
                min={min}
                max={max}
                step={step}
            />
        );
    };

    return (
        <BaseParamComponent
            label="种子"
            value={value}
            onChange={onChange}
            onVariableChange={onVariableChange}
            isVariable={isVariable}
            renderInput={renderInput}
            defaultValue={1}
            {...rest}
        />
    );
};