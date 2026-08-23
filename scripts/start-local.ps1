param([int]$Port=8765)
$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
$Assets=Join-Path $Root 'assets'
$required=@('ort.wasm.min.js','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm','face_detection_yunet_2026may.onnx','face_recognition_sface_2021dec_int8.onnx')
foreach($n in $required){if(-not(Test-Path(Join-Path $Assets $n))){throw "Missing assets\$n. Run setup-assets.bat first."}}
Copy-Item (Join-Path $Root 'src\index.template.html') (Join-Path $Root 'dev.html') -Force
$listener=[Net.HttpListener]::new();$listener.Prefixes.Add("http://localhost:$Port/");$listener.Start();Start-Process "http://localhost:$Port/dev.html";Write-Host "Pop-up Face Check-in: http://localhost:$Port/dev.html";Write-Host 'Ctrl+C to stop.'
try{while($listener.IsListening){$ctx=$listener.GetContext();$path=$ctx.Request.Url.LocalPath.TrimStart('/');if(-not$path){$path='dev.html'};$full=[IO.Path]::GetFullPath((Join-Path $Root $path));if(-not$full.StartsWith([IO.Path]::GetFullPath($Root)) -or -not(Test-Path $full)){$ctx.Response.StatusCode=404;$ctx.Response.Close();continue};$bytes=[IO.File]::ReadAllBytes($full);$ext=[IO.Path]::GetExtension($full).ToLower();$ctx.Response.ContentType=@{'.html'='text/html; charset=utf-8';'.js'='text/javascript; charset=utf-8';'.mjs'='text/javascript; charset=utf-8';'.wasm'='application/wasm';'.onnx'='application/octet-stream'}[$ext];if(-not$ctx.Response.ContentType){$ctx.Response.ContentType='application/octet-stream'};$ctx.Response.ContentLength64=$bytes.Length;$ctx.Response.OutputStream.Write($bytes,0,$bytes.Length);$ctx.Response.Close()}}finally{$listener.Stop();Remove-Item (Join-Path $Root 'dev.html') -ErrorAction SilentlyContinue}
