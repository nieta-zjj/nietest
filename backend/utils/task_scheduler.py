"""
任务调度工具模块

提供任务调度相关的工具函数，用于计算任务延迟时间等
"""
import time
import logging
from typing import List, Dict, Any, Optional

# 配置日志
logger = logging.getLogger(__name__)


class TaskScheduler:
    """任务调度器，用于计算任务延迟时间"""
    
    @staticmethod
    def calculate_lumina_delay(index: int) -> float:
        """
        计算Lumina任务的延迟时间
        
        规则：
        1. 第1个任务直接执行（预热）
        2. 第2个任务与第1个间隔90秒
        3. 第3个任务与第2个间隔12秒
        4. 之后的每个任务与之前减少间隔0.01秒，直到间隔0.5秒不再减少
        
        Args:
            index: 任务索引，从0开始
            
        Returns:
            延迟时间（秒）
        """
        if index == 0:
            # 第1个任务直接执行
            return 0
        elif index == 1:
            # 第2个任务与第1个间隔90秒
            return 90
        elif index == 2:
            # 第3个任务与第2个间隔12秒
            return 12
        else:
            # 之后的每个任务与之前减少间隔0.01秒，直到间隔0.5秒不再减少
            delay = max(12 - 0.01 * (index - 2), 0.5)
            return delay
    
    @staticmethod
    def calculate_normal_delay(index: int) -> float:
        """
        计算普通任务的延迟时间
        
        规则：
        1. 无需预热，第1个任务间隔1秒
        2. 之后每个任务与之前减少间隔0.01秒，直到间隔0.2秒不再减少
        
        Args:
            index: 任务索引，从0开始
            
        Returns:
            延迟时间（秒）
        """
        if index == 0:
            # 第1个任务间隔1秒
            return 1
        else:
            # 之后每个任务与之前减少间隔0.01秒，直到间隔0.2秒不再减少
            delay = max(1 - 0.01 * index, 0.2)
            return delay
    
    @staticmethod
    def distribute_tasks_with_delay(subtasks: List[Dict[str, Any]], is_lumina: bool = False) -> List[Dict[str, Any]]:
        """
        按照延迟规则分配任务
        
        Args:
            subtasks: 子任务列表
            is_lumina: 是否为Lumina任务
            
        Returns:
            带有延迟时间的子任务列表
        """
        result = []
        
        # 计算每个任务的延迟时间
        for i, subtask in enumerate(subtasks):
            if is_lumina:
                delay = TaskScheduler.calculate_lumina_delay(i)
            else:
                delay = TaskScheduler.calculate_normal_delay(i)
                
            # 添加延迟时间到任务中
            subtask_with_delay = subtask.copy()
            subtask_with_delay["delay"] = delay
            result.append(subtask_with_delay)
            
        return result
    
    @staticmethod
    def execute_tasks_with_delay(subtasks: List[Dict[str, Any]], callback) -> None:
        """
        按照延迟时间执行任务
        
        Args:
            subtasks: 带有延迟时间的子任务列表
            callback: 回调函数，用于执行任务
        """
        for subtask in subtasks:
            # 获取延迟时间
            delay = subtask.get("delay", 0)
            
            # 等待指定的延迟时间
            if delay > 0:
                logger.info(f"等待 {delay} 秒后执行任务 {subtask.get('id', '')}")
                time.sleep(delay)
            
            # 执行任务
            callback(subtask)
