from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
import os
import httpx
import logging
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI(title="ShinDora Nesub API Gateway")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Target Next.js server running on port 3000
NEXTJS_URL = os.environ.get("NEXTJS_INTERNAL_URL", "http://127.0.0.1:3000")

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "shindora-backend", "target": NEXTJS_URL}

# Reverse Proxy all /api/* requests directly to Next.js API handler on port 3000
@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
async def proxy_to_nextjs(request: Request, path: str):
    target_url = f"{NEXTJS_URL}/api/{path}"
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"
    
    body = await request.body()
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("content-length", None)
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            req = client.build_request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body if body else None,
            )
            response = await client.send(req)
            
            resp_headers = dict(response.headers)
            resp_headers.pop("content-encoding", None)
            resp_headers.pop("content-length", None)
            
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=resp_headers
            )
        except Exception as e:
            logger.error(f"Proxy error to {target_url}: {e}")
            return JSONResponse(
                status_code=502,
                content={"error": "Failed to connect to Next.js server", "detail": str(e)}
            )
