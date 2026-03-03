const envApiBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, '')

export const API_BASE =
  envApiBase || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '/api')

export type Project = {
  id: string
  name: string
  updated_at?: string
  json?: Record<string, unknown>
}

export type DiscoverResult = {
  id: string
  title: string
  url: string
  source: string
  thumb?: string | null
  snippet?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  listProjects: () => request<{ projects: Project[] }>('/projects'),
  createProject: (name: string) => request<Project>('/projects', { method: 'POST', body: JSON.stringify({ name }) }),
  getProject: (id: string) => request<Project>(`/projects/${id}`),
  updateProject: (id: string, json: Record<string, unknown>) => request<{ ok: boolean }>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify({ json }) }),
  discover: (provider: 'mealdb' | 'openlibrary' | 'wikipedia', query: string, options: Record<string, unknown> = {}) =>
    request<{ results: DiscoverResult[] }>('/discover/search', { method: 'POST', body: JSON.stringify({ provider, query, options }) }),
}
