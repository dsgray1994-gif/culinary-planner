param(
  [string]$RepoUrl = "https://github.com/dsgray1994-gif/culinary-planner.git",
  [string]$CommitMessage = "Deploy update",
  [string]$ApiBase,
  [string]$WebBase,
  [string]$CoolifyUrl = "https://app.coolify.io",
  [switch]$SkipBootstrap,
  [switch]$SkipPublish,
  [switch]$SkipOpenCoolify
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $PSCommandPath
$RepoRoot = Split-Path -Parent $ScriptDir
Set-Location $RepoRoot

function Step($name, [scriptblock]$action) {
  Write-Host "`n== $name ==" -ForegroundColor Cyan
  & $action
}

function Ensure-Origin([string]$url) {
  $hasOrigin = $true
  try {
    git remote get-url origin | Out-Null
  }
  catch {
    $hasOrigin = $false
  }

  if ($hasOrigin) {
    git remote set-url origin $url
  }
  else {
    git remote add origin $url
  }
}

function Script-Path([string]$name) {
  return Join-Path $ScriptDir $name
}

Step 'Doctor checks' {
  powershell -ExecutionPolicy Bypass -File (Script-Path 'doctor.ps1')
}

if (-not $SkipBootstrap) {
  Step 'Bootstrap dependencies' {
    powershell -ExecutionPolicy Bypass -File (Script-Path 'bootstrap.ps1')
  }
}

Step 'Ensure git origin URL' {
  Ensure-Origin $RepoUrl
  git remote -v
}

if (-not $SkipPublish) {
  Step 'Commit and push' {
    $pending = git status --porcelain
    if ([string]::IsNullOrWhiteSpace($pending)) {
      Write-Host 'No local changes to commit; skipping publish step.' -ForegroundColor Yellow
    }
    else {
      powershell -ExecutionPolicy Bypass -File (Script-Path 'publish.ps1') -m $CommitMessage
    }
  }
}

if (-not $SkipOpenCoolify) {
  Step 'Open Coolify dashboard' {
    powershell -ExecutionPolicy Bypass -File (Script-Path 'deploy-coolify.ps1') -CoolifyUrl $CoolifyUrl
  }
}

Write-Host "`nManual Coolify step required:" -ForegroundColor Yellow
Write-Host '1) Create a new Docker Compose resource from this repository.'
Write-Host '2) Use docker-compose.yml at repo root.'
Write-Host '3) Set env vars: POSTGRES_PASSWORD, OPENAI_API_KEY, CORS_ORIGINS, VITE_API_BASE.'
Write-Host '4) Deploy and assign your public domain to the web service.'

if ($ApiBase -and $WebBase) {
  Step 'Post-deploy smoke check' {
    powershell -ExecutionPolicy Bypass -File (Script-Path 'render-check.ps1') -ApiBase $ApiBase -WebBase $WebBase
  }
}
else {
  Write-Host "`nOptional: pass -ApiBase and -WebBase to run post-deploy checks automatically." -ForegroundColor Yellow
}

Write-Host "`nDone." -ForegroundColor Green
