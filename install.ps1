# Install moshi-hook on Windows (experimental preview).
#
#   powershell -ExecutionPolicy Bypass -c "irm https://getmoshi.app/install.ps1 | iex"
#
# Native Windows support is experimental: the binaries are unsigned, the agent
# matrix is narrower than macOS and Linux, and Herdr is the only supported
# terminal multiplexer. See docs/windows.md for the boundary. The stable layout
# on Windows is WSL2.
[CmdletBinding()]
param(
    [string]$Version,
    [string]$Cdn = $(if ($env:MOSHI_HOOK_CDN) { $env:MOSHI_HOOK_CDN } else { "https://cdn.getmoshi.app" }),
    [string]$InstallDir = $env:MOSHI_HOOK_INSTALL_DIR,
    [int]$Retain = 3,
    [string]$LocalArchivePath,
    [string]$LocalArchiveSha256,
    [switch]$SkipPath,
    [switch]$SkipService
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Step([string]$Message) { Write-Host "==> $Message" }

function Test-Digest([string]$Path, [string]$Expected) {
    if ($Expected -notmatch '^[0-9a-fA-F]{64}$') { throw "Invalid SHA-256 checksum for $Path." }
    $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    if ($actual -ine $Expected) { throw "Downloaded moshi-hook checksum did not match. Expected $Expected but got $actual." }
}

function Get-Checksum([string]$ChecksumsPath, [string]$AssetName) {
    foreach ($line in Get-Content -LiteralPath $ChecksumsPath) {
        $fields = @($line -split '\s+' | Where-Object { $_ })
        if ($fields.Count -ge 2 -and $fields[-1].TrimStart('*') -eq $AssetName) { return $fields[0] }
    }
    throw "Checksum for $AssetName was not found."
}

function Prepend-Path([string]$PathValue, [string]$Entry) {
    $needle = $Entry.TrimEnd('\')
    $parts = @($Entry)
    if ($PathValue) { $parts += @($PathValue -split ';' | Where-Object { $_ -and $_.TrimEnd('\') -ine $needle }) }
    return ($parts -join ';')
}

function Set-ManagedJunction([string]$Path, [string]$Target, [string]$OwnedRoot) {
    if (Test-Path -LiteralPath $Path) {
        $item = Get-Item -LiteralPath $Path -Force
        if (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.LinkType -ne 'Junction') {
            throw "Refusing to replace non-junction path: $Path"
        }
        $oldTarget = [string]$item.Target
        $owned = [IO.Path]::GetFullPath($OwnedRoot).TrimEnd('\') + '\'
        if (-not [IO.Path]::GetFullPath($oldTarget).StartsWith($owned, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to retarget a junction not managed by this installer: $Path"
        }
        if ([IO.Path]::GetFullPath($oldTarget) -ieq [IO.Path]::GetFullPath($Target)) { return }
        Remove-Item -LiteralPath $Path -Force
    }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Path) | Out-Null
    New-Item -ItemType Junction -Path $Path -Target $Target | Out-Null
}

if ($env:OS -ne 'Windows_NT') { throw 'scripts/install.ps1 supports Windows only.' }
if (-not [Environment]::Is64BitOperatingSystem) { throw 'moshi-hook requires 64-bit Windows.' }

Write-Host 'moshi-hook for Windows is an experimental, unsigned preview.'
Write-Host 'Herdr is the supported multiplexer; WSL2 remains the stable layout.'
Write-Host 'Details: https://getmoshi.app/docs/install-moshi-hook'
Write-Host ''

# Detección compatible con PowerShell 5.1 y Core/7
$architecture = if ($env:PROCESSOR_ARCHITECTURE -eq 'AMD64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'AMD64') { 'X64' } elseif ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'Arm64' } else { $env:PROCESSOR_ARCHITECTURE }
switch ($architecture) {
    'X64' { $asset = 'moshi-hook_Windows_x86_64.zip'; $target = 'x86_64-pc-windows' }
    'Arm64' { $asset = 'moshi-hook_Windows_arm64.zip'; $target = 'aarch64-pc-windows' }
    default { throw "Unsupported Windows architecture: $architecture" }
}

$cdnRoot = $Cdn.TrimEnd('/')
$usingLocal = -not [string]::IsNullOrWhiteSpace($LocalArchivePath)
if ($usingLocal -xor (-not [string]::IsNullOrWhiteSpace($LocalArchiveSha256))) {
    throw 'Local archive mode requires both LocalArchivePath and LocalArchiveSha256.'
}
if (-not $Version) {
    if ($usingLocal) { throw 'Local archive mode requires Version.' }
    Write-Step 'Resolving latest moshi-hook version'
    $Version = (Invoke-RestMethod -Uri "$cdnRoot/hook/latest/version.txt").ToString().Trim()
}
if ($Version -notmatch '^v[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$') { throw "Invalid moshi-hook version: $Version" }

$packageRoot = if ($InstallDir) { [IO.Path]::GetFullPath($InstallDir) } else { Join-Path $env:USERPROFILE '.moshi\packages\standalone' }
$releasesDir = Join-Path $packageRoot 'releases'
$releaseDir = Join-Path $releasesDir "$Version-$target"
$visibleBin = if ($InstallDir) { Join-Path $packageRoot 'bin' } else { Join-Path $env:LOCALAPPDATA 'Programs\Moshi Hook\bin' }
$lockPath = Join-Path $packageRoot 'install.lock'
$tempDir = Join-Path ([IO.Path]::GetTempPath()) ("moshi-hook-install-" + [Guid]::NewGuid().ToString('N'))
$staging = Join-Path $releasesDir (".staging-" + [Guid]::NewGuid().ToString('N'))

New-Item -ItemType Directory -Force -Path $tempDir,$releasesDir,$packageRoot | Out-Null
$installLock = $null
while ($null -eq $installLock) {
    try {
        $installLock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    } catch [IO.IOException] {
        Start-Sleep -Milliseconds 250
    }
}
try {
    Get-ChildItem -LiteralPath $releasesDir -Directory -Filter '.staging-*' -ErrorAction SilentlyContinue |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    if (-not (Test-Path -LiteralPath (Join-Path $releaseDir 'moshi-hook.exe') -PathType Leaf)) {
        $archive = if ($usingLocal) { [IO.Path]::GetFullPath($LocalArchivePath) } else { Join-Path $tempDir $asset }
        $expected = $LocalArchiveSha256
        if (-not $usingLocal) {
            Write-Step "Downloading $asset ($Version)"
            $base = "$cdnRoot/hook/$Version"
            $checksums = Join-Path $tempDir 'checksums.txt'
            Invoke-WebRequest -Uri "$base/$asset" -OutFile $archive
            Invoke-WebRequest -Uri "$base/checksums.txt" -OutFile $checksums
            $expected = Get-Checksum -ChecksumsPath $checksums -AssetName $asset
        }
        Test-Digest -Path $archive -Expected $expected
        Expand-Archive -LiteralPath $archive -DestinationPath $staging
        $binary = Get-ChildItem -LiteralPath $staging -Recurse -File -Filter 'moshi-hook.exe' | Select-Object -First 1
        if ($null -eq $binary) { throw 'Downloaded archive did not contain moshi-hook.exe.' }
        if ($binary.DirectoryName -ne $staging) { Move-Item -LiteralPath $binary.FullName -Destination (Join-Path $staging 'moshi-hook.exe') }
        & (Join-Path $staging 'moshi-hook.exe') version *> $null
        if ($LASTEXITCODE -ne 0) { throw 'Downloaded moshi-hook failed its version check.' }
        Move-Item -LiteralPath $staging -Destination $releaseDir
    }

    & (Join-Path $releaseDir 'moshi-hook.exe') version *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Installed moshi-hook failed its version check.' }
    # Homebrew symlinks moshi-hook => moshi on macOS/Linux; mirror that here.
    $aliasPath = Join-Path $releaseDir 'moshi.exe'
    if (-not (Test-Path -LiteralPath $aliasPath -PathType Leaf)) {
        try {
            New-Item -ItemType HardLink -Path $aliasPath -Target (Join-Path $releaseDir 'moshi-hook.exe') | Out-Null
        } catch {
            Copy-Item -LiteralPath (Join-Path $releaseDir 'moshi-hook.exe') -Destination $aliasPath
        }
    }
    Set-ManagedJunction -Path $visibleBin -Target $releaseDir -OwnedRoot $releasesDir
    if (-not $SkipPath) {
        $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
        $newPath = Prepend-Path -PathValue $userPath -Entry $visibleBin
        if ($newPath -cne $userPath) {
            [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
            Write-Step 'Updated the user PATH.'
        }
        $env:Path = Prepend-Path -PathValue $env:Path -Entry $visibleBin
    }

    $keep = [Math]::Max(1, $Retain)
    $releaseFull = [IO.Path]::GetFullPath($releaseDir)
    $others = @(Get-ChildItem -LiteralPath $releasesDir -Directory | Where-Object {
        -not $_.Name.StartsWith('.staging-') -and [IO.Path]::GetFullPath($_.FullName) -ne $releaseFull
    } | Sort-Object LastWriteTimeUtc -Descending)
    $others | Select-Object -Skip ($keep - 1) | Remove-Item -Recurse -Force
} finally {
    $installLock.Dispose()
    Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "moshi-hook $Version installed successfully (experimental Windows preview)."

# Register logon startup and start the daemon, as install.sh does: without it
# the daemon dies with its terminal and never comes back after a reboot.
$serviceStarted = $false
if ($SkipService -or $env:MOSHI_HOOK_SKIP_SERVICE -eq '1') {
    Write-Step 'Skipped background service (MOSHI_HOOK_SKIP_SERVICE=1).'
} else {
    Write-Step 'Starting the background service.'
    & (Join-Path $visibleBin 'moshi-hook.exe') service install
    if ($LASTEXITCODE -eq 0) {
        $serviceStarted = $true
    } else {
        Write-Warning 'Could not start the background service; run later: moshi-hook service install'
    }
}

Write-Host ''
Write-Host 'Open a new PowerShell window, then run:'
Write-Host '  moshi-hook install'
if (-not $serviceStarted) {
    Write-Host '  moshi-hook service install'
}