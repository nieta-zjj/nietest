"""
数据库迁移脚本：为任务表添加is_favorite和variables_map字段

运行方式：
python -m backend.scripts.migrate_task_fields
或者
cd backend && python scripts/migrate_task_fields.py
"""

import sys
import os

# 添加项目根目录到Python路径
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from peewee import BooleanField
from playhouse.postgres_ext import JSONField, PostgresqlExtDatabase
from playhouse.migrate import migrate, PostgresqlMigrator
from dotenv import load_dotenv
from pathlib import Path

# 加载环境变量
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(env_path)


def add_fields():
    """添加is_favorite和variables_map字段"""
    print("开始数据库迁移...")

    # 直接创建数据库连接
    db = PostgresqlExtDatabase(
        os.getenv("TEST_DB_NAME", "database"),
        user=os.getenv("TEST_DB_USER", "postgres"),
        password=os.getenv("TEST_DB_PASSWORD", ""),
        host=os.getenv("TEST_DB_HOST", "localhost"),
        port=int(os.getenv("TEST_DB_PORT", "5432")),
        autoconnect=True
    )

    # 创建迁移器
    migrator = PostgresqlMigrator(db)

    try:
        # 检查字段是否已存在
        table_info = db.get_columns('nietest_tasks')
        existing_columns = [col.name for col in table_info]

        migrations_to_run = []

        # 检查is_favorite字段
        if 'is_favorite' not in existing_columns:
            print("添加is_favorite字段...")
            migrations_to_run.append(
                migrator.add_column('nietest_tasks', 'is_favorite', BooleanField(default=False))
            )
        else:
            print("is_favorite字段已存在，跳过...")

        # 检查variables_map字段
        if 'variables_map' not in existing_columns:
            print("添加variables_map字段...")
            migrations_to_run.append(
                migrator.add_column('nietest_tasks', 'variables_map', JSONField(default={}))
            )
        else:
            print("variables_map字段已存在，跳过...")

        # 执行迁移
        if migrations_to_run:
            migrate(*migrations_to_run)
            print(f"成功执行 {len(migrations_to_run)} 个迁移操作")
        else:
            print("所有字段都已存在，无需迁移")

        # 创建索引（如果不存在）
        try:
            print("检查并创建is_favorite索引...")
            db.execute_sql(
                "CREATE INDEX IF NOT EXISTS nietest_tasks_is_favorite_idx ON nietest_tasks (is_favorite)"
            )
            print("is_favorite索引创建完成")
        except Exception as e:
            print(f"创建索引时出错（可能已存在）: {e}")

        print("数据库迁移完成！")

    except Exception as e:
        print(f"迁移过程中出错: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    add_fields()