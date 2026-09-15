@echo off
setlocal
cd /d "%~dp0"
if not exist ".env" (
  copy /Y "env.example" ".env" >nul
  echo Arquivo .env criado a partir do exemplo.
)
if not exist "producaoscan-api.exe" (
  echo producaoscan-api.exe nao encontrado nesta pasta.
  pause
  exit /b 1
)
echo Iniciando API ProducaoScan...
producaoscan-api.exe
