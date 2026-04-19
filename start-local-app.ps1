param(
  [switch]$RebuildFrontend
)

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"
$frontendDist = Join-Path $frontendDir "dist"
$requirementsFile = Join-Path $backendDir "python\\requirements.txt"

if (-not (Test-Path (Join-Path $backendDir "mvnw.cmd"))) {
  throw "Backend Maven wrapper not found at $backendDir"
}

if (-not (Test-Path (Join-Path $frontendDir "package.json"))) {
  throw "Frontend package.json not found at $frontendDir"
}

if ($RebuildFrontend -or -not (Test-Path (Join-Path $frontendDist "index.html"))) {
  Write-Host "Building frontend bundle..."
  Push-Location $frontendDir
  try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "Frontend build failed."
    }
  } finally {
    Pop-Location
  }
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

$env:APP_FRONTEND_DIST = $frontendDist
$env:APP_OPEN_BROWSER_ON_READY = "true"
$env:APP_PRIVATE_HOST_ENABLED = "true"
$env:SERVER_ADDRESS = "127.0.0.1"
$env:MAVEN_USER_HOME = Join-Path $backendDir ".mvn-user-home"

Write-Host "Starting local app on the private loopback host..."
Push-Location $backendDir
try {
  cmd.exe /c mvnw.cmd spring-boot:run
} finally {
  Pop-Location
}
