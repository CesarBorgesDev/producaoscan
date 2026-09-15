@echo off
setlocal
cd /d "%~dp0"
echo Iniciando PostgreSQL...
docker compose up -d postgres
if errorlevel 1 (
  echo Falha ao iniciar o banco. Verifique se o Docker Desktop esta em execucao.
  pause
  exit /b 1
)
echo Banco disponivel em localhost:5434
docker compose ps
pause
