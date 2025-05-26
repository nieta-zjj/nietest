# Dramatiq任务处理系统

这是一个基于Dramatiq的任务处理系统，用于异步处理各种任务。

## 目录结构

```
backend/dramatiq_app/
├── actors/                 # 任务Actor定义
│   ├── test_submit_master.py  # 主任务提交Actor
│   └── test_run_subtask.py    # 子任务执行Actor
├── middlewares/            # 中间件
│   ├── catch_exceptions.py  # 异常捕获中间件
│   └── task_tracker.py      # 任务跟踪中间件
├── utils/                  # 工具函数
│   ├── exceptions.py       # 异常处理工具
│   ├── feishu.py           # 飞书通知工具
│   ├── tracker.py          # 数据跟踪工具
│   └── mongodb.py          # MongoDB操作工具
├── workers/                # 工作进程
│   ├── broker_setup.py     # 代理设置
│   ├── master.py           # 主任务工作进程
│   ├── subtask.py          # 子任务工作进程
│   └── subtask_ops.py      # Lumina子任务工作进程
├── config.py               # 配置文件
└── start_dramatiq.py       # 启动工作进程脚本
```

## 队列说明

系统使用以下队列：

1. **nietest_master**: 主任务队列，处理任务提交和创建子任务
2. **nietest_master_ops**: Lumina主任务队列（暂未使用）
3. **nietest_subtask**: 子任务队列，处理普通图像生成任务
4. **nietest_subtask_ops**: Lumina子任务队列，处理Lumina图像生成任务

## 使用方法

### 1. 启动工作进程

可以使用提供的脚本启动工作进程：

#### Windows (PowerShell)

```powershell
# 启动所有队列的工作进程
.\scripts\start_dramatiq_workers.ps1

# 启动特定队列的工作进程
.\scripts\start_dramatiq_workers.ps1 -queue master
.\scripts\start_dramatiq_workers.ps1 -queue subtask
.\scripts\start_dramatiq_workers.ps1 -queue subtask_ops

# 自定义进程数和线程数
.\scripts\start_dramatiq_workers.ps1 -queue all -processes 4 -threads 8
```

#### Linux/macOS (Bash)

```bash
# 启动所有队列的工作进程
./scripts/start_dramatiq_workers.sh

# 启动特定队列的工作进程
./scripts/start_dramatiq_workers.sh -q master
./scripts/start_dramatiq_workers.sh --queue subtask
./scripts/start_dramatiq_workers.sh --queue subtask_ops

# 自定义进程数和线程数
./scripts/start_dramatiq_workers.sh -q all -p 4 -t 8
```

### 2. 直接使用Python命令

也可以直接使用Python命令启动工作进程：

```bash
# 启动主任务队列工作进程
python -m backend.dramatiq_app.start_dramatiq master --processes 2 --threads 5

# 启动子任务队列工作进程
python -m backend.dramatiq_app.start_dramatiq subtask --processes 2 --threads 5

# 启动Lumina子任务队列工作进程
python -m backend.dramatiq_app.start_dramatiq subtask_ops --processes 2 --threads 5

# 启动所有队列的工作进程
python -m backend.dramatiq_app.start_dramatiq all --processes 2 --threads 5
```

## 开发说明

### 1. 添加新的Actor

1. 在`actors/`目录下创建新的Actor文件
2. 使用`@dramatiq.actor`装饰器定义Actor函数
3. 指定队列名称和重试策略

### 2. 添加新的Worker

1. 在`workers/`目录下创建新的Worker文件
2. 导入相关的Actor和broker_setup
3. 初始化数据库连接
4. 更新`start_dramatiq.py`以支持新的Worker

## 环境变量

### Redis配置
- `REDIS_HOST`: Redis主机地址，默认为localhost
- `REDIS_PORT`: Redis端口，默认为6379
- `REDIS_DB`: Redis数据库，默认为0
- `BROKER_REDIS_URL`: Redis连接URL，默认为redis://localhost:6379/0

### 队列配置
- `STANDARD_QUEUE`: 标准队列名称，默认为nietest_master
- `LUMINA_QUEUE`: Lumina队列名称，默认为nietest_master_ops
- `SUBTASK_QUEUE`: 子任务队列名称，默认为nietest_subtask
- `SUBTASK_OPS_QUEUE`: Lumina子任务队列名称，默认为nietest_subtask_ops
- `MAX_RETRIES`: 最大重试次数，默认为0

### 图像生成配置
- `NIETA_XTOKEN`: API令牌，必须设置
- `IMAGE_MAX_POLLING_ATTEMPTS`: 最大轮询次数，默认为30
- `IMAGE_POLLING_INTERVAL`: 轮询间隔（秒），默认为2.0
- `LUMINA_MAX_POLLING_ATTEMPTS`: Lumina最大轮询次数，默认为50
- `LUMINA_POLLING_INTERVAL`: Lumina轮询间隔（秒），默认为3.0

### MongoDB配置
- `MONGO_HOST`: MongoDB主机地址，默认为localhost
- `MONGO_PORT`: MongoDB端口，默认为27017
- `MONGO_USER`: MongoDB用户名，默认为空
- `MONGO_PASSWORD`: MongoDB密码，默认为空
- `MONGO_DB`: MongoDB数据库名称，默认为task_db
- `TASK_COLLECTION`: 任务集合名称，默认为tasks
- `SUBTASK_COLLECTION`: 子任务集合名称，默认为subtasks

### 飞书通知配置
- `FEISHU_WEBHOOK_URL`: 飞书Webhook URL，用于发送通知
