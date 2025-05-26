#!/bin/bash
# 启动Dramatiq工作进程
# 用法: ./scripts/start_dramatiq.sh [进程数] [线程数]

# 默认参数
PROCESSES=${1:-1}
THREADS=${2:-5}

echo "正在启动Dramatiq工作进程..."
echo "进程数: $PROCESSES"
echo "线程数: $THREADS"

# 设置环境变量
export PYTHONPATH="."
export LOG_LEVEL="DEBUG"  # 设置日志级别为DEBUG，可选值：DEBUG, INFO, WARNING, ERROR, CRITICAL

# 使用dramatiq命令行工具直接启动工作进程
# 这将保持进程运行并显示日志输出
python -m dramatiq --processes $PROCESSES --threads $THREADS --verbose backend.dramatiq_app.workers.master

# 注意：上面的命令会持续运行，直到按下Ctrl+C
