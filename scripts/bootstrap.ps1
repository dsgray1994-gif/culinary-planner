$ErrorActionPreference = 'Stop'
python -m venv api/.venv
./api/.venv/Scripts/python.exe -m pip install --upgrade pip
./api/.venv/Scripts/python.exe -m pip install -r api/requirements.txt
Push-Location web
npm ci
Pop-Location
Write-Host 'bootstrap ok'
