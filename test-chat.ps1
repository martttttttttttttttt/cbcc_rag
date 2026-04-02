$body = @{
    message = "Is there any comments from the court about the route by which we have exercised our disciplinary powers?"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/chat" -Method Post -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 10
