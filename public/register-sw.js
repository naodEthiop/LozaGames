// Register service worker with update handling
const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    console.log('Service workers are not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    console.log('ServiceWorker registration successful');

    // Check for updates every hour
    setInterval(() => {
      registration.update().catch(err => 
        console.log('ServiceWorker update check failed:', err)
      );
    }, 60 * 60 * 1000);

    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      
      newWorker.addEventListener('statechange', () => {
        // When the new service worker is installed
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('New content is available; please refresh.');
          // Optional: Show update notification to user
          if (window.confirm('A new version is available. Update now?')) {
            window.location.reload();
          }
        }
      });
    });
  } catch (error) {
    console.error('ServiceWorker registration failed:', error);
  }
};

// Wait for page to load and register service worker
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  registerServiceWorker();
} else {
  window.addEventListener('DOMContentLoaded', registerServiceWorker);
}

// Listen for controller changes (when a new service worker takes over)
navigator.serviceWorker.addEventListener('controllerchange', () => {
  console.log('Controller changed');
  window.location.reload();
});
