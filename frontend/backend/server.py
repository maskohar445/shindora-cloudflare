from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
import httpx
import os
import logging
from pathlib import Path

ROOT_DIR = Path(__file__).parent

NEXTJS_URL = os.environ.get('NEXTJS_URL', 'http://127.0.0.1:3000').rstrip('/')

app = FastAPI()

@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy_to_nextjs(request: Request, path: str):
    target_url = f"{NEXTJS_URL}/api/{path}"
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"
    
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("content-length", None)
    
    body = await request.body()
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            res = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body if body else None,
                follow_redirects=True
            )
            response_headers = dict(res.headers)
            response_headers.pop("content-encoding", None)
            response_headers.pop("content-length", None)
            response_headers.pop("transfer-encoding", None)
            return Response(
                content=res.content,
                status_code=res.status_code,
                headers=response_headers,
                media_type=res.headers.get("content-type")
            )
        except Exception as e:
            return JSONResponse(
                status_code=502,
                content={"error": "Failed to connect to Next.js API", "details": str(e)}
            )

@app.get("/api")
async def root_api():
    return {"status": "ok", "service": "ShinDora-Nesub"}
