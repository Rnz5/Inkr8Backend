param(
    [string]$Node = 'node',
    [string]$FirebaseCli = '',
    [string]$EmulatorBinary = '',
    [string]$EvidenceDirectory = ''
)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
Set-Location -LiteralPath $PSScriptRoot
if ($EmulatorBinary) { $env:FIRESTORE_EMULATOR_BINARY_PATH = (Resolve-Path -LiteralPath $EmulatorBinary).Path }
if ($EvidenceDirectory) {
    New-Item -ItemType Directory -Force -Path $EvidenceDirectory | Out-Null
    $env:CAP10_EVIDENCE_DIR = (Resolve-Path -LiteralPath $EvidenceDirectory).Path
}
function Invoke-LocalFirestore([string]$TestCommand, [string]$Label) {
    $firebaseArgs = @('emulators:exec','--project','demo-inkr8','--only','firestore',$TestCommand)
    if ($FirebaseCli) { & $Node $FirebaseCli @firebaseArgs }
    else { & firebase.cmd @firebaseArgs }
    $script:LastSuiteExitCode = $LASTEXITCODE
    if ($env:CAP10_EVIDENCE_DIR -and (Test-Path -LiteralPath 'firestore-debug.log')) {
        Copy-Item -LiteralPath 'firestore-debug.log' -Destination (Join-Path $env:CAP10_EVIDENCE_DIR ($Label+'-emulator.log')) -Force
    }
}
# Each suite gets a new emulator process. Both commands retain their original concurrency/assertions.
Invoke-LocalFirestore 'npm --prefix functions run test:integration:coverage' 'functional'
$functionalCode = $script:LastSuiteExitCode
Invoke-LocalFirestore 'npm --prefix functions run test:concurrency:coverage' 'concurrency'
$concurrencyCode = $script:LastSuiteExitCode
if ($env:CAP10_EVIDENCE_DIR) {
    @{functionalExitCode=$functionalCode;concurrencyExitCode=$concurrencyCode;project='demo-inkr8';separateEmulatorProcesses=$true;emulatorBinary=$env:FIRESTORE_EMULATOR_BINARY_PATH;nodeExecutable=$Node} |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $env:CAP10_EVIDENCE_DIR 'firestore_suites.json') -Encoding utf8
}
if ($functionalCode -ne 0 -or $concurrencyCode -ne 0) { exit 1 }
exit 0
