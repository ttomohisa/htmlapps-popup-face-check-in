param([Parameter(Mandatory=$true)][string]$Path,[string]$ExpectedSourcePath='')
$ErrorActionPreference='Stop'
throw 'Self-extract output is disabled for this application in app.config.json.'
