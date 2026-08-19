param(
  [string]$OutputDirectory = "release/paperlingo-deploy"
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$target = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDirectory))
$releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot "release"))
if (-not $target.StartsWith($releaseRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "输出目录必须位于项目 release 目录内"
}
if (Test-Path -LiteralPath $target) {
  throw "输出目录已存在：$target。请先移动或重命名旧部署包。"
}

New-Item -ItemType Directory -Path $target | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot "src") -Destination $target -Recurse
New-Item -ItemType Directory -Path (Join-Path $target "server") | Out-Null
foreach ($name in @("src", "drizzle")) {
  Copy-Item -LiteralPath (Join-Path $projectRoot "server/$name") -Destination (Join-Path $target "server") -Recurse
}
foreach ($name in @("package.json", "package-lock.json", "tsconfig.json", "dictionary.js")) {
  Copy-Item -LiteralPath (Join-Path $projectRoot "server/$name") -Destination (Join-Path $target "server/$name")
}
New-Item -ItemType Directory -Path (Join-Path $target "data") | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot "data/ecdict.sqlite") -Destination (Join-Path $target "data/ecdict.sqlite")
Copy-Item -LiteralPath (Join-Path $projectRoot "data/ECDICT-LICENSE") -Destination (Join-Path $target "data/ECDICT-LICENSE")
foreach ($name in @("package.json", "package-lock.json", "index.html", "vite.config.js")) {
  Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $target
}

Copy-Item -LiteralPath (Join-Path $PSScriptRoot "Dockerfile.web") -Destination (Join-Path $target "Dockerfile.web")
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "Dockerfile.api") -Destination (Join-Path $target "Dockerfile.api")
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "nginx.conf") -Destination (Join-Path $target "nginx.conf")
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "compose.production.yaml") -Destination (Join-Path $target "compose.yaml")
Copy-Item -LiteralPath (Join-Path $PSScriptRoot ".dockerignore") -Destination (Join-Path $target ".dockerignore")
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "README-DEPLOY.md") -Destination (Join-Path $target "README.md")
Copy-Item -LiteralPath (Join-Path $PSScriptRoot ".env.production.example") -Destination (Join-Path $target ".env.example")

function New-HexSecret([int]$byteCount) {
  return [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes($byteCount)).ToLowerInvariant()
}
$environment = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot ".env.production.example")
$environment = $environment.Replace("replace-with-random-database-password", (New-HexSecret 18))
$environment = $environment.Replace("replace-with-random-object-storage-password", (New-HexSecret 18))
$environment = $environment.Replace("replace-with-at-least-32-random-characters", (New-HexSecret 32))
[System.IO.File]::WriteAllText((Join-Path $target ".env"), $environment, [System.Text.UTF8Encoding]::new($false))

$revision = (git -C $projectRoot rev-parse --short HEAD 2>$null)
$releaseInfo = "PaperLingo deployment package`nRevision: $revision`nBuilt: $([DateTimeOffset]::Now.ToString('u'))`n"
[System.IO.File]::WriteAllText((Join-Path $target "RELEASE.txt"), $releaseInfo, [System.Text.UTF8Encoding]::new($false))
$manifest = Get-ChildItem -LiteralPath $target -Recurse -File |
  Where-Object { $_.Name -ne "SHA256SUMS" } |
  Sort-Object FullName |
  ForEach-Object {
    $relative = [System.IO.Path]::GetRelativePath($target, $_.FullName).Replace("\", "/")
    "{0}  {1}" -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $relative
  }
[System.IO.File]::WriteAllLines((Join-Path $target "SHA256SUMS"), $manifest, [System.Text.UTF8Encoding]::new($false))

Write-Output $target
