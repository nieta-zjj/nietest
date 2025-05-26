#!/bin/bash
# 启动Dramatiq工作进程的Bash脚本

# 设置环境变量
export PYTHONPATH="."

# 定义颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 显示帮助信息
show_help() {
    echo -e "${GREEN}启动Dramatiq工作进程的Bash脚本${NC}"
    echo ""
    echo "用法: ./scripts/start_dramatiq_workers.sh [选项]"
    echo ""
    echo "选项:"
    echo "  -q, --queue <队列名称>    要启动的队列，可选值: master, subtask, subtask_ops, all (默认: all)"
    echo "  -p, --processes <数量>    进程数量 (默认: 2)"
    echo "  -t, --threads <数量>      每个进程的线程数量 (默认: 5)"
    echo "  -h, --help                显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./scripts/start_dramatiq_workers.sh -q master -p 2 -t 5"
    echo "  ./scripts/start_dramatiq_workers.sh --queue subtask"
    echo "  ./scripts/start_dramatiq_workers.sh"
    echo ""
}

# 默认参数
QUEUE="all"
PROCESSES=2
THREADS=5

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -q|--queue)
            QUEUE="$2"
            shift 2
            ;;
        -p|--processes)
            PROCESSES="$2"
            shift 2
            ;;
        -t|--threads)
            THREADS="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}错误: 未知选项 $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# 验证队列参数
if [[ "$QUEUE" != "master" && "$QUEUE" != "subtask" && "$QUEUE" != "subtask_ops" && "$QUEUE" != "all" ]]; then
    echo -e "${RED}错误: 无效的队列名称 '$QUEUE'${NC}"
    echo "有效的队列名称: master, subtask, subtask_ops, all"
    exit 1
fi

# 显示启动信息
echo -e "${GREEN}正在启动Dramatiq工作进程...${NC}"
echo "队列: $QUEUE"
echo "进程数量: $PROCESSES"
echo "每个进程的线程数量: $THREADS"
echo ""

# 启动Dramatiq工作进程
python -m backend.dramatiq_app.start_dramatiq $QUEUE --processes $PROCESSES --threads $THREADS

# 检查启动结果
if [ $? -ne 0 ]; then
    echo -e "${RED}启动Dramatiq工作进程时出错${NC}"
    exit 1
fi
