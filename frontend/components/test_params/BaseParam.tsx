"use client";

import React, { ReactNode } from "react";
import { Switch } from "@heroui/react";
import { BaseParamProps, ParamValueType } from "./types";
import { VariableValuesList } from "./VariableValuesList";

interface BaseParamComponentProps extends BaseParamProps {
    label: string;
    renderInput: (value: ParamValueType, onChange: (value: ParamValueType) => void) => ReactNode;
    renderVariableInput?: (value: ParamValueType, onChange: (value: ParamValueType) => void) => ReactNode;
    defaultValue: ParamValueType;
}

/**
 * 基础参数组件模板
 * 提供通用的变量切换、标签显示和变量值列表功能
 */
export const BaseParamComponent: React.FC<BaseParamComponentProps> = ({
    label,
    value,
    isVariable,
    variableValues = [],
    onChange,
    onVariableChange,
    onVariableValuesChange,
    renderInput,
    renderVariableInput,
    defaultValue,
    disabled = false
}) => {
    // 如果没有提供变量值列表或为空，使用当前值初始化
    const values = (variableValues && variableValues.length > 0) ? variableValues : [value];

    // 处理变量值列表变化
    const handleVariableValuesChange = (newValues: ParamValueType[]) => {
        onVariableValuesChange?.(newValues);
    };

    // 渲染变量值输入控件
    const variableInputRenderer = renderVariableInput || renderInput;

    return (
        <div className="py-2">
            <div className="flex items-center justify-between min-h-[44px]">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium w-24 flex-shrink-0">{label}</span>
                    <Switch
                        size="sm"
                        isSelected={isVariable}
                        onValueChange={onVariableChange}
                        isDisabled={disabled}
                    />
                    <span className="text-xs text-default-500">变量</span>
                </div>
                <div className="w-48 flex justify-end">
                    {!isVariable ? (
                        renderInput(value, onChange)
                    ) : (
                        <div className="h-10">
                            {/* 变量模式下不显示输入框，使用固定名称 */}
                        </div>
                    )}
                </div>
            </div>
            {isVariable && (
                <VariableValuesList
                    values={values}
                    onChange={handleVariableValuesChange}
                    defaultValue={defaultValue}
                    renderInput={(value, index, onChange) =>
                        variableInputRenderer(value, onChange)
                    }
                />
            )}
        </div>
    );
};