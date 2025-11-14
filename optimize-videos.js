const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configuration
const CONFIG = {
  inputDir: path.join(__dirname, 'videos'),
  outputDir: path.join(__dirname, 'public', 'videos'),
  qualities: [
    { name: 'high', width: 1280, crf: 23, bitrate: '2M' },
    { name: 'medium', width: 854, crf: 25, bitrate: '1M' },
    { name: 'low', width: 640, crf: 28, bitrate: '500k' }
  ],
  formats: ['webm', 'mp4'],
  posterTime: '00:00:02.000', // Time to extract poster image
  threads: 0, // 0 = auto-detect
  tempDir: path.join(__dirname, 'temp')
};

// Ensure output directories exist
[CONFIG.outputDir, CONFIG.tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Check if FFmpeg is installed
function checkFFmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    console.error('Error: FFmpeg is not installed or not in system PATH');
    console.log('Please install FFmpeg to continue.');
    console.log('On macOS: brew install ffmpeg');
    console.log('On Ubuntu/Debian: sudo apt-get install ffmpeg');
    console.log('On Windows: Download from https://ffmpeg.org/download.html');
    return false;
  }
}

// Get video duration in seconds
function getVideoDuration(inputPath) {
  try {
    const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`;
    const output = execSync(cmd, { encoding: 'utf-8' }).trim();
    return parseFloat(output) || 0;
  } catch (error) {
    console.error(`Error getting duration for ${inputPath}:`, error.message);
    return 0;
  }
}

// Generate poster image from video
function generatePoster(inputPath, outputPath) {
  try {
    const cmd = `ffmpeg -y -i "${inputPath}" -ss ${CONFIG.posterTime} -vframes 1 -q:v 2 "${outputPath}"`;
    execSync(cmd, { stdio: 'inherit' });
    console.log(`Generated poster: ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`Error generating poster for ${inputPath}:`, error.message);
    return false;
  }
}

// Optimize video with FFmpeg
function optimizeVideo(inputPath, outputPath, options) {
  const { width, crf, bitrate, format } = options;
  const tempPath = path.join(CONFIG.tempDir, `${uuidv4()}.${format}`);
  
  try {
    let cmd;
    
    if (format === 'webm') {
      // VP9 codec for WebM
      cmd = [
        'ffmpeg', '-y', '-i', `"${inputPath}"`,
        '-c:v', 'libvpx-vp9',
        '-crf', crf,
        '-b:v', bitrate,
        '-threads', CONFIG.threads,
        '-cpu-used', '4', // Faster encoding with minor quality trade-off
        '-row-mt', '1', // Multi-threading for VP9
        '-tile-rows', '2', // Parallel encoding
        '-auto-alt-ref', '1',
        '-lag-in-frames', '25',
        '-deadline', 'good',
        '-pass', '1',
        '-f', 'webm',
        '/dev/null' // NUL on Windows
      ].join(' ');
      
      execSync(cmd, { stdio: 'inherit' });
      
      cmd = [
        'ffmpeg', '-y', '-i', `"${inputPath}"`,
        '-c:v', 'libvpx-vp9',
        '-crf', crf,
        '-b:v', bitrate,
        '-threads', CONFIG.threads,
        '-cpu-used', '2', // Better quality for second pass
        '-row-mt', '1',
        '-tile-rows', '2',
        '-auto-alt-ref', '1',
        '-lag-in-frames', '25',
        '-deadline', 'good',
        '-pass', '2',
        '-f', 'webm',
        `"${tempPath}"`
      ].join(' ');
    } else {
      // H.264 codec for MP4
      cmd = [
        'ffmpeg', '-y', '-i', `"${inputPath}"`,
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-crf', crf,
        '-b:v', bitrate,
        '-movflags', '+faststart',
        '-profile:v', 'high',
        '-level', '4.0',
        '-pix_fmt', 'yuv420p',
        '-threads', CONFIG.threads,
        '-f', 'mp4',
        `"${tempPath}"`
      ].join(' ');
    }
    
    // Add width filter if specified
    if (width) {
      cmd = cmd.replace('-i', `-vf "scale='min(${width},iw)':-2" -i`);
    }
    
    execSync(cmd, { stdio: 'inherit' });
    
    // Move the temp file to the final location
    fs.renameSync(tempPath, outputPath);
    
    console.log(`Optimized: ${outputPath} (${format}, ${width || 'original'}px)`);
    return true;
  } catch (error) {
    console.error(`Error optimizing ${inputPath}:`, error.message);
    
    // Clean up temp file if it exists
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    
    return false;
  }
}

// Process all videos in the input directory
async function processVideos() {
  if (!checkFFmpeg()) {
    process.exit(1);
  }
  
  const files = fs.readdirSync(CONFIG.inputDir);
  const videoFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.mp4', '.mov', '.mkv', '.avi', '.webm'].includes(ext);
  });
  
  if (videoFiles.length === 0) {
    console.log('No video files found in the input directory.');
    return;
  }
  
  console.log(`Found ${videoFiles.length} video(s) to process.`);
  
  // Process each video file
  for (const file of videoFiles) {
    const inputPath = path.join(CONFIG.inputDir, file);
    const baseName = path.basename(file, path.extname(file));
    
    console.log(`\nProcessing: ${file}`);
    
    // Generate poster image
    const posterPath = path.join(CONFIG.outputDir, `${baseName}-poster.jpg`);
    if (!fs.existsSync(posterPath)) {
      console.log('Generating poster image...');
      generatePoster(inputPath, posterPath);
    } else {
      console.log('Poster image already exists, skipping...');
    }
    
    // Process each quality and format
    for (const quality of CONFIG.qualities) {
      for (const format of CONFIG.formats) {
        const outputFileName = `${baseName}-${quality.name}.${format}`;
        const outputPath = path.join(CONFIG.outputDir, outputFileName);
        
        if (fs.existsSync(outputPath)) {
          console.log(`Skipping existing: ${outputFileName}`);
          continue;
        }
        
        console.log(`Optimizing to ${quality.name} quality (${format})...`);
        optimizeVideo(inputPath, outputPath, { ...quality, format });
      }
    }
    
    // Also create a default version without quality suffix
    for (const format of CONFIG.formats) {
      const outputFileName = `${baseName}.${format}`;
      const outputPath = path.join(CONFIG.outputDir, outputFileName);
      
      if (fs.existsSync(outputPath)) {
        console.log(`Skipping existing: ${outputFileName}`);
        continue;
      }
      
      // Use high quality for default version
      const quality = CONFIG.qualities.find(q => q.name === 'high') || CONFIG.qualities[0];
      
      console.log(`Creating default version (${format})...`);
      optimizeVideo(inputPath, outputPath, { ...quality, format });
    }
  }
  
  // Clean up temp directory
  try {
    fs.rmdirSync(CONFIG.tempDir, { recursive: true });
  } catch (error) {
    console.error('Error cleaning up temp directory:', error.message);
  }
  
  console.log('\nVideo optimization complete!');
}

// Run the script
processVideos().catch(error => {
  console.error('Error processing videos:', error);
  process.exit(1);
});
