// redirect-checker.js — SignalForge Redirect Chain Tracker
async function checkRedirects(url) {
 const redirectChain = [];
 let current = url;
 const maxHops = 5;
 for (let i = 0; i < maxHops; i++) {
 try {
 const response = await fetch(current, {
 method: 'HEAD',
 redirect: 'manual'
 });
 redirectChain.push(current);
 if (response.type === 'opaqueredirect' || response.status === 301 ||
response.status === 302) {
 const next = response.headers.get('location');
 if (next && next !== current) {
 current = next;
 } else {
 break;
 }
 } else {
 break;
 }
 } catch (e) {
 break;
 }
 }
 return {
 hops: redirectChain.length - 1,
 finalURL: redirectChain[redirectChain.length - 1] || url,
 chain: redirectChain
 };
}