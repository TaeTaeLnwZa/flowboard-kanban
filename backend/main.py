"""FastAPI gateway for a public, shared Supabase Kanban board."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal
from uuid import UUID

import httpx
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "frontend" / "dist"
app = FastAPI(title="Flowboard API")


class TaskInput(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    status: Literal["todo", "doing", "done"] = "todo"
    priority: Literal["low", "medium", "high"] = "medium"
    due_date: str | None = None


class TaskPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    status: Literal["todo", "doing", "done"] | None = None
    priority: Literal["low", "medium", "high"] | None = None
    due_date: str | None = None


def settings() -> tuple[str, str]:
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
    if not url.startswith("https://") or not key:
        raise HTTPException(503, "Supabase is not configured")
    return url, key


async def database_request(
    method: str,
    *,
    task_id: UUID | None = None,
    data: dict | None = None,
) -> list[dict]:
    url, key = settings()
    headers = {
        "apikey": key,
        "Accept": "application/json",
        "Prefer": "return=representation",
    }
    params = {"select": "id,title,description,status,priority,due_date,created_at"}
    if task_id:
        params["id"] = f"eq.{task_id}"
    if method == "GET":
        params["order"] = "created_at.asc"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            result = await client.request(
                method, f"{url}/rest/v1/kanban_tasks", headers=headers, params=params, json=data
            )
    except httpx.RequestError as exc:
        raise HTTPException(502, "Database is unavailable") from exc
    if result.status_code >= 400:
        if result.status_code in (401, 403):
            raise HTTPException(result.status_code, "Your session is invalid or access was denied")
        raise HTTPException(502, "Database request failed")
    return result.json() if result.content else []


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tasks")
async def list_tasks() -> list[dict]:
    return await database_request("GET")


@app.post("/api/tasks", status_code=201)
async def create_task(task: TaskInput) -> dict:
    data = task.model_dump()
    data["title"] = data["title"].strip()
    if not data["title"]:
        raise HTTPException(422, "Title cannot be blank")
    result = await database_request("POST", data=data)
    return result[0]


@app.patch("/api/tasks/{task_id}")
async def update_task(task_id: UUID, task: TaskPatch) -> dict:
    data = task.model_dump(exclude_unset=True)
    if "title" in data:
        data["title"] = (data["title"] or "").strip()
        if not data["title"]:
            raise HTTPException(422, "Title cannot be blank")
    if not data:
        raise HTTPException(422, "No changes supplied")
    result = await database_request("PATCH", task_id=task_id, data=data)
    if not result:
        raise HTTPException(404, "Task not found")
    return result[0]


@app.delete("/api/tasks/{task_id}", status_code=204)
async def delete_task(task_id: UUID) -> Response:
    result = await database_request("DELETE", task_id=task_id)
    if not result:
        raise HTTPException(404, "Task not found")
    return Response(status_code=204)


if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


@app.get("/{path:path}", include_in_schema=False)
def frontend(path: str) -> FileResponse:
    if not DIST.is_dir():
        raise HTTPException(404, "Frontend has not been built")
    file = DIST / path
    if path and file.is_file() and DIST in file.resolve().parents:
        return FileResponse(file)
    return FileResponse(DIST / "index.html")
