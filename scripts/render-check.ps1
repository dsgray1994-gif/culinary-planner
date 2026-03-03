param(
  [Parameter(Mandatory = $true)][string]$ApiBase,
  [Parameter(Mandatory = $true)][string]$WebBase
)

$ErrorActionPreference = 'Stop'

function Normalize-BaseUrl([string]$url) {
  if ([string]::IsNullOrWhiteSpace($url)) { return $url }
  return $url.Trim().TrimEnd('/')
}

$ApiBase = Normalize-BaseUrl $ApiBase
$WebBase = Normalize-BaseUrl $WebBase

Write-Host "== Culinary Planner Deployment Check ==" -ForegroundColor Cyan
Write-Host "API: $ApiBase"
Write-Host "WEB: $WebBase"

$allGood = $true

function Check-Step($name, [scriptblock]$action) {
  try {
    & $action
    Write-Host "[PASS] $name" -ForegroundColor Green
  }
  catch {
    $script:allGood = $false
    Write-Host "[FAIL] $name => $($_.Exception.Message)" -ForegroundColor Red
  }
}

Check-Step 'Web URL responds' {
  $res = Invoke-WebRequest -Uri $WebBase -Method GET -TimeoutSec 45
  if ($res.StatusCode -lt 200 -or $res.StatusCode -ge 400) {
    throw "Unexpected web status code: $($res.StatusCode)"
  }
  if ([string]::IsNullOrWhiteSpace($res.Content)) {
    throw 'Web response body was empty.'
  }
}

Check-Step 'API /health returns ok=true and db ready' {
  $health = Invoke-RestMethod -Uri "$ApiBase/health" -Method GET -TimeoutSec 45
  if (-not $health.ok) {
    throw "Health response did not contain ok=true. Response: $($health | ConvertTo-Json -Depth 10)"
  }
  if ($null -ne $health.db -and -not $health.db.ready) {
    throw "Database not ready. Health: $($health | ConvertTo-Json -Depth 10)"
  }
}

Check-Step 'API list projects endpoint' {
  $list = Invoke-RestMethod -Uri "$ApiBase/projects" -Method GET -TimeoutSec 45
  if ($null -eq $list.projects) {
    throw "Expected 'projects' array in response."
  }
}

$projectId = $null
$projectName = "DeployCheck-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"

Check-Step 'API create project endpoint' {
  $created = Invoke-RestMethod -Uri "$ApiBase/projects" -Method POST -ContentType 'application/json' -Body (@{ name = $projectName } | ConvertTo-Json)
  if ([string]::IsNullOrWhiteSpace($created.id)) {
    throw 'Create did not return project id.'
  }
  $script:projectId = $created.id
}

Check-Step 'API get project endpoint' {
  if (-not $projectId) { throw 'No project id available from create step.' }
  $project = Invoke-RestMethod -Uri "$ApiBase/projects/$projectId" -Method GET -TimeoutSec 45
  if ($project.name -ne $projectName) {
    throw "Expected name '$projectName' but got '$($project.name)'"
  }
}

Check-Step 'API update project endpoint' {
  if (-not $projectId) { throw 'No project id available from create step.' }
  $payload = @{ json = @{ overview = 'render-check'; sources = @() } } | ConvertTo-Json -Depth 10
  $updated = Invoke-RestMethod -Uri "$ApiBase/projects/$projectId" -Method PUT -ContentType 'application/json' -Body $payload -TimeoutSec 45
  if (-not $updated.ok) {
    throw 'Update endpoint did not return ok=true.'
  }
}

Check-Step 'API discover endpoint (wikipedia)' {
  $payload = @{ provider = 'wikipedia'; query = 'pasta'; options = @{} } | ConvertTo-Json -Depth 10
  $discover = Invoke-RestMethod -Uri "$ApiBase/discover/search" -Method POST -ContentType 'application/json' -Body $payload -TimeoutSec 60
  if ($null -eq $discover.results) {
    throw "Discover response missing results field."
  }
}

Check-Step 'API delete project endpoint' {
  if (-not $projectId) { throw 'No project id available from create step.' }
  $deleted = Invoke-RestMethod -Uri "$ApiBase/projects/$projectId" -Method DELETE -TimeoutSec 45
  if (-not $deleted.ok) {
    throw 'Delete endpoint did not return ok=true.'
  }
}

if ($allGood) {
  Write-Host 'All checks passed.' -ForegroundColor Green
  exit 0
}

Write-Host 'One or more checks failed. Review service logs and env vars.' -ForegroundColor Yellow
exit 1
