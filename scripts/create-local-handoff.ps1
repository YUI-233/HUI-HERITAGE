param(
  [string]$Label = (Get-Date -Format "yyyyMMdd")
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = Join-Path $projectRoot ("outputs\HUI-HERITAGE-handoff-" + $Label)
$stagingRoot = Join-Path $projectRoot ".tmp\handoff-$Label"
$pgDump = "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"

if (-not (Test-Path -LiteralPath $pgDump)) { throw "pg_dump was not found: $pgDump" }
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot ".env"))) { throw "Missing .env; DATABASE_URL cannot be read." }

if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
New-Item -ItemType Directory -Force -Path $outputRoot, $stagingRoot | Out-Null

$codeRoot = Join-Path $stagingRoot "source"
New-Item -ItemType Directory -Force -Path $codeRoot | Out-Null
$directories = @("app", "db", "docs", "drizzle", "examples", "lib", "prisma", "public", "scripts", "tests", "types", "worker", ".openai")
$rootFiles = @(".env.example", ".gitignore", "AGENTS.md", "HANDOFF.md", "PROJECT.md", "README.md", "drizzle.config.ts", "eslint.config.mjs", "next.config.ts", "package-lock.json", "package.json", "pnpm-lock.yaml", "postcss.config.mjs", "tsconfig.json", "vite.config.ts")
foreach ($directory in $directories) {
  $source = Join-Path $projectRoot $directory
  if (Test-Path -LiteralPath $source) {
    robocopy $source (Join-Path $codeRoot $directory) /E /XD node_modules .next .git .pnpm-store .tmp .wrangler build dist output outputs uploads work | Out-Null
    if ($LASTEXITCODE -gt 7) { throw "Failed to copy $directory (robocopy exit code $LASTEXITCODE)." }
  }
}
foreach ($file in $rootFiles) {
  $source = Join-Path $projectRoot $file
  if (Test-Path -LiteralPath $source) { Copy-Item -LiteralPath $source -Destination $codeRoot -Force }
}

$codeArchive = Join-Path $outputRoot ("source-" + $Label + ".zip")
Compress-Archive -Path (Join-Path $codeRoot "*") -DestinationPath $codeArchive -CompressionLevel Optimal -Force

$uploads = Join-Path $projectRoot "uploads"
$uploadsArchive = Join-Path $outputRoot ("uploads-" + $Label + ".zip")
if (Test-Path -LiteralPath $uploads) { Compress-Archive -Path (Join-Path $uploads "*") -DestinationPath $uploadsArchive -CompressionLevel Optimal -Force }

$databaseUrlLine = Get-Content -LiteralPath (Join-Path $projectRoot ".env") | Where-Object { $_ -match "^\s*DATABASE_URL\s*=" } | Select-Object -First 1
if (-not $databaseUrlLine) { throw "DATABASE_URL was not found in .env." }
$databaseUrl = ($databaseUrlLine -replace "^\s*DATABASE_URL\s*=\s*", "").Trim().Trim('"').Trim("'")
if (-not $databaseUrl) { throw "DATABASE_URL is empty." }
$databaseBackup = Join-Path $outputRoot ("database-" + $Label + ".backup")
& $pgDump --format=custom --no-owner --file $databaseBackup --dbname $databaseUrl
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (exit code $LASTEXITCODE)." }

$manifest = Get-ChildItem -LiteralPath $outputRoot -File | Where-Object { $_.Name -ne "MANIFEST.txt" } | ForEach-Object {
  $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
  "{0}`t{1}`t{2}" -f $_.Name, $_.Length, $hash
}
$manifest | Set-Content -LiteralPath (Join-Path $outputRoot "MANIFEST.txt") -Encoding utf8
Remove-Item -LiteralPath $stagingRoot -Recurse -Force
Write-Host "Handoff package generated: $outputRoot"
