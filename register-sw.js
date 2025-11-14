// Service Worker Registration with Enhanced Error Handling
const registerServiceWorker = async () => {
  // Check for service worker support
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers are not supported in this browser');
    return false;
  }

  try {
    // Register the service worker
    const registration = await navigator.serviceWorker.register('service-worker.js', {
      scope: '/',
      updateViaCache: 'none' // Always check for updates
    });

    console.log('ServiceWorker registration successful with scope: ', registration.scope);

    // Check for updates immediately and then every 1 hour
    const checkForUpdates = () => {
      registration.update().catch(err => 
        console.debug('ServiceWorker update check failed:', err)
      );
    };
    
    // Initial check
    checkForUpdates();
    
    // Schedule periodic checks (every hour)
    const updateInterval = setInterval(checkForUpdates, 60 * 60 * 1000);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      console.log('New service worker found. Installing...');
      const newWorker = registration.installing;
      
      newWorker.addEventListener('statechange', () => {
        switch(newWorker.state) {
          case 'installed':
            if (navigator.serviceWorker.controller) {
              // New update available
              console.log('New content is available; please refresh.');
              
              // Show update notification (customize this UI as needed)
              const updateUI = document.createElement('div');
              updateUI.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #333;
                color: white;
                padding: 12px 24px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                gap: 16px;
                z-index: 10000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
              `;
              
              updateUI.innerHTML = `
                <span>New version available!</span>
                <button style="
                  background: #4CAF50;
                  border: none;
                  color: white;
                  padding: 6px 12px;
                  border-radius: 4px;
                  cursor: pointer;
                ">Update Now</button>
              `;
              
              const updateButton = updateUI.querySelector('button');
              updateButton.onclick = () => {
                newWorker.postMessage({ action: 'skipWaiting' });
              };
              
              document.body.appendChild(updateUI);
            } else {
              console.log('Content is now available offline!');
            }
            break;
            
          case 'redundant':
            console.error('The installing service worker became redundant.');
            break;
        }
      });
    });

    // Handle controller change (when new service worker takes over)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      console.log('New service worker activated. Reloading page...');
      window.location.reload();
    });

    // Clean up interval on page unload
    window.addEventListener('beforeunload', () => {
      clearInterval(updateInterval);
    });

    return true;
    
  } catch (error) {
    console.error('ServiceWorker registration failed:', error);
    return false;
  }
};

// Start the registration when the page loads
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  // Load immediately if page already loaded
  registerServiceWorker();
} else {
  // Wait for DOM to load
  window.addEventListener('DOMContentLoaded', registerServiceWorker);
}

// Listen for messages from the service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'RELOAD_PAGE') {
      window.location.reload();
    }
  });
}
