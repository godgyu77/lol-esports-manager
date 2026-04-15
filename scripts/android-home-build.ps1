param(
  [ValidateSet("arm64", "arm", "x86", "x86_64")]
  [string]$Flavor = "arm64",
  [switch]$Release
)

$ErrorActionPreference = "Stop"

function Resolve-ExistingPath {
  param([string[]]$Candidates)

  foreach ($candidate in $Candidates) {
    if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
    if (Test-Path $candidate) {
      return (Resolve-Path $candidate).Path
    }
  }

  return $null
}

function Resolve-LatestNdk {
  param([string]$SdkRoot)

  if (-not $SdkRoot) { return $null }
  $ndkDir = Join-Path $SdkRoot "ndk"
  if (-not (Test-Path $ndkDir)) { return $null }

  $latest = Get-ChildItem $ndkDir -Directory | Sort-Object Name -Descending | Select-Object -First 1
  if ($latest) {
    return $latest.FullName
  }

  return $null
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$androidProjectDir = Join-Path $repoRoot "src-tauri\gen\android"
$gradleWrapper = Join-Path $androidProjectDir "gradlew.bat"

if (-not (Test-Path $gradleWrapper)) {
  throw "Android project has not been initialized. Run 'npx tauri android init' first."
}

$sdkRoot = Resolve-ExistingPath @(
  $env:ANDROID_SDK_ROOT,
  $env:ANDROID_HOME,
  (Join-Path $repoRoot ".android-sdk"),
  (Join-Path $env:LOCALAPPDATA "Android\Sdk")
)

if (-not $sdkRoot) {
  throw "Android SDK not found. Set ANDROID_SDK_ROOT or install Android SDK."
}

$ndkRoot = Resolve-ExistingPath @(
  $env:NDK_HOME,
  (Resolve-LatestNdk -SdkRoot $sdkRoot)
)

if (-not $ndkRoot) {
  throw "Android NDK not found under SDK. Install NDK from Android Studio SDK Manager."
}

$javaHome = Resolve-ExistingPath @(
  $env:JAVA_HOME,
  "C:\Users\user\.jdks\azul-17.0.17",
  (Join-Path $env:ProgramFiles "Android\Android Studio\jbr"),
  (Join-Path $env:ProgramFiles "Android\Android Studio\jre")
)

if (-not $javaHome) {
  throw "JAVA_HOME not found. Install JDK 17 or Android Studio."
}

$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:NDK_HOME = $ndkRoot
$env:JAVA_HOME = $javaHome
$env:GRADLE_USER_HOME = Join-Path $repoRoot ".gradle-android-cache"

if (-not (Test-Path $env:GRADLE_USER_HOME)) {
  New-Item -ItemType Directory -Path $env:GRADLE_USER_HOME | Out-Null
}

$profileName = if ($Release) { "Release" } else { "Debug" }
$taskName = "assemble{0}{1}" -f ($Flavor.Substring(0, 1).ToUpper() + $Flavor.Substring(1)), $profileName

Write-Host "==> Repo: $repoRoot"
Write-Host "==> SDK:  $sdkRoot"
Write-Host "==> NDK:  $ndkRoot"
Write-Host "==> JAVA: $javaHome"
Write-Host "==> Task: $taskName"

Push-Location $repoRoot
try {
  npm run build
} finally {
  Pop-Location
}

Push-Location $androidProjectDir
try {
  & $gradleWrapper $taskName
} finally {
  Pop-Location
}

$apkProfileDir = if ($Release) { "release" } else { "debug" }
$apkBaseDir = Join-Path $androidProjectDir "app\build\outputs\apk"
$apkMatches = Get-ChildItem $apkBaseDir -Recurse -Filter *.apk -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match [regex]::Escape($apkProfileDir) } |
  Sort-Object LastWriteTime -Descending

if ($apkMatches) {
  Write-Host ""
  Write-Host "APK generated:"
  $apkMatches | Select-Object -First 5 | ForEach-Object { Write-Host $_.FullName }
} else {
  Write-Warning "Build finished but no APK was found under $apkBaseDir"
}
