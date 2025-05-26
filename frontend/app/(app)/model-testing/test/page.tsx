"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  SelectItem,
  Divider,
  Switch,
  Checkbox,
  Button,
  Textarea,
  Slider,
  Tooltip,
  Tabs,
  Tab,
  useDisclosure,
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { VTokenSelector } from "@/components/vtoken";
import { PROMPT_TYPE_TO_VTOKEN_TYPE } from "@/types/vtoken";
import { SearchSelectItem } from "@/types/search";
// 导入参数组件
import {
  RatioParam,
  SeedParam,
  UsePolishParam,
  FreetextParam,
  OCVTokenParam,
  ElementumParam,
  IsLuminaParam,
  LuminaModelNameParam,
  LuminaCfgParam,
  LuminaStepParam
} from "@/components/test_params";
import { apiRequest } from "@/utils/apiClient";
import { toast } from "sonner";
import { calculateTaskCount, formatTaskCount, isTaskCountExceeded } from "@/utils/taskCalculator";
import { useAuth } from "@/lib/auth/client";
import { LoginModal } from "@/components/login/login-modal";


// 添加隐藏滚动条的样式
const hideScrollbarStyle = `
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

// 定义提示词类型
type Prompt = {
  type: string;
  value: string;
  weight: number;
  is_variable: boolean;
  img_url?: string;
  uuid?: string;
  name?: string;
  variable_id?: string;
  variable_name?: string;
  variable_values?: VariableValueType[]; // 添加变量值列表字段
  selected?: boolean; // 新增选中状态用于批量编辑
};

// 变量值类型定义
type VariableValueType = {
  type: string;
  value: string;
  weight: number;
  uuid?: string;
  img_url?: string;
  name?: string;
};

// 定义任务参数类型
type TaskParameter = {
  type: string;
  value: any;
  is_variable: boolean;
  variable_id?: string;
  variable_name?: string;
  variable_values?: any[];
  format: string;
};

// 添加一个检查客户端渲染的钩子
function useIsClient() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}

export default function TestPage() {
  // 检查是否为客户端渲染
  const isClient = useIsClient();

  // 添加提交状态
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // 添加提交结果状态
  const [submitResult, setSubmitResult] = useState<{ success: boolean; taskId?: string; message?: string } | null>(null);

  // 复用任务状态
  const [reusedTask, setReusedTask] = useState<{ id: string; name: string; detail: any } | null>(null);

  // Modal状态管理
  const { isOpen: isValidationModalOpen, onOpen: onValidationModalOpen, onOpenChange: onValidationModalChange } = useDisclosure();
  const { isOpen: isResetModalOpen, onOpen: onResetModalOpen, onOpenChange: onResetModalChange } = useDisclosure();
  const { isOpen: isJsonErrorModalOpen, onOpen: onJsonErrorModalOpen, onOpenChange: onJsonErrorModalChange } = useDisclosure();
  const { isOpen: isTaskConfirmModalOpen, onOpen: onTaskConfirmModalOpen, onOpenChange: onTaskConfirmModalChange } = useDisclosure();
  const { isOpen: isLoginModalOpen, onOpen: onLoginModalOpen, onOpenChange: onLoginModalChange } = useDisclosure();
  const [validationMessage, setValidationMessage] = useState<string>("");
  const [jsonErrorMessage, setJsonErrorMessage] = useState<string>("");
  const [taskCountInfo, setTaskCountInfo] = useState<{ count: number; formattedCount: string; taskData: any } | null>(null);

  // 获取认证状态
  const { user, isLoading: authLoading } = useAuth();

  // 生成用于变量ID的计数器
  const [variableIdCounter, setVariableIdCounter] = useState<number>(1);

  // 获取下一个变量ID
  const getNextVariableId = () => {
    const nextId = variableIdCounter;
    setVariableIdCounter(prevId => prevId + 1);
    return `${nextId}`;
  };

  // 任务基本信息
  const [name, setName] = useState<string>("新任务");

  // 提示词列表
  const [prompts, setPrompts] = useState<Prompt[]>([
    {
      type: "freetext",
      value: "1girl, cute",
      weight: 1.0,
      is_variable: false,
      selected: false
    }
  ]);

  // 是否启用批量编辑模式
  const [batchEditMode, setBatchEditMode] = useState<boolean>(false);
  // 选中的提示词数量
  const [selectedCount, setSelectedCount] = useState<number>(0);

  // 任务参数
  const [ratio, setRatio] = useState<TaskParameter>({
    type: 'ratio',
    value: '1:1',
    is_variable: false,
    format: 'string'
  });

  const [seed, setSeed] = useState<TaskParameter>({
    type: 'seed',
    value: 1,
    is_variable: false,
    format: 'int'
  });

  const [userPolish, setUserPolish] = useState<TaskParameter>({
    type: 'use_polish',
    value: false,
    is_variable: false,
    format: 'bool'
  });

  const [isLumina, setIsLumina] = useState<TaskParameter>({
    type: 'is_lumina',
    value: false,
    is_variable: false,
    format: 'bool'
  });

  const [luminaModelName, setLuminaModelName] = useState<TaskParameter>({
    type: 'lumina_model_name',
    value: null,
    is_variable: false,
    format: 'string'
  });

  const [luminaCfg, setLuminaCfg] = useState<TaskParameter>({
    type: 'lumina_cfg',
    value: 5.5,
    is_variable: false,
    format: 'float'
  });

  const [luminaStep, setLuminaStep] = useState<TaskParameter>({
    type: 'lumina_step',
    value: 30,
    is_variable: false,
    format: 'int'
  });

  const [priority, setPriority] = useState<number>(1);

  // 生成JSON数据
  const [jsonData, setJsonData] = useState<string>("");
  // 编辑中的JSON
  const [editingJson, setEditingJson] = useState<string>("");
  // 是否有JSON解析错误
  const [jsonError, setJsonError] = useState<string | null>(null);

  // 本地存储键名
  const STORAGE_KEY = 'model_test_config';

  // 保存配置到本地存储
  const saveConfigToLocalStorage = () => {
    // 确保只在客户端执行
    if (!isClient) return;

    try {
      const config = {
        name,
        prompts,
        ratio,
        seed,
        userPolish,
        isLumina,
        luminaModelName,
        luminaCfg,
        luminaStep,
        priority,
        variableIdCounter
      };

      // 防止循环引用
      const configStr = JSON.stringify(config, (key, value) => {
        // 避免序列化函数或循环引用
        if (typeof value === 'function') {
          return undefined;
        }
        return value;
      });

      localStorage.setItem(STORAGE_KEY, configStr);
      console.log("配置已保存到本地存储");
    } catch (error) {
      console.error("保存配置失败:", error);
    }
  };

  // 从本地存储加载配置
  const loadConfigFromLocalStorage = () => {
    // 确保只在客户端执行
    if (!isClient) return;

    try {
      const storedConfig = localStorage.getItem(STORAGE_KEY);
      if (!storedConfig) {
        console.log("没有找到保存的配置");
        return;
      }

      console.log("正在加载保存的配置...");
      const config = JSON.parse(storedConfig);

      // 只有当配置存在相应字段时才更新
      if (config.name !== undefined) setName(config.name);

      if (config.prompts && Array.isArray(config.prompts)) {
        // 确保提示词对象有必要的字段
        const validPrompts = config.prompts.map((prompt: any) => ({
          type: prompt.type || "freetext",
          value: prompt.value || "",
          weight: prompt.weight || 1.0,
          is_variable: !!prompt.is_variable,
          selected: false, // 始终重置选中状态
          ...(prompt.is_variable ? {
            variable_name: prompt.variable_name || "",
            variable_id: prompt.variable_id || getNextVariableId(),
            variable_values: Array.isArray(prompt.variable_values) ? prompt.variable_values : []
          } : {}),
          ...(prompt.type === 'oc_vtoken_adaptor' || prompt.type === 'elementum' ? {
            img_url: prompt.img_url || '',
            uuid: prompt.uuid || '',
            name: prompt.name || ''
          } : {})
        }));
        setPrompts(validPrompts);
      }

      if (config.ratio) setRatio(config.ratio);
      if (config.seed) setSeed(config.seed);
      if (config.userPolish) setUserPolish(config.userPolish);
      if (config.isLumina) setIsLumina(config.isLumina);
      if (config.luminaModelName) setLuminaModelName(config.luminaModelName);
      if (config.luminaCfg) setLuminaCfg(config.luminaCfg);
      if (config.luminaStep) setLuminaStep(config.luminaStep);
      if (config.priority !== undefined) setPriority(config.priority);
      if (config.variableIdCounter && typeof config.variableIdCounter === 'number') {
        setVariableIdCounter(config.variableIdCounter);
      }

      console.log("配置已成功从本地存储加载");
    } catch (error) {
      console.error("加载配置失败:", error);
    }
  };

  // 组件加载时从本地存储恢复配置
  useEffect(() => {
    // 确保代码只在浏览器端执行
    if (isClient) {
      // 先检查是否有复用的任务
      const reusedTaskStr = localStorage.getItem('reusedTask');
      if (reusedTaskStr) {
        try {
          const reusedTaskData = JSON.parse(reusedTaskStr);
          setReusedTask(reusedTaskData);
          // 不立即应用，等待用户确认
        } catch (error) {
          console.error("解析复用任务数据失败:", error);
          localStorage.removeItem('reusedTask');
        }
      } else {
        // 如果没有复用任务，加载本地保存的配置
        loadConfigFromLocalStorage();
      }
    }
  }, [isClient]);

  // 任何配置更改时自动保存到本地存储
  useEffect(() => {
    // 确保代码只在浏览器端执行并且组件已经初始化
    if (isClient) {
      // 使用setTimeout延迟执行以避免在初始化阶段触发保存
      const timer = setTimeout(() => {
        saveConfigToLocalStorage();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [
    isClient,
    name,
    prompts,
    ratio,
    seed,
    userPolish,
    isLumina,
    luminaModelName,
    luminaCfg,
    luminaStep,
    priority,
    variableIdCounter
  ]);

  // 清理任务参数数据 - 从useEffect中移出到组件内作为独立函数
  const cleanParameter = (param: TaskParameter) => {
    const cleanedParam = { ...param };
    if (param.is_variable) {
      // 变量模式保留变量相关字段和变量值列表
      delete cleanedParam.value;
      if (!cleanedParam.variable_values) {
        cleanedParam.variable_values = [param.value];
      }
    } else {
      // 非变量模式只保留值
      delete cleanedParam.variable_name;
      delete cleanedParam.variable_id;
      delete cleanedParam.variable_values;
    }
    return cleanedParam;
  };

  // 更新JSON数据
  useEffect(() => {
    // 清理提示词数据，根据变量状态保留必要字段
    const cleanedPrompts = prompts.map(prompt => {
      const cleanPrompt: any = {
        type: prompt.type,
        is_variable: prompt.is_variable
      };

      if (prompt.is_variable) {
        // 变量模式下只保留变量相关字段
        cleanPrompt.variable_name = prompt.variable_name || "";
        cleanPrompt.variable_id = prompt.variable_id || "";
        // 如果有变量值列表，则保留
        if (prompt.variable_values && prompt.variable_values.length > 0) {
          cleanPrompt.variable_values = prompt.variable_values;
        }
      } else {
        // 非变量模式下保留值和权重
        cleanPrompt.value = prompt.value;
        cleanPrompt.weight = prompt.weight;

        // 对于角色和元素类型，还需保留额外字段
        if (prompt.type === 'oc_vtoken_adaptor' || prompt.type === 'elementum') {
          cleanPrompt.uuid = prompt.uuid;
          cleanPrompt.img_url = prompt.img_url;
          cleanPrompt.name = prompt.name;
        }
      }

      return cleanPrompt;
    });

    const data = {
      name,
      prompts: cleanedPrompts,
      ratio: cleanParameter(ratio),
      seed: cleanParameter(seed),
      use_polish: cleanParameter(userPolish),
      is_lumina: cleanParameter(isLumina),
      lumina_model_name: cleanParameter(luminaModelName),
      lumina_cfg: cleanParameter(luminaCfg),
      lumina_step: cleanParameter(luminaStep),
      priority
    };

    const formattedJson = JSON.stringify(data, null, 2);
    setJsonData(formattedJson);
    setEditingJson(formattedJson);
  }, [
    name,
    prompts,
    ratio,
    seed,
    userPolish,
    isLumina,
    luminaModelName,
    luminaCfg,
    luminaStep,
    priority
  ]);

  // 添加提示词
  const addPrompt = () => {
    setPrompts([
      ...prompts,
      {
        type: "freetext",
        value: "",
        weight: 1.0,
        is_variable: false,
        selected: false
      }
    ]);
  };

  // 更新提示词
  const updatePrompt = (index: number, field: string, value: any) => {
    const newPrompts = [...prompts];

    // 如果是切换变量状态
    if (field === 'is_variable') {
      if (value === true) {
        // 切换为变量，但保留必需的字段，清空非必需字段
        const promptType = newPrompts[index].type;
        const currentValue = newPrompts[index].value;
        const currentWeight = newPrompts[index].weight;

        // 创建默认变量值对象
        let defaultVariableValue: VariableValueType = {
          type: promptType,
          value: currentValue,
          weight: currentWeight
        };

        // 对于角色和元素类型，添加额外必要字段
        if (promptType === 'oc_vtoken_adaptor' || promptType === 'elementum') {
          defaultVariableValue.uuid = newPrompts[index].uuid || '';
          defaultVariableValue.img_url = newPrompts[index].img_url || '';
          defaultVariableValue.name = newPrompts[index].name || '';
        }

        const newPrompt: Prompt = {
          type: promptType,
          is_variable: true,
          variable_name: "",
          variable_id: getNextVariableId(),
          variable_values: [defaultVariableValue], // 初始化变量值列表
          // 以下字段是Prompt类型所必需的
          value: "",
          weight: 1.0,
          selected: newPrompts[index].selected || false
        };

        // 清除可选的vtoken字段
        delete (newPrompt as any).img_url;
        delete (newPrompt as any).uuid;
        delete (newPrompt as any).name;

        newPrompts[index] = newPrompt;
      } else {
        // 切换回非变量，根据类型初始化必要字段
        const promptType = newPrompts[index].type;
        // 尝试从变量值列表中获取第一个值
        const firstVariableValue = newPrompts[index].variable_values?.[0] || {
          type: promptType,
          value: '',
          weight: 1.0,
          uuid: '',
          img_url: '',
          name: ''
        };

        if (promptType === 'oc_vtoken_adaptor' || promptType === 'elementum') {
          newPrompts[index] = {
            type: promptType,
            is_variable: false,
            value: firstVariableValue.value || '',
            weight: firstVariableValue.weight || 1.0,
            img_url: firstVariableValue.img_url || '',
            uuid: firstVariableValue.uuid || '',
            name: firstVariableValue.name || '',
            selected: false
          };
        } else {
          newPrompts[index] = {
            type: promptType,
            is_variable: false,
            value: firstVariableValue.value || '',
            weight: firstVariableValue.weight || 1.0,
            selected: false
          };
        }

        // 清除变量相关字段
        delete (newPrompts[index] as any).variable_name;
        delete (newPrompts[index] as any).variable_id;
        delete (newPrompts[index] as any).variable_values;
      }
    } else if (field === 'type') {
      // 如果是切换类型
      let updatedPrompt: Prompt;

      if (newPrompts[index].is_variable) {
        // 变量模式下切换类型
        updatedPrompt = {
          type: value,
          is_variable: true,
          variable_name: newPrompts[index].variable_name || "",
          variable_id: newPrompts[index].variable_id || getNextVariableId(),
          // 以下字段是Prompt类型所必需的
          value: "",
          weight: 1.0,
          selected: newPrompts[index].selected || false
        };

        // 更新变量值列表中的类型
        if (newPrompts[index].variable_values && newPrompts[index].variable_values.length > 0) {
          const updatedValues = newPrompts[index].variable_values.map(val => {
            const newVal: VariableValueType = {
              type: value,
              value: val.value || '',
              weight: val.weight || 1.0
            };

            // 对于角色和元素类型，确保有必要字段
            if (value === 'oc_vtoken_adaptor' || value === 'elementum') {
              newVal.uuid = val.uuid || '';
              newVal.img_url = val.img_url || '';
              newVal.name = val.name || '';
            }

            return newVal;
          });
          updatedPrompt.variable_values = updatedValues;
        } else {
          // 如果没有变量值列表，创建一个空的带默认值
          const defaultValue: VariableValueType = {
            type: value,
            value: '',
            weight: 1.0
          };

          // 对于角色和元素类型，添加额外必要字段
          if (value === 'oc_vtoken_adaptor' || value === 'elementum') {
            defaultValue.uuid = '';
            defaultValue.img_url = '';
            defaultValue.name = '';
          }

          updatedPrompt.variable_values = [defaultValue];
        }

        // 清除可选的vtoken字段
        delete (updatedPrompt as any).img_url;
        delete (updatedPrompt as any).uuid;
        delete (updatedPrompt as any).name;
      } else {
        // 非变量模式下切换类型
        updatedPrompt = {
          type: value,
          is_variable: false,
          value: '',
          weight: 1.0,
          selected: newPrompts[index].selected || false
        };

        // 如果切换到角色或元素类型，添加必要字段
        if (value === 'oc_vtoken_adaptor' || value === 'elementum') {
          updatedPrompt.img_url = '';
          updatedPrompt.uuid = '';
          updatedPrompt.name = '';
        } else {
          // 如果从角色/元素切换到文本，删除这些字段
          delete (updatedPrompt as any).img_url;
          delete (updatedPrompt as any).uuid;
          delete (updatedPrompt as any).name;
        }

        // 清除变量相关字段
        delete (updatedPrompt as any).variable_name;
        delete (updatedPrompt as any).variable_id;
        delete (updatedPrompt as any).variable_values;
      }

      newPrompts[index] = updatedPrompt;
    } else if (field === 'variable_values') {
      // 直接更新变量值列表
      newPrompts[index].variable_values = value;
    } else {
      // 其他字段的正常更新
      newPrompts[index] = {
        ...newPrompts[index],
        [field]: value
      };
    }

    setPrompts(newPrompts);
  };

  // 删除提示词
  const removePrompt = (index: number) => {
    setPrompts(prompts.filter((_, i) => i !== index));
  };

  // 切换提示词选中状态（用于批量编辑）
  const togglePromptSelection = (index: number) => {
    const newPrompts = [...prompts];
    newPrompts[index].selected = !newPrompts[index].selected;
    setPrompts(newPrompts);
    setSelectedCount(newPrompts.filter(p => p.selected).length);
  };

  // 移动提示词位置（上移/下移）
  const movePrompt = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) ||
      (direction === 'down' && index === prompts.length - 1)) {
      return; // 已在顶部或底部
    }

    const newPrompts = [...prompts];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newPrompts[index];
    newPrompts[index] = newPrompts[targetIndex];
    newPrompts[targetIndex] = temp;
    setPrompts(newPrompts);
  };

  // 复制提示词
  const duplicatePrompt = (index: number) => {
    const promptToDuplicate = prompts[index];
    const newPrompt = { ...promptToDuplicate, selected: false };
    const newPrompts = [...prompts];
    newPrompts.splice(index + 1, 0, newPrompt);
    setPrompts(newPrompts);
  };

  // 批量删除选中的提示词
  const batchDeletePrompts = () => {
    setPrompts(prompts.filter(prompt => !prompt.selected));
    setSelectedCount(0);
  };

  // 批量修改选中提示词的类型
  const batchUpdateType = (type: string) => {
    setPrompts(prompts.map(prompt =>
      prompt.selected ? { ...prompt, type } : prompt
    ));
  };

  // 处理JSON编辑
  const handleJsonEdit = (json: string) => {
    setEditingJson(json);
    setJsonError(null);
  };

  // 应用JSON更改
  const applyJsonChanges = () => {
    try {
      const data = JSON.parse(editingJson);

      // 更新所有状态
      if (data.name) setName(data.name);
      if (data.prompts) setPrompts(data.prompts);
      if (data.ratio) setRatio(data.ratio);
      if (data.seed) setSeed(data.seed);
      if (data.use_polish) setUserPolish(data.use_polish);
      if (data.is_lumina) setIsLumina(data.is_lumina);
      if (data.lumina_model_name) setLuminaModelName(data.lumina_model_name);
      if (data.lumina_cfg) setLuminaCfg(data.lumina_cfg);
      if (data.lumina_step) setLuminaStep(data.lumina_step);
      if (data.priority) setPriority(data.priority);

      setJsonError(null);
      toast.success("JSON配置应用成功");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "JSON格式错误，请检查语法";
      setJsonErrorMessage(`JSON解析失败：\n\n${errorMessage}\n\n请检查JSON格式是否正确，注意：\n• 字符串需要用双引号包围\n• 对象和数组的语法要正确\n• 不能有多余的逗号\n• 括号要匹配`);
      onJsonErrorModalOpen();
    }
  };

  // 添加参数变量值处理函数
  const updateParameterVariableValue = (parameter: TaskParameter, index: number, newValue: any) => {
    // 如果不是变量模式，直接更新value
    if (!parameter.is_variable) {
      return { ...parameter, value: newValue };
    }

    // 变量模式下，确保variable_values存在
    let newValues = parameter.variable_values ? [...parameter.variable_values] : [parameter.value];

    // 更新指定索引的值
    if (index >= 0 && index < newValues.length) {
      newValues[index] = newValue;
    }

    // 同时更新value，保持与第一个变量值一致
    const updatedValue = index === 0 ? newValue : parameter.value;

    return {
      ...parameter,
      variable_values: newValues,
      value: updatedValue  // 同步更新value
    };
  };

  // 验证所有变量是否都有变量名
  const validateVariables = () => {
    const missingVariableNames = [];

    // 检查提示词变量
    prompts.forEach((prompt, index) => {
      if (prompt.is_variable && (!prompt.variable_name || prompt.variable_name.trim() === '')) {
        missingVariableNames.push(`提示词 ${index + 1}`);
      }
    });

    // 检查比例参数
    if (ratio.is_variable && (!ratio.variable_name || ratio.variable_name.trim() === '')) {
      missingVariableNames.push('比例');
    }

    // 检查种子参数
    if (seed.is_variable && (!seed.variable_name || seed.variable_name.trim() === '')) {
      missingVariableNames.push('种子');
    }

    // 检查润色参数
    if (userPolish.is_variable && (!userPolish.variable_name || userPolish.variable_name.trim() === '')) {
      missingVariableNames.push('润色');
    }

    // 检查lumina相关参数
    if (isLumina.is_variable && (!isLumina.variable_name || isLumina.variable_name.trim() === '')) {
      missingVariableNames.push('使用Lumina');
    }

    if (luminaModelName.is_variable && (!luminaModelName.variable_name || luminaModelName.variable_name.trim() === '')) {
      missingVariableNames.push('Lumina模型名称');
    }

    if (luminaCfg.is_variable && (!luminaCfg.variable_name || luminaCfg.variable_name.trim() === '')) {
      missingVariableNames.push('Lumina配置');
    }

    if (luminaStep.is_variable && (!luminaStep.variable_name || luminaStep.variable_name.trim() === '')) {
      missingVariableNames.push('Lumina步数');
    }

    return missingVariableNames;
  };

  // 提交任务
  const submitTask = () => {
    // 首先检查登录状态
    if (!user) {
      // 未登录，显示登录Modal
      onLoginModalOpen();
      return;
    }

    // 验证变量名
    const missingVariableNames = validateVariables();

    // 如果有缺失的变量名，显示警告
    if (missingVariableNames.length > 0) {
      const missingNamesStr = missingVariableNames.join('、');
      setValidationMessage(`以下变量缺少变量名，请补充后再提交：\n${missingNamesStr}`);
      onValidationModalOpen();
      return;
    }

    // 清除上一次的提交结果
    setSubmitResult(null);

    try {
      // 解析高级模式下的JSON或使用当前表单状态
      let taskData;

      try {
        // 尝试解析高级模式下的JSON
        taskData = JSON.parse(editingJson);

        // 确保批量大小存在
        if (!taskData.batch_size) {
          taskData.batch_size = {
            type: 'batch_size',
            value: 1,
            is_variable: false,
            format: 'int'
          };
        }
      } catch (error) {
        // 如果解析失败，则使用表单状态构建数据
        taskData = {
          name,
          prompts: prompts.map(prompt => ({
            type: prompt.type,
            value: prompt.value,
            weight: prompt.weight,
            is_variable: prompt.is_variable,
            variable_id: prompt.variable_id,
            variable_name: prompt.variable_name,
            variable_values: prompt.variable_values,
            img_url: prompt.img_url,
            uuid: prompt.uuid,
            name: prompt.name
          })),
          ratio: cleanParameter(ratio),
          seed: cleanParameter(seed),
          use_polish: cleanParameter(userPolish),
          is_lumina: cleanParameter(isLumina),
          lumina_model_name: cleanParameter(luminaModelName),
          lumina_cfg: cleanParameter(luminaCfg),
          lumina_step: cleanParameter(luminaStep),
          priority: priority,
          batch_size: {
            type: 'batch_size',
            value: 1,
            is_variable: false,
            format: 'int'
          }
        };
      }

      // 计算任务数量
      const taskCount = calculateTaskCount(taskData);

      // 检查是否超过5万限制
      if (isTaskCountExceeded(taskCount)) {
        setValidationMessage(`任务数量超过限制！\n\n即将生成 ${formatTaskCount(taskCount)} 个任务，但系统限制最多生成 50,000 个任务。\n\n请减少变量值的数量或调整任务参数。`);
        onValidationModalOpen();
        return;
      }

      // 设置任务确认信息并显示确认Modal
      setTaskCountInfo({
        count: taskCount,
        formattedCount: formatTaskCount(taskCount),
        taskData: taskData
      });
      onTaskConfirmModalOpen();

    } catch (error) {
      console.error('准备提交数据时出错', error);
      setSubmitResult({
        success: false,
        message: '准备提交数据时出错，请检查高级模式下的JSON格式'
      });
    }
  };

  // 确认提交任务
  const confirmSubmitTask = () => {
    if (!taskCountInfo) return;

    // 设置提交状态
    setIsSubmitting(true);

    // 使用API提交任务
    apiRequest("api/v1/test/task", {
      method: "POST",
      body: taskCountInfo.taskData,
    })
      .then(response => {
        console.log('任务提交成功', response);
        // 设置成功状态
        setSubmitResult({
          success: true,
          taskId: response.data.task_id,
          message: response.message || '任务提交成功'
        });
        // 保存当前配置到本地存储
        saveConfigToLocalStorage();
        toast.success(`任务提交成功！将生成 ${taskCountInfo.formattedCount} 个任务`);
      })
      .catch(error => {
        console.error('任务提交失败', error);
        // 设置失败状态
        setSubmitResult({
          success: false,
          message: error.message || '任务提交失败，请稍后重试'
        });
        toast.error('任务提交失败');
      })
      .finally(() => {
        // 恢复提交状态
        setIsSubmitting(false);
        // 关闭确认Modal
        onTaskConfirmModalChange();
        // 清除任务确认信息
        setTaskCountInfo(null);
      });
  };

  // 完整更新参数变量状态
  const updateParameterVariableStatus = (parameter: TaskParameter, isVariable: boolean, name: string = "") => {
    if (isVariable) {
      // 切换为变量，使用固定变量名
      return {
        ...parameter,
        is_variable: true,
        variable_name: name, // 使用传入的固定名称
        variable_id: getNextVariableId(),
        variable_values: [parameter.value]
      };
    } else {
      // 切换回非变量，优先使用变量列表的第一个值
      let newValue = parameter.value;

      // 如果有变量值列表且不为空，则使用第一个值
      if (parameter.variable_values && parameter.variable_values.length > 0) {
        newValue = parameter.variable_values[0];
      }

      return {
        ...parameter,
        is_variable: false,
        value: newValue,
        variable_name: undefined,
        variable_id: undefined,
        variable_values: undefined
      };
    }
  };

  // 添加参数变量值
  const addParameterVariableValue = (parameter: TaskParameter, value: any = null) => {
    const defaultValue = value !== null ? value : (
      parameter.format === 'bool' ? false :
        parameter.format === 'float' ? 0.0 :
          parameter.format === 'int' ? 0 : ''
    );

    const newValues = parameter.variable_values ? [...parameter.variable_values] : [];
    newValues.push(defaultValue);

    return { ...parameter, variable_values: newValues };
  };

  // 删除参数变量值
  const removeParameterVariableValue = (parameter: TaskParameter, index: number) => {
    if (!parameter.variable_values || parameter.variable_values.length <= 1) {
      return parameter; // 至少保留一个值
    }

    const newValues = [...parameter.variable_values];
    newValues.splice(index, 1);

    return { ...parameter, variable_values: newValues };
  };

  // 移动参数变量值位置
  const moveParameterVariableValue = (parameter: TaskParameter, index: number, direction: 'up' | 'down') => {
    if (!parameter.variable_values ||
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === parameter.variable_values.length - 1)) {
      return parameter;
    }

    const newValues = [...parameter.variable_values];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newValues[index];
    newValues[index] = newValues[targetIndex];
    newValues[targetIndex] = temp;

    return { ...parameter, variable_values: newValues };
  };

  // 复制参数变量值
  const duplicateParameterVariableValue = (parameter: TaskParameter, index: number) => {
    if (!parameter.variable_values) {
      return parameter;
    }

    const newValues = [...parameter.variable_values];
    const valueToDuplicate = newValues[index];
    newValues.splice(index + 1, 0, valueToDuplicate);

    return { ...parameter, variable_values: newValues };
  };

  // 重置所有配置
  const resetAllConfig = () => {
    // 确保只在客户端执行
    if (!isClient) return;

    // 显示确认对话框
    onResetModalOpen();
  };

  // 确认重置配置
  const confirmResetConfig = () => {
    // 生成带时间戳的任务名称
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const timestampedName = `未命名任务-${year}-${month}-${day}-${hour}-${minute}-${second}`;

    // 重置所有状态到初始值
    setName(timestampedName);
    setPrompts([{
      type: "freetext",
      value: "1girl, cute",
      weight: 1.0,
      is_variable: false,
      selected: false
    }]);
    setRatio({
      type: 'ratio',
      value: '1:1',
      is_variable: false,
      format: 'string'
    });
    setSeed({
      type: 'seed',
      value: 1,
      is_variable: false,
      format: 'int'
    });
    setUserPolish({
      type: 'use_polish',
      value: false,
      is_variable: false,
      format: 'bool'
    });
    setIsLumina({
      type: 'is_lumina',
      value: false,
      is_variable: false,
      format: 'bool'
    });
    setLuminaModelName({
      type: 'lumina_model_name',
      value: null,
      is_variable: false,
      format: 'string'
    });
    setLuminaCfg({
      type: 'lumina_cfg',
      value: 5.5,
      is_variable: false,
      format: 'float'
    });
    setLuminaStep({
      type: 'lumina_step',
      value: 30,
      is_variable: false,
      format: 'int'
    });
    setPriority(1);
    setVariableIdCounter(1);
    // 清除本地存储
    localStorage.removeItem(STORAGE_KEY);

    // 关闭Modal
    onResetModalChange();

    // 显示成功提示
    toast.success("配置已重置");
  };

  // 下载配置为JSON文件
  const downloadConfigAsJson = () => {
    // 确保只在客户端执行
    if (!isClient) return;

    try {
      // 生成下载内容
      const config = {
        name,
        prompts,
        ratio,
        seed,
        userPolish,
        isLumina,
        luminaModelName,
        luminaCfg,
        luminaStep,
        priority
      };
      const configStr = JSON.stringify(config, null, 2);
      const blob = new Blob([configStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // 创建下载链接
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name || 'model_test_config'}.json`;
      document.body.appendChild(a);
      a.click();

      // 清理
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("配置文件下载成功");
    } catch (error) {
      console.error("下载配置失败:", error);
      toast.error("下载配置失败，请重试");
    }
  };

  // 上传配置文件
  const uploadConfigFile = () => {
    // 确保只在客户端执行
    if (!isClient) return;

    try {
      // 创建文件输入元素
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';

      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const config = JSON.parse(event.target?.result as string);
            // 更新所有状态
            if (config.name !== undefined) setName(config.name);
            if (config.prompts !== undefined) setPrompts(config.prompts);
            if (config.ratio !== undefined) setRatio(config.ratio);
            if (config.seed !== undefined) setSeed(config.seed);
            if (config.userPolish !== undefined) setUserPolish(config.userPolish);
            if (config.isLumina !== undefined) setIsLumina(config.isLumina);
            if (config.luminaModelName !== undefined) setLuminaModelName(config.luminaModelName);
            if (config.luminaCfg !== undefined) setLuminaCfg(config.luminaCfg);
            if (config.luminaStep !== undefined) setLuminaStep(config.luminaStep);
            if (config.priority !== undefined) setPriority(config.priority);

            toast.success("配置文件上传成功");
          } catch (error) {
            console.error("解析配置文件失败:", error);
            toast.error("配置文件格式无效，请检查JSON格式");
          }
        };
        reader.readAsText(file);
      };

      input.click();
    } catch (error) {
      console.error("上传配置失败:", error);
      toast.error("上传配置失败，请重试");
    }
  };

  // 应用复用的任务设置
  const applyReusedTask = () => {
    if (!reusedTask || !reusedTask.detail) return;

    try {
      const taskDetail = reusedTask.detail;

      // 更新任务名称（加上"复用"前缀）
      setName(`复用-${reusedTask.name}`);

      // 更新提示词
      if (taskDetail.prompts && Array.isArray(taskDetail.prompts)) {
        setPrompts(taskDetail.prompts.map((p: any) => ({
          ...p,
          selected: false // 重置选中状态
        })));
      }

      // 更新参数
      if (taskDetail.ratio) setRatio(taskDetail.ratio);
      if (taskDetail.seed) setSeed(taskDetail.seed);
      if (taskDetail.use_polish) setUserPolish(taskDetail.use_polish);
      if (taskDetail.is_lumina) setIsLumina(taskDetail.is_lumina);
      if (taskDetail.lumina_model_name) setLuminaModelName(taskDetail.lumina_model_name);
      if (taskDetail.lumina_cfg) setLuminaCfg(taskDetail.lumina_cfg);
      if (taskDetail.lumina_step) setLuminaStep(taskDetail.lumina_step);
      if (taskDetail.priority !== undefined) setPriority(taskDetail.priority);

      // 清除复用任务数据
      localStorage.removeItem('reusedTask');
      setReusedTask(null);

      // 显示成功提示
      toast.success(`已应用任务"${reusedTask.name}"的配置`);
    } catch (error) {
      console.error("应用复用任务失败:", error);
      toast.error("应用复用任务失败");
    }
  };

  // 忽略复用任务
  const ignoreReusedTask = () => {
    localStorage.removeItem('reusedTask');
    setReusedTask(null);
    // 加载本地保存的配置
    loadConfigFromLocalStorage();
  };

  return (
    <>
      <style jsx global>{hideScrollbarStyle}</style>
      {/* 左侧参数设置区域 - 增大与分割线的安全距离 */}
      <div className="fixed left-[320px] top-0 bottom-0 w-[calc(100%-330px)] xl:w-[calc(67%-330px)] 2xl:w-[calc(75%-330px)] min-w-[600px] overflow-hidden flex flex-col p-4">
        <div className="w-full flex-shrink-0">
          {/* 任务参数设置区域标题 */}
          <h2 className="text-xl font-medium mb-4 pt-2 pb-4 z-10">任务参数设置</h2>
        </div>
        <div className="w-full flex-grow overflow-hidden">
          <div
            className="overflow-y-auto hide-scrollbar h-full pb-24"
            style={{ maxHeight: 'calc(100vh - 5rem)' }}
          >
            <div className="space-y-6 pb-6">
              {/* 任务名称 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">任务名称</label>
                <Input
                  placeholder="输入任务名称"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-default-400">为您的任务指定一个名称</p>
              </div>

              {/* 提示词区域 */}
              <Divider className="my-4" />
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-medium">提示词设置</h3>
                  <div className="flex items-center gap-2">
                    <Switch
                      isSelected={batchEditMode}
                      onValueChange={setBatchEditMode}
                      size="sm"
                      aria-label="启用批量编辑模式"
                    />
                    <span className="text-sm">批量编辑</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {batchEditMode && selectedCount > 0 && (
                    <Button
                      color="danger"
                      size="sm"
                      variant="flat"
                      startContent={<Icon icon="solar:trash-bin-trash-linear" />}
                      onPress={batchDeletePrompts}
                      aria-label="批量删除选中的提示词"
                    >
                      批量删除 ({selectedCount})
                    </Button>
                  )}
                  <Button
                    color="primary"
                    size="sm"
                    startContent={<Icon icon="solar:add-circle-linear" />}
                    onPress={addPrompt}
                    aria-label="添加新提示词"
                  >
                    添加提示词
                  </Button>
                </div>
              </div>

              {/* 提示词列表 - 每行一个提示词 */}
              <div className="space-y-3">
                {prompts.map((prompt, index) => (
                  <div
                    key={index}
                    className={`flex flex-col border rounded-md overflow-hidden
                      ${batchEditMode && prompt.selected ? 'border-primary bg-primary-50 dark:bg-primary-50/20' :
                        prompt.is_variable ? 'border-primary-200 bg-primary-50 dark:border-primary-300/30 dark:bg-primary-50/20' :
                          'border-default-200 dark:border-default-100'}`}
                  >
                    {/* 提示词主体部分 */}
                    <div className="flex items-center gap-2 p-3 min-h-[60px]">
                      {/* 批量编辑时的选择框 */}
                      {batchEditMode && (
                        <Checkbox
                          isSelected={prompt.selected}
                          onValueChange={() => togglePromptSelection(index)}
                          className="mr-1"
                          aria-label={`选择提示词 ${index + 1}`}
                        />
                      )}

                      {/* 1. 类型选择区 */}
                      <div className="w-[180px] flex-shrink-0">
                        <Tabs
                          size="sm"
                          aria-label="提示词类型"
                          selectedKey={prompt.type}
                          onSelectionChange={(key) => {
                            updatePrompt(index, 'type', key.toString());
                          }}
                          classNames={{
                            base: "w-full",
                            tabList: "gap-1 w-full",
                            tab: "h-7 px-2 py-0",
                            cursor: "h-7"
                          }}
                        >
                          <Tab key="freetext" title="文本" />
                          <Tab key="oc_vtoken_adaptor" title="角色" />
                          <Tab key="elementum" title="元素" />
                        </Tabs>
                      </div>

                      {/* 2. 是否变量 */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Switch
                          size="sm"
                          isSelected={prompt.is_variable}
                          onValueChange={(checked) => updatePrompt(index, 'is_variable', checked)}
                          aria-label={`将提示词 ${index + 1} 设为变量`}
                        />
                        <span className="text-xs text-default-500">变量</span>
                      </div>

                      {/* 3,4. 输入框和权重 / 变量名和变量值列表 */}
                      {!prompt.is_variable ? (
                        <>
                          {/* 非变量模式下的输入框和权重 */}
                          <div className="flex-grow">
                            {prompt.type === "freetext" ? (
                              <Input
                                size="sm"
                                placeholder="输入提示词内容"
                                value={prompt.value}
                                onChange={(e) => updatePrompt(index, 'value', e.target.value)}
                                className="w-full"
                              />
                            ) :
                              <VTokenSelector
                                name={prompt.name}
                                type={PROMPT_TYPE_TO_VTOKEN_TYPE[prompt.type]}
                                header_img={prompt.img_url}
                                onChange={(value) => {
                                  // 如果用户清除了选择（value为空），则清除所有相关字段
                                  if (!value) {
                                    updatePrompt(index, 'name', '');
                                    updatePrompt(index, 'uuid', '');
                                    updatePrompt(index, 'img_url', '');
                                    updatePrompt(index, 'value', '');
                                  } else {
                                    // 仅更新名称，这可能发生在用户直接编辑名称时
                                    updatePrompt(index, 'name', value);
                                  }
                                }}
                                onSelectItem={(item: SearchSelectItem) => {
                                  // 更新选中项目的所有信息
                                  const updatedPrompt: Prompt = {
                                    ...prompts[index],
                                    name: item.name,
                                    uuid: item.uuid,
                                    img_url: item.header_img,
                                    value: item.uuid // 将value设为uuid而不是name
                                  };

                                  const newPrompts = [...prompts];
                                  newPrompts[index] = updatedPrompt;
                                  setPrompts(newPrompts);
                                }}
                              />
                            }
                          </div>

                          <div className="w-20 flex-shrink-0">
                            <Input
                              size="sm"
                              type="number"
                              placeholder="权重"
                              value={prompt.weight.toString()}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                if (!isNaN(value) && value >= 0.5 && value <= 2) {
                                  updatePrompt(index, 'weight', value);
                                }
                              }}
                              className="w-full"
                              min={0.5}
                              max={2}
                              step={0.05}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          {/* 变量模式下的变量名输入框 */}
                          <div className="flex-grow">
                            <Input
                              size="sm"
                              placeholder="输入变量名称"
                              value={prompt.variable_name || ''}
                              onChange={(e) => updatePrompt(index, 'variable_name', e.target.value)}
                              className="w-full"
                            />
                          </div>
                        </>
                      )}

                      {/* 5. 操作按钮组 */}
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="light"
                          isIconOnly
                          isDisabled={index === 0}
                          onPress={() => movePrompt(index, 'up')}
                          aria-label={`上移提示词 ${index + 1}`}
                        >
                          <Icon icon="solar:alt-arrow-up-linear" />
                        </Button>
                        <Button
                          size="sm"
                          variant="light"
                          isIconOnly
                          isDisabled={index === prompts.length - 1}
                          onPress={() => movePrompt(index, 'down')}
                          aria-label={`下移提示词 ${index + 1}`}
                        >
                          <Icon icon="solar:alt-arrow-down-linear" />
                        </Button>
                        <Button
                          size="sm"
                          variant="light"
                          isIconOnly
                          onPress={() => duplicatePrompt(index)}
                          aria-label={`复制提示词 ${index + 1}`}
                        >
                          <Icon icon="solar:copy-linear" />
                        </Button>
                        <Button
                          size="sm"
                          variant="light"
                          color="danger"
                          isIconOnly
                          onPress={() => removePrompt(index)}
                          aria-label={`删除提示词 ${index + 1}`}
                        >
                          <Icon icon="solar:trash-bin-trash-linear" />
                        </Button>
                      </div>
                    </div>

                    {/* 变量值列表部分 - 直接在提示词框内 */}
                    {prompt.is_variable && (
                      <div className="border-t border-primary-200 dark:border-primary-300/30 p-3 bg-primary-50 dark:bg-primary-50/20">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">变量值列表</span>
                          <Button
                            size="sm"
                            variant="flat"
                            color="primary"
                            startContent={<Icon icon="solar:add-circle-linear" width={14} />}
                            onPress={() => {
                              // 创建新的变量值对象
                              const promptType = prompt.type;
                              let newVariableValue: VariableValueType = {
                                type: promptType,
                                value: '',
                                weight: 1.0
                              };

                              // 对于角色和元素类型，添加额外必要字段
                              if (promptType === 'oc_vtoken_adaptor' || promptType === 'elementum') {
                                newVariableValue.uuid = '';
                                newVariableValue.img_url = '';
                                newVariableValue.name = '';
                              }

                              const newVariableValues = [...(prompt.variable_values || []), newVariableValue];
                              updatePrompt(index, 'variable_values', newVariableValues);
                            }}
                            aria-label={`为变量 ${prompt.variable_name || '未命名变量'} 添加值`}
                          >
                            添加值
                          </Button>
                        </div>

                        <div className="space-y-2">
                          {(prompt.variable_values || []).map((varValue, varIndex) => (
                            <div key={varIndex} className="flex items-center gap-2 p-2 border border-primary-100 dark:border-primary-200/20 rounded-md bg-primary-50/30 dark:bg-primary-50/10">
                              <div className="flex-grow">
                                {prompt.type === "freetext" ? (
                                  <Input
                                    size="sm"
                                    placeholder="输入提示词内容"
                                    value={varValue.value || ''}
                                    onChange={(e) => {
                                      const newVariableValues = [...(prompt.variable_values || [])];
                                      newVariableValues[varIndex] = {
                                        ...newVariableValues[varIndex],
                                        value: e.target.value
                                      };
                                      updatePrompt(index, 'variable_values', newVariableValues);
                                    }}
                                    className="w-full"
                                  />
                                ) : (
                                  <VTokenSelector
                                    name={varValue.name || ''}
                                    type={PROMPT_TYPE_TO_VTOKEN_TYPE[prompt.type]}
                                    header_img={varValue.img_url || ''}
                                    onChange={(value) => {
                                      const newVariableValues = [...(prompt.variable_values || [])];
                                      if (!value) {
                                        // 清除
                                        newVariableValues[varIndex] = {
                                          ...newVariableValues[varIndex],
                                          name: '',
                                          uuid: '',
                                          img_url: '',
                                          value: ''
                                        };
                                      } else {
                                        // 只更新名称
                                        newVariableValues[varIndex] = {
                                          ...newVariableValues[varIndex],
                                          name: value
                                        };
                                      }
                                      updatePrompt(index, 'variable_values', newVariableValues);
                                    }}
                                    onSelectItem={(item: SearchSelectItem) => {
                                      const newVariableValues = [...(prompt.variable_values || [])];
                                      newVariableValues[varIndex] = {
                                        ...newVariableValues[varIndex],
                                        name: item.name,
                                        uuid: item.uuid,
                                        img_url: item.header_img,
                                        value: item.uuid
                                      };
                                      updatePrompt(index, 'variable_values', newVariableValues);
                                    }}
                                  />
                                )}
                              </div>

                              <div className="w-20 flex-shrink-0">
                                <Input
                                  size="sm"
                                  type="number"
                                  placeholder="权重"
                                  value={(varValue.weight || 1.0).toString()}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    if (!isNaN(value) && value >= 0.5 && value <= 2) {
                                      const newVariableValues = [...(prompt.variable_values || [])];
                                      newVariableValues[varIndex] = {
                                        ...newVariableValues[varIndex],
                                        weight: value
                                      };
                                      updatePrompt(index, 'variable_values', newVariableValues);
                                    }
                                  }}
                                  className="w-full"
                                  min={0.5}
                                  max={2}
                                  step={0.05}
                                />
                              </div>

                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="light"
                                  isIconOnly
                                  isDisabled={varIndex === 0}
                                  onPress={() => {
                                    const newVariableValues = [...(prompt.variable_values || [])];
                                    const temp = newVariableValues[varIndex];
                                    newVariableValues[varIndex] = newVariableValues[varIndex - 1];
                                    newVariableValues[varIndex - 1] = temp;
                                    updatePrompt(index, 'variable_values', newVariableValues);
                                  }}
                                  aria-label={`上移变量值 ${varIndex + 1}`}
                                >
                                  <Icon icon="solar:alt-arrow-up-linear" width={16} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="light"
                                  isIconOnly
                                  isDisabled={varIndex === (prompt.variable_values?.length || 0) - 1}
                                  onPress={() => {
                                    const newVariableValues = [...(prompt.variable_values || [])];
                                    const temp = newVariableValues[varIndex];
                                    newVariableValues[varIndex] = newVariableValues[varIndex + 1];
                                    newVariableValues[varIndex + 1] = temp;
                                    updatePrompt(index, 'variable_values', newVariableValues);
                                  }}
                                  aria-label={`下移变量值 ${varIndex + 1}`}
                                >
                                  <Icon icon="solar:alt-arrow-down-linear" width={16} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="light"
                                  isIconOnly
                                  onPress={() => {
                                    const newVariableValues = [...(prompt.variable_values || [])];
                                    const valueToDuplicate = newVariableValues[varIndex];
                                    newVariableValues.splice(varIndex + 1, 0, { ...valueToDuplicate });
                                    updatePrompt(index, 'variable_values', newVariableValues);
                                  }}
                                  aria-label={`复制变量值 ${varIndex + 1}`}
                                >
                                  <Icon icon="solar:copy-linear" width={16} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="light"
                                  color="danger"
                                  isIconOnly
                                  isDisabled={(prompt.variable_values?.length || 0) <= 1}
                                  onPress={() => {
                                    const newVariableValues = [...(prompt.variable_values || [])];
                                    newVariableValues.splice(varIndex, 1);
                                    updatePrompt(index, 'variable_values', newVariableValues);
                                  }}
                                  aria-label={`删除变量值 ${varIndex + 1}`}
                                >
                                  <Icon icon="solar:trash-bin-trash-linear" width={16} />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 基本参数区域 */}
              <Divider className="my-4" />
              <h3 className="text-lg font-medium mb-4">基本参数</h3>

              <div className="space-y-0">
                {/* 比例 */}
                <div className="py-2 border-b border-default-100 dark:border-default-100/70">
                  <RatioParam
                    value={ratio.value}
                    isVariable={ratio.is_variable}
                    variableValues={ratio.variable_values}
                    variableName={ratio.variable_name}
                    onChange={(newValue) => setRatio(updateParameterVariableValue(ratio, 0, newValue))}
                    onVariableChange={(isVariable) => setRatio(updateParameterVariableStatus(ratio, isVariable, "比例"))}
                    onVariableValuesChange={(values) => {
                      setRatio({
                        ...ratio,
                        variable_values: values
                      });
                    }}
                    onVariableNameChange={(name) => {
                      setRatio({
                        ...ratio,
                        variable_name: name
                      });
                    }}
                  />
                </div>

                {/* 种子 */}
                <div className="py-2 border-b border-default-100 dark:border-default-100/70">
                  <SeedParam
                    value={seed.value}
                    isVariable={seed.is_variable}
                    variableValues={seed.variable_values}
                    variableName={seed.variable_name}
                    onChange={(newValue) => setSeed(updateParameterVariableValue(seed, 0, newValue))}
                    onVariableChange={(isVariable) => setSeed(updateParameterVariableStatus(seed, isVariable, "种子"))}
                    onVariableValuesChange={(values) => {
                      setSeed({
                        ...seed,
                        variable_values: values
                      });
                    }}
                    onVariableNameChange={(name) => {
                      setSeed({
                        ...seed,
                        variable_name: name
                      });
                    }}
                  />
                </div>

                {/* 润色 */}
                <div className="py-2 border-b border-default-100 dark:border-default-100/70">
                  <UsePolishParam
                    value={userPolish.value}
                    isVariable={userPolish.is_variable}
                    variableValues={userPolish.variable_values}
                    variableName={userPolish.variable_name}
                    onChange={(newValue) => setUserPolish(updateParameterVariableValue(userPolish, 0, newValue))}
                    onVariableChange={(isVariable) => setUserPolish(updateParameterVariableStatus(userPolish, isVariable, "润色"))}
                    onVariableValuesChange={(values) => {
                      setUserPolish({
                        ...userPolish,
                        variable_values: values
                      });
                    }}
                    onVariableNameChange={(name) => {
                      setUserPolish({
                        ...userPolish,
                        variable_name: name
                      });
                    }}
                  />
                </div>

                {/* 使用Lumina */}
                <div className="py-2 border-b border-default-100 dark:border-default-100/70">
                  <IsLuminaParam
                    value={isLumina.value}
                    isVariable={isLumina.is_variable}
                    variableValues={isLumina.variable_values}
                    variableName={isLumina.variable_name}
                    onChange={(newValue) => setIsLumina(updateParameterVariableValue(isLumina, 0, newValue))}
                    onVariableChange={(isVariable) => setIsLumina(updateParameterVariableStatus(isLumina, isVariable, "lumina"))}
                    onVariableValuesChange={(values) => {
                      setIsLumina({
                        ...isLumina,
                        variable_values: values
                      });
                    }}
                    onVariableNameChange={(name) => {
                      setIsLumina({
                        ...isLumina,
                        variable_name: name
                      });
                    }}
                  />
                </div>

                {/* Lumina相关设置 */}
                {(isLumina.value || isLumina.is_variable) && (
                  <>
                    {/* Lumina模型名称 */}
                    <div className="py-2 border-b border-default-100 dark:border-default-100/70">
                      <LuminaModelNameParam
                        value={luminaModelName.value}
                        isVariable={luminaModelName.is_variable}
                        variableValues={luminaModelName.variable_values}
                        variableName={luminaModelName.variable_name}
                        onChange={(newValue) => setLuminaModelName(updateParameterVariableValue(luminaModelName, 0, newValue))}
                        onVariableChange={(isVariable) => setLuminaModelName(updateParameterVariableStatus(luminaModelName, isVariable, "模型"))}
                        onVariableValuesChange={(values) => {
                          setLuminaModelName({
                            ...luminaModelName,
                            variable_values: values
                          });
                        }}
                        onVariableNameChange={(name) => {
                          setLuminaModelName({
                            ...luminaModelName,
                            variable_name: name
                          });
                        }}
                        placeholder="输入Lumina模型名称"
                      />
                    </div>

                    {/* Lumina配置 */}
                    <div className="py-2 border-b border-default-100 dark:border-default-100/70">
                      <LuminaCfgParam
                        value={luminaCfg.value}
                        isVariable={luminaCfg.is_variable}
                        variableValues={luminaCfg.variable_values}
                        variableName={luminaCfg.variable_name}
                        onChange={(newValue) => setLuminaCfg(updateParameterVariableValue(luminaCfg, 0, newValue))}
                        onVariableChange={(isVariable) => setLuminaCfg(updateParameterVariableStatus(luminaCfg, isVariable, "cfg"))}
                        onVariableValuesChange={(values) => {
                          setLuminaCfg({
                            ...luminaCfg,
                            variable_values: values
                          });
                        }}
                        onVariableNameChange={(name) => {
                          setLuminaCfg({
                            ...luminaCfg,
                            variable_name: name
                          });
                        }}
                        min={0}
                        max={10}
                        step={0.1}
                      />
                    </div>

                    {/* Lumina步数 */}
                    <div className="py-2 border-b border-default-100 dark:border-default-100/70">
                      <LuminaStepParam
                        value={luminaStep.value}
                        isVariable={luminaStep.is_variable}
                        variableValues={luminaStep.variable_values}
                        variableName={luminaStep.variable_name}
                        onChange={(newValue) => setLuminaStep(updateParameterVariableValue(luminaStep, 0, newValue))}
                        onVariableChange={(isVariable) => setLuminaStep(updateParameterVariableStatus(luminaStep, isVariable, "步数"))}
                        onVariableValuesChange={(values) => {
                          setLuminaStep({
                            ...luminaStep,
                            variable_values: values
                          });
                        }}
                        onVariableNameChange={(name) => {
                          setLuminaStep({
                            ...luminaStep,
                            variable_name: name
                          });
                        }}
                        min={10}
                        max={50}
                        step={1}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* 优先级 */}
              {/* <div className="py-2 border-b border-default-100">
                <div className="flex items-center justify-between h-full">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium w-24 flex-shrink-0">优先级</span>
                  </div>
                  <div className="w-48 flex justify-end">
                    <Input
                      type="text"
                      value="1"
                      isReadOnly
                      className="w-28 bg-default-100"
                    />
                  </div>
                </div>
              </div> */}
            </div>
          </div>
        </div>

        {/* 底部固定按钮区域 */}
        <div className="fixed bottom-0 left-[320px] w-[calc(100%-330px)] xl:w-[calc(67%-330px)] 2xl:w-[calc(75%-330px)] min-w-[600px] bg-background py-4 px-6 border-t border-default-100 dark:border-default-100/70 z-10">
          {/* 复用任务提示 */}
          {reusedTask && (
            <div className="mb-3 p-3 rounded-md bg-primary-50 dark:bg-primary-50/20 border border-primary-200 dark:border-primary-300/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:copy-linear" className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">
                    检测到复用的任务设置: {reusedTask.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    color="primary"
                    variant="flat"
                    startContent={<Icon icon="solar:check-circle-linear" />}
                    onPress={applyReusedTask}
                  >
                    应用
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<Icon icon="solar:close-circle-linear" />}
                    onPress={ignoreReusedTask}
                  >
                    忽略
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 提交结果提示 */}
          {submitResult && (
            <div className={`mb-3 p-2 rounded-md text-sm ${submitResult.success ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600'}`}>
              {submitResult.success ? (
                <>
                  <Icon icon="solar:check-circle-bold" className="mr-1" />
                  {submitResult.message}，任务ID：{submitResult.taskId}
                </>
              ) : (
                <>
                  <Icon icon="solar:close-circle-bold" className="mr-1" />
                  {submitResult.message}
                </>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <Button
              color="default"
              startContent={<Icon icon="solar:restart-linear" />}
              onPress={resetAllConfig}
              aria-label="重置所有参数"
              isDisabled={isSubmitting}
            >
              重置参数
            </Button>
            <Button
              color="primary"
              startContent={isSubmitting ? <Spinner size="sm" /> : <Icon icon="solar:play-linear" />}
              aria-label="开始任务"
              onPress={submitTask}
              isDisabled={isSubmitting}
            >
              {isSubmitting ? '提交中...' : '开始任务'}
            </Button>
          </div>
        </div>
      </div>

      {/* 高级模式 JSON编辑区域 - 右侧 */}
      <div className="fixed right-0 top-0 bottom-0 hidden xl:flex xl:flex-col bg-default-50 w-[33%] 2xl:w-[25%] p-6">
        <h2 className="text-xl font-medium mb-2">高级模式</h2>
        <p className="text-sm text-default-500 mb-4">直接编辑任务JSON数据</p>

        <div className="flex-grow h-[calc(100vh-12rem)] mb-4 relative">
          <textarea
            placeholder="编辑JSON数据"
            value={editingJson}
            onChange={(e) => handleJsonEdit(e.target.value)}
            className="w-full h-full font-mono text-xs absolute inset-0 resize-none overflow-auto p-2 border border-default-200 dark:border-default-100/80 rounded-md bg-background text-foreground"
            aria-label="JSON配置编辑器"
          />
        </div>

        {jsonError && (
          <div className="text-danger text-sm mb-4">{jsonError}</div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Button
            color="default"
            className="w-full"
            startContent={<Icon icon="solar:diskette-linear" />}
            onPress={downloadConfigAsJson}
            aria-label="保存参数到JSON文件"
          >
            保存参数
          </Button>
          <Button
            color="default"
            className="w-full"
            startContent={<Icon icon="solar:upload-linear" />}
            onPress={uploadConfigFile}
            aria-label="从JSON文件上传参数"
          >
            上传参数
          </Button>
          <Button
            color="primary"
            onPress={applyJsonChanges}
            className="w-full"
            startContent={<Icon icon="solar:check-circle-linear" />}
            aria-label="应用JSON修改"
          >
            应用修改
          </Button>
        </div>
      </div>

      {/* 验证错误Modal */}
      <Modal
        isOpen={isValidationModalOpen}
        onOpenChange={onValidationModalChange}
        placement="center"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:danger-circle-linear" className="w-6 h-6 text-warning" />
                  <span>参数验证失败</span>
                </div>
              </ModalHeader>
              <ModalBody>
                <p className="whitespace-pre-line">{validationMessage}</p>
              </ModalBody>
              <ModalFooter>
                <Button color="primary" onPress={onClose}>
                  我知道了
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* 登录Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => onLoginModalChange()}
        onLoginSuccess={() => {
          onLoginModalChange();
          toast.success("登录成功！");
        }}
      />

      {/* 重置确认Modal */}
      <Modal
        isOpen={isResetModalOpen}
        onOpenChange={onResetModalChange}
        placement="center"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:question-circle-linear" className="w-6 h-6 text-warning" />
                  <span>确认重置</span>
                </div>
              </ModalHeader>
              <ModalBody>
                <p>确定要重置所有配置参数吗？这将丢失所有更改。</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button color="danger" onPress={confirmResetConfig}>
                  确认重置
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* JSON错误Modal */}
      <Modal
        isOpen={isJsonErrorModalOpen}
        onOpenChange={onJsonErrorModalChange}
        placement="center"
        size="lg"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:danger-circle-linear" className="w-6 h-6 text-danger" />
                  <span>JSON格式错误</span>
                </div>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-3">
                  <p className="whitespace-pre-line text-sm">{jsonErrorMessage}</p>
                  <div className="p-3 bg-default-100 rounded-md">
                    <p className="text-xs text-default-600 mb-2">常见错误示例：</p>
                    <div className="space-y-1 text-xs font-mono">
                      <div className="text-danger">❌ "name": 'test',  // 单引号错误</div>
                      <div className="text-success">✅ "name": "test",  // 双引号正确</div>
                      <div className="text-danger">❌ {"{ \"a\": 1, }"}  // 多余逗号</div>
                      <div className="text-success">✅ {"{ \"a\": 1 }"}  // 无多余逗号</div>
                    </div>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="primary" onPress={onClose}>
                  我知道了
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* 任务确认Modal */}
      <Modal
        isOpen={isTaskConfirmModalOpen}
        onOpenChange={onTaskConfirmModalChange}
        placement="center"
        size="lg"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:check-circle-linear" className="w-6 h-6 text-success" />
                  <span>任务确认</span>
                </div>
              </ModalHeader>
              <ModalBody>
                <p>即将生成 {taskCountInfo?.formattedCount} 个任务，确认提交吗？</p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button color="primary" onPress={confirmSubmitTask}>
                  确认提交
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
