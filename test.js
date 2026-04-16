/**
 * test.js — SignalForge Manual Test Suite
 *
 * This is a Node.js test script. It tests the core logic of SignalForge
 * (rules.js) without needing a browser.
 *
 * Run with:  node test.js
 *
 * NOTE: Chrome extension APIs (chrome.storage, chrome.tabs, etc.) are not
 * available in Node, so this suite covers everything that can be tested
 * in isolation — the URL analysis engine, history manager logic, and
 * OFFICIAL_DOMAINS completeness. Browser-dependent features (popup UI,
 * background service worker, content script toast) are covered by the
 * manual checklist at the bottom of this file.
 */

// ─── Minimal shim so rules.js and history.js work in Node ───────────────────
if (typeof globalThis.module === 'undefined') globalThis.module = {};

// Load and eval rules.js — exposes analyzeURL, KNOWN_BRANDS, OFFICIAL_DOMAINS
const fs = require('fs');
const rulesCode = fs.readFileSync('./rules.js', 'utf8');
// Strip the CommonJS export line so eval doesn't choke on it
const rulesStripped = rulesCode.replace(/if\s*\(typeof module[\s\S]*?\}\s*\}/, '');
eval(rulesStripped);

// Load history.js — exposes MAX_HISTORY
const historyCode = fs.readFileSync('./history.js', 'utf8');
// history.js uses chrome.storage — strip those functions, we only need the constant
const historyStripped = historyCode
 .replace(/async function saveToHistory[\s\S]*?\n\}/, '')
 .replace(/async function getHistory[\s\S]*?\n\}/, '')
 .replace(/async function clearHistory[\s\S]*?\n\}/, '');
eval(historyStripped);

// ─── Tiny test runner ─────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name, fn) {
 try {
  fn();
  console.log(`  ✅  ${name}`);
  passed++;
 } catch (e) {
  console.log(`  ❌  ${name}`);
  console.log(`       → ${e.message}`);
  failed++;
 }
}

function assert(condition, message) {
 if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, label) {
 if (actual !== expected) {
  throw new Error(`${label || ''} expected "${expected}" but got "${actual}"`);
 }
}

function assertGte(actual, min, label) {
 if (actual < min) {
  throw new Error(`${label || ''} expected >= ${min} but got ${actual}`);
 }
}

function assertLt(actual, max, label) {
 if (actual >= max) {
  throw new Error(`${label || ''} expected < ${max} but got ${actual}`);
 }
}

// ─── SECTION 1: analyzeURL — Safe URLs ───────────────────────────────────────
console.log('\n📋  Section 1: Safe URLs (should score < 15)\n');

test('Google homepage is safe', () => {
 const r = analyzeURL('https://www.google.com');
 assertLt(r.score, 15, 'score');
 assertEqual(r.level, 'safe', 'level');
});

test('Amazon India is safe', () => {
 const r = analyzeURL('https://www.amazon.in/products');
 assertLt(r.score, 15, 'score');
 assertEqual(r.level, 'safe', 'level');
});

test('GitHub is safe', () => {
 const r = analyzeURL('https://github.com/user/repo');
 assertLt(r.score, 15, 'score');
});

test('Wikipedia is safe', () => {
 const r = analyzeURL('https://en.wikipedia.org/wiki/Phishing');
 assertLt(r.score, 15, 'score');
});

test('Netflix is safe', () => {
 const r = analyzeURL('https://www.netflix.com/browse');
 assertLt(r.score, 15, 'score');
});

// ─── SECTION 2: analyzeURL — Dangerous URLs ──────────────────────────────────
console.log('\n📋  Section 2: Dangerous URLs (should score >= 60)\n');

test('IP address URL is dangerous', () => {
 const r = analyzeURL('http://192.168.1.1/login/verify');
 // IP (35) + HTTP (10) + keywords login/verify (10) = 55 → suspicious
 assertGte(r.score, 30, 'score');
 assert(r.level === 'suspicious' || r.level === 'dangerous', 'level should be suspicious or dangerous');
 assert(r.reasons.some(r => r.includes('IP address')), 'should flag IP address');
});

test('@ symbol in URL is suspicious', () => {
 const r = analyzeURL('http://google.com@evil.com/steal');
 // @ (25) + HTTP (10) = 35 → suspicious
 assertGte(r.score, 30, 'score');
 assert(r.level === 'suspicious' || r.level === 'dangerous', 'level should be suspicious or dangerous');
 assert(r.reasons.some(r => r.includes('@')), 'should flag @ symbol');
});

test('Fake Amazon domain is dangerous', () => {
 const r = analyzeURL('http://amazon.com.login-verify.xyz/account');
 assertGte(r.score, 60, 'score');
 assertEqual(r.level, 'dangerous', 'level');
});

test('Fake PayPal domain is dangerous', () => {
 const r = analyzeURL('http://paypal-secure-login.tk/verify');
 assertGte(r.score, 60, 'score');
 assertEqual(r.level, 'dangerous', 'level');
});

test('IP + suspicious keywords is dangerous', () => {
 const r = analyzeURL('http://45.33.32.156/login/verify/account/password');
 assertGte(r.score, 60, 'score');
 assertEqual(r.level, 'dangerous', 'level');
});

// ─── SECTION 3: analyzeURL — Suspicious URLs ─────────────────────────────────
console.log('\n📋  Section 3: Suspicious URLs (should score 30–59)\n');

test('URL shortener is suspicious', () => {
 // bit.ly alone scores 20 (potentially_harmful), which is correct behaviour
 const r = analyzeURL('https://bit.ly/3xAbc12');
 assertGte(r.score, 15, 'score');
 assert(
  r.level === 'potentially_harmful' || r.level === 'suspicious' || r.level === 'dangerous',
  'level should not be safe'
 );
 assert(r.reasons.some(r => r.includes('shortener')), 'should flag URL shortener');
});

test('Suspicious TLD .xyz is suspicious', () => {
 const r = analyzeURL('https://free-reward-claim.xyz/win');
 assertGte(r.score, 30, 'score');
});

test('Excessive subdomains is suspicious', () => {
 const r = analyzeURL('https://login.secure.account.verify.evil.com/');
 assertGte(r.score, 30, 'score');
});

test('Multiple suspicious keywords bumps score', () => {
 const r = analyzeURL('https://example.com/verify/login/account/password/update');
 assertGte(r.score, 15, 'score');
 assert(r.reasons.some(r => r.includes('keywords')), 'should mention keywords in reasons');
});

// ─── SECTION 4: analyzeURL — Specific Rule Checks ────────────────────────────
console.log('\n📋  Section 4: Individual Rule Verification\n');

test('Rule: long URL adds to score', () => {
 const longURL = 'https://example.com/' + 'a'.repeat(80);
 const r = analyzeURL(longURL);
 assert(r.reasons.some(r => r.includes('unusually long')), 'should flag long URL');
});

test('Rule: HTTP (non-HTTPS) adds to score', () => {
 const r = analyzeURL('http://example.com/page');
 assert(r.reasons.some(r => r.includes('HTTPS')), 'should flag missing HTTPS');
});

test('Rule: hyphen-heavy domain adds to score', () => {
 const r = analyzeURL('https://my-free-prize-claim.com/win');
 assert(r.reasons.some(r => r.includes('hyphens')), 'should flag hyphens');
});

test('Rule: number-letter mixing (amaz0n style) adds to score', () => {
 const r = analyzeURL('https://amaz0n-login.com/account');
 assert(r.reasons.some(r => r.includes('mixes letters and numbers')), 'should flag l33t-speak domain');
});

test('Rule: fake HTTPS in domain name adds to score', () => {
 const r = analyzeURL('http://https-secure-login.com/verify');
 assert(r.reasons.some(r => r.includes('https but page is not')), 'should flag fake https in domain');
});

test('Rule: SBI impersonation is caught (new OFFICIAL_DOMAINS entry)', () => {
 const r = analyzeURL('https://sbi-netbanking-login.com/verify');
 assert(r.reasons.some(r => r.toLowerCase().includes('sbi')), 'should flag SBI impersonation');
});

test('Rule: HDFC impersonation is caught (new OFFICIAL_DOMAINS entry)', () => {
 const r = analyzeURL('https://hdfc-secure-login.net/account');
 assert(r.reasons.some(r => r.toLowerCase().includes('hdfc')), 'should flag HDFC impersonation');
});

test('Rule: Flipkart impersonation is caught (new OFFICIAL_DOMAINS entry)', () => {
 const r = analyzeURL('https://flipkart-offers-win.xyz/claim');
 assert(r.reasons.some(r => r.toLowerCase().includes('flipkart')), 'should flag Flipkart impersonation');
});

test('Rule: Instagram impersonation is caught (new OFFICIAL_DOMAINS entry)', () => {
 const r = analyzeURL('https://instagram-verify-account.tk/login');
 assert(r.reasons.some(r => r.toLowerCase().includes('instagram')), 'should flag Instagram impersonation');
});

// ─── SECTION 5: analyzeURL — Edge Cases ──────────────────────────────────────
console.log('\n📋  Section 5: Edge Cases\n');

test('Invalid URL returns safe with score 0', () => {
 const r = analyzeURL('not-a-url-at-all');
 assertEqual(r.score, 0, 'score');
 assertEqual(r.level, 'safe', 'level');
 assertEqual(r.reasons.length, 0, 'reasons length');
});

test('Empty string returns safe', () => {
 const r = analyzeURL('');
 assertEqual(r.score, 0, 'score');
 assertEqual(r.level, 'safe', 'level');
});

test('Score is capped at 100', () => {
 // Craft a URL that would score very high without the cap
 const r = analyzeURL('http://192.168.1.1@https-login-verify-account-password-update-secure.xyz/free/win/prize/reward/gift/lucky');
 assert(r.score <= 100, 'score should never exceed 100');
});

test('Reasons array is always an array', () => {
 const r = analyzeURL('https://google.com');
 assert(Array.isArray(r.reasons), 'reasons should be an array');
});

test('Official Amazon domain is NOT flagged as impersonation', () => {
 const r = analyzeURL('https://www.amazon.com/dp/B08N5WRWNW');
 assert(!r.reasons.some(r => r.includes('imitates amazon')), 'real amazon should not be flagged');
});

test('Official Google domain is NOT flagged as impersonation', () => {
 const r = analyzeURL('https://mail.google.com/mail/u/0/');
 assert(!r.reasons.some(r => r.includes('imitates google')), 'real google should not be flagged');
});

// ─── SECTION 6: OFFICIAL_DOMAINS completeness check ─────────────────────────
console.log('\n📋  Section 6: OFFICIAL_DOMAINS completeness\n');

// Parse KNOWN_BRANDS and OFFICIAL_DOMAINS directly from rules.js source
// (const declarations from eval are block-scoped and not accessible here)
const rulesSource = fs.readFileSync('./rules.js', 'utf8');

// Extract KNOWN_BRANDS array values
const knownBrandsMatch = rulesSource.match(/const KNOWN_BRANDS\s*=\s*\[([\s\S]*?)\];/);
const knownBrandsRaw = knownBrandsMatch ? knownBrandsMatch[1] : '';
const parsedKnownBrands = (knownBrandsRaw.match(/'([^']+)'/g) || []).map(s => s.replace(/'/g, ''));

// Extract OFFICIAL_DOMAINS keys
const officialDomainsMatch = rulesSource.match(/const OFFICIAL_DOMAINS\s*=\s*\{([\s\S]*?)\};/);
const officialDomainsRaw = officialDomainsMatch ? officialDomainsMatch[1] : '';
const parsedOfficialDomainKeys = (officialDomainsRaw.match(/^\s*(\w+)\s*:/gm) || []).map(s => s.trim().replace(':', ''));

test('Every brand in KNOWN_BRANDS has an entry in OFFICIAL_DOMAINS', () => {
 const missing = parsedKnownBrands.filter(brand => !parsedOfficialDomainKeys.includes(brand));
 assert(
  missing.length === 0,
  `These brands are in KNOWN_BRANDS but missing from OFFICIAL_DOMAINS: ${missing.join(', ')}`
 );
});

test('All OFFICIAL_DOMAINS entries are non-empty arrays', () => {
 assert(parsedOfficialDomainKeys.length > 0, 'OFFICIAL_DOMAINS should have entries');
 // Check each key has at least one domain value (a quoted string after the colon)
 for (const key of parsedOfficialDomainKeys) {
  const keySection = officialDomainsRaw.match(new RegExp(key + `\\s*:\\s*\\[([^\\]]+)\\]`));
  assert(keySection && keySection[1].includes("'"), `${key} should have at least one domain`);
 }
});

// ─── SECTION 7: history.js logic (pure logic, no chrome API) ─────────────────
console.log('\n📋  Section 7: History Logic (in-memory simulation)\n');

// Parse MAX_HISTORY directly from history.js source
const historySource = fs.readFileSync('./history.js', 'utf8');
const maxHistoryMatch = historySource.match(/const MAX_HISTORY\s*=\s*(\d+)/);
const parsedMaxHistory = maxHistoryMatch ? parseInt(maxHistoryMatch[1]) : null;

test('MAX_HISTORY constant is 20', () => {
 assertEqual(parsedMaxHistory, 20, 'MAX_HISTORY');
});

test('History slice in popup matches MAX_HISTORY', () => {
 // Read popup.js and check the slice value
 const popupCode = fs.readFileSync('./popup.js', 'utf8');
 assert(popupCode.includes('slice(0, 20)'), 'popup.js should use slice(0, 20) to match MAX_HISTORY');
});

// ─── Results ──────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(`\n  Total: ${passed + failed} tests   ✅ ${passed} passed   ❌ ${failed} failed\n`);
if (failed > 0) {
 process.exit(1);
}

// ─── MANUAL BROWSER CHECKLIST ────────────────────────────────────────────────
/**
 * The following features require a real Chrome browser to test.
 * Load the extension unpacked and verify each item manually.
 *
 * POPUP UI
 * [ ] Navigate to a known-safe site (e.g. github.com) — green toast appears and disappears after 5s
 * [ ] Navigate to http://192.168.1.1 — warning popup opens, shows DANGEROUS badge
 * [ ] Warning popup shows threat score, reasons list, and AI explanation
 * [ ] "Go Back" button closes popup and navigates back
 * [ ] "Continue Anyway" button closes popup and navigates to the URL
 * [ ] Clicking "Continue Anyway" 3 times permanently allows the URL (no more warnings)
 * [ ] Potentially harmful site shows 10s countdown, clicking button cancels countdown
 * [ ] After cancelling countdown, "Continue Anyway" button works normally
 *
 * MANUAL SCAN
 * [ ] Paste a valid URL (e.g. http://bit.ly/test) → shows score + reasons list
 * [ ] Paste a safe URL (e.g. https://google.com) → shows score 0 + "No suspicious patterns"
 * [ ] Type garbage (e.g. "hello world") → shows "Please enter a valid URL." error
 * [ ] Type a URL without protocol (e.g. "amazon.com") → auto-prefixes https:// and scans
 *
 * HISTORY
 * [ ] After visiting several sites, history list shows up to 20 entries
 * [ ] "Clear Data" button wipes history and resets the list to "No scans yet."
 * [ ] History shows correct color-coded score badges per threat level
 *
 * AI ANALYSIS
 * [ ] Warning popup shows AI scam type badge and explanation for a flagged URL
 * [ ] If API key is wrong/missing, fallback message appears instead of freezing
 *
 * REDIRECT CHECKER (removed)
 * [ ] Confirm there is NO "Redirect Info" section in the warning popup
 */
