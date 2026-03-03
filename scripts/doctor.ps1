$ErrorActionPreference = 'Stop'
Write-Host 'Checking toolchain...'
node --version
npm --version
python --version
Write-Host 'doctor ok'
