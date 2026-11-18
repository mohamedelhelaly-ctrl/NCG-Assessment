from slowapi import Limiter
from slowapi.util import get_remote_address

# Per-process, in-memory limiter. Behind Railway's proxy uvicorn runs with --proxy-headers,
# so the key is the real client address. Move to Redis before running several workers.
limiter = Limiter(key_func=get_remote_address, default_limits=[])
