$ErrorActionPreference = 'Stop'
$remote = git remote get-url origin
if (-not $remote) { throw 'origin remote is not set' }
Start-Process "https://dashboard.render.com/blueprint/new?repo=$([uri]::EscapeDataString($remote))"
