// rules.js — SignalForge URL Detection Engine
const SUSPICIOUS_KEYWORDS = [
 'verify', 'login', 'secure', 'free', 'reward', 'win',
 'urgent', 'update', 'bank', 'account', 'confirm', 'password',
 'gift', 'lucky', 'prize', 'alert', 'suspended', 'blocked'
];
const SUSPICIOUS_TLDS = ['.xyz', '.tk', '.top', '.ru', '.ml', '.ga', '.cf',
'.gq'];
const URL_SHORTENERS = [
 'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly',
 'is.gd', 'buff.ly', 'adf.ly', 'short.link'
];
const KNOWN_BRANDS = [
 'amazon', 'paypal', 'google', 'netflix', 'paytm', 'sbi',
 'hdfc', 'icici', 'facebook', 'instagram', 'microsoft',
 'apple', 'flipkart', 'myntra', 'zomato', 'swiggy'
];
const OFFICIAL_DOMAINS = {
 amazon: ['amazon.com', 'amazon.in'],
 paypal: ['paypal.com'],
 google: ['google.com'],
 netflix: ['netflix.com'],
 paytm: ['paytm.com'],
 sbi: ['sbi.co.in', 'onlinesbi.sbi'],
 hdfc: ['hdfcbank.com'],
 icici: ['icicibank.com'],
 facebook: ['facebook.com'],
 instagram: ['instagram.com'],
 microsoft: ['microsoft.com', 'live.com', 'outlook.com'],
 apple: ['apple.com', 'icloud.com'],
 flipkart: ['flipkart.com'],
 myntra: ['myntra.com'],
 zomato: ['zomato.com'],
 swiggy: ['swiggy.com'],
};
function analyzeURL(urlString) {
 let score = 0;
 const reasons = [];
 let url;
 try {
 url = new URL(urlString);
 } catch (e) {
 return { score: 0, reasons: [], level: 'safe' };
 }
 const full = urlString.toLowerCase();
 const hostname = url.hostname.toLowerCase();
 const pathname = url.pathname.toLowerCase();
 // Check 1: URL length
 if (urlString.length > 75) {
 score += 10;
 reasons.push('URL is unusually long (' + urlString.length + ' characters)');
 }
 // Check 2: @ symbol in URL
 if (urlString.includes('@')) {
 score += 25;
 reasons.push('URL contains @ symbol — used to disguise real destination');
}
 // Check 3: IP address instead of domain
 if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(hostname)) {
 score += 35;
 reasons.push('URL uses an IP address instead of a domain name');
 }
 // Check 4: Suspicious TLD
 for (const tld of SUSPICIOUS_TLDS) {
 if (hostname.endsWith(tld)) {
 score += 20;
 reasons.push('Domain uses suspicious extension: ' + tld);
 break;
 }
 }
 // Check 5: Suspicious keywords
 const foundKeywords = SUSPICIOUS_KEYWORDS.filter(kw => full.includes(kw));
 if (foundKeywords.length > 0) {
 score += Math.min(foundKeywords.length * 5, 15);
 reasons.push('Suspicious keywords found: ' + foundKeywords.join(', '));
}
// Check 6: URL shortener
 for (const shortener of URL_SHORTENERS) {
 if (hostname.includes(shortener)) {
 score += 20;
 reasons.push('Link uses a URL shortener — real destination is hidden');
 break;
 }
 }
 // Check 7: Excessive subdomains
 const dots = (hostname.match(/\./g) || []).length;
 if (dots > 3) {
 score += 15;
 reasons.push('Too many subdomains (' + dots + ' dots) — common phishing trick');
 }
 // Check 8: Fake HTTPS in domain name
 if (hostname.includes('https') && url.protocol !== 'https:') {
 score += 20;
 reasons.push('Domain name contains https but page is not actually HTTPS');
 }
 // Check 9: Brand name in suspicious domain
for (const brand of KNOWN_BRANDS) {
  if (hostname.includes(brand)) {
    const officialDomains = OFFICIAL_DOMAINS[brand];
    if (officialDomains && !officialDomains.some(d => hostname.endsWith(d))) {
      score += 20;
      reasons.push('Domain imitates ' + brand + ' but is not the official website');
      break;
    }
  }
}
 // Check 10: Non-HTTPS
 if (url.protocol === 'http:') {
 score += 10;
 reasons.push('Website does not use HTTPS — connection is not encrypted');
 }
 // Check 11: Hyphen heavy domain
 const hyphens = (hostname.match(/-/g) || []).length;
 if (hyphens >= 2) {
 score += 10;
 reasons.push('Domain has many hyphens (' + hyphens + ') — not typical of legitimate sites');
 }
 // Check 12: Numbers replacing letters
 if (/[a-z]\d[a-z]|\d[a-z]\d/.test(hostname)) {
 score += 15;
  reasons.push('Domain mixes letters and numbers in suspicious way (e.g.amaz0n)');
 }
 // Determine level
 let level = 'safe';
 if (score >= 60) level = 'dangerous';
 else if (score >= 30) level = 'suspicious';
 else if (score >= 15) level = 'potentially_harmful';
 return { score: Math.min(score, 100), reasons, level };
}
// Export for use in other files
if (typeof module !== 'undefined') module.exports = { analyzeURL };