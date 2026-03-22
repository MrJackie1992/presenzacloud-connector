#!/usr/bin/env pwsh
# build.ps1 — Builda l'installer PresenzaCloud Connector
#
# Prerequisiti (installa una volta sola):
#   npm install -g pkg
#   Inno Setup da https://jrsoftware.org/isdl.php
#
# Uso:
#   .\build.ps1                          → installer normale (chiede token durante install)
#   .\build.ps1 -Token "abc123..."       → installer pre-configurato per visita con USB
#
# Output: dist/PresenzaCloud-Connector-Setup.exe

param(
    [string]$Token = ""
)

$ErrorActionPreference = "Stop"

Write-Host "`n[1/4] Creazione cartella dist..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "dist" | Out-Null

Write-Host "[2/4] Build connector.exe con pkg (Node.js bundled)..." -ForegroundColor Cyan
pkg connector.js --target node18-win-x64 --output dist/connector.exe
if ($LASTEXITCODE -ne 0) { Write-Error "pkg connector.js fallito"; exit 1 }

Write-Host "[3/4] Build setup-wizard.exe..." -ForegroundColor Cyan
pkg setup-wizard.js --target node18-win-x64 --output dist/setup-wizard.exe
if ($LASTEXITCODE -ne 0) { Write-Error "pkg setup-wizard.js fallito"; exit 1 }

Write-Host "[4/4] Compilazione installer Inno Setup..." -ForegroundColor Cyan

if ($Token -ne "") {
    # Installer pre-configurato con token per la visita USB
    Write-Host "  → Token pre-configurato: $($Token.Substring(0,8))..." -ForegroundColor Yellow
    
    # Crea una copia temporanea dell'iss con il token incorporato
    $iss = Get-Content "installer.iss" -Raw
    $iss = $iss -replace '#define PresetToken ""', "#define PresetToken `"$Token`""
    $iss | Set-Content "installer_temp.iss" -Encoding UTF8
    
    & "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer_temp.iss
    Remove-Item "installer_temp.iss" -Force
    
    # Rinomina l'output per distinguerlo
    $date = Get-Date -Format "yyyyMMdd"
    Rename-Item "dist\PresenzaCloud-Connector-Setup.exe" `
                "dist\PresenzaCloud-Connector-Setup-PRECONFIGURATO-$date.exe"
} else {
    & "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer.iss
}

if ($LASTEXITCODE -ne 0) { Write-Error "Inno Setup compilation fallita"; exit 1 }

Write-Host "`n✓ Build completata!" -ForegroundColor Green
Write-Host "  Installer: dist\" -ForegroundColor Green
Get-ChildItem "dist\*.exe" | ForEach-Object { Write-Host "  → $($_.Name)" -ForegroundColor White }

if ($Token -ne "") {
    Write-Host "`n  QUESTO INSTALLER E' PRE-CONFIGURATO" -ForegroundColor Yellow
    Write-Host "  Il consulente non dovrà inserire nessun token." -ForegroundColor Yellow
    Write-Host "  Copia il file .exe sulla chiavetta USB." -ForegroundColor Yellow
}
