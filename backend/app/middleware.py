"""Small, dependency-free HTTP boundary protections.

The application stays deployable as one FastAPI process, while its edge behavior
is explicit and testable: bounded bodies, abuse throttles, secure response headers,
and traceable request IDs. A multi-instance deployment should replace the local
rate-limit store with a shared edge/Redis limiter.
"""
from __future__ import annotations

import math
import re
import threading
import time
import uuid
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable

from starlette.datastructures import MutableHeaders
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from . import config

_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_WRITE_METHODS = {"POST", "PUT", "PATCH"}
_JSON_ENDPOINTS = {"/auth/login", "/auth/register", "/contact", "/newsletter"}


class BodyLimitMiddleware:
    """Reject oversized bodies before Pydantic, hashing, or database work."""

    def __init__(self, app: ASGIApp, max_bytes: int = config.MAX_BODY_BYTES) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("method") not in _WRITE_METHODS:
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        declared = headers.get(b"content-length")
        if declared:
            try:
                if int(declared) > self.max_bytes:
                    await self._reject(scope, receive, send)
                    return
            except ValueError:
                await self._reject(scope, receive, send, "Invalid Content-Length")
                return

        # Also count streamed/chunked bodies; do not trust Content-Length alone.
        buffered: list[Message] = []
        received = 0
        while True:
            message = await receive()
            buffered.append(message)
            if message["type"] != "http.request":
                break
            received += len(message.get("body", b""))
            if received > self.max_bytes:
                await self._reject(scope, receive, send)
                return
            if not message.get("more_body", False):
                break

        cursor = 0

        async def replay() -> Message:
            nonlocal cursor
            if cursor < len(buffered):
                message = buffered[cursor]
                cursor += 1
                return message
            return {"type": "http.disconnect"}

        await self.app(scope, replay, send)

    @staticmethod
    async def _reject(
        scope: Scope, receive: Receive, send: Send, detail: str = "Request body too large"
    ) -> None:
        await JSONResponse({"detail": detail}, status_code=413)(scope, receive, send)


class JsonContentTypeMiddleware:
    """Keep JSON write routes out of browser form and content-sniffing paths."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] == "http"
            and scope.get("method") == "POST"
            and scope.get("path") in _JSON_ENDPOINTS
        ):
            raw = dict(scope.get("headers", [])).get(b"content-type", b"")
            media_type = raw.decode("latin-1").split(";", 1)[0].strip().lower()
            if media_type != "application/json" and not media_type.endswith("+json"):
                await JSONResponse(
                    {"detail": "Content-Type must be application/json"}, status_code=415
                )(scope, receive, send)
                return
        await self.app(scope, receive, send)


class SecurityHeadersMiddleware:
    """Add safe defaults and a request ID to every HTTP response."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = dict(scope.get("headers", [])).get(b"x-request-id", b"").decode(
            "ascii", errors="ignore"
        )
        request_id = incoming if _SAFE_REQUEST_ID.fullmatch(incoming) else uuid.uuid4().hex

        async def secure_send(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["X-Request-ID"] = request_id
                headers["X-Content-Type-Options"] = "nosniff"
                headers["X-Frame-Options"] = "DENY"
                headers["Referrer-Policy"] = "no-referrer"
                headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
                headers["Cross-Origin-Resource-Policy"] = "same-site"
                headers["Cross-Origin-Opener-Policy"] = "same-origin"
                headers["Content-Security-Policy"] = (
                    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; "
                    "form-action 'none'"
                )
                headers["X-Permitted-Cross-Domain-Policies"] = "none"
                headers["X-DNS-Prefetch-Control"] = "off"
                headers["Cache-Control"] = "no-store"
                if config.production() or scope.get("scheme") == "https":
                    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            await send(message)

        await self.app(scope, receive, secure_send)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Bound high-risk writes per client without collecting durable IP data."""

    # path: (requests, window seconds)
    RULES = {
        "/auth/login": (10, 60),
        "/auth/register": (5, 3600),
        "/contact": (5, 3600),
        "/newsletter": (10, 3600),
    }

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self._buckets: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()
        self._last_prune = time.monotonic()

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        rule = self.RULES.get(request.url.path) if request.method == "POST" else None
        if rule is None:
            return await call_next(request)

        limit, window = rule
        client = request.client.host if request.client else "unknown"
        key = (request.url.path, client)
        now = time.monotonic()
        with self._lock:
            if now - self._last_prune >= 300:
                stale_before = now - max(window for _, window in self.RULES.values())
                stale = [key for key, values in self._buckets.items() if not values or values[-1] <= stale_before]
                for stale_key in stale:
                    del self._buckets[stale_key]
                self._last_prune = now
            bucket = self._buckets[key]
            while bucket and bucket[0] <= now - window:
                bucket.popleft()
            if len(bucket) >= limit:
                retry_after = max(1, math.ceil(window - (now - bucket[0])))
                return JSONResponse(
                    {"detail": "Too many requests. Please try again later."},
                    status_code=429,
                    headers={"Retry-After": str(retry_after)},
                )
            bucket.append(now)
            remaining = max(0, limit - len(bucket))

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
