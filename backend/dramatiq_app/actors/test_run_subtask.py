"""
子任务处理Actor模块

接收子任务ID，处理单个图像生成任务并返回结果
"""

import logging
import dramatiq
from dramatiq.middleware import CurrentMessage
from typing import Dict, Any, Optional, List, Tuple
import traceback
from datetime import datetime
import json
import time
import random
import asyncio
import math
import os
import httpx

from backend.core.config import settings
from backend.utils.feishu import feishu_notify
from backend.models.db.dramatiq_base import DramatiqBaseModel
from backend.models.db.subtasks import Subtask, SubtaskStatus

# 配置日志
logger = logging.getLogger(__name__)

# 自定义异常类
class MaxRetriesException(Exception):
    """达到最大轮询次数异常"""
    pass

class ContentCensoredException(Exception):
    """内容审核异常，不应重试"""
    pass

class RetryableException(Exception):
    """可重试的异常"""
    pass

class ImageClient:
    """
    图像生成客户端

    实现图像生成服务的调用
    """
    def __init__(self):
        """初始化图像生成服务"""
        # 使用环境变量中的NIETA_XTOKEN
        self.x_token = os.environ.get("NIETA_XTOKEN", "")
        if not self.x_token:
            logger.warning("环境变量中未设置NIETA_XTOKEN，请确保设置正确的API令牌")
            raise ValueError("环境变量中未设置NIETA_XTOKEN")

        # API端点
        self.api_url = "https://api.talesofai.cn/v3/make_image"
        self.task_status_url = "https://api.talesofai.cn/v1/artifact/task/{task_uuid}"

        # Lumina API端点
        self.lumina_api_url = "https://ops.api.talesofai.cn/v3/make_image"
        self.lumina_task_status_url = "https://ops.api.talesofai.cn/v1/artifact/task/{task_uuid}"

        # 轮询配置
        self.max_polling_attempts = int(os.getenv("IMAGE_MAX_POLLING_ATTEMPTS", "30"))  # 最大轮询次数
        self.polling_interval = float(os.getenv("IMAGE_POLLING_INTERVAL", "2.0"))  # 轮询间隔（秒）

        # Lumina轮询配置
        self.lumina_max_polling_attempts = int(os.getenv("LUMINA_MAX_POLLING_ATTEMPTS", "50"))  # Lumina最大轮询次数
        self.lumina_polling_interval = float(os.getenv("LUMINA_POLLING_INTERVAL", "3.0"))  # Lumina轮询间隔（秒）

        # 默认请求头
        self.default_headers = {
            "Content-Type": "application/json",
            "x-platform": "nieta-app/web",
            "X-Token": self.x_token
        }

    async def generate_image(self,
                            prompts: List[Dict[str, Any]],
                            width: int,
                            height: int,
                            seed: int = None,
                            use_polish: bool = False,
                            is_lumina: bool = False,
                            lumina_model_name: str = None,
                            lumina_cfg: float = None,
                            lumina_step: int = None) -> Dict[str, Any]:
        """
        生成图像

        Args:
            prompts: 提示词列表
            width: 图像宽度
            height: 图像高度
            seed: 随机种子
            is_lumina: 是否使用Lumina模型
            lumina_model_name: Lumina模型名称
            lumina_cfg: Lumina配置参数
            lumina_step: Lumina步数

        Returns:
            生成结果
        """

        # 生成随机种子（如果未提供）
        if seed is None or seed == 0:
            seed = random.randint(1, 2147483647)
            logger.info(f"生成随机种子: {seed}")
        else:
            logger.info(f"使用提供的种子: {seed}")

        # 选择API端点
        api_url = self.lumina_api_url if is_lumina else self.api_url
        task_status_url = self.lumina_task_status_url if is_lumina else self.task_status_url
        logger.info(f"使用{'Lumina' if is_lumina else '标准'}API端点: {api_url}")

        final_prompts = []
        for prompt in prompts:
            if prompt['type'] == 'freetext':
                final_prompt = {
                    "type": "freetext",
                    "value": prompt['value'],
                    "weight": prompt['weight']
                }
            else:
                final_prompt = {
                    "type": prompt['type'],
                    "value": prompt['value'],
                    "uuid": prompt['uuid'],
                    "weight": prompt['weight'],
                    "name": prompt['name'],
                    "img_url": prompt['img_url'],
                    "domain": "",
                    "parent": "",
                    "label": None,
                    "sort_index": 0,
                    "status": "IN_USE",
                    "polymorphi_values": {},
                    "sub_type": None
                }
            final_prompts.append(final_prompt)

        if is_lumina:
            final_prompts.append({
                    "type": 'elementum',
                    "value": 'b5edccfe-46a2-4a14-a8ff-f4d430343805',
                    "uuid": 'b5edccfe-46a2-4a14-a8ff-f4d430343805',
                    "weight": 1.0,
                    "name": "lumina1",
                    "img_url": "https://oss.talesofai.cn/picture_s/1y7f53e6itfn_0.jpeg",
                    "domain": "",
                    "parent": "",
                    "label": None,
                    "sort_index": 0,
                    "status": "IN_USE",
                    "polymorphi_values": {},
                    "sub_type": None
            })

        # 构建请求载荷
        logger.info(f"构建API请求载荷...")
        payload = {
            "storyId": "",
            "jobType": "universal",
            "width": width,
            "height": height,
            "rawPrompt": final_prompts,
            "seed": seed,
            "meta": {"entrance": "PICTURE,PURE"},
            "context_model_series": None,
            "negative_freetext": "",
            "advanced_translator": use_polish
        }

        # 如果是Lumina任务，添加Lumina特定参数
        if is_lumina:
            client_args = {}
            if lumina_model_name:
                client_args["ckpt_name"] = lumina_model_name
            if lumina_cfg is not None:
                client_args["cfg"] = lumina_cfg
            if lumina_step is not None:
                client_args["steps"] = lumina_step

            if client_args:
                payload["client_args"] = client_args
                logger.info(f"添加Lumina参数: {client_args}")

        try:
            # 发送API请求，直接获取任务UUID字符串
            task_uuid = await self._call_api(api_url, payload)

            # 验证任务UUID
            if not task_uuid:
                raise Exception("API返回的任务UUID为空")

            logger.info(f"获取到任务UUID: {task_uuid}")

            # 轮询任务状态
            max_attempts = self.lumina_max_polling_attempts if is_lumina else self.max_polling_attempts
            polling_interval = self.lumina_polling_interval if is_lumina else self.polling_interval

            result = await self._poll_task_status(task_uuid, task_status_url, max_attempts, polling_interval)

            # 检查任务状态
            task_status = result.get("status")
            task_status = result.get("task_status")

            # 检查task_status
            if task_status:
                if task_status == "SUCCESS":
                    # 提取图像URL
                    image_url = await self._extract_image_url(result)
                    if not image_url:
                        raise Exception("无法从结果中提取图像URL")

                    return {
                        "success": True,
                        "data": {
                            "image_url": image_url,
                            "seed": seed,
                            "is_lumina": is_lumina,
                            "width": width,
                            "height": height
                        }
                    }
                elif task_status == "FAILURE":
                    error_msg = result.get("error", "未知错误")
                    logger.error(f"任务失败(task_status=FAILURE): {task_uuid}, 错误: {error_msg}")
                    raise Exception(f"任务失败: {error_msg}")
                elif task_status == "ILLEGAL_IMAGE":
                    logger.error(f"任务失败(task_status=ILLEGAL_IMAGE): {task_uuid}, 内容不合规")
                    raise ContentCensoredException("图像生成API返回ILLEGAL_IMAGE状态，内容不合规")
                elif task_status == "TIMEOUT":
                    logger.warning(f"任务超时(task_status=TIMEOUT): {task_uuid}, 将进行重试")
                    raise RetryableException("图像生成API返回TIMEOUT状态，任务超时")
                elif task_status == "PENDING":
                    pass
                    # 继续轮询，不做其他处理
                else:
                    # 其他未知状态视为失败
                    logger.error(f"任务失败(task_status={task_status}): {task_uuid}, 将结束重试")
                    error_msg = result.get("error", f"任务状态为{task_status}")
                    raise Exception(f"任务失败: {error_msg}")

            # 提取图像URL
            image_url = await self._extract_image_url(result)
            if not image_url:
                raise Exception("无法从结果中提取图像URL")

            return {
                "success": True,
                "data": {
                    "image_url": image_url,
                    "seed": seed,
                    "is_lumina": is_lumina,
                    "width": width,
                    "height": height
                }
            }

        except Exception as e:
            logger.error(f"图像生成失败: {str(e)}")
            logger.error(traceback.format_exc())
            return {
                "success": False,
                "error": str(e)
            }

    async def _call_api(self, api_url: str, payload: Dict[str, Any]) -> str:
        """
        调用图像生成API

        Args:
            api_url: API端点
            payload: 请求载荷

        Returns:
            任务UUID字符串
        """
        # 记录任务信息
        task_info = f"宽度={payload.get('width')}, 高度={payload.get('height')}, 种子={payload.get('seed')}"

        start_time = time.time()
        logger.info(f"开始调用图像生成API {task_info}")

        try:
            # 发送API请求
            async with httpx.AsyncClient(timeout=300.0) as client:  # 5分钟超时
                response = await client.post(
                    api_url,
                    json=payload,
                    headers=self.default_headers
                )

                # 检查响应状态
                response.raise_for_status()

                # 获取响应内容
                content = response.text.strip()
                elapsed_time = time.time() - start_time
                logger.info(f"图像生成API请求成功 {task_info}, 耗时: {elapsed_time:.2f}秒")

                # 返回任务UUID字符串
                return content.replace('"', '')
        except Exception as e:
            logger.error(f"发送API请求失败: {str(e)}")
            raise

    async def _poll_task_status(self, task_uuid: str, task_status_url_template: str,
                               max_attempts: int, polling_interval: float) -> Dict[str, Any]:
        """
        轮询任务状态

        Args:
            task_uuid: 任务UUID
            task_status_url_template: 任务状态URL模板
            max_attempts: 最大轮询次数
            polling_interval: 轮询间隔（秒）

        Returns:
            任务结果
        """
        task_status_url = task_status_url_template.format(task_uuid=task_uuid)

        for attempt in range(1, max_attempts + 1):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(
                        task_status_url,
                        headers=self.default_headers
                    )

                    response.raise_for_status()
                    result = response.json()

                    # 检查任务状态
                    status = result.get("status")
                    task_status = result.get("task_status")

                    # 检查task_status
                    if task_status:
                        if task_status == "SUCCESS":
                            return result
                        elif task_status == "FAILURE":
                            error_msg = result.get("error", "未知错误")
                            logger.error(f"任务失败(task_status=FAILURE): {task_uuid}, 错误: {error_msg}")
                            raise Exception(f"任务失败: {error_msg}")
                        elif task_status == "ILLEGAL_IMAGE":
                            logger.error(f"任务失败(task_status=ILLEGAL_IMAGE): {task_uuid}, 内容不合规")
                            raise ContentCensoredException("图像生成API返回ILLEGAL_IMAGE状态，内容不合规")
                        elif task_status == "TIMEOUT":
                            logger.warning(f"任务超时(task_status=TIMEOUT): {task_uuid}, 将进行重试")
                            raise RetryableException("图像生成API返回TIMEOUT状态，任务超时")
                        elif task_status == "PENDING":
                            logger.info(f"任务进行中(task_status=PENDING): {task_uuid}, 轮询次数: {attempt}/{max_attempts}")
                            # 继续轮询，不做其他处理
                        else:
                            # 其他未知状态视为失败
                            logger.error(f"任务失败(task_status={task_status}): {task_uuid}, 将结束重试")
                            error_msg = result.get("error", f"任务状态为{task_status}")
                            raise Exception(f"任务失败: {error_msg}")
                    else:
                        logger.warning(f"API响应中没有task_status字段: {result}, 轮询次数: {attempt}/{max_attempts}")

                    # 如果不是最后一次尝试，则等待下一次轮询
                    if attempt < max_attempts:
                        await asyncio.sleep(polling_interval)
            except Exception as e:
                # 如果是最后一次尝试，则直接抛出异常
                if attempt == max_attempts:
                    if isinstance(e, (MaxRetriesException, ContentCensoredException, RetryableException)):
                        raise e
                    logger.error(f"轮询任务状态失败，已达到最大轮询次数: {max_attempts}")
                    raise MaxRetriesException(f"达到最大轮询次数 {max_attempts}") from e

                logger.warning(f"轮询任务状态失败: {str(e)}, 将在{polling_interval}秒后重试")
                await asyncio.sleep(polling_interval)

        # 如果循环正常结束但仍未返回结果（这种情况理论上不会发生）
        raise MaxRetriesException(f"达到最大轮询次数 {max_attempts}")

    async def _extract_image_url(self, result: Dict[str, Any]) -> Optional[str]:
        """
        从结果中提取图像URL

        Args:
            result: 图像生成结果

        Returns:
            图像URL，如果无法提取则返回None
        """
        try:
            # 尝试从结果中提取图像URL
            if result.get("task_status") == "SUCCESS":
                artifacts = result.get("artifacts", [])
                if artifacts and len(artifacts) > 0:
                    return artifacts[0].get("url")
        except Exception as e:
            logger.error(f"提取图像URL失败: {str(e)}")
            return None

        return None

    async def calculate_dimensions(self, ratio: str) -> Tuple[int, int]:
        """
        根据比例计算宽高，确保总像素数接近 1024²

        Args:
            ratio: 比例字符串，如"1:1"、"4:3"等

        Returns:
            宽度和高度
        """
        target_pixels = 1024 * 1024

        parts = ratio.split(":")
        if len(parts) == 2:
            try:
                width_ratio = float(parts[0])
                height_ratio = float(parts[1])
                x = math.sqrt(target_pixels / (width_ratio * height_ratio))
                width = width_ratio * x
                height = height_ratio * x
                width = round(width / 8) * 8
                height = round(height / 8) * 8
                return int(width), int(height)
            except Exception as e:
                logger.warning(f"计算比例 {ratio} 的尺寸时出错: {str(e)}")

        return 1024, 1024

def update_subtask_status(subtask_id: str, status: str, error: str = None, result: str = None) -> bool:
    """
    更新子任务状态

    Args:
        subtask_id: 子任务ID
        status: 状态
        error: 错误信息
        result: 结果URL

    Returns:
        是否更新成功
    """
    try:
        # 初始化数据库连接
        DramatiqBaseModel.initialize_database()

        # 同时初始化BaseModel的数据库连接，因为Subtask模型继承自BaseModel
        try:
            from backend.core.app import initialize_app
            initialize_app()
        except Exception as base_init_error:
            logger.error(f"更新子任务状态时初始化BaseModel数据库连接失败: {str(base_init_error)}")
            raise

        # 获取子任务
        subtask = Subtask.get_or_none(Subtask.id == subtask_id)
        if not subtask:
            logger.error(f"子任务不存在: {subtask_id}")
            return False

        # 更新状态
        subtask.status = status
        subtask.updated_at = datetime.now()

        # 如果是开始处理，更新开始时间
        if status == SubtaskStatus.PROCESSING.value:
            subtask.started_at = datetime.now()

        # 如果是完成或失败，更新完成时间和其他信息
        if status in [SubtaskStatus.COMPLETED.value, SubtaskStatus.FAILED.value]:
            subtask.completed_at = datetime.now()

            if error:
                subtask.error = error

            if result:
                subtask.result = result

        # 保存更新
        subtask.save()
        return True
    except Exception as e:
        logger.error(f"更新子任务状态失败: {str(e)}")
        return False

async def process_subtask(subtask_id: str) -> Dict[str, Any]:
    """
    处理子任务

    Args:
        subtask_id: 子任务ID

    Returns:
        处理结果
    """
    # 初始化数据库连接
    DramatiqBaseModel.initialize_database()

    # 同时初始化BaseModel的数据库连接，因为Subtask、Task等模型继承自BaseModel
    try:
        from backend.core.app import initialize_app
        initialize_app()
    except Exception as base_init_error:
        logger.error(f"[{subtask_id}] 初始化BaseModel数据库连接失败: {str(base_init_error)}")
        raise

    # 获取子任务数据
    subtask = Subtask.get_or_none(Subtask.id == subtask_id)
    if not subtask:
        logger.error(f"子任务不存在: {subtask_id}")
        return {
            "status": "failed",
            "error": f"子任务不存在: {subtask_id}"
        }

    # 更新子任务状态为处理中
    update_subtask_status(subtask_id, SubtaskStatus.PROCESSING.value)

    try:
        # 提取任务参数
        prompts = subtask.prompts
        ratio = subtask.ratio
        seed = subtask.seed
        use_polish = subtask.use_polish
        is_lumina = subtask.is_lumina
        lumina_model_name = subtask.lumina_model_name
        lumina_cfg = subtask.lumina_cfg
        lumina_step = subtask.lumina_step

        # 记录任务参数
        logger.info(f"子任务参数: ratio={ratio}, seed={seed}, use_polish={use_polish}, is_lumina={is_lumina}")
        if is_lumina:
            logger.info(f"Lumina参数: model={lumina_model_name}, cfg={lumina_cfg}, step={lumina_step}")

        # 创建图像客户端
        image_client = ImageClient()

        # 计算宽高
        width, height = await image_client.calculate_dimensions(ratio)

        logger.info(f"开始生成图像: 子任务ID={subtask_id}, 宽度={width}, 高度={height}, 种子={seed}")

        # 生成图像
        result = await image_client.generate_image(
            prompts=prompts,
            width=width,
            height=height,
            seed=seed,
            use_polish=use_polish,
            is_lumina=is_lumina,
            lumina_model_name=lumina_model_name,
            lumina_cfg=lumina_cfg,
            lumina_step=lumina_step
        )

        if not result.get("success"):
            raise Exception(f"图像生成失败: {result.get('error', '未知错误')}, {result}")

        # 提取图像URL
        image_url = result.get("data", {}).get("image_url")
        if not image_url:
            raise Exception("无法从结果中获取图像URL")

        # 获取实际使用的种子（可能是随机生成的）
        actual_seed = result.get("data", {}).get("seed", seed)

        logger.info(f"图像生成成功: 子任务ID={subtask_id}, 图像URL={image_url}, 种子={actual_seed}")

        # 更新子任务状态为已完成
        update_subtask_status(
            subtask_id=subtask_id,
            status=SubtaskStatus.COMPLETED.value,
            result=image_url
        )

        # 尝试发送飞书通知
        try:
            feishu_notify(
                event_type="task_completed",
                task_id=str(subtask.task.id),
                task_name=subtask.task.name,
                submitter=subtask.task.user.username if subtask.task.user else None,
                details={
                    "子任务ID": str(subtask_id),
                    "图像URL": image_url,
                    "随机种子": actual_seed,
                    "变量索引": subtask.variable_indices,
                    "是否Lumina": "是" if is_lumina else "否"
                },
                message="子任务已完成"
            )
        except Exception as notify_error:
            # 飞书通知失败不影响主流程
            logger.warning(f"发送飞书通知失败: {str(notify_error)}")

        # 返回结果
        return {
            "status": "completed",
            "result": image_url,
            "seed": actual_seed
        }

    except Exception as e:
        # 处理异常
        error_msg = f"图像生成失败: {str(e)}"
        error_details = traceback.format_exc()
        logger.error(f"子任务 {subtask_id} {error_msg}\n{error_details}")

        # 检查是否是审核问题或内容不合规
        is_censored = False
        if "451" in str(e) or "审核" in str(e) or "敏感" in str(e) or "违规" in str(e) or "ILLEGAL_IMAGE" in str(e) or "内容不合规" in str(e):
            is_censored = True
            logger.warning(f"子任务 {subtask_id} 可能触发内容审核或内容不合规，不进行重试")

        # 更新子任务状态为失败
        update_subtask_status(
            subtask_id=subtask_id,
            status=SubtaskStatus.FAILED.value,
            error=error_msg
        )

        # 尝试发送飞书通知
        try:
            feishu_notify(
                event_type="task_failed",
                task_id=str(subtask.task.id),
                task_name=subtask.task.name,
                submitter=subtask.task.user.username if subtask.task.user else None,
                details={
                    "子任务ID": str(subtask_id),
                    "错误信息": error_msg,
                    "变量索引": subtask.variable_indices,
                    "是否内容不合规": "是" if is_censored else "否",
                    "错误类型": "内容不合规" if is_censored else "其他错误"
                },
                message="子任务失败"
            )
        except Exception as notify_error:
            # 飞书通知失败不影响主流程
            logger.warning(f"发送飞书通知失败: {str(notify_error)}")

        # 根据错误类型抛出不同的异常
        if is_censored:
            # 内容审核问题，不应重试
            raise ContentCensoredException(error_msg)
        else:
            # 其他错误，可以重试
            raise RetryableException(error_msg)

@dramatiq.actor(
    queue_name=settings.SUBTASK_QUEUE,  # 使用子任务队列
    max_retries=settings.MAX_RETRIES,  # 最多重试3次
    time_limit=300000,  # 300秒，考虑到图像生成可能需要较长时间
    # retry_when=RetryableException,  # 只有RetryableException才会触发重试
)
def test_run_subtask(subtask_id: str):
    """
    处理单个子任务

    Args:
        subtask_id: 子任务ID
    """
    # 获取当前重试次数
    message = CurrentMessage.get_current_message()
    retry_count = message.options.get("retries", 0) if message else 0

    logger.info(f"[{subtask_id}] 子任务开始执行 (重试次数: {retry_count})")

    # 初始化数据库
    DramatiqBaseModel.initialize_database()

    # 同时初始化BaseModel的数据库连接，因为Subtask、Task等模型继承自BaseModel
    try:
        from backend.core.app import initialize_app
        initialize_app()
    except Exception as base_init_error:
        logger.error(f"[{subtask_id}] 初始化BaseModel数据库连接失败: {str(base_init_error)}")
        raise

    if retry_count > 0:
        try:
            subtask = Subtask.get_or_none(Subtask.id == subtask_id)
            if subtask:
                subtask.error_retry_count = retry_count
                subtask.save()
                logger.info(f"[{subtask_id}] 更新子任务重试计数: {retry_count}")
        except Exception as e:
            logger.error(f"[{subtask_id}] 更新重试计数失败: {str(e)}")

    # 使用事件循环运行异步处理函数
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        # 如果没有事件循环，创建一个新的
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    # 运行异步处理函数
    result = loop.run_until_complete(process_subtask(subtask_id))

    logger.info(f"[{subtask_id}] 子任务执行完成: {result.get('status')}")

    return result

@dramatiq.actor(
    queue_name=settings.SUBTASK_OPS_QUEUE,  # 使用Lumina子任务队列
    max_retries=0,  # 最多重试3次
    time_limit=600000,  # 600秒，考虑到Lumina图像生成可能需要更长时间
    retry_when=RetryableException,  # 只有RetryableException才会触发重试
)
def test_run_lumina_subtask(subtask_id: str):
    """
    处理Lumina子任务（与普通子任务相同，但使用不同的队列和超时设置）

    Args:
        subtask_id: 子任务ID
    """
    logger.info(f"[{subtask_id}] Lumina子任务开始执行")
    return test_run_subtask(subtask_id)


