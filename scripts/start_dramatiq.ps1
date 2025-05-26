# 启动Dramatiq工作进程
# 用法: .\scripts\start_dramatiq.ps1 [进程数] [线程数]

param (
    [int]$processes = 1,
    [int]$threads = 5
)

Write-Host "正在启动Dramatiq工作进程..."
Write-Host "进程数: $processes"
Write-Host "线程数: $threads"

# 设置环境变量
$env:PYTHONPATH = "."
$env:LOG_LEVEL = "DEBUG"  # 设置日志级别为DEBUG，可选值：DEBUG, INFO, WARNING, ERROR, CRITICAL

# 使用dramatiq命令行工具直接启动工作进程
# 这将保持进程运行并显示日志输出
python -m dramatiq --processes $processes --threads $threads --verbose backend.dramatiq_app.workers.master
# python -m dramatiq --processes 1 --threads 5 --verbose backend.dramatiq_app.workers.master
# 注意：上面的命令会持续运行，直到按下Ctrl+C
