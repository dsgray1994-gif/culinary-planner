import { FormEvent, useEffect, useMemo, useState } from 'react'
import { api, DiscoverResult, Project } from './api'
import './styles.css'

type PersistedProjectJson = {
  overview?: string
  sources?: DiscoverResult[]
}

const defaultProjectJson: PersistedProjectJson = {
  overview: '',
  sources: [],
}

function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectName, setProjectName] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [projectJson, setProjectJson] = useState<PersistedProjectJson>(defaultProjectJson)
  const [sources, setSources] = useState<DiscoverResult[]>([])
  const [query, setQuery] = useState('chicken')
  const [provider, setProvider] = useState<'mealdb' | 'openlibrary' | 'wikipedia'>('mealdb')
  const [error, setError] = useState('')
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [saving, setSaving] = useState(false)

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )

  async function loadProjects() {
    setLoadingProjects(true)
    setError('')
    try {
      const data = await api.listProjects()
      setProjects(data.projects)
      if (!selectedProjectId && data.projects.length > 0) {
        setSelectedProjectId(data.projects[0].id)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoadingProjects(false)
    }
  }

  async function loadProject(projectId: string) {
    setError('')
    try {
      const project = await api.getProject(projectId)
      const nextJson = (project.json as PersistedProjectJson | undefined) ?? defaultProjectJson
      setProjectJson({
        overview: nextJson.overview ?? '',
        sources: nextJson.sources ?? [],
      })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  useEffect(() => {
    loadProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedProjectId) {
      loadProject(selectedProjectId)
    }
  }, [selectedProjectId])

  async function createProject(e: FormEvent) {
    e.preventDefault()
    if (!projectName.trim()) return
    setError('')
    try {
      const project = await api.createProject(projectName.trim())
      setProjectName('')
      await loadProjects()
      setSelectedProjectId(project.id)
      setProjectJson(defaultProjectJson)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function runDiscover(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoadingSearch(true)
    setError('')
    try {
      const data = await api.discover(provider, query)
      setSources(data.results)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoadingSearch(false)
    }
  }

  async function saveProject(next: PersistedProjectJson) {
    if (!selectedProjectId) return
    setSaving(true)
    setError('')
    try {
      await api.updateProject(selectedProjectId, next as Record<string, unknown>)
      setProjectJson(next)
      await loadProjects()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function saveSource(result: DiscoverResult) {
    if (!selectedProjectId) return
    const alreadySaved = (projectJson.sources ?? []).some((source) => source.id === result.id && source.source === result.source)
    if (alreadySaved) return
    const nextSources = [...(projectJson.sources ?? []), result]
    await saveProject({ ...projectJson, sources: nextSources })
  }

  async function removeSource(result: DiscoverResult) {
    if (!selectedProjectId) return
    const nextSources = (projectJson.sources ?? []).filter(
      (source) => !(source.id === result.id && source.source === result.source),
    )
    await saveProject({ ...projectJson, sources: nextSources })
  }

  return (
    <main className="layout">
      <header className="hero">
        <h1>Culinary Planner</h1>
        <p>Build meal projects, discover references, and persist work in Postgres.</p>
        <code>API: {import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'}</code>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="grid">
        <section className="card">
          <h2>Projects</h2>
          <form onSubmit={createProject} className="row">
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project name"
              aria-label="Project name"
            />
            <button type="submit">Create</button>
          </form>
          <div className="list">
            {loadingProjects ? (
              <p>Loading projects…</p>
            ) : projects.length === 0 ? (
              <p>No projects yet. Create your first one.</p>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  className={project.id === selectedProjectId ? 'list-item active' : 'list-item'}
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <span>{project.name}</span>
                  <small>{project.updated_at ? new Date(project.updated_at).toLocaleString() : ''}</small>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="card">
          <h2>Project Brief</h2>
          {!selectedProject ? (
            <p>Select a project to edit details.</p>
          ) : (
            <>
              <p className="muted">{selectedProject.name}</p>
              <textarea
                rows={6}
                placeholder="Describe goals, dietary constraints, and timeline..."
                value={projectJson.overview ?? ''}
                onChange={(e) => setProjectJson({ ...projectJson, overview: e.target.value })}
              />
              <button onClick={() => saveProject(projectJson)} disabled={saving}>
                {saving ? 'Saving…' : 'Save Brief'}
              </button>
            </>
          )}
        </section>

        <section className="card full-width">
          <h2>Discover Sources</h2>
          <form onSubmit={runDiscover} className="row">
            <select value={provider} onChange={(e) => setProvider(e.target.value as typeof provider)}>
              <option value="mealdb">TheMealDB</option>
              <option value="openlibrary">OpenLibrary</option>
              <option value="wikipedia">Wikipedia</option>
            </select>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipes, cuisines, references" />
            <button type="submit" disabled={loadingSearch}>{loadingSearch ? 'Searching…' : 'Search'}</button>
          </form>

          <div className="discover-grid">
            <div>
              <h3>Results</h3>
              <ul className="results">
                {sources.map((result) => (
                  <li key={`${result.source}-${result.id}`}>
                    <a href={result.url} target="_blank" rel="noreferrer">{result.title}</a>
                    <p>{result.snippet || 'No summary available.'}</p>
                    <button onClick={() => saveSource(result)} disabled={!selectedProjectId}>Save/Cite</button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3>Saved Citations</h3>
              <ul className="results">
                {(projectJson.sources ?? []).map((result) => (
                  <li key={`saved-${result.source}-${result.id}`}>
                    <a href={result.url} target="_blank" rel="noreferrer">{result.title}</a>
                    <p>{result.source}</p>
                    <button onClick={() => removeSource(result)} disabled={!selectedProjectId}>Remove</button>
                  </li>
                ))}
                {(projectJson.sources ?? []).length === 0 && <li>No saved citations yet.</li>}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
