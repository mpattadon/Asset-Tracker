param(
  [string]$FrontendHost = "0.0.0.0"
)

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"
$pwshPath = Join-Path $PSHOME "pwsh.exe"

if (-not (Test-Path $pwshPath)) {
  $pwshPath = "pwsh"
}

if (-not (Test-Path (Join-Path $backendDir "mvnw.cmd"))) {
  throw "Backend Maven wrapper not found at $backendDir"
}

if (-not (Test-Path (Join-Path $frontendDir "package.json"))) {
  throw "Frontend package.json not found at $frontendDir"
}

$backendCommand = "Set-Location '$backendDir'; cmd.exe /c mvnw.cmd spring-boot:run"
$frontendCommand = "Set-Location '$frontendDir'; npm run dev -- --host $FrontendHost"

Start-Process -FilePath $pwshPath `
  -WorkingDirectory $backendDir `
  -ArgumentList @("-NoExit", "-Command", $backendCommand) `
  -WindowStyle Normal

Start-Sleep -Seconds 2

Start-Process -FilePath $pwshPath `
  -WorkingDirectory $frontendDir `
  -ArgumentList @("-NoExit", "-Command", $frontendCommand) `
  -WindowStyle Normal

Write-Host "Backend starting in a new terminal from $backendDir"
Write-Host "Frontend starting in a new terminal from $frontendDir on host $FrontendHost"
Write-Host "Frontend URL: http://localhost:5173"
