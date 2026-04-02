$body = @{
    message = "Leung Yuk Kit"
    category = "SFAT"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/chat" -Method POST -ContentType "application/json" -Body $body
$response | ConvertTo-Json -Depth 10
