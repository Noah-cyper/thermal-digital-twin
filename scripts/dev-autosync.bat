@echo off
REM Bấm đúp để chạy auto-sync HMI localhost. Để cửa sổ này mở suốt.
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev-autosync.ps1"
echo.
echo (Auto-sync da dung.) Nhan phim bat ky de dong...
pause >nul
