/**
 * VToken类型定义文件
 */

import { SearchSelectItem } from "@/types/search";

/**
 * VToken类型
 */
export type VTokenType = "character" | "element";

/**
 * VToken选择器属性
 */
export interface VTokenSelectorProps {
    /** 当前选中的名称 */
    name?: string;
    /** 令牌类型 */
    type: VTokenType;
    /** 头图 */
    header_img?: string;
    /** 值变化回调 */
    onChange: (value: string) => void;
    /** 选择项目回调 */
    onSelectItem?: (item: SearchSelectItem) => void;
    /** 额外的CSS类名 */
    className?: string;
    /** 是否禁用 */
    disabled?: boolean;
}

/**
 * 提示词类型映射
 */
export const PROMPT_TYPE_TO_VTOKEN_TYPE: Record<string, VTokenType> = {
    oc_vtoken_adaptor: "character",
    elementum: "element",
};