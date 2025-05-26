"""
中间件模块

提供请求处理中间件
"""
import time
import logging
import json
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

# 配置日志
logger = logging.getLogger(__name__)

class DatabaseMiddleware(BaseHTTPMiddleware):
    """
    数据库连接中间件

    确保每个请求都有正确的数据库连接
    """

    def __init__(self, app: ASGIApp):
        """
        初始化中间件

        Args:
            app: ASGI应用
        """
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        """
        处理请求

        Args:
            request: 请求对象
            call_next: 下一个处理函数

        Returns:
            响应对象
        """
        # 检查数据库连接状态
        from backend.models.db.base import BaseModel
        from backend.db.initialization import reconnect_test_db
        import peewee

        try:
            # 检查数据库连接是否有效
            if not BaseModel.check_database_connected():
                logger.warning("数据库连接已关闭，正在重新初始化...")
                reconnect_test_db()
                logger.info("数据库连接已重新初始化")

            # 处理请求
            response = await call_next(request)
            return response

        except (peewee.InterfaceError, peewee.OperationalError, peewee.DatabaseError) as e:
            # 数据库连接错误，尝试重新连接
            logger.error(f"数据库连接错误: {str(e)}")
            try:
                logger.info("尝试重新连接数据库...")
                reconnect_test_db()
                logger.info("数据库重新连接成功，重新处理请求")

                # 重新处理请求
                response = await call_next(request)
                return response
            except Exception as reconnect_error:
                logger.error(f"数据库重新连接失败: {str(reconnect_error)}")
                raise e
        except Exception as e:
            logger.error(f"中间件处理请求时发生未知错误: {str(e)}")
            raise


class LoggingMiddleware(BaseHTTPMiddleware):
    """
    日志记录中间件

    记录请求和响应的详细信息
    """

    def __init__(self, app: ASGIApp):
        """
        初始化中间件

        Args:
            app: ASGI应用
        """
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        """
        处理请求

        Args:
            request: 请求对象
            call_next: 下一个处理函数

        Returns:
            响应对象
        """
        # 记录请求开始时间
        start_time = time.time()

        # 获取请求信息
        method = request.method
        url = str(request.url)
        client_host = request.client.host if request.client else "unknown"

        # 记录请求信息
        logger.info(f"开始处理请求: {method} {url} - 客户端: {client_host}")

        # 尝试获取请求体
        try:
            body = await request.body()
            if body:
                body_str = body.decode("utf-8")
                # 如果是JSON，格式化输出
                try:
                    json_body = json.loads(body_str)
                    logger.debug(f"请求体: {json.dumps(json_body, ensure_ascii=False, indent=2)}")
                except:
                    # 如果不是JSON，直接输出
                    logger.debug(f"请求体: {body_str}")
        except Exception as e:
            logger.debug(f"无法读取请求体: {str(e)}")

        # 处理请求
        try:
            response = await call_next(request)

            # 计算处理时间
            process_time = time.time() - start_time

            # 记录响应信息
            logger.info(
                f"请求处理完成: {method} {url} - 状态码: {response.status_code} - 耗时: {process_time:.4f}秒"
            )

            # 添加处理时间到响应头
            response.headers["X-Process-Time"] = str(process_time)

            return response
        except Exception as e:
            # 记录异常信息
            process_time = time.time() - start_time
            logger.error(
                f"请求处理异常: {method} {url} - 异常: {str(e)} - 耗时: {process_time:.4f}秒"
            )
            raise
