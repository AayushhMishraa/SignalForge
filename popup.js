// popup.js — SignalForge Popup Controller
document.addEventListener('DOMContentLoaded', async () => {
 const data = await chrome.storage.local.get('pendingWarning');
 if (data.pendingWarning) {
  showWarningView(data.pendingWarning);
 } else {
  showDefaultView();
 }
});

async function showWarningView(warning) {
 document.getElementById('default-view').classList.add('hidden');
 document.getElementById('warning-view').classList.remove('hidden');
 const badge = document.getElementById('threat-badge');
 badge.classList.add(warning.level);
 const badgeTextMap = {
  'dangerous': '🚨 DANGEROUS LINK',
  'suspicious': '⚠️ SUSPICIOUS LINK',
  'potentially_harmful': 'ℹ️ POTENTIALLY HARMFUL'
 };
 badge.textContent = badgeTextMap[warning.level] || '✅ SAFE';
 document.getElementById('score-display').textContent = warning.score + '/100 Threat Score';
 document.getElementById('score-display').style.color =
  warning.level === 'dangerous' ? '#B00020' :
  warning.level === 'suspicious' ? '#856404' :
  warning.level === 'potentially_harmful' ? '#1565C0' : '#1B5E20';
 document.getElementById('url-display').textContent = warning.url;
 const reasonsList = document.getElementById('reasons-list');
 warning.reasons.forEach(r => {
  const li = document.createElement('li');
  li.textContent = r;
  reasonsList.appendChild(li);
 });

 // Show bypass hint only on the 3rd attempt
 const attempts = warning.continueAttempts || 0;
 const continueBtn = document.getElementById('btn-continue');
 let autoInterval = null;

 if (warning.level === 'potentially_harmful') {
  let seconds = 5;
  continueBtn.textContent = `Auto-continuing in ${seconds}s...`;
  autoInterval = setInterval(() => {
   seconds--;
   if (seconds > 0) {
    continueBtn.textContent = `Auto-continuing in ${seconds}s...`;
   } else {
    clearInterval(autoInterval);
    chrome.runtime.sendMessage({ type: 'AUTO_CONTINUE', tabId: warning.tabId, url: warning.url });
   }
  }, 1000);
 } else {
  if (attempts >= 2) {
   continueBtn.textContent = 'Continue Anyway (click to bypass permanently)';
  }
 }

 // Get AI analysis
 const ai = await getAIAnalysis(warning.url, warning.score, warning.reasons);
 document.getElementById('scam-type').textContent = ai.scamType;
 document.getElementById('ai-explanation').textContent = ai.explanation;

 // Get redirect info
 document.getElementById('redirect-info').textContent = 'Checking redirect chain...';
 try {
  const redirectData = await checkRedirects(warning.url);
  if (redirectData.hops > 0) {
   document.getElementById('redirect-info').textContent =
    redirectData.hops + ' redirect(s) detected. Final URL: ' + redirectData.finalURL;
  } else {
   document.getElementById('redirect-info').textContent = 'No redirects detected.';
  }
 } catch (e) {
  document.getElementById('redirect-info').textContent = 'Could not check redirects.';
 }

 // Button handlers
 document.getElementById('btn-goback').addEventListener('click', () => {
  if (autoInterval) clearInterval(autoInterval);
  chrome.runtime.sendMessage({ type: 'GO_BACK', tabId: warning.tabId, url: warning.url });
 });
 continueBtn.addEventListener('click', () => {
  if (autoInterval) clearInterval(autoInterval);
  chrome.runtime.sendMessage({ type: 'CONTINUE_ANYWAY', tabId: warning.tabId, url: warning.url });
 });
}

async function showDefaultView() {
 document.getElementById('default-view').classList.remove('hidden');
 document.getElementById('warning-view').classList.add('hidden');
 loadHistory();
 document.getElementById('btn-scan').addEventListener('click', async () => {
  let url = document.getElementById('manual-url').value.trim();
  if (!url) return;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
   url = 'https://' + url;
  }
  const result = analyzeURL(url);
  const resultDiv = document.getElementById('manual-result');
  resultDiv.classList.remove('hidden');
  resultDiv.textContent = 'Threat Score: ' + result.score + '/100 — ' + result.level.toUpperCase();
  resultDiv.style.color =
   result.level === 'dangerous' ? '#B00020' :
   result.level === 'suspicious' ? '#856404' :
   result.level === 'potentially_harmful' ? '#1565C0' : '#1B5E20';
 });

 document.getElementById('btn-clear').addEventListener('click', async () => {
  await clearHistory();
  await chrome.storage.local.remove(['allowedURLs', 'bypassURL', 'continueCount', 'pendingWarning']);
  loadHistory();
 });
}

async function loadHistory() {
 const history = await getHistory();
 const list = document.getElementById('history-list');
 list.innerHTML = '';
 if (history.length === 0) {
  list.textContent = 'No scans yet.';
  return;
 }
 history.slice(0, 15).forEach(item => {
  const div = document.createElement('div');
  div.className = 'history-item';
  const urlSpan = document.createElement('span');
  urlSpan.className = 'history-url';
  urlSpan.textContent = item.url;
  const scoreSpan = document.createElement('span');
  scoreSpan.className = 'history-score score-' + item.result.level;
  scoreSpan.textContent = item.result.score;
  div.appendChild(urlSpan);
  div.appendChild(scoreSpan);
  list.appendChild(div);
 });
}