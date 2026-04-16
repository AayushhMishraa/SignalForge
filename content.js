// content.js — SignalForge Content Script
console.log('SignalForge content script loaded.');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SHOW_SAFE_TOAST') {
    showSafeToast();
  }
});

function showSafeToast() {
  // Prevent duplicate toasts
  if (document.getElementById('signalforge-safe-toast')) return;

  const toast = document.createElement('div');
  toast.id = 'signalforge-safe-toast';
  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 18px;">✅</span>
      <div>
        <div style="font-weight: bold; font-size: 13px;">SignalForge</div>
        <div style="font-size: 12px; opacity: 0.9;">Safe Website (Low Threat Score)</div>
      </div>
    </div>
  `;
  
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    backgroundColor: '#1B5E20', // Safe green
    color: '#ffffff',
    padding: '12px 16px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: '2147483647',
    fontFamily: 'Arial, sans-serif',
    transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    transform: 'translateY(100px)',
    opacity: '0',
    pointerEvents: 'none'
  });

  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });

  // Automatically remove after 5 seconds
  setTimeout(() => {
    toast.style.transform = 'translateY(20px)';
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 500);
  }, 5000);
}