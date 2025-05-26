# 启动Dramatiq工作进程的PowerShell脚本

# 设置环境变量
$env:PYTHONPATH = "."

# 定义颜色函数
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

# 显示帮助信息
function Show-Help {
    Write-ColorOutput Green "启动Dramatiq工作进程的PowerShell脚本"
    Write-Output ""
    Write-Output "用法: .\scripts\start_dramatiq_workers.ps1 [选项]"
    Write-Output ""
    Write-Output "选项:"
    Write-Output "  -queue <队列名称>    要启动的队列，可选值: master, subtask, subtask_ops, all (默认: all)"
    Write-Output "  -processes <数量>    进程数量 (默认: 2)"
    Write-Output "  -threads <数量>      每个进程的线程数量 (默认: 5)"
    Write-Output "  -help                显示此帮助信息"
    Write-Output ""
    Write-Output "示例:"
    Write-Output "  .\scripts\start_dramatiq_workers.ps1 -queue master -processes 2 -threads 5"
    Write-Output "  .\scripts\start_dramatiq_workers.ps1 -queue subtask"
    Write-Output "  .\scripts\start_dramatiq_workers.ps1 -queue all"
    Write-Output ""
}

# 解析命令行参数
param (
    [string]$queue = "all",
    [int]$processes = 2,
    [int]$threads = 5,
    [switch]$help
)

# 如果请求帮助，显示帮助信息并退出
if ($help) {
    Show-Help
    exit 0
}

# 验证队列参数
if ($queue -notin @("master", "subtask", "subtask_ops", "all")) {
    Write-ColorOutput Red "错误: 无效的队列名称 '$queue'"
    Write-Output "有效的队列名称: master, subtask, subtask_ops, all"
    exit 1
}

# 显示启动信息
Write-ColorOutput Green "正在启动Dramatiq工作进程..."
Write-Output "队列: $queue"
Write-Output "进程数量: $processes"
Write-Output "每个进程的线程数量: $threads"
Write-Output ""

# 启动Dramatiq工作进程
try {
    python -m backend.dramatiq_app.start_dramatiq $queue --processes $processes --threads $threads
}
catch {
    Write-ColorOutput Red "启动Dramatiq工作进程时出错: $_"
    exit 1
}
