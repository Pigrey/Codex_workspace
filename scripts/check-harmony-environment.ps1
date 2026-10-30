param([string]$DevEcoHome)

# Read-only inspection. Does not inspect signing files, account state or device IDs.
$ErrorActionPreference = 'Continue'
$toolRows = foreach ($toolName in @('git', 'node', 'npm', 'java', 'hdc', 'ohpm', 'hvigor')) {
    $toolCommand = Get-Command $toolName -ErrorAction SilentlyContinue
    [pscustomobject]@{ Name = $toolName; Found = [bool]$toolCommand; Path = $toolCommand.Source }
}
$inspectionErrors = [System.Collections.Generic.List[string]]::new()
$osInfo = $null
$machineInfo = $null
$diskRows = @()
try { $osInfo = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop }
catch { $inspectionErrors.Add('OS CIM query unavailable: ' + $_.Exception.Message) }
try { $machineInfo = Get-CimInstance Win32_ComputerSystem -ErrorAction Stop }
catch { $inspectionErrors.Add('Memory CIM query unavailable: ' + $_.Exception.Message) }
try { $diskRows = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction Stop | ForEach-Object {
    [pscustomobject]@{ Drive = $_.DeviceID; FreeGiB = [math]::Round($_.FreeSpace / 1GB, 1) }
}) }
catch { $inspectionErrors.Add('Disk CIM query unavailable: ' + $_.Exception.Message) }
$candidatePaths = @(
    'C:\Program Files\Huawei\DevEco Studio',
    'C:\Program Files\Huawei\DevEco Studio Next',
    (Join-Path $env:USERPROFILE 'AppData\Local\Huawei'),
    (Join-Path $env:USERPROFILE 'AppData\Roaming\Huawei')
)
if ($DevEcoHome) { $candidatePaths += $DevEcoHome }
$pathRows = foreach ($candidatePath in ($candidatePaths | Select-Object -Unique)) {
    [pscustomobject]@{ Path = $candidatePath; Exists = Test-Path -LiteralPath $candidatePath }
}
$bundledRows = @()
if ($DevEcoHome -and (Test-Path -LiteralPath $DevEcoHome -PathType Container)) {
    # Tool discovery only; do not traverse signing/account directories.
    $bundledRows = Get-ChildItem -LiteralPath $DevEcoHome -File -Recurse -ErrorAction SilentlyContinue |
        Where-Object Name -In @('hdc.exe', 'ohpm.bat', 'hvigorw.bat', 'hvigor.js', 'node.exe', 'product-info.json') |
        Select-Object Name, FullName
}
[pscustomobject]@{
    OS = [pscustomobject]@{ Name = $osInfo.Caption; Version = $osInfo.Version; Architecture = $osInfo.OSArchitecture }
    RAMGiB = $(if ($machineInfo) { [math]::Round($machineInfo.TotalPhysicalMemory / 1GB, 1) } else { $null })
    Disks = @($diskRows)
    ToolsOnPath = @($toolRows)
    CandidatePaths = @($pathRows)
    BundledTools = @($bundledRows)
    InspectionErrors = @($inspectionErrors.ToArray())
    Note = 'Discovery only: does not certify SDK compatibility, signing, connected devices or successful build.'
} | ConvertTo-Json -Depth 6
if ($inspectionErrors.Count -gt 0) { exit 1 }
