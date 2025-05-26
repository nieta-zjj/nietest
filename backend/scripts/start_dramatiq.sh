#!/bin/bash
# 启动Dramatiq工作进程的Bash脚本

# 设置环境变量
export PYTHONPATH="."

# 启动主任务队列工作进程
echo "启动主任务队列工作进程..."
python -m dramatiq --processes 1 --threads 5 --verbose backend.dramatiq_app.workers.master
