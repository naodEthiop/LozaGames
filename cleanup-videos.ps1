# Cleanup unused video files

# Define the videos directory
$videosDir = Join-Path $PSScriptRoot "videos"

# Define which files to keep (optimized versions and posters)
$filesToKeep = @(
    "black-poster.jpg",
    "black.webm",
    "black_optimized.mp4",
    "blue-poster.jpg",
    "blue.webm",
    "blue_optimized.mp4",
    "green-poster.jpg",
    "green.webm",
    "green_optimized.mp4",
    "pink-poster.jpg",
    "pink.webm",
    "pink_optimized.mp4",
    "purple-poster.jpg",
    "purple.webm",
    "purple_optimized.mp4",
    "red-poster.jpg",
    "red.webm",
    "red_optimized.mp4",
    "white-poster.jpg",
    "white.webm",
    "white_optimized.mp4",
    "yellow-poster.jpg",
    "yellow.webm",
    "yellow_optimized.mp4",
    "intro-poster.jpg",
    "intro.webm",
    "intro_optimized.mp4",
    "closing-poster.jpg",
    "closing.webm",
    "closing_optimized.mp4"
)

# Get all files in the videos directory
$allFiles = Get-ChildItem -Path $videosDir -File
$deletedCount = 0
$keptCount = 0

Write-Host "Starting video cleanup in: $videosDir" -ForegroundColor Cyan

# Process each file
foreach ($file in $allFiles) {
    if ($filesToKeep -contains $file.Name) {
        $keptCount++
    } else {
        try {
            Remove-Item -Path $file.FullName -Force
            Write-Host "Deleted: $($file.Name)" -ForegroundColor Red
            $deletedCount++
        } catch {
            Write-Host "Error deleting $($file.Name): $_" -ForegroundColor Yellow
        }
    }
}

# Summary
Write-Host "`nCleanup complete!" -ForegroundColor Green
Write-Host "Files kept: $keptCount" -ForegroundColor Green
Write-Host "Files deleted: $deletedCount" -ForegroundColor Green

# Verify the remaining files
$remainingFiles = Get-ChildItem -Path $videosDir -File
Write-Host "`nRemaining files:" -ForegroundColor Cyan
$remainingFiles | Select-Object Name, @{Name="SizeMB";Expression={"{0:N2}" -f ($_.Length/1MB)}} | Format-Table -AutoSize
