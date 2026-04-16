// content.js — SignalForge Content Script
console.log('SignalForge content script loaded.');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
 if (message.type === 'SHOW_SAFE_TOAST') {
  showSafeToast();
 }
});

function showSafeToast() {
 if (document.getElementById('sf-safe-toast')) return;

 const toast = document.createElement('div');
 toast.id = 'sf-safe-toast';
 toast.innerHTML = `
  <div style="display:flex;align-items:center;gap:10px;">
   <span style="font-size:18px;">✅</span>
   <div>
    <div style="font-weight:bold;font-size:13px;">SignalForge</div>
    <div style="font-size:12px;opacity:0.9;">Safe Website (Low Threat Score)</div>
   </div>
  </div>
 `;
 Object.assign(toast.style, {
  position: 'fixed', bottom: '20px', right: '20px',
  backgroundColor: '#1B5E20', color: '#fff',
  padding: '12px 16px', borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  zIndex: '2147483647', fontFamily: 'Arial, sans-serif',
  transition: 'all 0.4s ease', transform: 'translateY(80px)', opacity: '0',
  pointerEvents: 'none'
 });
 document.body.appendChild(toast);
 requestAnimationFrame(() => {
  toast.style.transform = 'translateY(0)';
  toast.style.opacity = '1';
 });
 setTimeout(() => {
  toast.style.transform = 'translateY(20px)';
  toast.style.opacity = '0';
  setTimeout(() => toast.parentNode && toast.parentNode.removeChild(toast), 500);
 }, 5000);
}
