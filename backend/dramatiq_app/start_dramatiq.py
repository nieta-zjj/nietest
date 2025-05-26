"""
启动Dramatiq工作进程

用于启动Dramatiq工作进程的脚本
"""
import os
import sys
import logging
import argparse

# 在文件开头导入新的配置
from backend.core.config import settings

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [PID %(process)d] [%(threadName)s] [%(name)s] [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()],
)

logger = logging.getLogger(__name__)

def main():
    """主函数"""
    # 解析命令行参数
    parser = argparse.ArgumentParser(description="启动Dramatiq工作进程")
    parser.add_argument(
        "queue",
        choices=["master", "subtask", "subtask_ops", "all"],
        help=f"要处理的队列名称: master({settings.STANDARD_QUEUE}和{settings.LUMINA_QUEUE}), subtask({settings.SUBTASK_QUEUE}), subtask_ops({settings.SUBTASK_OPS_QUEUE}), all(所有队列)",
    )
    parser.add_argument(
        "--processes",
        type=int,
        default=2,
        help="进程数量",
    )
    parser.add_argument(
        "--threads",
        type=int,
        default=5,
        help="每个进程的线程数量",
    )
    args = parser.parse_args()

    # 设置环境变量
    os.environ["DRAMATIQ_PROCESSES"] = str(args.processes)
    os.environ["DRAMATIQ_THREADS"] = str(args.threads)

    # 导入相应的worker模块
    if args.queue == "master" or args.queue == "all":
        logger.info(f"启动主任务队列({settings.STANDARD_QUEUE}和{settings.LUMINA_QUEUE})工作进程: {args.processes}个进程, 每个进程{args.threads}个线程")
        logger.info("确保每个队列同时只有一个任务在执行，后面的任务需要等待前面的任务完成")
        from backend.dramatiq_app.workers import master
        logger.info("主任务队列工作进程启动完成")

    if args.queue == "subtask" or args.queue == "all":
        logger.info(f"启动子任务队列({settings.SUBTASK_QUEUE})工作进程: {args.processes}个进程, 每个进程{args.threads}个线程")
        from backend.dramatiq_app.workers import subtask
        logger.info("子任务队列工作进程启动完成")

    if args.queue == "subtask_ops" or args.queue == "all":
        logger.info(f"启动Lumina子任务队列(nietest_subtask_ops)工作进程: {args.processes}个进程, 每个进程{args.threads}个线程")
        from backend.dramatiq_app.workers import subtask_ops
        logger.info("Lumina子任务队列工作进程启动完成")

    logger.info(f"所有指定的队列工作进程已启动")

if __name__ == "__main__":
    main()




