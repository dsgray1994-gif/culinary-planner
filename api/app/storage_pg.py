from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool


class ProjectStore:
    def __init__(self) -> None:
        self.database_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/culinary_planner")
        self.pool = ConnectionPool(self.database_url, kwargs={"autocommit": True})

    def init(self) -> None:
        with self.pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS projects (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        json JSONB NOT NULL DEFAULT '{}'::jsonb,
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )

    def list_projects(self) -> list[dict[str, Any]]:
        with self.pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT id, name, updated_at FROM projects ORDER BY updated_at DESC")
                rows = cur.fetchall()
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            }
            for row in rows
        ]

    def create_project(self, name: str, project_json: dict[str, Any] | None = None) -> dict[str, Any]:
        project_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        payload = project_json or {"created_at": now}

        with self.pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO projects (id, name, json, updated_at) VALUES (%s, %s, %s::jsonb, NOW())",
                    (project_id, name, json.dumps(payload)),
                )
        return {"id": project_id, "name": name, "json": payload}

    def get_project(self, project_id: str) -> dict[str, Any] | None:
        with self.pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT id, name, json FROM projects WHERE id = %s", (project_id,))
                row = cur.fetchone()
        if not row:
            return None
        return {"id": row["id"], "name": row["name"], "json": row["json"]}

    def update_project(self, project_id: str, name: str | None, project_json: dict[str, Any] | None) -> bool:
        assignments = []
        values: list[Any] = []
        if name is not None:
            assignments.append("name = %s")
            values.append(name)
        if project_json is not None:
            assignments.append("json = %s::jsonb")
            values.append(json.dumps(project_json))
        assignments.append("updated_at = NOW()")
        values.append(project_id)

        with self.pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(f"UPDATE projects SET {', '.join(assignments)} WHERE id = %s", values)
                return cur.rowcount > 0

    def delete_project(self, project_id: str) -> bool:
        with self.pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM projects WHERE id = %s", (project_id,))
                return cur.rowcount > 0
