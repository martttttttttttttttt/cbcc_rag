$body = @{
    message = "Is there any comments from the court about the route by which we have exercised our disciplinary powers?"
} | ConvertTo-Json

Write-Host "Testing court comment question..." -ForegroundColor Cyan
$result = Invoke-RestMethod -Uri "http://localhost:3000/api/chat" -Method Post -ContentType "application/json" -Body $body

Write-Host "`n=== ANSWER ===" -ForegroundColor Green
Write-Host $result.answer
Write-Host "`n=== SOURCES ===" -ForegroundColor Green
$result.sources | Format-List
