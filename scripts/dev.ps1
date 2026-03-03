$ErrorActionPreference = 'Stop'
Start-Process powershell -ArgumentList '-NoExit','-Command','cd api; ./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000'
Start-Process powershell -ArgumentList '-NoExit','-Command','cd web; npm run dev -- --host 127.0.0.1 --port 5173'
Start-Process 'http://localhost:5173'
