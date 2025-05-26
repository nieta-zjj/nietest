#!/usr/bin/env python3
"""
MongoDB到PostgreSQL数据迁移脚本 v2.0

改进版本，支持配置文件、批量处理、错误恢复等功能
"""

import os
import sys
import json
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional
import logging
import argparse
from pathlib import Path
from dotenv import load_dotenv

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pymongo
    import psycopg2
    from psycopg2.extras import RealDictCursor, execute_batch
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
except ImportError as e:
    print(f"缺少必要的依赖包: {e}")
    print("请运行: pip install -r migration_requirements.txt")
    sys.exit(1)

# 加载环境变量
load_dotenv()

# 检查必要的环境变量
required_env_vars = [
    'MONGO_URI', 'MONGO_DATABASE', 'PG_HOST', 'PG_PORT',
    'PG_DATABASE', 'PG_USER', 'PG_PASSWORD'
]

missing_vars = [var for var in required_env_vars if not os.getenv(var)]
if missing_vars:
    print(f"缺少必要的环境变量: {', '.join(missing_vars)}")
    print("请复制 env.example 为 .env 并配置相应变量")
    sys.exit(1)

# MongoDB连接配置
MONGO_CONFIG = {
    'uri': os.getenv('MONGO_URI'),
    'database': os.getenv('MONGO_DATABASE')
}

# PostgreSQL连接配置
PG_CONFIG = {
    'host': os.getenv('PG_HOST'),
    'port': int(os.getenv('PG_PORT', 5432)),
    'database': os.getenv('PG_DATABASE'),
    'user': os.getenv('PG_USER'),
    'password': os.getenv('PG_PASSWORD')
}

# 迁移选项
MIGRATION_OPTIONS = {
    'batch_size': int(os.getenv('MIGRATION_BATCH_SIZE', 100)),
    'skip_existing': os.getenv('MIGRATION_SKIP_EXISTING', 'true').lower() == 'true',
    'create_users': os.getenv('MIGRATION_CREATE_USERS', 'true').lower() == 'true',
    'default_user_password': os.getenv('MIGRATION_DEFAULT_USER_PASSWORD', 'migrated_user_default_password')
}

# 默认测试用户配置
DEFAULT_TEST_USER = {
    'username': os.getenv('TEST_USER_USERNAME', 'test'),
    'password_hash': os.getenv('TEST_USER_PASSWORD_HASH', 'test_user_password_hash'),
    'roles': ['user']
}


class MigrationLogger:
    """迁移日志管理器"""

    def __init__(self, log_file: str = 'migration_v2.log'):
        self.logger = logging.getLogger('migration')
        self.logger.setLevel(logging.INFO)

        # 清除现有的处理器
        self.logger.handlers.clear()

        # 文件处理器
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(logging.INFO)

        # 控制台处理器
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)

        # 格式化器
        formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)

        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)

    def info(self, message: str):
        self.logger.info(message)

    def error(self, message: str):
        self.logger.error(message)

    def warning(self, message: str):
        self.logger.warning(message)


class MongoToPgMigratorV2:
    """MongoDB到PostgreSQL迁移器 v2.0"""

    def __init__(self, logger: MigrationLogger):
        self.logger = logger
        self.mongo_client = None
        self.pg_conn = None
        self.batch_size = MIGRATION_OPTIONS.get('batch_size', 100)
        self.skip_existing = MIGRATION_OPTIONS.get('skip_existing', True)
        self.create_users = MIGRATION_OPTIONS.get('create_users', True)

        # 统计信息
        self.stats = {
            'tasks_total': 0,
            'tasks_migrated': 0,
            'tasks_skipped': 0,
            'tasks_failed': 0,
            'subtasks_total': 0,
            'subtasks_migrated': 0,
            'subtasks_skipped': 0,
            'subtasks_failed': 0,
            'subtasks_orphaned': 0,
            'users_created': 0
        }

    def connect_mongo(self):
        """连接MongoDB"""
        try:
            self.mongo_client = pymongo.MongoClient(MONGO_CONFIG['uri'])
            self.mongo_db = self.mongo_client[MONGO_CONFIG['database']]
            # 测试连接
            self.mongo_client.admin.command('ping')
            self.logger.info("MongoDB连接成功")
        except Exception as e:
            self.logger.error(f"MongoDB连接失败: {e}")
            raise

    def connect_pg(self):
        """连接PostgreSQL"""
        try:
            self.pg_conn = psycopg2.connect(**PG_CONFIG)
            self.pg_conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            # 测试连接
            with self.pg_conn.cursor() as cursor:
                cursor.execute("SELECT 1")
            self.logger.info("PostgreSQL连接成功")
        except Exception as e:
            self.logger.error(f"PostgreSQL连接失败: {e}")
            raise

    def close_connections(self):
        """关闭数据库连接"""
        if self.mongo_client:
            self.mongo_client.close()
        if self.pg_conn:
            self.pg_conn.close()

    def create_test_user(self) -> str:
        """创建或获取test用户，返回用户ID"""
        with self.pg_conn.cursor() as cursor:
            # 检查test用户是否存在
            cursor.execute("SELECT id FROM users_v2 WHERE username = %s", (DEFAULT_TEST_USER['username'],))
            result = cursor.fetchone()

            if result:
                user_id = str(result[0])
                self.logger.info(f"找到已存在的test用户 (ID: {user_id})")
                return user_id

            # 创建test用户
            user_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO users_v2 (id, username, hashed_password, roles, is_active, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                user_id,
                DEFAULT_TEST_USER['username'],
                DEFAULT_TEST_USER['password_hash'],
                DEFAULT_TEST_USER['roles'],
                True,
                datetime.now(),
                datetime.now()
            ))

            self.stats['users_created'] += 1
            self.logger.info(f"创建test用户: {DEFAULT_TEST_USER['username']} (ID: {user_id})")
            return user_id

    def check_existing_task(self, task_id: str) -> bool:
        """检查任务是否已存在"""
        if not self.skip_existing:
            return False

        with self.pg_conn.cursor() as cursor:
            cursor.execute("SELECT 1 FROM nietest_tasks WHERE id = %s", (task_id,))
            return cursor.fetchone() is not None

    def check_existing_subtask(self, subtask_id: str) -> bool:
        """检查子任务是否已存在"""
        if not self.skip_existing:
            return False

        with self.pg_conn.cursor() as cursor:
            cursor.execute("SELECT 1 FROM nietest_subtasks WHERE id = %s", (subtask_id,))
            return cursor.fetchone() is not None

    def ensure_user_exists(self, username: str) -> str:
        """确保用户存在，如果不存在则创建，返回用户ID"""
        # 始终返回test用户ID，不再根据username创建不同用户
        if not hasattr(self, '_test_user_id'):
            self._test_user_id = self.create_test_user()

        # 记录原始用户名用于日志
        if username != DEFAULT_TEST_USER['username']:
            self.logger.info(f"将用户 {username} 的数据分配给test用户")

        return self._test_user_id

    def convert_mongo_tags_to_pg_prompts(self, tags: List[Dict]) -> List[Dict]:
        """将MongoDB的tags转换为PostgreSQL的prompts格式"""
        prompts = []

        for tag in tags:
            if tag.get('type') == 'element':
                prompt = {
                    'type': 'elementum',
                    'uuid': tag.get('uuid', ''),
                    'value': tag.get('uuid', ''),
                    'name': tag.get('value', ''),
                    'weight': tag.get('weight', 1),
                    'img_url': tag.get('header_img', ''),
                    'domain': '',
                    'parent': '',
                    'label': None,
                    'sort_index': 0,
                    'status': 'IN_USE',
                    'polymorphi_values': {},
                    'sub_type': None
                }
                prompts.append(prompt)

        return prompts

    def convert_mongo_variables_to_pg_format(self, variables: Dict, tags: List[Dict]) -> Dict:
        """将MongoDB的variables转换为PostgreSQL格式"""
        pg_variables = {}
        variable_tags = {tag['id']: tag for tag in tags if tag.get('isVariable', False)}

        for var_key, var_data in variables.items():
            if var_data.get('values') and len(var_data['values']) > 0:
                tag_id = var_data.get('tag_id')
                tag = variable_tags.get(tag_id, {})

                pg_variables[var_key] = {
                    'name': var_data.get('name', ''),
                    'type': tag.get('type', 'prompt'),
                    'values': [
                        {
                            'id': val.get('id', ''),
                            'value': val.get('value', ''),
                            'type': val.get('type', 'prompt')
                        }
                        for val in var_data['values']
                    ],
                    'values_count': var_data.get('values_count', 0)
                }

        return pg_variables

    def extract_settings_from_tags(self, tags: List[Dict]) -> Dict:
        """从tags中提取设置信息"""
        settings = {'batch_size': 1, 'use_polish': False}

        for tag in tags:
            if tag.get('type') == 'batch':
                try:
                    settings['batch_size'] = int(tag.get('value', 1))
                except (ValueError, TypeError):
                    settings['batch_size'] = 1
            elif tag.get('type') == 'polish':
                settings['use_polish'] = tag.get('value', 'false').lower() == 'true'

        return settings

    def create_task_parameter(self, param_type: str, value: Any, is_variable: bool = False, format_type: str = 'string'):
        """创建任务参数对象"""
        return {
            'type': param_type,
            'value': value,
            'is_variable': is_variable,
            'format': format_type
        }

    def migrate_task(self, mongo_task: Dict) -> bool:
        """迁移单个任务，返回是否成功"""
        task_id = mongo_task.get('id', 'unknown')

        try:
            # 检查是否已存在
            if self.check_existing_task(task_id):
                self.stats['tasks_skipped'] += 1
                self.logger.info(f"跳过已存在的任务: {task_id}")
                return True

            # 确保用户存在
            user_id = self.ensure_user_exists(mongo_task['username'])

            # 转换数据格式
            prompts = self.convert_mongo_tags_to_pg_prompts(mongo_task.get('tags', []))
            variables_map = self.convert_mongo_variables_to_pg_format(
                mongo_task.get('variables', {}),
                mongo_task.get('tags', [])
            )
            settings = self.extract_settings_from_tags(mongo_task.get('tags', []))

            # 处理时间字段
            created_at = mongo_task.get('created_at')
            if isinstance(created_at, dict) and '$date' in created_at:
                created_at = datetime.fromisoformat(created_at['$date'].replace('Z', '+00:00'))
            elif not isinstance(created_at, datetime):
                created_at = datetime.now()

            updated_at = mongo_task.get('updated_at')
            if isinstance(updated_at, dict) and '$date' in updated_at:
                updated_at = datetime.fromisoformat(updated_at['$date'].replace('Z', '+00:00'))
            elif not isinstance(updated_at, datetime):
                updated_at = datetime.now()

            # 插入任务到PostgreSQL
            with self.pg_conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO nietest_tasks (
                        id, name, user_id, status, priority, total_images, processed_images,
                        progress, is_deleted, is_favorite, created_at, updated_at, completed_at,
                        prompts, variables, variables_map, ratio, seed, batch_size, use_polish,
                        is_lumina, lumina_model_name, lumina_cfg, lumina_step
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                """, (
                    task_id,
                    mongo_task.get('task_name', ''),
                    user_id,
                    mongo_task.get('status', 'pending'),
                    mongo_task.get('priority', 1),
                    mongo_task.get('total_images', 0),
                    mongo_task.get('processed_images', 0),
                    mongo_task.get('progress', 0),
                    mongo_task.get('is_deleted', False),
                    False,  # is_favorite
                    created_at,
                    updated_at,
                    mongo_task.get('completed_at'),
                    json.dumps(prompts),
                    json.dumps([]),
                    json.dumps(variables_map),
                    json.dumps(self.create_task_parameter('ratio', '1:1')),
                    json.dumps(self.create_task_parameter('seed', None, format_type='int')),
                    json.dumps(self.create_task_parameter('batch_size', settings.get('batch_size', 1), format_type='int')),
                    json.dumps(self.create_task_parameter('use_polish', settings.get('use_polish', False), format_type='bool')),
                    json.dumps(self.create_task_parameter('is_lumina', False, format_type='bool')),
                    json.dumps(self.create_task_parameter('lumina_model_name', None)),
                    json.dumps(self.create_task_parameter('lumina_cfg', None, format_type='float')),
                    json.dumps(self.create_task_parameter('lumina_step', None, format_type='int'))
                ))

            self.stats['tasks_migrated'] += 1
            return True

        except Exception as e:
            self.stats['tasks_failed'] += 1
            self.logger.error(f"迁移任务失败 {task_id}: {e}")
            return False

    def check_parent_task_exists(self, task_id: str) -> bool:
        """检查父任务是否存在"""
        with self.pg_conn.cursor() as cursor:
            cursor.execute("SELECT 1 FROM nietest_tasks WHERE id = %s", (task_id,))
            return cursor.fetchone() is not None

    def migrate_subtask(self, mongo_subtask: Dict) -> bool:
        """迁移单个子任务，返回是否成功"""
        subtask_id = mongo_subtask.get('id', 'unknown')

        try:
            # 检查是否已存在
            if self.check_existing_subtask(subtask_id):
                self.stats['subtasks_skipped'] += 1
                self.logger.info(f"跳过已存在的子任务: {subtask_id}")
                return True

            # 检查父任务是否存在
            parent_task_id = mongo_subtask.get('parent_task_id')
            if not parent_task_id:
                self.stats['subtasks_failed'] += 1
                self.logger.warning(f"子任务 {subtask_id} 缺少parent_task_id，跳过")
                return False

            if not self.check_parent_task_exists(parent_task_id):
                self.stats['subtasks_orphaned'] += 1
                self.logger.warning(f"子任务 {subtask_id} 的父任务 {parent_task_id} 不存在，跳过")
                return False

            # 转换variable_indices格式
            variable_indices = mongo_subtask.get('variable_indices', [])
            pg_variable_indices = [idx if idx is not None else -1 for idx in variable_indices]

            # 转换prompts格式
            prompts = mongo_subtask.get('prompts', [])

            # 解析result
            result_url = None
            if mongo_subtask.get('result') and isinstance(mongo_subtask['result'], dict):
                result_url = mongo_subtask['result'].get('url')

            # 处理时间字段
            created_at = mongo_subtask.get('created_at')
            if isinstance(created_at, dict) and '$date' in created_at:
                created_at = datetime.fromisoformat(created_at['$date'].replace('Z', '+00:00'))
            elif not isinstance(created_at, datetime):
                created_at = datetime.now()

            updated_at = mongo_subtask.get('updated_at')
            if isinstance(updated_at, dict) and '$date' in updated_at:
                updated_at = datetime.fromisoformat(updated_at['$date'].replace('Z', '+00:00'))
            elif not isinstance(updated_at, datetime):
                updated_at = datetime.now()

            # 插入子任务到PostgreSQL
            with self.pg_conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO nietest_subtasks (
                        id, task_id, status, variable_indices, prompts, ratio, seed, use_polish,
                        batch_size, is_lumina, lumina_model_name, lumina_cfg, lumina_step,
                        timeout_retry_count, error_retry_count, error, created_at, updated_at,
                        started_at, completed_at, result, rating, evaluation
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                """, (
                    subtask_id,
                    mongo_subtask['parent_task_id'],
                    mongo_subtask.get('status', 'pending'),
                    pg_variable_indices,
                    json.dumps(prompts),
                    mongo_subtask.get('ratio', '1:1'),
                    mongo_subtask.get('seed'),
                    mongo_subtask.get('use_polish', False),
                    1,  # batch_size
                    False,  # is_lumina
                    None,  # lumina_model_name
                    None,  # lumina_cfg
                    None,  # lumina_step
                    mongo_subtask.get('retry_count', 0),
                    0,  # error_retry_count
                    mongo_subtask.get('error'),
                    created_at,
                    updated_at,
                    None,  # started_at
                    updated_at if mongo_subtask.get('status') == 'completed' else None,
                    result_url,
                    0,  # rating
                    []  # evaluation
                ))

            self.stats['subtasks_migrated'] += 1
            return True

        except Exception as e:
            self.stats['subtasks_failed'] += 1
            self.logger.error(f"迁移子任务失败 {subtask_id}: {e}")
            return False

    def migrate_all_data(self, dry_run: bool = False):
        """迁移所有数据"""
        try:
            # 连接数据库
            self.connect_mongo()
            if not dry_run:
                self.connect_pg()
                # 初始化test用户
                self.logger.info("初始化test用户...")
                self._test_user_id = self.create_test_user()

            # 获取MongoDB数据
            tasks_collection = self.mongo_db['tasks']
            dramatiq_collection = self.mongo_db['dramatiq_tasks']

            # 统计总数
            self.stats['tasks_total'] = tasks_collection.count_documents({})
            self.stats['subtasks_total'] = dramatiq_collection.count_documents({})

            self.logger.info(f"发现 {self.stats['tasks_total']} 个任务，{self.stats['subtasks_total']} 个子任务")

            if dry_run:
                self.logger.info("DRY RUN 模式 - 不会实际写入数据")
                return

            # 迁移任务
            self.logger.info("开始迁移任务数据...")
            tasks_cursor = tasks_collection.find({})

            for task in tasks_cursor:
                self.migrate_task(task)

                # 每处理一定数量后输出进度
                if (self.stats['tasks_migrated'] + self.stats['tasks_skipped'] + self.stats['tasks_failed']) % 10 == 0:
                    self.logger.info(f"任务进度: {self.stats['tasks_migrated'] + self.stats['tasks_skipped'] + self.stats['tasks_failed']}/{self.stats['tasks_total']}")

            # 迁移子任务
            self.logger.info("开始迁移子任务数据...")
            subtasks_cursor = dramatiq_collection.find({})

            for subtask in subtasks_cursor:
                self.migrate_subtask(subtask)

                # 每处理一定数量后输出进度
                if (self.stats['subtasks_migrated'] + self.stats['subtasks_skipped'] + self.stats['subtasks_failed']) % 50 == 0:
                    self.logger.info(f"子任务进度: {self.stats['subtasks_migrated'] + self.stats['subtasks_skipped'] + self.stats['subtasks_failed']}/{self.stats['subtasks_total']}")

            # 输出最终统计
            self.print_final_stats()

        except Exception as e:
            self.logger.error(f"迁移过程中发生错误: {e}")
            raise
        finally:
            self.close_connections()

    def print_final_stats(self):
        """输出最终统计信息"""
        self.logger.info("=" * 60)
        self.logger.info("迁移完成统计:")
        self.logger.info(f"任务:")
        self.logger.info(f"  总数: {self.stats['tasks_total']}")
        self.logger.info(f"  成功: {self.stats['tasks_migrated']}")
        self.logger.info(f"  跳过: {self.stats['tasks_skipped']}")
        self.logger.info(f"  失败: {self.stats['tasks_failed']}")
        self.logger.info(f"子任务:")
        self.logger.info(f"  总数: {self.stats['subtasks_total']}")
        self.logger.info(f"  成功: {self.stats['subtasks_migrated']}")
        self.logger.info(f"  跳过: {self.stats['subtasks_skipped']}")
        self.logger.info(f"  失败: {self.stats['subtasks_failed']}")
        self.logger.info(f"  孤立: {self.stats['subtasks_orphaned']}")
        self.logger.info(f"用户:")
        self.logger.info(f"  创建: {self.stats['users_created']}")
        self.logger.info("=" * 60)


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='MongoDB到PostgreSQL数据迁移工具 v2.0')
    parser.add_argument('--dry-run', action='store_true', help='试运行模式，不实际写入数据')
    parser.add_argument('--log-file', default='migration_v2.log', help='日志文件路径')

    args = parser.parse_args()

    # 初始化日志
    logger = MigrationLogger(args.log_file)

    logger.info("MongoDB到PostgreSQL数据迁移工具 v2.0")
    logger.info("=" * 60)

    # 显示配置信息
    logger.info("MongoDB配置:")
    logger.info(f"  URI: {MONGO_CONFIG['uri']}")
    logger.info(f"  数据库: {MONGO_CONFIG['database']}")

    logger.info("PostgreSQL配置:")
    for key, value in PG_CONFIG.items():
        if key == 'password':
            logger.info(f"  {key}: {'*' * len(str(value))}")
        else:
            logger.info(f"  {key}: {value}")

    logger.info("迁移选项:")
    for key, value in MIGRATION_OPTIONS.items():
        if 'password' in key.lower():
            logger.info(f"  {key}: {'*' * len(str(value))}")
        else:
            logger.info(f"  {key}: {value}")

    if args.dry_run:
        logger.info("运行模式: DRY RUN (试运行)")
    else:
        logger.info("运行模式: 正式迁移")

    # 确认继续
    if not args.dry_run:
        confirm = input("\n确认开始迁移? (y/N): ").strip().lower()
        if confirm != 'y':
            logger.info("用户取消迁移")
            return

    # 开始迁移
    migrator = MongoToPgMigratorV2(logger)

    try:
        migrator.migrate_all_data(dry_run=args.dry_run)
        if args.dry_run:
            logger.info("DRY RUN 完成")
        else:
            logger.info("迁移完成！")
    except Exception as e:
        logger.error(f"迁移失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()