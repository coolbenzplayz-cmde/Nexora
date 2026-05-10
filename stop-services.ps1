# Nexora Platform - Stop All Services
# Run this script from the project root directory

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Nexora Platform - Service Stopper" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = "c:\Users\Ben\CascadeProjects\windsurf-project"
$pidFile = "$projectRoot\service-pids.txt"

if (-not (Test-Path $pidFile)) {
    Write-Host "No service PIDs file found. Services may not have been started with start-services.ps1" -ForegroundColor Yellow
    Write-Host "You can manually stop services by closing their terminal windows or using Task Manager" -ForegroundColor White
    exit 0
}

$pids = Get-Content $pidFile

Write-Host "Stopping services..." -ForegroundColor Yellow

foreach ($pid in $pids) {
    try {
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($process) {
            Stop-Process -Id $pid -Force
            Write-Host "✓ Stopped process (PID: $pid)" -ForegroundColor Green
        } else {
            Write-Host "- Process (PID: $pid) not running" -ForegroundColor Gray
        }
    } catch {
        Write-Host "✗ Failed to stop process (PID: $pid)" -ForegroundColor Red
    }
}

# Remove PID file
Remove-Item $pidFile -Force

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "All Services Stopped!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
