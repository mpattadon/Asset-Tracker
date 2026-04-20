param(
  [switch]$RebuildFrontend
)

function Stop-SidecarProcesses {
  $sidecars = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*yfinance_sidecar.py*' }
  foreach ($sidecar in $sidecars) {
    try {
      Stop-Process -Id $sidecar.ProcessId -Force -ErrorAction Stop
    } catch {
    }
  }
}

function Test-SidecarHealthy {
  try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:9001/internal/market/version" -TimeoutSec 2
    return $null -ne $response.sidecarVersion
  } catch {
    return $false
  }
}

function Start-Sidecar {
  param(
    [string]$BackendDir
  )

  if (Test-SidecarHealthy) {
    return
  }

  Start-Process powershell -ArgumentList @(
    '-WindowStyle',
    'Hidden',
    '-Command',
    "& { Set-Location '$BackendDir'; python python/yfinance_sidecar.py }"
  ) | Out-Null

  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-SidecarHealthy) {
      return
    }
  }

  throw "yfinance sidecar did not become healthy on port 9001."
}

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

Write-Host "Stopping stale sidecar processes..."
Stop-SidecarProcesses
Write-Host "Starting yfinance sidecar..."
Start-Sidecar -BackendDir $backendDir

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
