"""
错误处理模块

提供全局异常处理和错误响应
"""
import sys
import traceback
import logging
from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

from backend.api.schemas.common import APIResponse
from backend.api.responses import JSONResponse

# 配置日志
logger = logging.getLogger(__name__)

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    请求验证异常处理器

    处理请求参数验证失败的情况

    Args:
        request: 请求对象
        exc: 验证异常

    Returns:
        JSON响应，包含错误详情
    """
    # 记录错误日志
    error_location = ".".join([str(loc) for loc in exc.errors()[0]["loc"]]) if exc.errors() else "unknown"
    logger.error(f"请求验证错误: {error_location} - {exc}")

    # 构建错误响应
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=APIResponse(
            code=422,
            message="请求参数验证失败",
            data={
                "detail": exc.errors(),
                "body": exc.body
            }
        ).model_dump()
    )

async def pydantic_validation_exception_handler(request: Request, exc: ValidationError):
    """
    Pydantic验证异常处理器

    处理数据模型验证失败的情况

    Args:
        request: 请求对象
        exc: 验证异常

    Returns:
        JSON响应，包含错误详情
    """
    # 记录错误日志
    logger.error(f"数据验证错误: {exc}")

    # 构建错误响应
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=APIResponse(
            code=422,
            message="数据验证失败",
            data={
                "detail": exc.errors()
            }
        ).model_dump()
    )

async def http_exception_handler(request: Request, exc):
    """
    HTTP异常处理器

    处理HTTP异常

    Args:
        request: 请求对象
        exc: HTTP异常

    Returns:
        JSON响应，包含错误详情
    """
    # 记录错误日志
    logger.error(f"HTTP错误: {exc.status_code} - {exc.detail}")

    # 构建错误响应
    return JSONResponse(
        status_code=exc.status_code,
        content=APIResponse(
            code=exc.status_code,
            message=str(exc.detail),
            data=None
        ).model_dump()
    )

async def general_exception_handler(request: Request, exc: Exception):
    """
    通用异常处理器

    处理所有未捕获的异常

    Args:
        request: 请求对象
        exc: 异常

    Returns:
        JSON响应，包含错误详情
    """
    # 获取异常信息和堆栈跟踪
    exc_type, exc_value, exc_traceback = sys.exc_info()
    stack_trace = traceback.format_exception(exc_type, exc_value, exc_traceback)

    # 记录详细错误日志
    logger.error(f"未处理的异常: {exc}")
    logger.error("".join(stack_trace))

    # 构建错误响应
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=APIResponse(
            code=500,
            message="服务器内部错误",
            data={
                "error": str(exc),
                "type": exc.__class__.__name__,
                "stack_trace": stack_trace if logger.level <= logging.DEBUG else None
            }
        ).model_dump()
    )
