param(
  [string]$Label = (Get-Date -Format "yyyyMMdd-HHmm")
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$stagingRoot = Join-Path $projectRoot ".tmp\handoff-source"
$outputRoot = Join-Path $projectRoot "outputs"
$archivePath = Join-Path $outputRoot "HUI-HERITAGE-source-$Label.zip"
$directories = @("app", "db", "docs", "drizzle", "examples", "lib", "prisma", "public", "scripts", "tests", "worker", ".openai")
$rootFiles = @(".env.example", ".gitignore", "AGENTS.md", "HANDOFF.md", "PROJECT.md", "README.md", "drizzle.config.ts", "eslint.config.mjs", "next-env.d.ts", "next.config.ts", "package-lock.json", "package.json", "pnpm-lock.yaml", "postcss.config.mjs", "tsconfig.json", "vite.config.ts")

if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
New-Item -ItemType Directory -Path $stagingRoot, $outputRoot -Force | Out-Null

foreach ($directory in $directories) {
  $source = Join-Path $projectRoot $directory
  if (Test-Path -LiteralPath $source) {
    $destination = Join-Path $stagingRoot $directory
    robocopy $source $destination /E /XD node_modules .next .git .pnpm-store .tmp .wrangler build dist outputs uploads work | Out-Null
    if ($LASTEXITCODE -gt 7) { throw "Unable to copy $directory (robocopy exit code $LASTEXITCODE)." }
  }
}

foreach ($file in $rootFiles) {
  $source = Join-Path $projectRoot $file
  if (Test-Path -LiteralPath $source) {
    Copy-Item -LiteralPath $source -Destination $stagingRoot -Force
  }
}

if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath -Force }
$sourceItems = Get-ChildItem -LiteralPath $stagingRoot -Force | Select-Object -ExpandProperty FullName
Compress-Archive -Path $sourceItems -DestinationPath $archivePath -CompressionLevel Optimal
Remove-Item -LiteralPath $stagingRoot -Recurse -Force

Write-Host ("Source package: {0}" -f $archivePath)
Write-Host "Excluded: .env, uploads, node_modules, and build caches."
