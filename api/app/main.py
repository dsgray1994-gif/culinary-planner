from __future__ import annotations

import os
from typing import Any, Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .storage_pg import ProjectStore

app = FastAPI(title="Culinary Planner API")
store = ProjectStore()
store_ready = False
store_error: str | None = None

origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1)
    json: dict[str, Any] | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    json: dict[str, Any] | None = None


class DiscoverRequest(BaseModel):
    provider: Literal["mealdb", "openlibrary", "wikipedia"]
    query: str
    options: dict[str, Any] = Field(default_factory=dict)


class AiStepRequest(BaseModel):
    project_id: str
    step_id: Literal[
        "master_list",
        "rotation",
        "doc_outline",
        "doc_cover",
        "recipes",
        "prep_map",
        "shopping",
    ]
    inputs: dict[str, Any] = Field(default_factory=dict)


@app.on_event("startup")
def startup() -> None:
    global store_ready, store_error
    try:
        store.init()
        store_ready = True
        store_error = None
    except Exception as exc:
        store_ready = False
        store_error = str(exc)


def _ensure_store_ready() -> None:
    if not store_ready:
        detail = "Database is not configured or reachable. Set DATABASE_URL in Render and redeploy API."
        if store_error:
            detail = f"{detail} Last error: {store_error}"
        raise HTTPException(status_code=503, detail=detail)


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "db": {"ready": store_ready, "error": store_error}}


@app.get("/projects")
def list_projects() -> dict[str, Any]:
    _ensure_store_ready()
    return {"projects": store.list_projects()}


@app.get("/api/projects")
def list_projects_alias() -> dict[str, Any]:
    return list_projects()


@app.post("/projects")
def create_project(payload: ProjectCreate) -> dict[str, Any]:
    _ensure_store_ready()
    return store.create_project(payload.name, payload.json)


@app.post("/api/projects")
def create_project_alias(payload: ProjectCreate) -> dict[str, Any]:
    return create_project(payload)


@app.get("/projects/{project_id}")
def get_project(project_id: str) -> dict[str, Any]:
    _ensure_store_ready()
    project = store.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.get("/api/projects/{project_id}")
def get_project_alias(project_id: str) -> dict[str, Any]:
    return get_project(project_id)


@app.put("/projects/{project_id}")
def update_project(project_id: str, payload: ProjectUpdate) -> dict[str, bool]:
    _ensure_store_ready()
    if not store.update_project(project_id, payload.name, payload.json):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}


@app.put("/api/projects/{project_id}")
def update_project_alias(project_id: str, payload: ProjectUpdate) -> dict[str, bool]:
    return update_project(project_id, payload)


@app.delete("/projects/{project_id}")
def delete_project(project_id: str) -> dict[str, bool]:
    _ensure_store_ready()
    if not store.delete_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}


@app.delete("/api/projects/{project_id}")
def delete_project_alias(project_id: str) -> dict[str, bool]:
    return delete_project(project_id)


async def _search_mealdb(query: str, options: dict[str, Any]) -> list[dict[str, Any]]:
    mode = options.get("mode", "name")
    if mode == "ingredient":
        endpoint = "filter.php"
        param = "i"
    elif mode == "area":
        endpoint = "filter.php"
        param = "a"
    else:
        endpoint = "search.php"
        param = "s"

    url = f"https://www.themealdb.com/api/json/v1/1/{endpoint}?{param}={query}"
    async with httpx.AsyncClient(timeout=15) as client:
        data = (await client.get(url)).json()
    meals = data.get("meals") or []
    return [
        {
            "id": item.get("idMeal"),
            "title": item.get("strMeal"),
            "url": f"https://www.themealdb.com/meal/{item.get('idMeal')}",
            "source": "mealdb",
            "thumb": item.get("strMealThumb"),
            "snippet": item.get("strArea") or item.get("strCategory") or "",
        }
        for item in meals
    ]


async def _search_openlibrary(query: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=15) as client:
        data = (await client.get("https://openlibrary.org/search.json", params={"q": query, "limit": 10})).json()
    return [
        {
            "id": doc.get("key"),
            "title": doc.get("title"),
            "url": f"https://openlibrary.org{doc.get('key')}",
            "source": "openlibrary",
            "thumb": f"https://covers.openlibrary.org/b/id/{doc.get('cover_i')}-M.jpg" if doc.get("cover_i") else None,
            "snippet": ", ".join(doc.get("author_name", [])[:2]),
        }
        for doc in data.get("docs", [])
    ]


async def _search_wikipedia(query: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=15) as client:
        data = (
            await client.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query",
                    "list": "search",
                    "srsearch": query,
                    "format": "json",
                    "utf8": 1,
                    "srlimit": 10,
                },
            )
        ).json()
    results = data.get("query", {}).get("search", [])
    return [
        {
            "id": str(item.get("pageid")),
            "title": item.get("title"),
            "url": f"https://en.wikipedia.org/?curid={item.get('pageid')}",
            "source": "wikipedia",
            "thumb": None,
            "snippet": item.get("snippet", "").replace("<span class=\"searchmatch\">", "").replace("</span>", ""),
        }
        for item in results
    ]


@app.post("/discover/search")
async def discover_search(payload: DiscoverRequest) -> dict[str, Any]:
    if payload.provider == "mealdb":
        results = await _search_mealdb(payload.query, payload.options)
    elif payload.provider == "openlibrary":
        results = await _search_openlibrary(payload.query)
    else:
        results = await _search_wikipedia(payload.query)
    return {"results": results}


@app.post("/api/discover/search")
async def discover_search_alias(payload: DiscoverRequest) -> dict[str, Any]:
    return await discover_search(payload)


@app.post("/ai/step")
def ai_step(payload: AiStepRequest) -> dict[str, Any]:
    return {
        "result": {
            "project_id": payload.project_id,
            "step_id": payload.step_id,
            "summary": f"Generated placeholder output for {payload.step_id}",
            "inputs": payload.inputs,
        }
    }


@app.post("/api/ai/step")
def ai_step_alias(payload: AiStepRequest) -> dict[str, Any]:
    return ai_step(payload)
