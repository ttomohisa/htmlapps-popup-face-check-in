param(
  [string]$Path
)
$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
if([string]::IsNullOrWhiteSpace($Path)){$Path=Join-Path $Root 'dist\index.html'}
if(-not(Test-Path $Path -PathType Leaf)){throw "Standalone HTML not found: $Path"}
$html=Get-Content $Path -Raw -Encoding UTF8
foreach($token in @("connect-src blob:;","window.__FACE_CHECK_EMBEDDED__=true","Pop-up Face Check-in","face_detection_yunet_2026may.onnx","sface-2021dec-int8-ort")){
  if(-not$html.Contains($token)){throw "Standalone verification failed. Missing: $token"}
}
if($html -match "connect-src\s+(?:'self'|https?:)"){throw 'Standalone HTML must not allow network connect-src origins; only blob: is permitted for the embedded WASM runtime.'}
if($html -match '<script\s+src='){throw 'Standalone HTML must not contain an external script src.'}
if($html -match 'assets/ort\.wasm\.min\.js'){throw 'Standalone HTML still references the local ORT script.'}
if($html -match 'https?://[^"'' ]+\.(?:js|wasm|onnx)'){throw 'Standalone HTML contains an external runtime asset URL.'}
Write-Host '[OK] Standalone verification passed.' -ForegroundColor Green
