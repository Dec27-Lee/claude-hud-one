param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$GradleArgs
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $repoRoot 'apps/android'
$toolsDir = Join-Path $repoRoot '.tools'
$jdkRoot = Join-Path $toolsDir 'jdk'
$gradleRoot = Join-Path $toolsDir 'gradle'
$androidSdk = Join-Path $toolsDir 'android-sdk'

function Test-Java17Available {
  try {
    $versionOutput = & cmd /c "java -version 2>&1"
    $versionText = ($versionOutput | Out-String)
    return ($versionText -match 'version "17\.' -or $versionText -match 'version "2[0-9]\.' -or $versionText -match 'openjdk 17\.' -or $versionText -match 'openjdk 2[0-9]\.')
  } catch {
    return $false
  }
}

function Ensure-AndroidPackage {
  param(
    [Parameter(Mandatory = $true)][string]$SdkRoot,
    [Parameter(Mandatory = $true)][string]$RelativePath,
    [Parameter(Mandatory = $true)][string]$DisplayName
  )
  $path = Join-Path $SdkRoot $RelativePath
  if (-not (Test-Path $path)) {
    throw "Android SDK is missing $DisplayName at $path. Install it before running Android validation."
  }
}

if (Test-Path $jdkRoot) {
  $jdk = Get-ChildItem $jdkRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1
  if ($jdk) {
    $env:JAVA_HOME = $jdk.FullName
    $env:Path = "$($jdk.FullName)\bin;$env:Path"
  }
}

if (-not (Test-Java17Available)) {
  throw 'Java 17+ is required for Android Gradle validation. Install JDK 17 or place it under .tools/jdk.'
}

if (Test-Path $androidSdk) {
  $env:ANDROID_HOME = $androidSdk
  $env:ANDROID_SDK_ROOT = $androidSdk
  $env:Path = "$androidSdk\platform-tools;$androidSdk\cmdline-tools\latest\bin;$env:Path"
  Ensure-AndroidPackage -SdkRoot $androidSdk -RelativePath 'platforms\android-34' -DisplayName 'platforms;android-34'
  Ensure-AndroidPackage -SdkRoot $androidSdk -RelativePath 'build-tools\34.0.0' -DisplayName 'build-tools;34.0.0'
  $localProperties = Join-Path $androidDir 'local.properties'
  $sdkEscaped = $androidSdk.Replace('\', '\\').Replace(':', '\:')
  $desiredLocalProperties = "sdk.dir=$sdkEscaped"
  $currentLocalProperties = if (Test-Path $localProperties) { (Get-Content -Raw -Path $localProperties -Encoding UTF8).Trim() } else { '' }
  if ($currentLocalProperties -ne $desiredLocalProperties) {
    Set-Content -Path $localProperties -Encoding utf8 -Value $desiredLocalProperties
  }
} else {
  $localProperties = Join-Path $androidDir 'local.properties'
  if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT -and -not (Test-Path $localProperties)) {
    throw "Android SDK was not found. Expected .tools/android-sdk, ANDROID_HOME/ANDROID_SDK_ROOT, or $localProperties."
  }
}

$localGradle = Join-Path $gradleRoot 'gradle-8.7/bin/gradle.bat'
$wrapper = Join-Path $androidDir 'gradlew.bat'
$gradle = if (Test-Path $localGradle) { $localGradle } else { $wrapper }

if (-not (Test-Path $gradle)) {
  throw "Gradle is not available. Expected $localGradle or $wrapper."
}

if (-not $GradleArgs -or $GradleArgs.Length -eq 0) {
  $GradleArgs = @('tasks')
}

& $gradle -p $androidDir @GradleArgs
exit $LASTEXITCODE
