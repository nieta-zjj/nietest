"use client";

import React from "react";
import { Input, Slider } from "@heroui/react";
import { BaseParamComponent } from "./BaseParam";
import { NumberParamProps, ParamValueType } from "./types";

/**
 * Lumina步数参数组件
 */
export const LuminaStepParam: React.FC<Partial<NumberParamProps>> = (props) => {
    const {
        value = 30,
        onChange = () => { },
        onVariableChange = () => { },
        isVariable = false,
        min = 10,
        max = 50,
        step = 1,
        showSlider = true,
        ...rest
    } = props;

    // 渲染输入控件（滑块+数字输入框）
    const renderInput = (currentValue: ParamValueType, onValueChange: (value: ParamValueType) => void) => {
        // 确保值是数字
        const numValue = typeof currentValue === 'number' ? currentValue : parseInt(String(currentValue || "30"));

        return (
            <div className="flex items-center gap-2 w-full">
                {showSlider && (
                    <div className="flex-grow">
                        <Slider
                            size="sm"
                            step={step}
                            minValue={min}
                            maxValue={max}
                            value={numValue}
                            onChange={(value: number | number[]) => {
                                // Slider可能返回单个值或数组，确保我们获取到单个值
                                const newValue = Array.isArray(value) ? value[0] : value;
                                onValueChange(newValue);
                            }}
                        />
                    </div>
                )}
                <div className="w-16">
                    <Input
                        size="sm"
                        type="number"
                        value={numValue.toString()}
                        onChange={(e) => {
                            const value = parseInt(e.target.value);
                            if (!isNaN(value) && value >= min && value <= max) {
                                onValueChange(value);
                            }
                        }}
                        min={min}
                        max={max}
                        step={step}
                        className="w-full"
                    />
                </div>
            </div>
        );
    };

    return (
        <BaseParamComponent
            label="步数"
            value={value}
            onChange={onChange}
            onVariableChange={onVariableChange}
            isVariable={isVariable}
            renderInput={renderInput}
            defaultValue={30}
            {...rest}
        />
    );
};