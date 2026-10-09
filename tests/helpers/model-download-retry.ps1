$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $Root 'scripts/setup-assets.ps1'), [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Setup script must parse successfully.' }
# Load real production functions without executing top-level model downloads.
foreach ($function in $ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $false)) {
  . ([ScriptBlock]::Create($function.Extent.Text))
}
Add-Type -TypeDefinition @'
public class ModelTestResponse {
  public int StatusCode { get; private set; }
  public ModelTestResponse(int status) { StatusCode = status; }
}
public class ModelTestHttpException : System.Exception {
  public ModelTestResponse Response { get; private set; }
  public ModelTestHttpException(int status) : base("Synthetic HTTP " + status) { Response = new ModelTestResponse(status); }
}
'@
$Assets = Join-Path ([IO.Path]::GetTempPath()) ('model-retry-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Assets | Out-Null
$script:bytes = [Text.Encoding]::UTF8.GetBytes('Synthetic verified model bytes')
$algorithm = [Security.Cryptography.SHA256]::Create()
try { $expectedHash = ([BitConverter]::ToString($algorithm.ComputeHash($script:bytes))).Replace('-', '').ToLowerInvariant() } finally { $algorithm.Dispose() }
$Uri = 'https://example.invalid/synthetic-model'
function Assert-Equal($Actual, $Expected, [string]$Message) { if ($Actual -ne $Expected) { throw ($Message + ': expected ' + $Expected + ', got ' + $Actual) } }
function Reset-Test([object[]]$Outcomes) {
  $script:outcomes = @($Outcomes)
  $script:calls = @()
  $script:delays = @()
  $script:index = 0
  Get-ChildItem -LiteralPath $Assets -File | Remove-Item -Force
}
function Invoke-WebRequest([string]$Uri, [string]$OutFile) {
  $script:calls += $Uri
  $outcome = $script:outcomes[$script:index]
  $script:index++
  [IO.File]::WriteAllBytes($OutFile, [byte[]]@(1, 2))
  if ($outcome -eq 'timeout') { throw (New-Object TimeoutException 'Synthetic timeout') }
  if ($outcome -eq 'web-timeout') { throw (New-Object Net.WebException('Synthetic timeout', [Net.WebExceptionStatus]::Timeout)) }
  if ($outcome -eq 'other') { throw (New-Object IO.IOException 'Synthetic permanent I/O error') }
  if ($outcome -is [int]) { throw (New-Object ModelTestHttpException($outcome)) }
  [IO.File]::WriteAllBytes($OutFile, $script:bytes)
}
function Start-Sleep([int]$Seconds) { $script:delays += $Seconds }
function Run-Download([string]$Hash = $expectedHash, [long]$Size = $script:bytes.Length) {
  Download-VerifiedAsset 'model.onnx' $Uri $Size $Hash | Out-Null
}
function Expect-Failure([string]$Pattern, [string]$Hash = $expectedHash, [long]$Size = $script:bytes.Length) {
  $failed = $false
  try { Run-Download $Hash $Size } catch { $failed = $true; if ($_.Exception.Message -notmatch $Pattern) { throw } }
  if (-not $failed) { throw 'Expected download failure.' }
}
try {
  foreach ($transient in @(502, 504, 'timeout', 'web-timeout')) {
    Reset-Test @($transient, 'ok')
    Run-Download
    Assert-Equal $script:calls.Count 2 'Transient recovery request count'
    Assert-Equal ($script:delays -join ',') '2' 'Transient recovery backoff'
    Assert-Equal (($script:calls | Select-Object -Unique) -join ',') $Uri 'Retry keeps the exact URL'
    Assert-Equal (Get-Sha256Hex (Join-Path $Assets 'model.onnx')) $expectedHash 'Verified success bytes'
  }
  Reset-Test @(504, 502, 'ok')
  Run-Download
  Assert-Equal $script:calls.Count 3 'Third attempt success'
  Assert-Equal ($script:delays -join ',') '2,4' 'Increasing bounded backoff'
  Reset-Test @(504, 504, 504, 'ok')
  Expect-Failure '504'
  Assert-Equal $script:calls.Count 3 'Maximum total attempts'
  Assert-Equal ($script:delays -join ',') '2,4' 'No sleep after final failure'
  Assert-Equal (Test-Path (Join-Path $Assets 'model.onnx')) $false 'Failed transfer leaves no partial asset'
  foreach ($permanent in @(400, 403, 404, 500, 'other')) {
    Reset-Test @($permanent, 'ok')
    Expect-Failure 'Synthetic'
    Assert-Equal $script:calls.Count 1 'Permanent failure is not retried'
    Assert-Equal $script:delays.Count 0 'Permanent failure has no backoff'
    Assert-Equal (Test-Path (Join-Path $Assets 'model.onnx')) $false 'Permanent transfer failure leaves no partial asset'
  }
  Reset-Test @('ok', 'ok')
  Expect-Failure 'verification failed' ('0' * 64)
  Assert-Equal $script:calls.Count 1 'Hash mismatch is not retried'
  Assert-Equal (Test-Path (Join-Path $Assets 'model.onnx')) $false 'Hash mismatch bytes removed'
  Reset-Test @('ok', 'ok')
  Expect-Failure 'verification failed' $expectedHash ($script:bytes.Length + 1)
  Assert-Equal $script:calls.Count 1 'Size mismatch is not retried'
  Assert-Equal (Test-Path (Join-Path $Assets 'model.onnx')) $false 'Size mismatch bytes removed'
  Reset-Test @('ok')
  Run-Download
  Run-Download
  Assert-Equal $script:calls.Count 1 'Verified cached asset is reused'
  Write-Host 'Model download retry checks passed.'
} finally { Remove-Item -LiteralPath $Assets -Recurse -Force }
