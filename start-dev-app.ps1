param(
  [switch]$NoBrowser
)

function Get-FreePort {
  param(
    [int]$StartPort
  )

  $port = $StartPort
  while ($true) {
    $listener = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
      Where-Object { $_.State -eq "Listen" } |
      Select-Object -First 1
    if (-not $listener) {
      return $port
    }
    $port++
  }
}

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

Write-Host "Stopping stale sidecar processes..."
Stop-SidecarProcesses
Write-Host "Starting yfinance sidecar..."
Start-Sidecar -BackendDir $backendDir

$mavenUserHome = Join-Path $backendDir ".mvn-user-home"
$backendPort = Get-FreePort -StartPort 8080
$frontendPort = Get-FreePort -StartPort 5173
$proxyTarget = "http://127.0.0.1:$backendPort"

$backendCommand = @"
& {
  `$env:SERVER_ADDRESS = '127.0.0.1'
  `$env:SERVER_PORT = '$backendPort'
  `$env:APP_PRIVATE_HOST_ENABLED = 'false'
  `$env:APP_OPEN_BROWSER_ON_READY = 'false'
  `$env:MAVEN_USER_HOME = '$mavenUserHome'
  Set-Location '$backendDir'
  cmd.exe /c mvnw.cmd spring-boot:run
}
"@

$frontendCommand = @"
& {
  `$env:VITE_PROXY_TARGET = '$proxyTarget'
  `$env:VITE_API_BASE_URL = '$proxyTarget'
  Set-Location '$frontendDir'
  npm run dev -- --host 127.0.0.1 --port $frontendPort
}
"@

Write-Host "Starting backend dev server in a new window..."
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  $backendCommand
)

Start-Sleep -Seconds 2

Write-Host "Starting frontend dev server in a new window..."
Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  $frontendCommand
)

if (-not $NoBrowser) {
  Start-Sleep -Seconds 3
  Write-Host "Opening dev app..."
  Start-Process "http://127.0.0.1:$frontendPort/"
}

Write-Host ""
Write-Host "Dev mode started."
Write-Host "Frontend: http://127.0.0.1:$frontendPort/"
Write-Host "Backend API: http://127.0.0.1:$backendPort/"
Write-Host "Vite proxy target: $proxyTarget"
Write-Host "Frontend API base: $proxyTarget"
Write-Host ""
Write-Host "Frontend changes will hot reload automatically."
Write-Host "Backend changes will restart when Spring recompiles changed classes."
