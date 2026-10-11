$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $projectRoot ".local-postgres"
$logFile = Join-Path $projectRoot ".local-postgres.log"
$postgresExe = if ($env:POSTGRES_BIN) { Join-Path $env:POSTGRES_BIN "postgres.exe" } else { "D:\postgresql\bin\postgres.exe" }

if (-not (Test-Path -LiteralPath $dataDir)) {
  throw "Missing $dataDir. Initialize the local database cluster first."
}
if (-not (Test-Path -LiteralPath $postgresExe)) {
  throw "PostgreSQL executable not found at $postgresExe. Set POSTGRES_BIN to its bin directory."
}

$pgIsReady = Join-Path (Split-Path $postgresExe) "pg_isready.exe"
$ready = & $pgIsReady -h 127.0.0.1 -p 5432 2>$null
if ($LASTEXITCODE -ne 0) {
  Start-Process -FilePath $postgresExe -ArgumentList @("-D", $dataDir, "-p", "5432") -WindowStyle Hidden -RedirectStandardOutput $logFile -RedirectStandardError (Join-Path $projectRoot ".local-postgres.err.log") | Out-Null
}

for ($attempt = 0; $attempt -lt 30; $attempt++) {
  & $pgIsReady -h 127.0.0.1 -p 5432 2>$null
  if ($LASTEXITCODE -eq 0) { exit 0 }
  Start-Sleep -Seconds 1
}
throw "Local PostgreSQL did not become ready on port 5432."
