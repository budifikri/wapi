# File: run_api_request.ps1

# Header untuk permintaan API
$headers = @{
    "accept"    = "application/json"
    "x-api-key" = "654321"
}

# URL endpoint API
$url = "https://gi_pos_all.fikricloud.my.id/session/start/f8377d8d-a589-4242-9ba6-9486a04ef80c"

# Tampilkan waktu mulai
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Host "`n⏱️ Request Time: $timestamp"

# Mulai stopwatch untuk menghitung response time
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

try {
    # Kirim request GET
    $response = Invoke-RestMethod -Uri $url -Method Get -Headers $headers

    # Hentikan stopwatch
    $stopwatch.Stop()
    $responseTime = $stopwatch.ElapsedMilliseconds

    # Tampilkan hasil
    Write-Host "`n✅ API Response Received" -ForegroundColor Green
    Write-Host "🕒 Response Time: $responseTime ms"
    Write-Host "`n📦 Response Content:"
    $response | ConvertTo-Json -Depth 10 | Write-Host
}
catch {
    # Hentikan stopwatch jika error
    $stopwatch.Stop()
    $responseTime = $stopwatch.ElapsedMilliseconds

    # Tampilkan error
    Write-Host "`n❌ Failed to access API" -ForegroundColor Red
    Write-Host "🕒 Response Time: $responseTime ms"
    Write-Host "`n🧾 Error Details:"
    Write-Host $_
}
