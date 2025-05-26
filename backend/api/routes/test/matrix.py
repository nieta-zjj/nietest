"""
矩阵数据路由模块

提供任务矩阵数据相关的API路由
"""
from typing import Dict, Any, List
import json
import traceback
from fastapi import APIRouter, HTTPException, Path

from backend.api.schemas.common import APIResponse
from backend.crud.task import task_crud
from backend.crud.subtask import subtask_crud

# 配置日志
import logging
logger = logging.getLogger(__name__)

# 创建路由
router = APIRouter()


def normalize_variables_for_frontend(variables_map: Dict[str, Any]) -> Dict[str, Any]:
    """
    统一变量格式，确保前端能够正确显示

    Args:
        variables_map: 原始变量映射

    Returns:
        标准化后的变量映射
    """
    normalized = {}

    # 按变量键排序，确保v0, v1, v2...的顺序
    sorted_keys = sorted(variables_map.keys(), key=lambda x: int(x[1:]) if x.startswith('v') and x[1:].isdigit() else 999)

    for var_key in sorted_keys:
        var_info = variables_map[var_key]

        # 确保每个变量都有完整的结构
        normalized_var = {
            "name": var_info.get("name", f"变量{var_key[1:]}"),
            "type": "prompt",  # 默认类型
            "values": [],
            "values_count": 0,
            "tag_id": var_info.get("tag_id")
        }

        # 处理变量值
        values = var_info.get("values", [])
        for i, value_item in enumerate(values):
            if isinstance(value_item, dict):
                normalized_value = {
                    "id": value_item.get("id", str(i)),
                    "value": str(value_item.get("value", "")),
                    "type": value_item.get("type", "prompt")
                }
            else:
                # 如果是简单值，转换为标准格式
                normalized_value = {
                    "id": str(i),
                    "value": str(value_item),
                    "type": "prompt"
                }

            normalized_var["values"].append(normalized_value)

        normalized_var["values_count"] = len(normalized_var["values"])
        normalized[var_key] = normalized_var

    return normalized


def calculate_total_combinations(variables_map: Dict[str, Any]) -> int:
    """
    计算变量的总组合数

    Args:
        variables_map: 变量映射

    Returns:
        总组合数
    """
    total = 1
    for var_info in variables_map.values():
        total *= var_info.get("values_count", 1)
    return total


@router.get("/task/{task_id}/matrix", response_model=APIResponse[Dict[str, Any]])
async def get_task_matrix(
    task_id: str = Path(..., description="任务ID")
):
    """
    获取任务的矩阵数据，用于条件筛选和表格显示

    Args:
        task_id: 任务ID

    Returns:
        任务的矩阵数据，包含变量定义和坐标映射（统一格式）
    """
    try:
        # 确保数据库连接是活跃的
        from backend.db.database import test_db_proxy
        if test_db_proxy.is_closed():
            logger.info("数据库连接已关闭，尝试重新连接")
            test_db_proxy.connect()

        # 使用事务包装查询，确保连接稳定
        try:
            with test_db_proxy.atomic():
                # 获取任务
                task = task_crud.get(id=task_id)
                if not task:
                    raise HTTPException(
                        status_code=404,
                        detail={"message": f"任务不存在: {task_id}"}
                    )

                # 获取子任务
                subtasks = list(subtask_crud.get_by_task(task_id))
                logger.info(f"获取到 {len(subtasks)} 个子任务")

                # 构建变量定义 - 只从 variables_map 解析
                variables_map = {}

                # 如果是字符串，尝试解析JSON
                if isinstance(task.variables_map, str):
                    try:
                        parsed_variables_map = json.loads(task.variables_map)
                        task.variables_map = parsed_variables_map
                    except json.JSONDecodeError as e:
                        logger.error(f"解析variables_map JSON失败: {e}")

                # 只从 variables_map 中解析变量信息
                if hasattr(task, 'variables_map') and task.variables_map:
                    # 检查用户ID，决定使用哪种数据结构
                    user_id = str(task.user.id) if task.user else None
                    special_user_id = "33a5e309-4569-452e-88be-7155bc87488f"

                    if user_id == special_user_id:
                        # 特殊用户：使用v*结构
                        for var_key, var_info in task.variables_map.items():
                            if not var_key.startswith('v'):
                                continue

                            variable_name = var_info.get("name", "")
                            variable_type = var_info.get("type", "")
                            variable_values = var_info.get("values", [])

                            # 构建变量值列表
                            values = []
                            for i, value in enumerate(variable_values):
                                if isinstance(value, dict):
                                    # 如果是字典，提取相关字段
                                    values.append({
                                        "id": value.get("id", str(i)),
                                        "value": str(value.get("value", "")),
                                        "type": value.get("type", variable_type)
                                    })
                                else:
                                    # 如果是简单值
                                    values.append({
                                        "id": str(i),
                                        "value": str(value),
                                        "type": variable_type
                                    })

                            if variable_name and variable_name.strip():
                                variables_map[var_key] = {
                                    "name": variable_name,
                                    "values": values,
                                    "values_count": len(values),
                                    "tag_id": var_info.get("id")
                                }
                    else:
                        # 其他用户：使用dramatiq设计的数据结构
                        for dimension_index, var_info in task.variables_map.items():
                            # 确保dimension_index是正确的格式
                            if isinstance(dimension_index, str) and dimension_index.startswith('v'):
                                # 如果已经是v0, v1格式，直接使用
                                var_key = dimension_index
                            else:
                                # 否则构建v{index}格式
                                var_key = f"v{dimension_index}"

                            variable_id = var_info.get("variable_id")
                            variable_name = var_info.get("variable_name", "")
                            variable_type = var_info.get("variable_type", "")
                            variable_values = var_info.get("values", [])

                            # 构建变量值列表
                            values = []
                            for i, value in enumerate(variable_values):
                                if isinstance(value, dict):
                                    # 如果是字典（提示词类型），提取 value 字段
                                    values.append({
                                        "id": str(i),
                                        "value": str(value.get("value", "")),
                                        "type": variable_type
                                    })
                                else:
                                    # 如果是简单值（参数类型）
                                    values.append({
                                        "id": str(i),
                                        "value": str(value),
                                        "type": variable_type
                                    })

                            # 只有当变量名不为空时才添加到结果中
                            if variable_name and variable_name.strip():
                                variables_map[var_key] = {
                                    "name": variable_name,
                                    "values": values,
                                    "values_count": len(values),
                                    "tag_id": variable_id
                                }
                            else:
                                # 如果变量名为空，但有值，使用默认名称
                                if values:
                                    default_name = f"变量{dimension_index}"
                                    variables_map[var_key] = {
                                        "name": default_name,
                                        "values": values,
                                        "values_count": len(values),
                                        "tag_id": variable_id
                                    }
                else:
                    logger.warning(f"Task {task_id} variables_map 为空或不存在")

                # 构建坐标映射 - 确保所有子任务都被包含，并生成完整的坐标矩阵
                #
                # 空间坐标系构成说明：
                # 1. 每个子任务通过variable_indices定义其在多维空间中的坐标位置
                # 2. variable_indices格式如：[0,0,0,1,1,2] 表示各个维度的索引值
                # 3. 确保从原点(0,0,...)开始包含所有可能的坐标组合
                # 4. 优先使用result，如果为空则使用error字段，如果都没有则留空
                #
                # 坐标键格式：
                # - 使用逗号分隔的索引值：如 "0,0,0,1,1,2"
                # - 确保完整的多维坐标矩阵覆盖
                coordinates_by_indices = {}

                # 首先根据variables_map生成所有可能的坐标组合
                normalized_variables = normalize_variables_for_frontend(variables_map)
                if normalized_variables:
                    # 计算每个维度的最大索引值
                    dimension_ranges = []
                    sorted_var_keys = sorted(normalized_variables.keys(), key=lambda x: int(x[1:]) if x.startswith('v') and x[1:].isdigit() else 999)

                    for var_key in sorted_var_keys:
                        var_info = normalized_variables[var_key]
                        values_count = var_info.get("values_count", 0)
                        if values_count > 0:
                            dimension_ranges.append(values_count)

                    # 生成所有可能的坐标组合
                    def generate_coordinates(ranges, current_coord=[]):
                        if not ranges:
                            if current_coord:
                                coord_key = ",".join(map(str, current_coord))
                                if coord_key not in coordinates_by_indices:
                                    coordinates_by_indices[coord_key] = ""  # 默认为空
                            return

                        for i in range(ranges[0]):
                            generate_coordinates(ranges[1:], current_coord + [i])

                    # 生成完整的坐标矩阵
                    generate_coordinates(dimension_ranges)

                # 然后用实际的子任务数据填充坐标映射
                for subtask in subtasks:
                    # 只要有variable_indices就处理
                    if subtask.variable_indices:
                        # 处理变量索引，构建完整的坐标
                        coordinate_parts = []
                        for idx in subtask.variable_indices:
                            if idx is not None and idx >= 0:
                                coordinate_parts.append(str(idx))
                            else:
                                # 对于无效索引，停止添加以保持坐标的连续性
                                break

                        # 只要有有效的坐标维度就更新到映射中
                        if coordinate_parts:
                            coordinate_key = ",".join(coordinate_parts)

                            # 确定结果值：优先使用result，如果为空则使用error字段
                            result_value = ""  # 默认为空字符串

                            # 检查result字段：不为None且不为空字符串
                            if subtask.result is not None and subtask.result.strip():
                                result_value = subtask.result.strip()
                                value_type = "result"
                            # 如果result为空，检查error字段
                            elif hasattr(subtask, 'error') and subtask.error is not None and subtask.error.strip():
                                # 将错误信息以特定格式传递，前端可以识别这是错误信息
                                result_value = f"ERROR: {subtask.error.strip()}"
                                value_type = "error"
                            else:
                                result_value = ""
                                value_type = "empty"

                            # 更新坐标映射（覆盖默认的空值），包含子任务ID和评分信息
                            coordinates_by_indices[coordinate_key] = {
                                "url": result_value,
                                "subtask_id": str(subtask.id),
                                "status": subtask.status,
                                "rating": getattr(subtask, 'rating', 0),
                                "evaluation": getattr(subtask, 'evaluation', []),
                                "variable_indices": subtask.variable_indices,
                                "created_at": subtask.created_at.isoformat() if subtask.created_at else None,
                                "completed_at": subtask.completed_at.isoformat() if subtask.completed_at else None
                            }
                        else:
                            logger.warning(f"子任务 {subtask.id} 的variable_indices无有效坐标: {subtask.variable_indices}")
                    else:
                        logger.warning(f"子任务 {subtask.id} 没有variable_indices，跳过坐标映射")

                logger.info(f"坐标系构建完成，共生成 {len(coordinates_by_indices)} 个坐标映射")

                # 统计不同类型的结果
                result_stats = {"with_result": 0, "with_error": 0, "empty": 0}
                for subtask in subtasks:
                    if subtask.variable_indices:
                        # 使用与坐标映射相同的判断逻辑
                        if subtask.result is not None and subtask.result.strip():
                            result_stats["with_result"] += 1
                        elif hasattr(subtask, 'error') and subtask.error is not None and subtask.error.strip():
                            result_stats["with_error"] += 1
                        else:
                            result_stats["empty"] += 1

                # 注意：normalized_variables已经在前面计算过了，这里直接使用

                # 构建响应数据
                matrix_data = {
                    "task_id": str(task.id),
                    "task_name": task.name,
                    "created_at": task.created_at.isoformat(),
                    "variables_map": normalized_variables,
                    "coordinates_by_indices": coordinates_by_indices,
                    "summary": {
                        "total_variables": len(normalized_variables),
                        "total_combinations": calculate_total_combinations(normalized_variables),
                        "total_subtasks": len(subtasks),
                        "mapped_coordinates": len(coordinates_by_indices),
                        "result_statistics": {
                            "with_result": result_stats["with_result"],
                            "with_error": result_stats["with_error"],
                            "empty": result_stats["empty"]
                        }
                    }
                }

        except HTTPException:
            # 直接重新抛出HTTP异常
            raise
        except Exception as query_error:
            logger.error(f"查询执行出错: {str(query_error)}")
            raise

        return APIResponse[Dict[str, Any]](
            code=200,
            message="获取任务矩阵数据成功",
            data=matrix_data
        )
    except HTTPException:
        # 直接重新抛出HTTP异常
        raise
    except Exception as e:
        # 获取完整的错误栈信息
        error_stack = traceback.format_exc()
        logger.error(f"获取任务矩阵数据出错: {str(e)}\n错误栈: {error_stack}")

        # 尝试重新初始化数据库连接
        try:
            from backend.db.initialization import reconnect_test_db
            reconnect_test_db()
            logger.info("已尝试重新初始化数据库连接")
        except Exception as db_error:
            logger.error(f"重新初始化数据库连接失败: {str(db_error)}")

        # 在响应中包含错误栈信息
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"获取任务矩阵数据出错: {str(e)}",
                "error_stack": error_stack
            }
        )