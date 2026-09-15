@echo off
setlocal
cd /d "%~dp0"
echo === 1/2 PostgreSQL ===
docker compose up -d postgres
if errorlevel 1 (
  echo Falha ao iniciar o banco. Verifique se o Docker Desktop esta em execucao.
  pause
  exit /b 1
)
echo Aguardando o banco ficar pronto...
timeout /t 8 /nobreak >nul
if not exist ".env" copy /Y "env.example" ".env" >nul
echo === 2/2 Backend ===
if not exist "producaoscan-api.exe" (
  echo producaoscan-api.exe nao encontrado nesta pasta.
  pause
  exit /b 1
)
producaoscan-api.exe
