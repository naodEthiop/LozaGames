# Optimize all MP4 videos in the videos directory
$videosPath = "d:\LozaGames\videos"
$ffmpegPath = "ffmpeg"  # Make sure ffmpeg is in your PATH

# Get all MP4 files except those already optimized
$videos = Get-ChildItem -Path $videosPath -Filter "*.mp4" | 
    Where-Object { $_.Name -notlike "*_optimized*" }

foreach ($video in $videos) {
    $outputWebM = Join-Path $videosPath ($video.BaseName + ".webm")
    $outputPoster = Join-Path $videosPath ($video.BaseName + "-poster.jpg")
    
    Write-Host "Processing $($video.Name)..." -ForegroundColor Cyan
    
    # Convert to WebM (VP9 codec)
    & $ffmpegPath -i $video.FullName `
        -c:v libvpx-vp9 -b:v 1M -crf 30 -threads 4 -speed 2 -tile-columns 2 -frame-parallel 1 -row-mt 1 `
        -c:a libopus -b:a 128k -ac 2 -ar 48000 `
        -pass 1 -f webm -y NUL
    
    & $ffmpegPath -i $video.FullName `
        -c:v libvpx-vp9 -b:v 1M -crf 30 -threads 4 -speed 1 -tile-columns 2 -frame-parallel 1 -row-mt 1 `
        -auto-alt-ref 1 -lag-in-frames 25 -g 240 -deadline good -qcomp 0.8 -aq-mode 0 -c:a libopus -b:a 128k -ac 2 -ar 48000 `
        -pass 2 -y $outputWebM
    
    # Create poster image
    & $ffmpegPath -i $video.FullName -ss 00:00:01.000 -vframes 1 -q:v 2 -y $outputPoster
    
    # Optional: Create optimized MP4 (H.265) as fallback
    $outputMP4 = Join-Path $videosPath ($video.BaseName + "_optimized.mp4")
    & $ffmpegPath -i $video.FullName -c:v libx265 -crf 28 -preset medium -c:a aac -b:a 128k -movflags +faststart -y $outputMP4
    
    # Clean up log files
    Remove-Item -Path "ffmpeg2pass-0.log" -ErrorAction SilentlyContinue
}

Write-Host "All videos processed successfully!" -ForegroundColor Green