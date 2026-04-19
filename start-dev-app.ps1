param(
  [switch]$NoBrowser
)

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"
$requirementsFile = Join-Path $backendDir "python\\requirements.txt"

if (-not (Test-Path (Join-Path $backendDir "mvnw.cmd"))) {
  throw "Backend Maven wrapper not found at $backendDir"
}

if (-not (Test-Path (Join-Path $frontendDir "package.json"))) {
  throw "Frontend package.json not found at $frontendDir"
}

Write-Host "Checking Python runtime..."
python --version | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Python was not found on PATH."
}

python -c "import yfinance" 2>$null
if ($LASTEXITCODE -ne 0) {
  if (-not (Test-Path $requirementsFile)) {
    throw "Python requirements file not found at $requirementsFile"
  }

  Write-Host "Installing Python dependencies for the yfinance sidecar..."
  python -m pip install -r $requirementsFile
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to install Python dependencies."
  }
}

$backendCommand = @(
  '$env:SERVER_ADDRESS="127.0.0.1";',
  '$env:APP_PRIVATE_HOST_ENABLED="false";',
  '$env:APP_OPEN_BROWSER_ON_READY="false";',
  '$env:MAVEN_USER_HOME="' + (Join-Path $backendDir ".mvn-user-home") + '";',
  'Set-Location "' + $backendDir + '";',
  'cmd.exe /c mvnw.cmd spring-boot:run'
) -join ' '

$frontendCommand = @(
  'Set-Location "' + $frontendDir + '";',
  'npm run dev -- --host 127.0.0.1 --port 5173'
) -join ' '

Write-Host "Starting backend dev server in a new window..."
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  $backendCommand
)

Write-Host "Starting frontend dev server in a new window..."
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  $frontendCommand
)

if (-not $NoBrowser) {
  Start-Sleep -Seconds 3
  Write-Host "Opening dev app..."
  Start-Process "http://127.0.0.1:5173/"
}

Write-Host ""
Write-Host "Dev mode started."
Write-Host "Frontend: http://127.0.0.1:5173/"
Write-Host "Backend API: http://127.0.0.1:8080/"
Write-Host ""
Write-Host "Frontend changes will hot reload automatically."
Write-Host "Backend changes will restart when Spring recompiles changed classes."
