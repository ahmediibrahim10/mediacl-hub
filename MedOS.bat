@echo off
title MedOS - Medical AI Platform (Full Launch)
color 0B

echo ====================================================
echo        Cleaning up old processes and ports...
echo ====================================================
taskkill /F /IM python.exe > nul 2>&1
taskkill /F /IM node.exe > nul 2>&1

echo ====================================================
echo          Starting MedOS Full Platform...
echo ====================================================

:: 1. تشغيل الباك-إند في نافذة مستقلة
echo [1/2] Starting Backend Server (FastAPI on port 8000)...
start cmd /k "cd backend && python -m uvicorn main:app --reload --port 8000"

:: 2. الانتظار 4 ثوانٍ لضمان استقرار الباك-إند وبدء تشغيله بالكامل
timeout /t 4 /nobreak > nul

:: 3. تشغيل الفرونت-إند في مجلد frontend الصحيح
echo [2/2] Starting Frontend App (Vite on port 5173)...
start cmd /k "cd frontend && npm run dev"

echo ====================================================
echo        MedOS is running successfully! 🚀
echo ====================================================
echo Backend URL: http://127.0.0.1:8000
echo Frontend URL: http://localhost:5173
echo ====================================================
pause