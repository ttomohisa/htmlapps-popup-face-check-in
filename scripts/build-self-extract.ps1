param([Parameter(Mandatory=$true)][string]$InputPath,[Parameter(Mandatory=$true)][string]$OutputPath,[string]$AppName='Standalone app',[string]$AppNameJa='Standalone app')
$ErrorActionPreference='Stop'
throw 'Self-extract output is disabled for this application in app.config.json. Enable it and replace this helper with the current htmlapps-template implementation before use.'
