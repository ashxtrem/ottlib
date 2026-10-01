$projectRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$port = 8081
$configPath = Join-Path $projectRoot 'config\config.json'

if (Test-Path -LiteralPath $configPath) {
  try {
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    if ($null -ne $config.port) {
      $port = [int]$config.port
    }
  } catch {
    Write-Warning "Could not read $configPath; using port $port."
  }
}

$listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
$serverProcessIds = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
$stopped = 0

foreach ($processId in $serverProcessIds) {
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if ($null -eq $process -or $process.ProcessName -ne 'node') {
    continue
  }

  Stop-Process -Id $processId -Force
  $stopped++
}

if ($stopped -eq 0) {
  Write-Output "No OTTLib Node server was listening on port $port."
} else {
  Write-Output "Stopped $stopped OTTLib server process(es) on port $port."
}
