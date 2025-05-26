/**
 * 测试参数组件的基础类型定义
 */

// 参数值类型
export type ParamValueType = string | number | boolean | null;

// 基础参数接口
export interface BaseParamProps {
    // 参数是否为变量
    isVariable: boolean;
    // 参数当前值
    value: ParamValueType;
    // 参数变量值列表
    variableValues?: ParamValueType[];
    // 变量ID
    variableId?: string;
    // 变量名称
    variableName?: string;
    // 值更新回调
    onChange: (newValue: ParamValueType) => void;
    // 变量状态更新回调
    onVariableChange: (isVariable: boolean) => void;
    // 变量值列表更新回调
    onVariableValuesChange?: (values: ParamValueType[]) => void;
    // 变量名称更新回调
    onVariableNameChange?: (name: string) => void;
    // 禁用状态
    disabled?: boolean;
}

// 文本类参数接口
export interface TextParamProps extends BaseParamProps {
    placeholder?: string;
}

// 选择类参数接口
export interface SelectParamProps extends BaseParamProps {
    options: { key: string; label: string }[];
}

// 数值类参数接口
export interface NumberParamProps extends BaseParamProps {
    min?: number;
    max?: number;
    step?: number;
    showSlider?: boolean;
}

// 布尔类参数接口
export interface BooleanParamProps extends BaseParamProps {
    trueLabel?: string;
    falseLabel?: string;
}

// 角色/元素类参数接口
export interface VTokenParamProps extends BaseParamProps {
    type: "character" | "element";
    header_img?: string;
    name?: string;
    uuid?: string;
}