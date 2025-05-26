$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$RootDir = Split-Path -Parent $ProjectRoot
Set-Location -Path $RootDir
uvicorn backend.main:app --host 127.0.0.1 --port 8001 --reload --reload-dir backend
