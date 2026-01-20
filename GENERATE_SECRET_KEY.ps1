# PowerShell script to generate SECRET_KEY for Railway
# Run this script to generate a secure random secret key

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  יצירת SECRET_KEY ל-Railway" -ForegroundColor Cyan
Write-Host "========================================"
Write-Host ""

# Generate a secure random string (64 characters)
$chars = [char[]]((48..57) + (65..90) + (97..122))  # 0-9, A-Z, a-z
$secretKey = -join ((1..64) | ForEach-Object { $chars | Get-Random })

Write-Host "SECRET_KEY שנוצר:" -ForegroundColor Green
Write-Host ""
Write-Host $secretKey -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  העתק את הערך למעלה" -ForegroundColor Cyan
Write-Host "  והוסף אותו כ-Environment Variable ב-Railway:" -ForegroundColor Cyan
Write-Host "  Settings > Variables > SECRET_KEY" -ForegroundColor Cyan
Write-Host "========================================"
Write-Host ""

# Also copy to clipboard (Windows)
$secretKey | Set-Clipboard
Write-Host "✓ הועתק ל-Clipboard!" -ForegroundColor Green
Write-Host ""

Read-Host "לחץ Enter כדי לסגור"
