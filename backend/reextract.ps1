$response = Invoke-RestMethod -Uri "http://localhost:3000/api/extract-all-content" -Method POST -ContentType "application/json" -Body '{}'
$response | ConvertTo-Json -Depth 5
