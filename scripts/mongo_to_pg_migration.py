#!/usr/bin/env python3
"""
MongoDB到PostgreSQL数据迁移脚本

将MongoDB中的tasks和dramatiq_task数据迁移到PostgreSQL数据库
"""

import os
import sys
import json
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional
import logging

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pymongo
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
    from dotenv import load_dotenv
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

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('migration.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 默认测试用户配置
DEFAULT_TEST_USER = {
    'username': os.getenv('TEST_USER_USERNAME', 'test'),
    'password_hash': os.getenv('TEST_USER_PASSWORD_HASH', 'test_user_password_hash'),
    'roles': ['user']
}


class MongoToPgMigrator:
    """MongoDB到PostgreSQL迁移器"""

    def __init__(self):
        # MongoDB连接配置
        self.mongo_uri = os.getenv('MONGO_URI')
        self.mongo_db_name = os.getenv('MONGO_DATABASE')

        # PostgreSQL连接配置 - 需要根据实际环境配置
        self.pg_config = {
            'host': os.getenv('PG_HOST'),
            'port': int(os.getenv('PG_PORT')),
            'database': os.getenv('PG_DATABASE'),
            'user': os.getenv('PG_USER'),
            'password': os.getenv('PG_PASSWORD')
        }

        self.mongo_client = None
        self.pg_conn = None

    def connect_mongo(self):
        """连接MongoDB"""
        try:
            self.mongo_client = pymongo.MongoClient(self.mongo_uri)
            self.mongo_db = self.mongo_client[self.mongo_db_name]
            logger.info("MongoDB连接成功")
        except Exception as e:
            logger.error(f"MongoDB连接失败: {e}")
            raise

    def connect_pg(self):
        """连接PostgreSQL"""
        try:
            self.pg_conn = psycopg2.connect(**self.pg_config)
            self.pg_conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            logger.info("PostgreSQL连接成功")
        except Exception as e:
            logger.error(f"PostgreSQL连接失败: {e}")
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
                logger.info(f"找到已存在的test用户 (ID: {user_id})")
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

            logger.info(f"创建test用户: {DEFAULT_TEST_USER['username']} (ID: {user_id})")
            return user_id

    def ensure_user_exists(self, username: str) -> str:
        """确保用户存在，如果不存在则创建，返回用户ID"""
        # 始终返回test用户ID，不再根据username创建不同用户
        if not hasattr(self, '_test_user_id'):
            self._test_user_id = self.create_test_user()

        # 记录原始用户名用于日志
        if username != DEFAULT_TEST_USER['username']:
            logger.info(f"将用户 {username} 的数据分配给test用户")

        return self._test_user_id

    def convert_mongo_tags_to_pg_prompts(self, tags: List[Dict]) -> List[Dict]:
        """将MongoDB的tags转换为PostgreSQL的prompts格式"""
        prompts = []

        for tag in tags:
            if tag.get('type') == 'element':
                # 元素类型转换为elementum类型
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
            elif tag.get('type') == 'prompt' and tag.get('isVariable'):
                # 变量提示词类型，在variables中处理，这里不添加到prompts
                continue
            elif tag.get('type') in ['polish', 'batch']:
                # 这些类型在settings中处理，不添加到prompts
                continue

        return prompts

    def convert_mongo_variables_to_pg_format(self, variables: Dict, tags: List[Dict]) -> Dict:
        """将MongoDB的variables转换为PostgreSQL格式"""
        pg_variables = {}

        # 找到变量类型的tags
        variable_tags = {tag['id']: tag for tag in tags if tag.get('isVariable', False)}

        for var_key, var_data in variables.items():
            if var_data.get('values') and len(var_data['values']) > 0:
                # 找到对应的tag
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
        settings = {
            'maxThreads': 4,
            'xToken': ''
        }

        for tag in tags:
            if tag.get('type') == 'batch':
                settings['batch_size'] = int(tag.get('value', 1))
            elif tag.get('type') == 'polish':
                settings['use_polish'] = tag.get('value', 'false').lower() == 'true'

        return settings

    def migrate_task(self, mongo_task: Dict) -> str:
        """迁移单个任务"""
        try:
            # 确保用户存在
            user_id = self.ensure_user_exists(mongo_task['username'])

            # 转换数据格式
            prompts = self.convert_mongo_tags_to_pg_prompts(mongo_task.get('tags', []))
            variables_map = self.convert_mongo_variables_to_pg_format(
                mongo_task.get('variables', {}),
                mongo_task.get('tags', [])
            )
            settings = self.extract_settings_from_tags(mongo_task.get('tags', []))

            # 创建任务参数对象
            def create_task_parameter(param_type: str, value: Any, is_variable: bool = False, format_type: str = 'string'):
                return {
                    'type': param_type,
                    'value': value,
                    'is_variable': is_variable,
                    'format': format_type
                }

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
                    mongo_task['id'],
                    mongo_task.get('task_name', ''),
                    user_id,
                    mongo_task.get('status', 'pending'),
                    mongo_task.get('priority', 1),
                    mongo_task.get('total_images', 0),
                    mongo_task.get('processed_images', 0),
                    mongo_task.get('progress', 0),
                    mongo_task.get('is_deleted', False),
                    False,  # is_favorite
                    mongo_task.get('created_at', datetime.now()),
                    mongo_task.get('updated_at', datetime.now()),
                    mongo_task.get('completed_at'),
                    json.dumps(prompts),  # prompts
                    json.dumps([]),  # variables (空数组)
                    json.dumps(variables_map),  # variables_map
                    json.dumps(create_task_parameter('ratio', '1:1')),
                    json.dumps(create_task_parameter('seed', None, format_type='int')),
                    json.dumps(create_task_parameter('batch_size', settings.get('batch_size', 1), format_type='int')),
                    json.dumps(create_task_parameter('use_polish', settings.get('use_polish', False), format_type='bool')),
                    json.dumps(create_task_parameter('is_lumina', False, format_type='bool')),
                    json.dumps(create_task_parameter('lumina_model_name', None)),
                    json.dumps(create_task_parameter('lumina_cfg', None, format_type='float')),
                    json.dumps(create_task_parameter('lumina_step', None, format_type='int'))
                ))

            logger.info(f"成功迁移任务: {mongo_task['id']}")
            return mongo_task['id']

        except Exception as e:
            logger.error(f"迁移任务失败 {mongo_task.get('id', 'unknown')}: {e}")
            raise

    def migrate_subtask(self, mongo_subtask: Dict):
        """迁移单个子任务"""
        try:
            # 转换variable_indices格式
            variable_indices = mongo_subtask.get('variable_indices', [])
            # 将null值转换为-1，因为PostgreSQL数组不支持null元素
            pg_variable_indices = [idx if idx is not None else -1 for idx in variable_indices]

            # 转换prompts格式
            prompts = mongo_subtask.get('prompts', [])

            # 解析result
            result_url = None
            if mongo_subtask.get('result') and isinstance(mongo_subtask['result'], dict):
                result_url = mongo_subtask['result'].get('url')

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
                    mongo_subtask['id'],
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
                    mongo_subtask.get('retry_count', 0),  # timeout_retry_count
                    0,  # error_retry_count
                    mongo_subtask.get('error'),
                    mongo_subtask.get('created_at', datetime.now()),
                    mongo_subtask.get('updated_at', datetime.now()),
                    None,  # started_at
                    mongo_subtask.get('updated_at') if mongo_subtask.get('status') == 'completed' else None,
                    result_url,
                    0,  # rating (默认未评分)
                    []  # evaluation (空数组)
                ))

            logger.info(f"成功迁移子任务: {mongo_subtask['id']}")

        except Exception as e:
            logger.error(f"迁移子任务失败 {mongo_subtask.get('id', 'unknown')}: {e}")
            raise

    def migrate_all_data(self):
        """迁移所有数据"""
        try:
            # 连接数据库
            self.connect_mongo()
            self.connect_pg()

            # 初始化test用户
            logger.info("初始化test用户...")
            self._test_user_id = self.create_test_user()

            # 获取MongoDB数据
            tasks_collection = self.mongo_db['tasks']
            dramatiq_collection = self.mongo_db['dramatiq_tasks']

            # 迁移任务
            logger.info("开始迁移任务数据...")
            tasks = list(tasks_collection.find({}))
            migrated_tasks = 0

            for task in tasks:
                try:
                    self.migrate_task(task)
                    migrated_tasks += 1
                except Exception as e:
                    logger.error(f"跳过任务 {task.get('id', 'unknown')}: {e}")
                    continue

            logger.info(f"任务迁移完成: {migrated_tasks}/{len(tasks)}")

            # 迁移子任务
            logger.info("开始迁移子任务数据...")
            subtasks = list(dramatiq_collection.find({}))
            migrated_subtasks = 0

            for subtask in subtasks:
                try:
                    self.migrate_subtask(subtask)
                    migrated_subtasks += 1
                except Exception as e:
                    logger.error(f"跳过子任务 {subtask.get('id', 'unknown')}: {e}")
                    continue

            logger.info(f"子任务迁移完成: {migrated_subtasks}/{len(subtasks)}")

            # 输出迁移统计
            logger.info("=" * 50)
            logger.info("迁移完成统计:")
            logger.info(f"任务: {migrated_tasks}/{len(tasks)}")
            logger.info(f"子任务: {migrated_subtasks}/{len(subtasks)}")
            logger.info("=" * 50)

        except Exception as e:
            logger.error(f"迁移过程中发生错误: {e}")
            raise
        finally:
            self.close_connections()


def main():
    """主函数"""
    print("MongoDB到PostgreSQL数据迁移工具")
    print("=" * 50)

    # 检查PostgreSQL连接配置
    migrator = MongoToPgMigrator()

    # 提示用户确认配置
    print("请确认PostgreSQL连接配置:")
    for key, value in migrator.pg_config.items():
        if key == 'password':
            print(f"  {key}: {'*' * len(str(value))}")
        else:
            print(f"  {key}: {value}")

    confirm = input("\n配置正确吗? (y/N): ").strip().lower()
    if confirm != 'y':
        print("请修改脚本中的pg_config配置后重新运行")
        return

    # 开始迁移
    try:
        migrator.migrate_all_data()
        print("\n迁移完成！请检查migration.log文件查看详细日志。")
    except Exception as e:
        print(f"\n迁移失败: {e}")
        print("请检查migration.log文件查看详细错误信息。")
        sys.exit(1)


if __name__ == "__main__":
    main()