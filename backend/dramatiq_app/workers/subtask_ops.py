"""
Lumina子任务工作进程模块

处理Lumina子任务队列 (nietest_subtask_ops)
负责执行Lumina图像生成子任务
"""
import logging

# 配置日志
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# 导入broker和actor
# 注意：broker_setup会在导入时初始化数据库连接
from backend.dramatiq_app.workers import broker_setup
from backend.dramatiq_app.actors import test_run_subtask

# 初始化数据库连接
def init_database():
    """初始化数据库连接，避免循环导入"""
    try:
        # 使用专门为Dramatiq设计的数据库模型
        from backend.models.db.dramatiq_base import DramatiqBaseModel

        logger.info("正在初始化数据库连接...")
        DramatiqBaseModel.initialize_database()
        logger.info("数据库连接初始化成功")
    except Exception as e:
        logger.error(f"数据库连接初始化失败: {str(e)}")
        raise

# 执行数据库初始化
init_database()

logger.info("Lumina子任务工作进程就绪，监听队列: nietest_subtask_ops")
