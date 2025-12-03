"""Request ID middleware for API request tracking and troubleshooting."""

import logging
import time
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

# Context variable for request_id (accessible throughout request lifecycle)
request_id_var: ContextVar[str] = ContextVar("request_id", default="")

logger = logging.getLogger("request")


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Middleware to generate and track request IDs for all API requests."""

    async def dispatch(self, request: Request, call_next):
        # Use client-provided request_id or generate new one
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request_id_var.set(request_id)

        # Record start time
        start_time = time.time()

        # Log request start
        logger.info(f"[{request_id}] {request.method} {request.url.path}")

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000

        # Add request_id to response header
        response.headers["X-Request-ID"] = request_id

        # Log request completion
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} -> {response.status_code} ({duration_ms:.0f}ms)"
        )

        return response


def get_request_id() -> str:
    """Get current request_id from context.

    Can be used in services/handlers to include request_id in logs.
    """
    return request_id_var.get()
