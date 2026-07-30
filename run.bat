@echo off
REM ============================================================
REM  IDTP thermal-runtime - chay HMI 1 cham (Windows)
REM  Nhap dup file nay de: cai dat -> build -> chay localhost:8080
REM  Yeu cau: da cai Node.js (>=20) va pnpm (corepack enable).
REM ============================================================
setlocal
cd /d "%~dp0"

echo.
echo [1/3] Cai dat phu thuoc (pnpm install)...
call pnpm install
if errorlevel 1 goto :err

echo.
echo [2/3] Build toan bo goi (pnpm build - tsc 7/7)...
call pnpm build
if errorlevel 1 goto :err

echo.
echo [3/3] Chay HMI tai http://localhost:8080  (Ctrl+C de dung)
echo       Mo trinh duyet va vao dia chi: http://localhost:8080
echo.
call pnpm --filter @idtp/app-thermal-runtime serve
if errorlevel 1 goto :err
goto :eof

:err
echo.
echo [LOI] Co buoc phia tren that bai. Doc thong bao loi o tren de biet nguyen nhan.
echo       Meo: dam bao da chay "corepack enable" va Node phien ban >= 20.
pause
endlocal
