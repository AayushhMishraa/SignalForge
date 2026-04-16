// popup.js — SignalForge Popup Controller
document.addEventListener('DOMContentLoaded', async () => {
 const data = await chrome.storage.local.get('pendingWarning');
 if (data.pendingWarning) {
  showWarningView(data.pendingWarning);
 } else {
  showDefaultView();
 }
});

// ─── Warning View ─────────────────────────────────────────────────────────────
async function showWarningView(warning) {
 document.getElementById('default-view').classList.add('hidden');
 document.getElementById('warning-view').classList.remove('hidden');

 const levelConfig = {
  dangerous: {
   icon: '🚨',
   label: 'Dangerous Link',
   color: '#dc3545',
   accentColor: '#f8d7da',
   borderColor: '#f5c6cb',
   reasonBorder: '#dc3545'
  },
  suspicious: {
   icon: '⚠️',
   label: 'Suspicious Link',
   color: '#e67e00',
   accentColor: '#fff3cd',
   borderColor: '#ffc107',
   reasonBorder: '#ffc107'
  },
  potentially_harmful: {
   icon: 'ℹ️',
   label: 'Potentially Harmful',
   color: '#0d6efd',
   accentColor: '#d1ecf1',
   borderColor: '#90caf9',
   reasonBorder: '#90caf9'
  }
 };

 const cfg = levelConfig[warning.level] || levelConfig['suspicious'];

 // Theme the warning view background — dark style, color only on accents
 document.getElementById('warning-view').style.background = '#0f0f1a';

 // Icon + label + score
 document.getElementById('threat-icon').textContent = cfg.icon;
 document.getElementById('threat-label').textContent = cfg.label;
 // Keep red for dangerous, adjust for other levels
 const scoreColor = warning.level === 'dangerous' ? '#ff4444' :
  warning.level === 'suspicious' ? '#ccaa00' : '#4488cc';
 document.getElementById('threat-label').style.color = scoreColor;
 document.getElementById('score-display').textContent = warning.score + '/100';
 document.getElementById('score-display').style.color = scoreColor;

 // Tint the threat header border per level
 document.querySelector('.threat-header').style.borderColor =
  warning.level === 'dangerous' ? '#3d0000' :
  warning.level === 'suspicious' ? '#3d3d00' : '#003d3d';

 // URL
 document.getElementById('url-display').textContent = warning.url;

 // Reasons
 const reasonsList = document.getElementById('reasons-list');
 warning.reasons.forEach(r => {
  const li = document.createElement('li');
  li.textContent = r;
  li.style.borderLeftColor = cfg.reasonBorder;
  reasonsList.appendChild(li);
 });

 // Continue button — dark style, no color theming needed
 const continueBtn = document.getElementById('btn-continue');
 const attempts = warning.continueAttempts || 0;
 if (attempts >= 2) {
  continueBtn.textContent = 'Continue (Bypass Permanently)';
 }

 // Auto-continue countdown for potentially_harmful
 let autoInterval = null;
 if (warning.level === 'potentially_harmful') {
  let seconds = 10;
  continueBtn.textContent = `Auto-continuing in ${seconds}s — click to cancel`;
  autoInterval = setInterval(() => {
   seconds--;
   if (seconds > 0) {
    continueBtn.textContent = `Auto-continuing in ${seconds}s — click to cancel`;
   } else {
    clearInterval(autoInterval);
    autoInterval = null;
    chrome.runtime.sendMessage({ type: 'AUTO_CONTINUE', tabId: warning.tabId, url: warning.url });
   }
  }, 1000);
 }

 // AI Analysis
 try {
  const ai = await getAIAnalysis(warning.url, warning.score, warning.reasons);
  document.getElementById('scam-type').textContent = ai.scamType;
  document.getElementById('ai-explanation').textContent = ai.explanation;
 } catch (e) {
  document.getElementById('scam-type').textContent = 'General Phishing';
  document.getElementById('ai-explanation').textContent =
   'AI analysis could not be completed. This URL was flagged based on heuristic checks — proceed with caution.';
 }

 // Go Back button
 document.getElementById('btn-goback').addEventListener('click', () => {
  if (autoInterval) clearInterval(autoInterval);
  chrome.runtime.sendMessage({ type: 'GO_BACK', tabId: warning.tabId, url: warning.url });
 });

 // Continue Anyway button
 continueBtn.addEventListener('click', () => {
  if (autoInterval) {
   // First click cancels the countdown
   clearInterval(autoInterval);
   autoInterval = null;
   continueBtn.textContent = 'Continue Anyway';
  } else {
   chrome.runtime.sendMessage({ type: 'CONTINUE_ANYWAY', tabId: warning.tabId, url: warning.url });
  }
 });
}

// ─── Default View ─────────────────────────────────────────────────────────────
function showDefaultView() {
 document.getElementById('default-view').classList.remove('hidden');
 document.getElementById('warning-view').classList.add('hidden');

 loadHistory();

 // Manual scan
 const scanBtn = document.getElementById('btn-scan');
 const input = document.getElementById('manual-url');

 const runScan = async () => {
  let url = input.value.trim();
  if (!url) return;

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
   url = 'https://' + url;
  }

  try {
   new URL(url);
  } catch (e) {
   const resultDiv = document.getElementById('manual-result');
   resultDiv.classList.remove('hidden');
   resultDiv.innerHTML = '⚠️ Please enter a valid URL.';
   resultDiv.style.borderLeftColor = '#dc3545';
   resultDiv.style.color = '#dc3545';
   return;
  }

  const result = analyzeURL(url);
  const resultDiv = document.getElementById('manual-result');
  resultDiv.classList.remove('hidden');

  const levelColors = {
   dangerous: '#dc3545',
   suspicious: '#e67e00',
   potentially_harmful: '#0d6efd',
   safe: '#28a745'
  };
  const color = levelColors[result.level] || '#28a745';
  resultDiv.style.borderLeftColor = color;
  resultDiv.style.color = color;

  let html = `<strong>Score: ${result.score}/100 — ${result.level.replace('_', ' ').toUpperCase()}</strong>`;
  if (result.reasons.length > 0) {
   html += '<ul style="margin-top:8px;padding-left:16px;color:#495057;">';
   result.reasons.forEach(r => {
    html += `<li style="font-size:11px;margin:3px 0;">${r}</li>`;
   });
   html += '</ul>';
  } else {
   html += '<div style="font-size:12px;color:#28a745;margin-top:6px;">✅ No suspicious patterns detected.</div>';
  }
  resultDiv.innerHTML = html;
 };

 scanBtn.addEventListener('click', runScan);
 input.addEventListener('keydown', (e) => { if (e.key === 'Enter') runScan(); });

 // Clear history
 document.getElementById('btn-clear').addEventListener('click', async () => {
  await clearHistory();
  await chrome.storage.local.remove(['allowedURLs', 'bypassURL', 'continueCount', 'pendingWarning']);
  loadHistory();
 });
}

// ─── History ──────────────────────────────────────────────────────────────────
async function loadHistory() {
 const list = document.getElementById('history-list');
 list.innerHTML = '<div style="color:#adb5bd;font-size:12px;padding:8px 0;">Loading...</div>';

 const history = await getHistory();
 list.innerHTML = '';

 if (history.length === 0) {
  list.innerHTML = '<div style="color:#adb5bd;font-size:12px;padding:8px 0;">No scans yet.</div>';
  return;
 }

 history.slice(0, 20).forEach(item => {
  const div = document.createElement('div');
  div.className = 'history-item';

  const urlSpan = document.createElement('span');
  urlSpan.className = 'history-url';
  urlSpan.textContent = item.url;
  urlSpan.title = item.url;

  const scoreSpan = document.createElement('span');
  scoreSpan.className = 'history-score score-' + item.result.level;
  scoreSpan.textContent = item.result.score;

  div.appendChild(urlSpan);
  div.appendChild(scoreSpan);
  list.appendChild(div);
 });
}
