param(
    [string]$DevEcoHome = 'C:\Program Files\Huawei\DevEco Studio',
    [string]$StageRoot = ([System.IO.Path]::GetTempPath()),
    [ValidateSet('tasks', 'assembleHap')][string]$Task = 'assembleHap'
)
$ErrorActionPreference = 'Stop'
$sourcePath = Join-Path $PSScriptRoot '..\harmony\probe'
$stagePath = Join-Path $StageRoot ('siji-harmony-' + [guid]::NewGuid().ToString('N'))
if ($stagePath -notmatch '^[A-Za-z0-9 :\\/@_.()\-]+$') {
    throw 'Hvigor requires an English project path. Pass -StageRoot with an ASCII temporary directory.'
}
New-Item -ItemType Directory -Path $stagePath | Out-Null
# Copy only source and official template assets; never follow dependency junctions.
foreach ($sourceName in @('AppScope','entry','hvigor','hvigorfile.ts','build-profile.json5','oh-package.json5')) {
    Copy-Item -LiteralPath (Join-Path $sourcePath $sourceName) -Destination $stagePath -Recurse
}
$moduleRoot = Join-Path $stagePath 'node_modules\@ohos'
New-Item -ItemType Directory -Path $moduleRoot -Force | Out-Null
foreach ($packageName in @('hvigor','hvigor-ohos-plugin')) {
    New-Item -ItemType Junction -Path (Join-Path $moduleRoot $packageName) `
        -Target (Join-Path $DevEcoHome ('tools\hvigor\' + $packageName)) | Out-Null
}
$previousNodePath = $env:NODE_PATH
$previousSdkHome = $env:DEVECO_SDK_HOME
$previousJavaHome = $env:JAVA_HOME
try {
    $env:NODE_PATH = Join-Path $stagePath 'node_modules'
    $env:DEVECO_SDK_HOME = Join-Path $DevEcoHome 'sdk'
    $env:JAVA_HOME = Join-Path $DevEcoHome 'jbr'
    Push-Location $stagePath
    try {
        Write-Output "Build staging directory: $stagePath"
        & (Join-Path $DevEcoHome 'tools\node\node.exe') `
            (Join-Path $DevEcoHome 'tools\hvigor\hvigor\bin\hvigor.js') `
            $Task --mode module -p product=default -p module=entry@default -p buildMode=debug --no-daemon
        $buildExitCode = $LASTEXITCODE
    } finally { Pop-Location }
} finally {
    $env:NODE_PATH = $previousNodePath
    $env:DEVECO_SDK_HOME = $previousSdkHome
    $env:JAVA_HOME = $previousJavaHome
}
Write-Output "Hvigor exit code: $buildExitCode"
if ($buildExitCode -eq 0 -and $Task -eq 'assembleHap') {
    $artifactPath = Join-Path $sourcePath 'build\validation'
    New-Item -ItemType Directory -Path $artifactPath -Force | Out-Null
    foreach ($artifactName in @('entry-default-unsigned.hap', 'pack.info')) {
        Copy-Item -LiteralPath (Join-Path $stagePath ('entry\build\default\outputs\default\' + $artifactName)) `
            -Destination $artifactPath
    }
    Get-FileHash -LiteralPath (Join-Path $artifactPath 'entry-default-unsigned.hap') -Algorithm SHA256
}
Write-Output 'Staging is retained for diagnostics. No signing or device installation is performed.'
exit $buildExitCode
