$ErrorActionPreference = 'Stop'
Unregister-ScheduledTask -TaskName 'Job Compass' -Confirm:$false -ErrorAction Stop
Write-Output 'Removed the Job Compass startup task. Any currently running service is unchanged.'
