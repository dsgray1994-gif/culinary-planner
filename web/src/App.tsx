import { FormEvent, useEffect, useState } from 'react'
import { api, DiscoverResult, Project } from './api'

function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectName, setProjectName] = useState('')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [sources, setSources] = useState<DiscoverResult[]>([])
  const [savedSources, setSavedSources] = useState<DiscoverResult[]>([])
  const [query, setQuery] = useState('chicken')
  const [provider, setProvider] = useState<'mealdb' | 'openlibrary' | 'wikipedia'>('mealdb')
  const [error, setError] = useState('')

  async function loadProjects() {
    try {
      const data = await api.listProjects()
      setProjects(data.projects)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  async function createProject(e: FormEvent) {
    e.preventDefault()
    if (!projectName.trim()) return
    const project = await api.createProject(projectName.trim())
    setProjectName('')
    setSelectedProject(project)
    await loadProjects()
  }

  async function runDiscover(e: FormEvent) {
    e.preventDefault()
    const data = await api.discover(provider, query)
    setSources(data.results)
  }

  async function saveSource(result: DiscoverResult) {
    if (!selectedProject) return
    const next = [...savedSources, result]
    setSavedSources(next)
    await api.updateProject(selectedProject.id, { sources: next })
  }

  return (
    <main style={{ fontFamily: 'Arial, sans-serif', maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h1>Culinary Planner</h1>
      <p>API: {import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'}</p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <section>
        <h2>Projects</h2>
        <form onSubmit={createProject}>
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name" />
          <button type="submit">Create</button>
        </form>
        <ul>
          {projects.map((project) => (
            <li key={project.id}>
              <button onClick={() => setSelectedProject(project)}>{project.name}</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Discover Sources</h2>
        <form onSubmit={runDiscover}>
          <select value={provider} onChange={(e) => setProvider(e.target.value as typeof provider)}>
            <option value="mealdb">TheMealDB</option>
            <option value="openlibrary">OpenLibrary</option>
            <option value="wikipedia">Wikipedia</option>
          </select>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search" />
          <button type="submit">Search</button>
        </form>
        <ul>
          {sources.map((result) => (
            <li key={`${result.source}-${result.id}`}>
              <a href={result.url} target="_blank" rel="noreferrer">{result.title}</a>
              <button onClick={() => saveSource(result)} disabled={!selectedProject}>Save/Cite</button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
