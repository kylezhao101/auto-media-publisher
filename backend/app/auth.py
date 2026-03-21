import os
from fastapi import Security, HTTPException, status, Request
from fastapi.security import APIKeyHeader

API_KEY = os.getenv("API_KEY")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(request: Request, key: str = Security(api_key_header)):
    resolved_key = key or request.query_params.get("api_key")
    if not resolved_key or resolved_key != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing API key"
        )