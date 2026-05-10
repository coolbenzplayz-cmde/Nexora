# Nexora Platform - Install All Dependencies
# Run this script from the project root directory

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Nexora Platform - Dependency Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = "c:\Users\Ben\CascadeProjects\windsurf-project"

# Function to install npm dependencies
function Install-NpmDependencies($path, $name) {
    Write-Host "Installing $name..." -ForegroundColor Yellow
    Set-Location "$projectRoot\$path"
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ $name installed successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to install $name" -ForegroundColor Red
    }
    Write-Host ""
}

# Install backend services
Write-Host "--- Installing Backend Services ---" -ForegroundColor Cyan
Install-NpmDependencies "services\api_gateway" "API Gateway"
Install-NpmDependencies "services\auth_service" "Auth Service"
Install-NpmDependencies "services\feed_service" "Feed Service"
Install-NpmDependencies "services\messaging_service" "Messaging Service"
Install-NpmDependencies "services\livestream_service" "Livestream Service"
Install-NpmDependencies "services\user_service" "User Service"
Install-NpmDependencies "services\recommendation_service" "Recommendation Service"
Install-NpmDependencies "services\notification_service" "Notification Service"
Install-NpmDependencies "services\payment_service" "Payment Service"
Install-NpmDependencies "services\search_service" "Search Service"
Install-NpmDependencies "services\ai_inference_service" "AI Inference Service"

# Install frontend apps
Write-Host "--- Installing Frontend Apps ---" -ForegroundColor Cyan
Install-NpmDependencies "apps\web" "Web App"
Install-NpmDependencies "admin" "Admin Panel"
Install-NpmDependencies "sdk" "SDK"

# Install Flutter dependencies for mobile app
Write-Host "--- Installing Mobile App Dependencies ---" -ForegroundColor Cyan
Write-Host "Installing Mobile App (Flutter)..." -ForegroundColor Yellow
Set-Location "$projectRoot\apps\mobile"
flutter pub get
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Mobile App dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install Mobile App dependencies" -ForegroundColor Red
    Write-Host "Note: Make sure Flutter is installed and added to PATH" -ForegroundColor Yellow
}
Write-Host ""

# Return to project root
Set-Location $projectRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Make sure MongoDB, Redis, Kafka, PostgreSQL, and Elasticsearch are running" -ForegroundColor White
Write-Host "2. Copy .env.example to .env and configure your environment variables" -ForegroundColor White
Write-Host "3. Run the services using start-services.ps1" -ForegroundColor White
Write-Host ""
