// history.js — SignalForge Scan History Manager
const MAX_HISTORY = 20;
async function saveToHistory(entry) {
 const data = await chrome.storage.local.get('scanHistory');
 let history = data.scanHistory || [];
 history.unshift(entry); // Add to beginning
 if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
 await chrome.storage.local.set({ scanHistory: history });
}
async function getHistory() {
 const data = await chrome.storage.local.get('scanHistory');
 return data.scanHistory || [];
}
async function clearHistory() {
 await chrome.storage.local.remove('scanHistory');
}
