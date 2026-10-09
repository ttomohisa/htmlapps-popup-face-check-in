param([switch]$SkipBuild)
$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
$required=@(
'.editorconfig','.gitattributes','.gitignore','AGENTS.md','APP_SPEC.md','CHANGELOG.md','CONTRIBUTING.md','LICENSE','README-FIRST.txt','README.ja.md','README.md','SECURITY.md','THIRD_PARTY_NOTICES.md','VERIFY_OFFLINE.md','app.config.json','dependencies.json','build-standalone.bat','build-standalone.ps1',
'components\README.md','components\async-state.html','components\confirm-dialog.html','components\mobile-bottom-bar.html','components\popover-menu.html','components\setting-field.html','components\toast.html',
'docs\ARCHITECTURE.md','docs\COMPONENTS.md','docs\COMPONENTS.ja.md','docs\DEPENDENCIES.md','docs\LLM_WORKFLOW.md','docs\LLM_WORKFLOW.ja.md',
'examples\dependencies.dayjs.json','schemas\app-config.schema.json','schemas\dependencies.schema.json',
'scripts\build-self-extract.ps1','scripts\check-repository.ps1','scripts\verify-self-extract.ps1','scripts\verify-standalone.ps1','src\index.template.html','assets\screenshot.png','assets\screenshot-mobile.png',
'.github\ISSUE_TEMPLATE\bug_report.yml','.github\ISSUE_TEMPLATE\config.yml','.github\ISSUE_TEMPLATE\feature_request.yml','.github\pull_request_template.md','.github\workflows\build-standalone.yml','.github\workflows\deploy-pages.yml'
)
foreach($relative in $required){if(-not(Test-Path(Join-Path $Root $relative))){throw "Required htmlapps-template path is missing: $relative"}}
& (Join-Path $Root 'scripts\check.ps1')
if(-not $SkipBuild){
  $assetNames=@('ort.wasm.min.js','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm','face_detection_yunet_2026may.onnx','face_recognition_sface_2021dec_int8.onnx')
  $assetsReady=$true
  foreach($name in $assetNames){if(-not(Test-Path(Join-Path $Root ('assets\'+$name)))){$assetsReady=$false}}
  if($assetsReady){& (Join-Path $Root 'build-standalone.ps1'); & (Join-Path $Root 'scripts\verify-standalone.ps1')}
  else{Write-Warning 'Runtime/model assets are not present. Run setup-assets.bat before build verification.'}
}
Write-Host '[OK] htmlapps-template repository alignment check passed.' -ForegroundColor Green
