Start.bat

@echo off
setlocal

:: 👇 KONFIGURACIJA
set FRONTEND_PORT=5173
set FRONTEND_PATH=apps\frontend
set BACKEND_PATH=apps\backend
set ELECTRON_PATH=electron

echo 🔧 Pokrećem backend server...
start cmd /k "cd %BACKEND_PATH% && yarn dev"

timeout /t 2 >nul

echo 🌐 Pokrećem frontend server...
start cmd /k "cd %FRONTEND_PATH% && yarn dev"

echo 🕓 Čekam da frontend server postane aktivan na portu %FRONTEND_PORT%...

:wait_for_port
ping -n 2 127.0.0.1 >nul
curl http://localhost:%FRONTEND_PORT% >nul 2>nul
if errorlevel 1 (
    echo ...još nije spremno
    timeout /t 2 >nul
    goto wait_for_port
)

echo ✅ Frontend server je spreman!

echo ⚡ Pokrećem Electron aplikaciju...
cd %ELECTRON_PATH%
npm start

endlocal
pause