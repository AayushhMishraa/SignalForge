// background.js — SignalForge Background Service Worker
importScripts('rules.js', 'history.js');

let popupWindowId = null;
let isProcessing = false;

const recentlyChecked = new Map();
const safeSitesCache = new Set();

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
 if (details.frameId !== 0) return;
 const url = details.url;
 if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return;
 if (url === 'about:blank' || url === 'about:newtab') return;

 if (isProcessing) return;

 // Normalize URL for cache: strip protocol so http:// and https:// of the same
 // domain are treated as one entry — prevents double-analysis after Chrome's
 // HTTPS interstitial redirects the user to the HTTP version of the same URL
 const normalizedURL = url.replace(/^https?:\/\//, '');
 const cacheKey = details.tabId + '_' + normalizedURL;
 const now = Date.now();
 if (recentlyChecked.has(cacheKey) && (now - recentlyChecked.get(cacheKey) < 60000)) return;
 recentlyChecked.set(cacheKey, now);

 const stored = await chrome.storage.local.get(['allowedURLs', 'bypassURL']);
 const allowedURLs = stored.allowedURLs || [];
 if (allowedURLs.includes(url)) return;
 if (stored.bypassURL === url) {
  await chrome.storage.local.remove('bypassURL');
  return;
 }

 const result = analyzeURL(url);
 await saveToHistory({ url, result, timestamp: new Date().toISOString() });

 if (result.score < 10) {
  safeSitesCache.add(cacheKey);
  return;
 }

 if (result.level !== 'safe') {
  isProcessing = true;
  safeSitesCache.delete(cacheKey);

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

  if (popupWindowId !== null) {
   try { await chrome.windows.remove(popupWindowId); } catch (e) {}
   popupWindowId = null;
  }

  try {
   let left, top;
   try {
    const currentWindow = await chrome.windows.getLastFocused();
    left = currentWindow.left + currentWindow.width - 440 - 10;
    top = currentWindow.top + 60;
   } catch (e) {}

   const winConfig = {
    url: chrome.runtime.getURL('popup.html'),
    type: 'popup',
    width: 440,
    height: 620,
    focused: true
   };
   if (left !== undefined) { winConfig.left = left; winConfig.top = top; }

   const win = await chrome.windows.create(winConfig);
   popupWindowId = win.id;
   // Force the popup to the front — needed when Chrome's own interstitial
   // steals focus immediately after window creation
   setTimeout(() => {
    chrome.windows.update(win.id, { focused: true, drawAttention: true });
   }, 150);
  } catch (e) {
   console.error('SignalForge: Failed to create popup window:', e);
   popupWindowId = null;
   isProcessing = false;
   return;
  }

  setTimeout(() => { isProcessing = false; }, 2000);
 }
});

chrome.webNavigation.onCompleted.addListener((details) => {
 if (details.frameId !== 0) return;
 const normalizedURL = details.url.replace(/^https?:\/\//, '');
 const cacheKey = details.tabId + '_' + normalizedURL;
 if (safeSitesCache.has(cacheKey)) {
  safeSitesCache.delete(cacheKey);
  chrome.tabs.sendMessage(details.tabId, { type: 'SHOW_SAFE_TOAST' }).catch(() => {});
 }
});

chrome.windows.onRemoved.addListener((windowId) => {
 if (windowId === popupWindowId) {
  popupWindowId = null;
  isProcessing = false;
  // Clear pendingWarning so extension icon popup shows default view
  chrome.storage.local.remove('pendingWarning');
 }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

 if (message.type === 'AUTO_CONTINUE') {
  (async () => {
   await chrome.storage.local.set({ bypassURL: message.url });
   await chrome.storage.local.remove('pendingWarning');
   if (sender.tab) {
    try { await chrome.windows.remove(sender.tab.windowId); } catch (e) {}
   }
   popupWindowId = null;
   isProcessing = false;
   chrome.tabs.update(message.tabId, { url: message.url });
   sendResponse({ success: true });
  })();
  return true;
 }

 if (message.type === 'CONTINUE_ANYWAY') {
  (async () => {
   const url = message.url;
   const tabId = message.tabId;

   const countData = await chrome.storage.local.get('continueCount');
   const continueCount = countData.continueCount || {};
   continueCount[url] = (continueCount[url] || 0) + 1;
   await chrome.storage.local.set({ continueCount });

   if (continueCount[url] >= 3) {
    const stored = await chrome.storage.local.get('allowedURLs');
    const allowedURLs = stored.allowedURLs || [];
    allowedURLs.push(url);
    await chrome.storage.local.set({ allowedURLs });
    delete continueCount[url];
    await chrome.storage.local.set({ continueCount });
   }

   await chrome.storage.local.set({ bypassURL: url });
   await chrome.storage.local.remove('pendingWarning');
   if (sender.tab) {
    try { await chrome.windows.remove(sender.tab.windowId); } catch (e) {}
   }
   popupWindowId = null;
   isProcessing = false;
   chrome.tabs.update(tabId, { url });
   sendResponse({ success: true });
  })();
  return true;
 }

 if (message.type === 'GO_BACK') {
  (async () => {
   await chrome.storage.local.remove('pendingWarning');
   const countData = await chrome.storage.local.get('continueCount');
   const continueCount = countData.continueCount || {};
   delete continueCount[message.url];
   await chrome.storage.local.set({ continueCount });
   if (sender.tab) {
    try { await chrome.windows.remove(sender.tab.windowId); } catch (e) {}
   }
   popupWindowId = null;
   isProcessing = false;
   try {
    await chrome.tabs.goBack(message.tabId);
   } catch (err) {
    await chrome.tabs.update(message.tabId, { url: 'chrome://newtab/' });
   }
   sendResponse({ success: true });
  })();
  return true;
 }

 return true;
});
