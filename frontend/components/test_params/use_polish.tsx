"use client";

import React from "react";
import { Switch } from "@heroui/react";
import { BaseParamComponent } from "./BaseParam";
import { BooleanParamProps, ParamValueType } from "./types";

/**
 * 润色参数组件
 */
export const UsePolishParam: React.FC<Partial<BooleanParamProps>> = (props) => {
    const {
        value = false,
        onChange = () => { },
        onVariableChange = () => { },
        isVariable = false,
        ...rest
    } = props;

    // 渲染开关
    const renderInput = (currentValue: ParamValueType, onValueChange: (value: ParamValueType) => void) => {
        // 确保值是布尔型
        const boolValue = !!currentValue;

        return (
            <Switch
                isSelected={boolValue}
                onValueChange={(checked) => onValueChange(checked)}
                className="min-h-[40px]"
            />
        );
    };

    return (
        <BaseParamComponent
            label="润色"
            value={value}
            onChange={onChange}
            onVariableChange={onVariableChange}
            isVariable={isVariable}
            renderInput={renderInput}
            defaultValue={false}
            {...rest}
        />
    );
};