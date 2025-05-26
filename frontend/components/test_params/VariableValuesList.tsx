"use client";

import React, { ReactNode } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ParamValueType } from "./types";

interface VariableValuesListProps {
    values: ParamValueType[];
    onChange: (values: ParamValueType[]) => void;
    renderInput: (value: ParamValueType, index: number, onChange: (value: ParamValueType) => void) => ReactNode;
    defaultValue?: ParamValueType;
}

/**
 * 变量值列表组件
 * 用于显示和管理参数的多个变量值
 */
export const VariableValuesList: React.FC<VariableValuesListProps> = ({
    values,
    onChange,
    renderInput,
    defaultValue = ""
}) => {
    // 添加新值
    const addValue = () => {
        onChange([...values, defaultValue]);
    };

    // 更新值
    const updateValue = (index: number, newValue: ParamValueType) => {
        const newValues = [...values];
        newValues[index] = newValue;
        onChange(newValues);
    };

    // 删除值
    const removeValue = (index: number) => {
        if (values.length <= 1) return; // 至少保留一个值
        const newValues = [...values];
        newValues.splice(index, 1);
        onChange(newValues);
    };

    // 移动值的位置
    const moveValue = (index: number, direction: "up" | "down") => {
        if (
            (direction === "up" && index === 0) ||
            (direction === "down" && index === values.length - 1)
        ) {
            return;
        }

        const newValues = [...values];
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        const temp = newValues[index];
        newValues[index] = newValues[targetIndex];
        newValues[targetIndex] = temp;
        onChange(newValues);
    };

    // 复制值
    const duplicateValue = (index: number) => {
        const newValues = [...values];
        const valueToDuplicate = newValues[index];
        newValues.splice(index + 1, 0, valueToDuplicate);
        onChange(newValues);
    };

    return (
        <div className="mt-2 mb-1 space-y-1">
            <div className="flex justify-between items-center">
                <span className="text-xs text-default-500">变量值列表</span>
                <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    startContent={<Icon icon="solar:add-circle-linear" width={14} />}
                    onPress={addValue}
                >
                    添加值
                </Button>
            </div>

            {values.map((value, index) => (
                <div key={index} className="flex items-center gap-2 p-1 border rounded-md">
                    <div className="flex-grow">
                        {renderInput(value, index, (newValue) => updateValue(index, newValue))}
                    </div>

                    <div className="flex gap-1">
                        <Button
                            size="sm"
                            variant="light"
                            isIconOnly
                            isDisabled={index === 0}
                            onPress={() => moveValue(index, "up")}
                        >
                            <Icon icon="solar:alt-arrow-up-linear" width={16} />
                        </Button>
                        <Button
                            size="sm"
                            variant="light"
                            isIconOnly
                            isDisabled={index === values.length - 1}
                            onPress={() => moveValue(index, "down")}
                        >
                            <Icon icon="solar:alt-arrow-down-linear" width={16} />
                        </Button>
                        <Button
                            size="sm"
                            variant="light"
                            isIconOnly
                            onPress={() => duplicateValue(index)}
                        >
                            <Icon icon="solar:copy-linear" width={16} />
                        </Button>
                        <Button
                            size="sm"
                            variant="light"
                            color="danger"
                            isIconOnly
                            isDisabled={values.length <= 1}
                            onPress={() => removeValue(index)}
                        >
                            <Icon icon="solar:trash-bin-trash-linear" width={16} />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
};