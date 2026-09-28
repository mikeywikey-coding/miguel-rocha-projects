$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$taskName = 'Job Compass'
$task = Get-ScheduledTask -TaskName $taskName
if ($task.Actions.WorkingDirectory -ne $projectRoot) {
    throw 'The scheduled task points to a different project. Restart cancelled.'
}

Stop-ScheduledTask -TaskName $taskName
$deadline = (Get-Date).AddSeconds(30)
do {
    $listener = Get-NetTCPConnection -LocalPort 8123 -State Listen -ErrorAction SilentlyContinue
    $running = (Get-ScheduledTask -TaskName $taskName).State -eq 'Running'
    if (-not $listener -and -not $running) { break }
    if ((Get-Date) -ge $deadline) { throw 'The previous server has not stopped. No second server was started.' }
    Start-Sleep -Milliseconds 250
} while ($true)

Start-ScheduledTask -TaskName $taskName
$deadline = (Get-Date).AddSeconds(30)
do {
    try {
        $health = Invoke-RestMethod 'http://127.0.0.1:8123/api/health' -TimeoutSec 2
        if ($health.scheduler_running) {
            Write-Output 'Job Compass restarted successfully: http://127.0.0.1:8123'
            exit 0
        }
    } catch { }
    Start-Sleep -Milliseconds 250
} while ((Get-Date) -lt $deadline)
throw 'The service did not become healthy. Check data/service.log.'
