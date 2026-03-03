param([string]$CoolifyUrl = 'https://app.coolify.io')
$ErrorActionPreference = 'Stop'
Start-Process $CoolifyUrl
