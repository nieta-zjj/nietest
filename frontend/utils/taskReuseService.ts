/**
 * 任务复用服务
 * 提供从历史任务中复用设置到测试页面的功能
 */

import { getTaskReuseConfig } from './apiClient';

// 本地存储键名
const REUSED_TASK_STORAGE_KEY = "reusedTask";

/**
 * 复用任务设置
 * 从数据库获取任务复用配置并保存到本地存储
 * @param taskId 任务ID
 * @returns 操作结果
 */
export const reuseTaskSettings = async (taskId: string) => {
    try {
        console.log(`开始复用任务设置，任务ID: ${taskId}`);

        // 从API获取任务复用配置
        const response = await getTaskReuseConfig(taskId);

        // 检查响应结构 - 后端返回的是APIResponse格式，包含code, message, data字段
        if (!response || response.code !== 200 || !response.data) {
            throw new Error(response?.message || "获取任务复用配置失败");
        }

        const configData = response.data;

        // 构建复用数据
        const reuseData = {
            id: configData.task_id,
            name: configData.task_name,
            detail: {
                name: configData.name, // 新任务名（带复用前缀）
                prompts: configData.prompts || [],
                ratio: configData.ratio,
                seed: configData.seed,
                use_polish: configData.use_polish,
                is_lumina: configData.is_lumina,
                lumina_model_name: configData.lumina_model_name,
                lumina_cfg: configData.lumina_cfg,
                lumina_step: configData.lumina_step,
                priority: configData.priority
            },
            timestamp: new Date().toISOString(),
            original_username: configData.original_username,
            is_old_format: configData.is_old_format || false
        };

        // 保存到本地存储
        try {
            localStorage.setItem(REUSED_TASK_STORAGE_KEY, JSON.stringify(reuseData));
            console.log("任务复用数据已保存到本地存储");
        } catch (error) {
            console.error("保存任务复用数据失败:", error);
            throw new Error("保存任务复用数据失败");
        }

        return {
            success: true,
            message: "任务设置已复用，请前往测试页面查看",
            data: reuseData,
        };
    } catch (error) {
        console.error("复用任务设置失败:", error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "复用任务设置失败",
            error: error instanceof Error ? error.message : "未知错误",
        };
    }
};

/**
 * 获取保存的复用任务数据
 * @returns 保存的复用任务数据，如果没有则返回null
 */
export const getReusedTaskData = () => {
    try {
        const savedData = localStorage.getItem(REUSED_TASK_STORAGE_KEY);
        if (!savedData) {
            return null;
        }

        return JSON.parse(savedData);
    } catch (error) {
        console.error("获取保存的复用任务数据失败:", error);
        return null;
    }
};

/**
 * 清除保存的复用任务数据
 */
export const clearReusedTaskData = () => {
    try {
        localStorage.removeItem(REUSED_TASK_STORAGE_KEY);
        console.log("复用任务数据已清除");
        return true;
    } catch (error) {
        console.error("清除复用任务数据失败:", error);
        return false;
    }
};