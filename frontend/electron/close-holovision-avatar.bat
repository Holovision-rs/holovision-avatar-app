@echo off
echo Zatvaram Holovision Avatar aplikaciju...

:: Pronađi PID procesa koji sadrži "Holovision Avatar.exe"
taskkill /F /IM "Holovision Avatar.exe"

echo Gotovo.
pause
