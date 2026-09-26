@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo First run: python -m venv .venv
  echo Then: .venv\Scripts\python -m pip install -r requirements.txt
  pause
  exit /b 1
)
echo Job Compass: http://127.0.0.1:8123
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8123
