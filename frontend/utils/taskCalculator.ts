// 任务计算工具函数

/**
 * 计算任务将生成的总数量
 * @param taskData 任务数据
 * @returns 任务总数量
 */
export const calculateTaskCount = (taskData: any): number => {
    let totalCount = 1;

    // 获取batch_size
    const batchSize = taskData.batch_size?.value || 1;
    if (typeof batchSize === 'number' && batchSize > 0) {
        totalCount *= batchSize;
    }

    // 处理提示词变量
    if (taskData.prompts && Array.isArray(taskData.prompts)) {
        taskData.prompts.forEach((prompt: any) => {
            if (prompt.is_variable && prompt.variable_values && Array.isArray(prompt.variable_values)) {
                if (prompt.variable_values.length > 0) {
                    totalCount *= prompt.variable_values.length;
                }
            }
        });
    }

    // 处理其他参数变量
    const paramKeys = ['ratio', 'seed', 'use_polish', 'is_lumina', 'lumina_model_name', 'lumina_cfg', 'lumina_step'];

    paramKeys.forEach(key => {
        const param = taskData[key];
        if (param && param.is_variable && param.variable_values && Array.isArray(param.variable_values)) {
            if (param.variable_values.length > 0) {
                totalCount *= param.variable_values.length;
            }
        }
    });

    return totalCount;
};

/**
 * 格式化任务数量显示
 * @param count 任务数量
 * @returns 格式化的字符串
 */
export const formatTaskCount = (count: number): string => {
    return count.toLocaleString();
};

/**
 * 检查任务数量是否超过限制
 * @param count 任务数量
 * @param limit 限制数量，默认50000
 * @returns 是否超过限制
 */
export const isTaskCountExceeded = (count: number, limit: number = 50000): boolean => {
    return count > limit;
};