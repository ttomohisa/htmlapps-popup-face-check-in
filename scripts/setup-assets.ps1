param([string]$BuilderDist = '')
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Assets = Join-Path $Root 'assets'
New-Item -ItemType Directory -Force $Assets | Out-Null

if ($BuilderDist) {
  Write-Host 'BuilderDist is no longer required. OpenCV runtime has been removed.'
}

function Get-Sha256Hex([string]$Path) {
  $fileHash = Get-Command Get-FileHash -ErrorAction SilentlyContinue
  if ($fileHash) { return (Get-FileHash $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $stream = $null
  try {
    $stream = [System.IO.File]::OpenRead($Path)
    $bytes = $sha.ComputeHash($stream)
    return ([System.BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
  }
  finally {
    if ($stream) { $stream.Dispose() }
    $sha.Dispose()
  }
}

function Download-Asset([string]$Name,[string]$Uri) {
  $path = Join-Path $Assets $Name
  if (Test-Path $path -PathType Leaf) {
    Write-Host "Using existing $Name"
    return $path
  }
  Write-Host "Downloading $Name..."
  Invoke-WebRequest -Uri $Uri -OutFile $path
  return $path
}

# Retry only transient transport failures. Size/hash validation remains outside this loop.
function Test-TransientModelDownloadError($Failure) {
  $exception = $Failure.Exception
  while ($null -ne $exception) {
    if ($exception -is [System.TimeoutException]) { return $true }
    if ($exception -is [System.Net.WebException] -and $exception.Status -eq [System.Net.WebExceptionStatus]::Timeout) { return $true }
    $responseProperty = $exception.PSObject.Properties['Response']
    if ($null -ne $responseProperty -and $null -ne $responseProperty.Value) {
      $statusProperty = $responseProperty.Value.PSObject.Properties['StatusCode']
      if ($null -ne $statusProperty -and @([int]502, [int]504) -contains [int]$statusProperty.Value) { return $true }
    }
    $exception = $exception.InnerException
  }
  return $false
}

function Invoke-ModelDownload([string]$Uri, [string]$Path) {
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
      Invoke-WebRequest -Uri $Uri -OutFile $Path
      return
    } catch {
      if (Test-Path -LiteralPath $Path) { Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue }
      if ($attempt -ge 3 -or -not (Test-TransientModelDownloadError $_)) { throw }
      $delay = 2 * $attempt
      Write-Warning "Transient model download failure; retrying in $delay seconds (attempt $($attempt + 1)/3)."
      Start-Sleep -Seconds $delay
    }
  }
}

function Download-VerifiedAsset([string]$Name,[string]$Uri,[long]$Size,[string]$Sha256) {
  $path = Join-Path $Assets $Name
  $ok = $false
  if (Test-Path $path -PathType Leaf) {
    if ((Get-Item $path).Length -eq $Size) {
      $ok = (Get-Sha256Hex $path) -eq $Sha256
    }
  }
  if (-not $ok) {
    if (Test-Path $path) { Remove-Item $path -Force }
    Write-Host "Downloading $Name..."
    Invoke-ModelDownload -Uri $Uri -Path $path
    $actualSize = (Get-Item $path).Length
    $actualHash = Get-Sha256Hex $path
    if ($actualSize -ne $Size -or $actualHash -ne $Sha256) {
      Remove-Item $path -Force -ErrorAction SilentlyContinue
      throw "$Name verification failed. size=$actualSize sha256=$actualHash"
    }
  } else {
    Write-Host "$Name already verified."
  }
  return $path
}

$stale = @('ort-wasm-simd.wasm','face_recognition_sface_2021dec_int8bq.onnx','face_recognition_sface_2021dec.onnx')
foreach ($name in $stale) {
  $path = Join-Path $Assets $name
  if (Test-Path $path) { Remove-Item $path -Force; Write-Host "Removed unused $name" }
}

Download-Asset 'ort.wasm.min.js' 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.wasm.min.js' | Out-Null
Download-Asset 'ort-wasm-simd-threaded.mjs' 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort-wasm-simd-threaded.mjs' | Out-Null
Download-Asset 'ort-wasm-simd-threaded.wasm' 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort-wasm-simd-threaded.wasm' | Out-Null
Download-VerifiedAsset 'face_detection_yunet_2026may.onnx' 'https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2026may.onnx' 229738 'ebafce4e3c118d6554634be5c27ab333b4c047a9a8c3faf1d7cf93101c22f0f0' | Out-Null
Download-VerifiedAsset 'face_recognition_sface_2021dec_int8.onnx' 'https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec_int8.onnx' 9896933 '2b0e941e6f16cc048c20aee0c8e31f569118f65d702914540f7bfdc14048d78a' | Out-Null

Write-Host ''
Write-Host 'Runtime/model size:'
$total = 0L
foreach ($name in @('ort.wasm.min.js','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm','face_detection_yunet_2026may.onnx','face_recognition_sface_2021dec_int8.onnx')) {
  $path = Join-Path $Assets $name
  if (Test-Path $path -PathType Leaf) {
    $bytes = (Get-Item $path).Length
    $total += $bytes
    Write-Host ("  {0,-48} {1,7} MiB" -f $name, [Math]::Round($bytes / 1MB, 2))
  }
}
Write-Host ("  {0,-48} {1,7} MiB" -f 'TOTAL', [Math]::Round($total / 1MB, 2))
Write-Host ''
Write-Host 'Assets ready. YuNet + standard SFace INT8 run on ONNX Runtime Web. OpenCV is not used.'
