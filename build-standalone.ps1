$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Template = Join-Path $Root 'src\index.template.html'
$Assets = Join-Path $Root 'assets'
$Dist = Join-Path $Root 'dist'
$Required = @(
  'ort.wasm.min.js',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
  'face_detection_yunet_2026may.onnx',
  'face_recognition_sface_2021dec_int8.onnx'
)
foreach ($name in $Required) {
  if (-not (Test-Path (Join-Path $Assets $name) -PathType Leaf)) {
    throw "Missing assets\$name. Run setup-assets.bat first."
  }
}

function New-GzipFile([string]$Source, [string]$Destination) {
  $input = $null
  $output = $null
  $gzip = $null
  try {
    $input = [System.IO.File]::OpenRead($Source)
    $output = [System.IO.File]::Create($Destination)
    $gzip = New-Object -TypeName System.IO.Compression.GZipStream -ArgumentList @($output, [System.IO.Compression.CompressionMode]::Compress)
    $input.CopyTo($gzip)
  }
  finally {
    if ($gzip) { $gzip.Dispose() }
    if ($output) { $output.Dispose() }
    if ($input) { $input.Dispose() }
  }
}

function Ensure-GzipFile([string]$Source, [string]$Destination) {
  $needsBuild = $true
  if (Test-Path $Destination -PathType Leaf) {
    $src = Get-Item $Source
    $dst = Get-Item $Destination
    if ($dst.Length -gt 0 -and $dst.LastWriteTimeUtc -ge $src.LastWriteTimeUtc) {
      $needsBuild = $false
    }
  }
  if ($needsBuild) {
    Write-Host ("Compressing {0}..." -f [IO.Path]::GetFileName($Source))
    New-GzipFile $Source $Destination
  }
}

function New-PayloadInfo(
  [string]$Label,
  [string]$Source,
  [string]$GzipPath,
  [double]$MinimumSavingPercent = 5.0,
  [bool]$ForceGzip = $false
) {
  Ensure-GzipFile $Source $GzipPath
  $rawBytes = (Get-Item $Source).Length
  $gzipBytes = (Get-Item $GzipPath).Length
  $saving = 0.0
  if ($rawBytes -gt 0) {
    $saving = (1.0 - ($gzipBytes / [double]$rawBytes)) * 100.0
  }
  $useGzip = $ForceGzip -or ($saving -ge $MinimumSavingPercent)
  if ($useGzip) {
    $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($GzipPath))
    $js = "{gzip:'$b64'}"
  }
  else {
    $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($Source))
    $js = "'$b64'"
  }
  return [PSCustomObject]@{
    Label = $Label
    RawBytes = $rawBytes
    PackedBytes = $(if ($useGzip) { $gzipBytes } else { $rawBytes })
    GzipBytes = $gzipBytes
    SavingPercent = $saving
    UseGzip = $useGzip
    Js = $js
  }
}

New-Item -ItemType Directory -Force $Dist | Out-Null
$html = Get-Content $Template -Raw -Encoding UTF8
$ortJs = Get-Content (Join-Path $Assets 'ort.wasm.min.js') -Raw -Encoding UTF8

$ortMjs = Join-Path $Assets 'ort-wasm-simd-threaded.mjs'
$ortWasm = Join-Path $Assets 'ort-wasm-simd-threaded.wasm'
$yunet = Join-Path $Assets 'face_detection_yunet_2026may.onnx'
$sface = Join-Path $Assets 'face_recognition_sface_2021dec_int8.onnx'

$ortMjsInfo = New-PayloadInfo 'ORT MJS' $ortMjs ($ortMjs + '.gz') 5.0 $false
# WASM is highly compressible and dominates the standalone payload, so always use gzip.
$ortWasmInfo = New-PayloadInfo 'ORT WASM' $ortWasm ($ortWasm + '.gz') 0.0 $true
$yunetInfo = New-PayloadInfo 'YuNet' $yunet ($yunet + '.gz') 5.0 $false
$sfaceInfo = New-PayloadInfo 'SFace INT8' $sface ($sface + '.gz') 5.0 $false

$ortMjsPayload = $ortMjsInfo.Js
$ortWasmPayload = $ortWasmInfo.Js
$yunetPayload = $yunetInfo.Js
$sfacePayload = $sfaceInfo.Js

$bootstrap = @"
<script>
window.__FACE_CHECK_EMBEDDED__=true;
window.__FACE_CHECK_ASSETS__={yunet:$yunetPayload,sface:$sfacePayload};
(function(){
  function bytesFromB64(b64){const s=atob(b64),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a}
  async function payloadBytes(payload){
    if(typeof payload==='string')return bytesFromB64(payload);
    if(payload&&payload.gzip){
      if(typeof DecompressionStream!=='function')throw new Error('DecompressionStream(gzip) is not supported by this browser.');
      const compressed=bytesFromB64(payload.gzip);
      const stream=new Blob([compressed],{type:'application/gzip'}).stream().pipeThrough(new DecompressionStream('gzip'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    throw new Error('Invalid embedded runtime payload.');
  }
  const mjsPayload=$ortMjsPayload;
  const wasmPayload=$ortWasmPayload;
  window.__FACE_CHECK_ORT_WASM_URLS__=(async()=>{
    const [mjsBytes,wasmBytes]=await Promise.all([payloadBytes(mjsPayload),payloadBytes(wasmPayload)]);
    return {
      mjs:URL.createObjectURL(new Blob([mjsBytes],{type:'text/javascript'})),
      wasm:URL.createObjectURL(new Blob([wasmBytes],{type:'application/wasm'}))
    };
  })();
})();
</script>
<script>
$ortJs
</script>
"@

$pattern = '(?s)<script>\s*window\.__FACE_CHECK_EMBEDDED__ = false;.*?</script>\s*<script src="assets/ort\.wasm\.min\.js"></script>'
$html = [System.Text.RegularExpressions.Regex]::Replace(
  $html,
  $pattern,
  [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $bootstrap },
  1
)

# Release HTML is fully self-contained; block runtime network access like htmlapps-template.
$html = $html.Replace("connect-src 'self' blob:;", "connect-src blob:;")

$out = Join-Path $Dist 'index.html'
[IO.File]::WriteAllText($out,$html,(New-Object Text.UTF8Encoding($false)))

Write-Host ''
foreach ($info in @($ortWasmInfo,$ortMjsInfo,$yunetInfo,$sfaceInfo)) {
  $rawMiB = [Math]::Round($info.RawBytes / 1MB, 2)
  $gzipMiB = [Math]::Round($info.GzipBytes / 1MB, 2)
  $saved = [Math]::Round($info.SavingPercent, 1)
  if ($info.UseGzip) {
    Write-Host ("{0}: {1} MiB raw -> {2} MiB gzip ({3}% smaller; gzip embedded)" -f $info.Label,$rawMiB,$gzipMiB,$saved)
  }
  else {
    Write-Host ("{0}: gzip saved only {1}%; raw embedded" -f $info.Label,$saved)
  }
}

$outBytes = (Get-Item $out).Length
$outMiB = [Math]::Round($outBytes / 1MB, 1)
$reportAssets = @()
foreach ($info in @($ortWasmInfo,$ortMjsInfo,$yunetInfo,$sfaceInfo)) {
  $reportAssets += [PSCustomObject]@{
    label = $info.Label
    rawBytes = [int64]$info.RawBytes
    packedBytes = [int64]$info.PackedBytes
    gzipBytes = [int64]$info.GzipBytes
    savingPercent = [Math]::Round($info.SavingPercent, 1)
    compression = $(if ($info.UseGzip) { 'gzip' } else { 'none' })
  }
}
$report = [PSCustomObject]@{
  app = 'Pop-up Face Check-in'
  version = [string]((Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'app.config.json') | ConvertFrom-Json).version)
  builtAtUtc = [DateTime]::UtcNow.ToString('o')
  output = 'dist/index.html'
  outputBytes = [int64]$outBytes
  outputMiB = $outMiB
  runtimeNetworkBlocked = $true
  assets = $reportAssets
}
$reportPath = Join-Path $Dist 'build-size-report.json'
[IO.File]::WriteAllText($reportPath, ($report | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding($false)))

Write-Host "Built: dist\index.html ($outMiB MB)"
Write-Host "Report: dist\build-size-report.json"
