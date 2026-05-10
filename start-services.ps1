# Nexora Platform - Start All Services
# Run this script from the project root directory
# Make sure all infrastructure services (MongoDB, Redis, Kafka, PostgreSQL, Elasticsearch) are running first

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Nexora Platform - Service Starter" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = "c:\Users\Ben\CascadeProjects\windsurf-project"

# Function to start a service in background
function Start-Service($path, $name, $port) {
    Write-Host "Starting $name on port $port..." -ForegroundColor Yellow
    Set-Location "$projectRoot\$path"
    $process = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -NoNewWindow -PassThru
    if ($process.Id) {
        Write-Host "✓ $name started (PID: $($process.Id))" -ForegroundColor Green
        return $process.Id
    } else {
        Write-Host "✗ Failed to start $name" -ForegroundColor Red
        return $null
    }
}

# Start backend services
Write-Host "--- Starting Backend Services ---" -ForegroundColor Cyan
$pids = @()

$pids += Start-Service "services\api_gateway" "API Gateway" "8080"
Start-Sleep -Seconds 2

$pids += Start-Service "services\auth_service" "Auth Service" "3001"
Start-Sleep -Seconds 2

$pids += Start-Service "services\feed_service" "Feed Service" "3002"
Start-Sleep -Seconds 2

$pids += Start-Service "services\messaging_service" "Messaging Service" "3003"
Start-Sleep -Seconds 2

$pids += Start-Service "services\livestream_service" "Livestream Service" "3004"
Start-Sleep -Seconds 2

$pids += Start-Service "services\user_service" "User Service" "3005"
Start-Sleep -Seconds 2

$pids += Start-Service "services\recommendation_service" "Recommendation Service" "3006"
Start-Sleep -Seconds 2

$pids += Start-Service "services\notification_service" "Notification Service" "3007"
Start-Sleep -Seconds 2

$pids += Start-Service "services\payment_service" "Payment Service" "3008"
Start-Sleep -Seconds 2

$pids += Start-Service "services\search_service" "Search Service" "3009"
Start-Sleep -Seconds 2

$pids += Start-Service "services\ai_inference_service" "AI Inference Service" "3010"
Start-Sleep -Seconds 2

# Start frontend apps
Write-Host "--- Starting Frontend Apps ---" -ForegroundColor Cyan
$pids += Start-Service "apps\web" "Web App" "5173"
Start-Sleep -Seconds 2

$pids += Start-Service "admin" "Admin Panel" "5174"
Start-Sleep -Seconds 2

# Return to project root
Set-Location $projectRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "All Services Started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service URLs:" -ForegroundColor Yellow
Write-Host "  - API Gateway: http://localhost:8080" -ForegroundColor White
Write-Host "  - Web App: http://localhost:5173" -ForegroundColor White
Write-Host "  - Admin Panel: http://localhost:5174" -ForegroundColor White
Write-Host ""
Write-Host "To stop all services, run stop-services.ps1" -ForegroundColor Yellow
Write-Host "Or press Ctrl+C in each terminal window" -ForegroundColor White
Write-Host ""

# Save PIDs to file for stopping services later
$pids | Where-Object { $_ -ne $null } | Out-File -FilePath "$projectRoot\service-pids.txt" -Encoding UTF8
Write-Host "Service PIDs saved to service-pids.txt" -ForegroundColor Gray
