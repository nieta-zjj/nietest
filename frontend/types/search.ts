/**
 * 搜索相关类型定义
 */

/**
 * 搜索结果项
 */
export interface SearchResultItem {
    /** 唯一标识 */
    uuid: string;
    /** 类型 */
    type: string;
    /** 名称 */
    name: string;
    /** 头图URL */
    header_img?: string;
    /** 热度分数 */
    heat_score?: number;
}

/**
 * 搜索选择项
 */
export interface SearchSelectItem extends SearchResultItem { }

/**
 * 搜索元数据
 */
export interface SearchMetadata {
    /** 总结果数 */
    total_size: number;
    /** 总页数 */
    total_page_size: number;
    /** 当前页码 */
    page_index: number;
    /** 每页大小 */
    page_size: number;
}

/**
 * 搜索响应
 */
export interface SearchResponse {
    /** 搜索结果数据 */
    data: SearchResultItem[];
    /** 搜索元数据 */
    metadata: SearchMetadata;
    /** 错误信息 */
    error?: string;
    /** HTTP状态码 */
    status: number;
}