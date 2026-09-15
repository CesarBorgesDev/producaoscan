$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$deploy = $PSScriptRoot

Write-Host "Gerando executavel do backend..."
Push-Location (Join-Path $root "backend")
& ".\.venv\Scripts\pyinstaller.exe" --noconfirm producaoscan-api.spec
Pop-Location
Copy-Item (Join-Path $root "backend\dist\producaoscan-api.exe") (Join-Path $deploy "producaoscan-api.exe") -Force

Write-Host "Gerando APK..."
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
$env:PATH = "$env:JAVA_HOME\bin;" + $env:PATH
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.InterfaceAlias -match "Wi-Fi|Ethernet" -and $_.IPAddress -like "192.168.*" } |
    Select-Object -First 1 -ExpandProperty IPAddress)
if (-not $ip) { $ip = "192.168.0.13" }
Push-Location (Join-Path $root "flutter_app")
flutter build apk --release --dart-define="API_URL=http://${ip}:8000"
Pop-Location
Copy-Item (Join-Path $root "flutter_app\build\app\outputs\flutter-apk\app-release.apk") (Join-Path $deploy "producao_scan.apk") -Force

if (-not (Test-Path (Join-Path $deploy ".env"))) {
    Copy-Item (Join-Path $deploy "env.example") (Join-Path $deploy ".env")
}

Write-Host "Pacote pronto em $deploy"
Get-ChildItem $deploy -File | Format-Table Name, Length
