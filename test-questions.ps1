# 测试不同类型的问题

$testQuestions = @(
    # 法院评论类
    "Is there any comments from the court about the route by which we have exercised our disciplinary powers?",
    
    # 事实查询类
    "What was the sanction imposed in SFAT 2021-5?",
    
    # 法律条款解释类
    "What is the meaning of section 194(1)(b) of the SFO?",
    
    # 比较分析类
    "How does SFAT 2021-5 differ from SFAT 2021-1?",
    
    # 程序问题类
    "What is the procedure for applying for anonymity?"
)

foreach ($q in $testQuestions) {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Testing: $q" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    $body = @{
        message = $q
    } | ConvertTo-Json

    $result = Invoke-RestMethod -Uri "http://localhost:3000/api/chat" -Method Post -ContentType "application/json" -Body $body
    
    Write-Host "`nAnswer:" -ForegroundColor Green
    Write-Host $result.answer
    Write-Host "`n"
}
