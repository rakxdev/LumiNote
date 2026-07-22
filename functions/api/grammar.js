// Cloudflare Pages Function for AI & Rule-Based Grammar Correction
export async function onRequest(context) {
  // Handle CORS preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await context.request.json();
    const rawText = body.text || '';

    if (!rawText.trim()) {
      return new Response(JSON.stringify({ correctedText: '' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Try LanguageTool Free Public API for deep grammar & spelling checks
    let corrected = await checkLanguageTool(rawText);

    // Apply rule-based spoken English cleanup (filler words & structural fixes)
    corrected = cleanSpokenEnglish(corrected);

    return new Response(JSON.stringify({ correctedText: corrected }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Grammar API Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Call LanguageTool free grammar checking API
async function checkLanguageTool(text) {
  try {
    const params = new URLSearchParams();
    params.append('text', text);
    params.append('language', 'en-US');

    const res = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    if (!res.ok) return text;

    const data = await res.json();
    const matches = data.matches || [];

    if (matches.length === 0) return text;

    // Apply replacements from right to left to keep character offsets valid
    let result = text;
    const sortedMatches = matches.sort((a, b) => b.offset - a.offset);

    for (const match of sortedMatches) {
      if (match.replacements && match.replacements.length > 0) {
        const replacement = match.replacements[0].value;
        const start = match.offset;
        const end = match.offset + match.length;
        result = result.slice(0, start) + replacement + result.slice(end);
      }
    }

    return result;
  } catch (err) {
    console.warn('LanguageTool API fallback:', err.message);
    return text;
  }
}

// Rule-based Spoken English & Broken Speech Cleanup Engine
function cleanSpokenEnglish(text) {
  let s = text;

  // 1. Remove spoken hesitations and filler words (case-insensitive)
  s = s.replace(/\b(uh|um|er|ah|like|you know|i mean|sort of|kind of)\b,?\s*/gi, ' ');

  // 2. Fix duplicated consecutive words (e.g. "I am I am", "the the")
  s = s.replace(/\b(\w+)\s+\1\b/gi, '$1');

  // 3. Fix common broken English subject-verb agreement patterns
  s = s.replace(/\bi is\b/gi, 'I am');
  s = s.replace(/\bwe is\b/gi, 'we are');
  s = s.replace(/\bthey is\b/gi, 'they are');
  s = s.replace(/\bhe don't\b/gi, "he doesn't");
  s = s.replace(/\bshe don't\b/gi, "she doesn't");
  s = s.replace(/\bit don't\b/gi, "it doesn't");
  s = s.replace(/\bit not\b/gi, "it did not");
  s = s.replace(/\bme and (\w+) (is|are|was|were|go|want)\b/gi, '$1 and I $2');

  // 4. Clean up multiple spaces and punctuation spaces
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/\s+([.,?!])/g, '$1');
  s = s.replace(/([.,?!])([A-Za-z])/g, '$1 $2');

  // 5. Ensure first letter of sentences and standalone "i" are capitalized
  s = s.replace(/\bi\b/g, 'I');
  s = s.replace(/(^\s*|[.?!]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());

  // 6. Ensure ending punctuation
  s = s.trim();
  if (s && !/[.?!]$/.test(s)) {
    s += '.';
  }

  return s;
}
