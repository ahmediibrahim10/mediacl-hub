import os
import sys
import time
import subprocess
import webbrowser
from datetime import datetime
import urllib.request

BACKEND_URL = "http://127.0.0.1:8000/api/health"
FRONTEND_URL = "http://localhost:5173"
started_processes = []

def log(msg):
    if not os.path.exists("logs"):
        os.makedirs("logs")
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    out = f"[{timestamp}] {msg}"
    print(out)
    with open("logs/launcher.log", "a", encoding="utf-8") as f:
        f.write(out + "\n")

def check_service_running(url):
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=2) as response:
            return response.status == 200
    except Exception as e:
        if hasattr(e, 'code'):
            return True
        return False

def start_backend():
    if check_service_running(BACKEND_URL):
        log("✓ FastAPI Backend is already running.")
        return
    log("↻ Starting FastAPI Backend...")
    
    python_exe = os.path.join("backend", "venv", "Scripts", "python.exe") if os.name == 'nt' else os.path.join("backend", "venv", "bin", "python")
    cmd = [python_exe, "-m", "uvicorn", "main:app", "--port", "8000"] if os.path.exists(python_exe) else ["python", "-m", "uvicorn", "main:app", "--port", "8000"]
    
    log_file = open("logs/backend.log", "a")
    cwd = "backend" if os.path.exists("backend") else "."
    p = subprocess.Popen(cmd, cwd=cwd, stdout=log_file, stderr=subprocess.STDOUT)
    started_processes.append(("Backend", p))

def start_frontend():
    if check_service_running(FRONTEND_URL):
        log("✓ Frontend is already running.")
        return
    log("↻ Starting React Frontend...")
    frontend_dir = "frontend" if os.path.exists("frontend") else "."
    log_file = open("logs/frontend.log", "a")
    p = subprocess.Popen("npm run dev", shell=True, cwd=frontend_dir, stdout=log_file, stderr=subprocess.STDOUT)
    started_processes.append(("Frontend", p))

def main():
    print("========================================")
    print("      MedOS - Powered by Gemini AI")
    print("========================================\n")
    
    start_backend()
    start_frontend()
    
    log("\n🚀 Waiting for services to start...")
    time.sleep(5)
    webbrowser.open(FRONTEND_URL)
    
    log("\n[MedOS is running. Keep this window open. Press Ctrl+C to stop services.]\n")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log("\nShutting down MedOS gracefully...")
        for name, process in started_processes:
            process.terminate()
        sys.exit(0)

if __name__ == "__main__":
    main()