// background.js — SignalForge Background Service Worker
importScripts('rules.js', 'history.js');

let popupWindowId = null;
let isProcessing = false; // Lock to prevent concurrent popup creation

// Simple guard to prevent infinite loops (e.g. from rapid page reloads)
const recentlyChecked = new Map();
const safeSitesCache = new Set(); // Track safe sites needing a toast

// Listen for navigations before they happen
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
 // Only check main frame navigations
 if (details.frameId !== 0) return;
 const url = details.url;
 // Skip internal Chrome pages
 if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return;
 if (url === 'about:blank' || url === 'about:newtab') return;

 // Prevent concurrent processing
 if (isProcessing) return;

 // Loop guard: skip repeated executions for the same tab/URL combo within 60 seconds
 const cacheKey = details.tabId + '_' + url;
 const now = Date.now();
 if (recentlyChecked.has(cacheKey) && (now - recentlyChecked.get(cacheKey) < 60000)) {
  return; 
 }
 recentlyChecked.set(cacheKey, now);

 // Check if URL is allowed (user clicked Continue 3 times) or temporarily bypassed
 const stored = await chrome.storage.local.get(['allowedURLs', 'bypassURL']);
 const allowedURLs = stored.allowedURLs || [];
 if (allowedURLs.includes(url)) return;
 // One-time bypass for Continue Anyway navigation
 if (stored.bypassURL === url) {
  await chrome.storage.local.remove('bypassURL');
  return;
 }

 // Run the URL through the analysis engine
 const result = analyzeURL(url);
 // Save to history regardless of score
 await saveToHistory({ url, result, timestamp: new Date().toISOString() });

 // If score is very low, mark as safe and queue up a toast
 if (result.score < 10) {
  safeSitesCache.add(cacheKey);
  return;
 }

 // If suspicious or dangerous, open popup
 if (result.level !== 'safe') {
  isProcessing = true;
  safeSitesCache.delete(cacheKey); // don't show toast for non-safe sites

  // Get current continue count for this URL
  const countData = await chrome.storage.local.get('continueCount');
  const continueCount = countData.continueCount || {};
  const urlCount = continueCount[url] || 0;

  const warningData = {
   url,
   score: result.score,
   reasons: result.reasons,
   level: result.level,
   tabId: details.tabId,
   continueAttempts: urlCount
  };
  await chrome.storage.local.set({ pendingWarning: warningData });

  // Close existing popup if open
  if (popupWindowId !== null) {
   try { await chrome.windows.remove(popupWindowId); } catch (e) {}
   popupWindowId = null;
  }

  // Open popup window on the right side
  try {
   const currentWindow = await chrome.windows.getCurrent();
   const popupWidth = 420;
   const popupHeight = 600;
   const left = currentWindow.left + currentWindow.width - popupWidth - 10;
   const top = currentWindow.top + 80;
   const win = await chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    width: popupWidth,
    height: popupHeight,
    left: left,
    top: top,
    focused: true
   });
   popupWindowId = win.id;
  } catch (e) {
   const win = await chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    width: 420,
    height: 600,
    focused: true
   });
   popupWindowId = win.id;
  }

  // Release lock after a short delay to debounce rapid events
  setTimeout(() => { isProcessing = false; }, 2000);
 }
});

// Trigger safe toast when page finishes loading
chrome.webNavigation.onCompleted.addListener((details) => {
 if (details.frameId !== 0) return;
 const cacheKey = details.tabId + '_' + details.url;
 if (safeSitesCache.has(cacheKey)) {
  safeSitesCache.delete(cacheKey);
  // Send message to content script to display the toast
  chrome.tabs.sendMessage(details.tabId, { type: 'SHOW_SAFE_TOAST' }).catch(() => {
   // content script might not be injected or ready on empty/chrome pages, safely ignore
  });
 }
});

// Clean up when popup window is closed manually
chrome.windows.onRemoved.addListener((windowId) => {
 if (windowId === popupWindowId) {
  popupWindowId = null;
  isProcessing = false;
 }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AUTO_CONTINUE') {
  (async () => {
   const url = message.url;
   const tabId = message.tabId;

   // Set bypass so the next navigation to this URL is allowed
   await chrome.storage.local.set({ bypassURL: url });
   await chrome.storage.local.remove('pendingWarning');

   // Close the popup window
   if (sender.tab) {
    try { await chrome.windows.remove(sender.tab.windowId); } catch (e) {}
   }
   popupWindowId = null;
   isProcessing = false;

   // Navigate to the URL
   chrome.tabs.update(tabId, { url: url });

   sendResponse({ success: true });
  })();
  return true;
 }

 if (message.type === 'CONTINUE_ANYWAY') {
  (async () => {
   const url = message.url;
   const tabId = message.tabId;

   // Increment continue count for this URL
   const countData = await chrome.storage.local.get('continueCount');
   const continueCount = countData.continueCount || {};
   continueCount[url] = (continueCount[url] || 0) + 1;
   await chrome.storage.local.set({ continueCount });

   // If user clicked Continue 3 times, permanently allow the URL
   if (continueCount[url] >= 3) {
    const stored = await chrome.storage.local.get('allowedURLs');
    const allowedURLs = stored.allowedURLs || [];
    allowedURLs.push(url);
    await chrome.storage.local.set({ allowedURLs });
    // Clean up count
    delete continueCount[url];
    await chrome.storage.local.set({ continueCount });
   }

   // Set bypass so the next navigation to this URL is allowed
   await chrome.storage.local.set({ bypassURL: url });
   await chrome.storage.local.remove('pendingWarning');

   // Close the popup window
   if (sender.tab) {
    try { await chrome.windows.remove(sender.tab.windowId); } catch (e) {}
   }
   popupWindowId = null;
   isProcessing = false;

   // Navigate to the URL
   chrome.tabs.update(tabId, { url: url });

   sendResponse({ success: true });
  })();
  return true; // Keep channel open for async
 }

 if (message.type === 'GO_BACK') {
  (async () => {
   await chrome.storage.local.remove('pendingWarning');
   // Reset continue count for this URL
   const countData = await chrome.storage.local.get('continueCount');
   const continueCount = countData.continueCount || {};
   delete continueCount[message.url];
   await chrome.storage.local.set({ continueCount });

   // Close the popup window
   if (sender.tab) {
    try { await chrome.windows.remove(sender.tab.windowId); } catch (e) {}
   }
   popupWindowId = null;
   isProcessing = false;

   try {
    await chrome.tabs.goBack(message.tabId);
   } catch (err) {
    // If goBack fails (e.g. from a chrome-error:// page), navigate to a new tab instead
    await chrome.tabs.update(message.tabId, { url: "chrome://newtab/" });
   }
   sendResponse({ success: true });
  })();
  return true;
 }

 return true;
});