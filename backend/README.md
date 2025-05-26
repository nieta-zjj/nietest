# Backend2 项目架构说明

本文档介绍Backend2项目的架构、目录结构以及推荐的代码阅读顺序，帮助开发者快速理解项目结构。

## 项目概述

Backend2是一个基于Python的后端服务，负责处理图像生成任务的管理、执行和结果处理。项目采用分层架构设计，清晰地分离了数据模型、数据访问、业务逻辑和工具函数。

## 快速开始

### 环境要求

- Python 3.11
- PostgreSQL 12+

### 安装步骤

1. **克隆仓库**

```bash
git clone <repository-url>
cd backend
```

2. **创建并激活虚拟环境**

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/macOS
python -m venv venv
source venv/bin/activate
```

3. **安装依赖**

```bash
pip install -r requirements.txt
```

4. **配置环境变量**

创建`.env`文件，并设置以下环境变量：

```
# 数据库配置
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_NAME=backend
TEST_DB_USER=postgres
TEST_DB_PASSWORD=your_password

# 数据库连接池配置
TEST_DB_MAX_CONNECTIONS=8
TEST_DB_STALE_TIMEOUT=300

# 图像生成服务配置
TEST_IMAGE_MAX_POLLING_ATTEMPTS=30
TEST_IMAGE_POLLING_INTERVAL=2.0
TEST_MAKE_API_TOKEN=your_api_token
```

5. **初始化数据库**

```bash
# 创建数据库表
python -m backend.scripts.init_db

# 创建初始用户
python -m backend.scripts.init_users
```

### 启动服务

1. **初始化应用**

```python
from backend.core import initialize_app, shutdown_app

# 初始化应用
db = initialize_app()

# 在这里执行你的代码
# ...

# 关闭应用
shutdown_app()
```

2. **使用服务**

```python
from backend.services.user_service import create_user, get_all_users
from backend.models.db.user import Role

# 创建用户
user = create_user(
    username="test_user",
    password="password123",
    roles=[Role.USER.value]
)

# 获取所有用户
users = get_all_users(user, skip=0, limit=10)
```

## 架构重构说明

本项目最近进行了架构重构，主要改进如下：

1. **关注点分离**：将原本混合在模型层的业务逻辑分离到专门的服务层和数据访问层
2. **单一职责原则**：每个模块只负责单一的功能职责
   - 模型层：纯数据结构定义
   - CRUD层：数据库访问操作
   - 服务层：业务逻辑处理
   - 工具层：通用工具函数
3. **提高可维护性**：代码组织更加清晰，便于功能扩展和问题定位
4. **降低耦合度**：各层之间通过明确的接口交互，降低依赖关系

重构前，大量业务逻辑混杂在 `models/db` 目录下的模型文件中。重构后，这些逻辑被适当地移动到了各自对应的层中。

## 目录结构

```
backend/
├── core/            # 核心配置
│   └── config.py    # 应用配置
├── db/              # 数据库管理
│   └── db_manager.py # 数据库连接管理
├── models/          # 数据模型层
│   ├── db/          # 数据库模型定义
│   └── prompt.py    # 提示词模型
├── crud/            # 数据访问层
├── services/        # 业务逻辑层
├── utils/           # 工具函数
└── README.md        # 本文档
```

## 推荐阅读顺序

为了全面理解项目结构和业务流程，推荐按以下顺序阅读代码：

### 1. 基础设施和配置

- `core/config.py` - 应用配置和环境变量
- `db/database.py` - 数据库连接管理（使用 Peewee 的 `DatabaseProxy`）
- `models/db/base.py` - 基础模型定义

### 2. 数据模型层

数据模型定义了系统的核心数据结构：

- `models/db/user.py` - 用户模型及权限定义
- `models/db/tasks.py` - 任务模型及状态枚举
- `models/db/subtasks.py` - 子任务模型及状态枚举
- `models/prompt.py` - 提示词模型结构

### 3. 数据访问层

数据访问层提供了与数据库交互的接口：

- `crud/base.py` - 通用CRUD操作基类
- `crud/user.py` - 用户相关数据访问
- `crud/task.py` - 任务相关数据访问
- `crud/subtask.py` - 子任务相关数据访问

### 4. 业务逻辑层

业务逻辑层实现了系统的核心功能：

- `services/task_service.py` - 任务管理相关业务逻辑
- `services/subtask_service.py` - 子任务处理相关业务逻辑
- `services/make_image.py` - 图像生成服务实现

## 详细功能说明

### 模型层 (models/)

#### models/db/

- `base.py` - 定义BaseModel基类，所有数据库模型的基础
- `user.py` - 用户模型与权限管理
  - `User` - 用户数据模型
  - `Permission` - 权限枚举
- `tasks.py` - 任务相关模型
  - `Task` - 任务数据模型
  - `TaskStatus` - 任务状态枚举
  - `MakeApiQueue` - API队列类型枚举
- `subtasks.py` - 子任务相关模型
  - `Subtask` - 子任务数据模型
  - `SubtaskStatus` - 子任务状态枚举

#### models/prompt.py

定义提示词模型，用于图像生成的提示词格式化和验证。

### 数据访问层 (crud/)

- `base.py` - 定义CRUDBase基类，提供通用的CRUD操作
- `user.py` - 用户数据访问，包括用户创建、认证等功能
- `task.py` - 任务数据访问
  - `TaskCRUD` - 提供任务的创建、查询、更新和删除功能
  - `get_by_user()` - 获取用户的所有任务
  - `update_progress()` - 更新任务进度
- `subtask.py` - 子任务数据访问
  - `SubtaskCRUD` - 提供子任务的创建、查询、更新和删除功能
  - `get_by_task()` - 获取任务的所有子任务
  - `get_pending_subtasks()` - 获取待处理的子任务
  - `update_status()` - 更新子任务状态
  - `set_result()` - 设置子任务结果
  - `set_rating()` - 设置子任务评分

### 业务逻辑层 (services/)

- `task_service.py` - 任务相关业务逻辑
  - `SettingField` - 设置字段模型
  - `validate_setting()` - 验证设置字段
  - `validate_prompts()` - 验证提示词列表
  - `create_task()` - 创建新任务
  - `update_task_status()` - 更新任务状态
- `subtask_service.py` - 子任务处理逻辑
  - `process_subtask()` - 处理单个子任务
  - `process_pending_subtasks()` - 批量处理待处理的子任务
- `make_image.py` - 图像生成服务
  - `MakeImageParams` - 图像生成参数
  - `make_image()` - 调用外部API生成图像

### 工具函数 (utils/)

- 各种实用工具和辅助函数，不包含业务逻辑

## 数据流程

典型的数据处理流程如下：

1. 通过API请求创建任务，调用`task_service.create_task()`
2. 系统将任务拆分为多个子任务
3. 子任务进入队列等待处理
4. 后台服务调用`subtask_service.process_pending_subtasks()`处理待处理的子任务
5. 每个子任务通过`make_image.make_image()`生成图像
6. 生成结果通过`subtask_crud.set_result()`记录到数据库
7. 当所有子任务完成后，更新主任务状态

## 开发指南

### 添加新功能

1. 如需添加新的数据模型，在`models/db/`下创建相应文件
2. 为新模型创建对应的CRUD操作，放在`crud/`目录下
3. 实现业务逻辑，放在`services/`目录下
4. 在API层引用服务层功能

### 代码规范

- 遵循分层架构，保持各层之间的清晰边界
- 模型层只包含数据结构定义，不包含业务逻辑或数据库操作
- 数据库连接管理集中在 `db` 目录中，使用 Peewee 的 `DatabaseProxy` 对象
- 数据访问层负责与数据库交互，不处理复杂业务规则
- 业务逻辑集中在服务层实现
- 工具函数保持通用性，便于复用
- 配置集中在 `core/config.py` 中，通过环境变量和默认值管理

## 开发与测试

### 开发环境设置

1. **安装开发依赖**

```bash
pip install -r requirements-dev.txt
```

2. **设置开发环境变量**

创建`.env.dev`文件，并设置开发环境特定的环境变量。

### 运行测试

```bash
# 运行所有测试
pytest

# 运行特定测试模块
pytest tests/test_user_service.py

# 运行带覆盖率报告的测试
pytest --cov=backend tests/
```

### 常见问题排查

1. **数据库连接问题**

如果遇到数据库连接问题，请检查：
- 数据库服务是否正在运行
- 环境变量中的数据库配置是否正确
- 数据库用户是否有足够的权限

2. **API令牌问题**

如果图像生成服务返回401错误，请检查：
- 环境变量中的`TEST_MAKE_API_TOKEN`是否正确设置
- 令牌是否已过期或被撤销

3. **依赖问题**

如果遇到导入错误，请确保：
- 已安装所有必要的依赖
- 虚拟环境已正确激活
- Python路径设置正确

## 部署指南

### 生产环境配置

1. **设置生产环境变量**

创建`.env.prod`文件，并设置生产环境特定的环境变量。

2. **数据库迁移**

在生产环境中初始化数据库：

```bash
python -m backend.scripts.init_db --prod
```

3. **启动服务**

使用生产环境配置启动服务：

```bash
python -m backend.app --env prod
```

### 监控与日志

- 日志文件保存在`logs/`目录下
- 使用`logging`模块记录应用日志
- 建议配置日志聚合服务以便于监控和故障排查