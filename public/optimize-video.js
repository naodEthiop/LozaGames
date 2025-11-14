// Optimize video loading and handle offline scenarios
document.addEventListener('DOMContentLoaded', () => {
  const videoElement = document.querySelector('video');
  
  if (!videoElement) return;

  // Only autoplay on desktop and if not in data saver mode
  const isDataSaver = navigator.connection?.saveData === true;
  const isSlowConnection = navigator.connection ? 
    (navigator.connection.effectiveType === 'slow-2g' || 
     navigator.connection.effectiveType === '2g') : false;

  if (!isDataSaver && !isSlowConnection) {
    videoElement.muted = true;
    videoElement.playsInline = true;
    
    // Try autoplay, fallback to click-to-play
    const playPromise = videoElement.play();
    
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay failed, show play button
        const playButton = document.createElement('button');
        playButton.className = 'video-play-button';
        playButton.innerHTML = '▶️ Play Video';
        playButton.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          padding: 12px 24px;
          font-size: 1.2em;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          z-index: 10;
        `;
        
        videoElement.parentNode.style.position = 'relative';
        videoElement.parentNode.appendChild(playButton);
        
        playButton.addEventListener('click', () => {
          videoElement.play().then(() => {
            playButton.style.display = 'none';
          });
        });
      });
    }
  }

  // Handle offline scenario
  if (!navigator.onLine) {
    videoElement.poster = '/images/offline-poster.jpg'; // Add a poster for offline
    videoElement.controls = true;
  }

  // Listen for online/offline changes
  window.addEventListener('online', () => {
    if (videoElement.poster) {
      videoElement.poster = '';
      videoElement.load();
    }
  });

  window.addEventListener('offline', () => {
    if (!videoElement.poster) {
      videoElement.poster = '/images/offline-poster.jpg';
      videoElement.controls = true;
    }
  });
});
