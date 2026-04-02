$db = Get-Content pdf_database.json -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Host "Total files: $($db.files.Count)"
Write-Host "First file: $($db.files[0].originalName)"
Write-Host "Content length: $($db.files[0].content.Length)"
Write-Host "Content preview:"
$db.files[0].content.Substring(0, [Math]::Min(2000, $db.files[0].content.Length))
