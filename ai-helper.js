// ai-helper.js — SignalForge AI Integration Layer (Groq API)
const GROQ_API_KEY = 'YOUR API KEY HERE'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SCAM_TYPES = [
  'Fake Login Page',
  'Banking / Financial Scam',
  'Reward / Giveaway Scam',
  'Crypto Scam',
  'Fake Shopping Site',
  'Notification Permission Scam',
  'OTP / KYC Scam',
  'Job Offer Scam',
  'General Phishing'
];

async function getAIAnalysis(url, score, reasons) {
  // Check if API key has been configured
  if (!GROQ_API_KEY || GROQ_API_KEY === 'PASTE_YOUR_GROQ_API_KEY_HERE') {
    console.warn('SignalForge: Groq API key not configured.');
    return {
      scamType: 'General Phishing',
      explanation: 'AI analysis unavailable — API key not configured. This URL was flagged based on heuristic checks. Proceed with caution.'
    };
  }

  const reasonText = reasons.join('; ');
  const prompt = `You are a cybersecurity expert assistant. A URL has been flagged as suspicious.
URL: ${url}
Threat Score: ${score}/100
Detected Issues: ${reasonText}
Please respond with ONLY a valid JSON object in this exact format:
{
  "scam_type": "one of: Fake Login Page, Banking Scam, Reward Scam, Crypto Scam, Fake Shopping Site, Notification Scam, OTP Scam, Job Scam, General Phishing",
  "explanation": "2-3 sentences in simple English explaining why this URL is dangerous, written for a non-technical user. Do not use jargon."
}
Return only the JSON. No extra text.`;

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GROQ_API_KEY
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a cybersecurity expert. Respond with only valid JSON, no extra text or markdown.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Groq API HTTP Error:', response.status, errorBody);
      throw new Error('Groq API returned HTTP ' + response.status);
    }

    const data = await response.json();

    console.log('Groq status:', response.status);
    console.log('Groq FULL response:', JSON.stringify(data, null, 2));

    if (!data.choices || !data.choices[0]) {
      throw new Error('No choices returned from Groq');
    }

    const rawText = data.choices[0].message?.content || '';

    const cleanText = rawText.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanText);
    } catch (e) {
      console.warn('JSON parse failed, raw:', cleanText);
      return {
        scamType: 'General Phishing',
        explanation: 'AI response could not be parsed. Proceed with caution.'
      };
    }

    return {
      scamType: parsed.scam_type || 'General Phishing',
      explanation: parsed.explanation || 'This URL shows multiple signs of being a phishing or scam website.'
    };

  } catch (error) {
    console.error('Groq error:', error);
    return {
      scamType: 'General Phishing',
      explanation: 'This URL shows multiple suspicious patterns that are commonly used in phishing attacks. It is recommended to avoid this website.'
    };
  }
}
