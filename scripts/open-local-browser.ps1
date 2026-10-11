$ErrorActionPreference = "SilentlyContinue"
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:3014/" -TimeoutSec 2
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
      $ready = $true
      break
    }
  } catch {
  }
  Start-Sleep -Seconds 1
}

if ($ready) {
  exit 0
}

Write-Host "Server was not ready within 60 seconds. Check the HUI HERITAGE server window." -ForegroundColor Yellow
exit 1
