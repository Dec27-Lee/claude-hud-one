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

if (Test-Path $jdkRoot) {
  $jdk = Get-ChildItem $jdkRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1
  if ($jdk) {
    $env:JAVA_HOME = $jdk.FullName
    $env:Path = "$($jdk.FullName)\bin;$env:Path"
  }
}

if (Test-Path $androidSdk) {
  $env:ANDROID_HOME = $androidSdk
  $env:ANDROID_SDK_ROOT = $androidSdk
  $env:Path = "$androidSdk\platform-tools;$androidSdk\cmdline-tools\latest\bin;$env:Path"
  $localProperties = Join-Path $androidDir 'local.properties'
  $sdkEscaped = $androidSdk.Replace('\', '\\').Replace(':', '\:')
  Set-Content -Path $localProperties -Encoding utf8 -Value "sdk.dir=$sdkEscaped"
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
