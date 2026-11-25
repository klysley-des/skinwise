# Copies this whole SkinWise program into the existing folder.
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = "C:\Users\HP\Desktop\skinwise-project"

if (-not (Test-Path (Join-Path $here "package.json"))) {
  throw "Run this script from the extracted SkinWise folder, next to package.json."
}
if (-not (Test-Path (Join-Path $here "src\app.js"))) {
  throw "src\app.js is missing from the extracted folder."
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null
& robocopy $here $dest /E /R:1 /W:1 /NFL /NDL /NJH /NJS /nc /ns /np | Out-Host
if ($LASTEXITCODE -ge 8) {
  throw "The copy into $dest failed."
}

$export = Select-String -Path (Join-Path $dest "src\app.js") -Pattern "export function createApp" -SimpleMatch
if (-not $export) {
  throw "src\app.js in $dest still has no createApp. Copy src from the zip again."
}

Write-Host ""
Write-Host "All SkinWise files are now in $dest"
Write-Host "Open that folder in Visual Studio Code and run: npm start"
Write-Host "Then open http://127.0.0.1:3060"
