// Cloudflare Pages Function for AI & Rule-Based Grammar Correction
export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await context.request.json();
    const rawText = body.text || '';
    const mode = body.mode || 'clean';

    if (!rawText.trim()) {
      return new Response(JSON.stringify({ correctedText: '' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store'
        }
      });
    }

    // Input length limit guard (20,000 characters)
    if (rawText.length > 20000) {
      return new Response(JSON.stringify({ error: 'Text exceeds 20,000 character limit' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Try LanguageTool Free Public API for deep grammar & spelling checks
    let corrected = await checkLanguageTool(rawText);

    // Apply safe rule-based spoken English cleanup
    corrected = cleanSpokenEnglish(corrected);

    // Output modes restructure the cleaned text deterministically (no LLM,
    // so results are predictable and the raw text stays in the editor's
    // undo history). 'clean' is the default passthrough.
    if (mode === 'bullets') corrected = toBullets(corrected);
    else if (mode === 'email') corrected = toEmail(corrected);

    return new Response(JSON.stringify({ correctedText: corrected }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store'
      }
    });

  } catch (error) {
    console.error('Grammar API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal grammar service error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Sentence-split on . ! ? boundaries, keeping abbreviations like "U.S.A."
// together by requiring a capital/number to start the next fragment.
export function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Bullets mode: each sentence becomes a list item; the trailing period is
// dropped on short items and kept on long ones where it reads naturally.
export function toBullets(text) {
  const sentences = splitSentences(text);
  if (sentences.length <= 1) return text;
  return sentences
    .map((s) => `- ${s.endsWith('.') && s.length > 60 ? s : s.replace(/\.$/, '')}`)
    .join('\n');
}

// Email mode: greeting + cleaned body + sign-off scaffold for the names.
export function toEmail(text) {
  const body = splitSentences(text).join(' ');
  return `Hi,\n\n${body}\n\nBest regards,`;
}

// Call LanguageTool free grammar checking API with timeout and bounds
export async function checkLanguageTool(text) {
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
      body: params.toString(),
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      console.warn(`LanguageTool returned status ${res.status}, bypassing API corrections`);
      return text;
    }

    const data = await res.json();
    const matches = data.matches || [];

    if (matches.length === 0) return text;

    // Apply replacements from right to left, skipping overlapping match spans
    let result = text;
    const sortedMatches = matches.sort((a, b) => b.offset - a.offset);
    let lastProcessedStart = Infinity;

    for (const match of sortedMatches) {
      if (match.replacements && match.replacements.length > 0) {
        const replacement = match.replacements[0].value;
        const start = match.offset;
        const end = match.offset + match.length;

        // Prevent corrupting overlapping spans
        if (end <= lastProcessedStart) {
          result = result.slice(0, start) + replacement + result.slice(end);
          lastProcessedStart = start;
        }
      }
    }

    return result;
  } catch (err) {
    console.warn('LanguageTool API fallback:', err.message);
    return text;
  }
}

// Safe Rule-based Spoken English & Speech Cleanup Engine
export function cleanSpokenEnglish(text) {
  if (!text || typeof text !== 'string') return '';
  let s = text.trim();
  if (!s) return '';

  // 1. Remove pure spoken hesitations and non-word filler tokens
  // Matches "uh", "um", "ah", "hmm", "erm", and lowercase "er" when isolated
  s = s.replace(/\b(?:uh+|um+|ah+|hmm+|erm+)\b,?\s*/gi, ' ');
  // Handle "er" strictly in lowercase/comma context to preserve uppercase "ER" (emergency room)
  s = s.replace(/(^|\s)er\b,?\s*/g, '$1');

  // 2. Duplicate word cleanup: collapse accidental speech stutters while preserving valid duplicates
  // Whitelist: "had had", "that that"
  s = s.replace(/\b([a-zA-Z]+)\s+\1\b/gi, (match, word) => {
    const lower = word.toLowerCase();
    if (lower === 'had' || lower === 'that' || lower === 'very') {
      return match;
    }
    return word;
  });

  // 3. Fix common broken English subject-verb agreement patterns
  s = s.replace(/\bi is\b/gi, 'I am');
  s = s.replace(/\bwe is\b/gi, 'we are');
  s = s.replace(/\bthey is\b/gi, 'they are');
  s = s.replace(/\bhe don't\b/gi, "he doesn't");
  s = s.replace(/\bshe don't\b/gi, "she doesn't");
  s = s.replace(/\bit don't\b/gi, "it doesn't");
  s = s.replace(/\bit not\b/gi, "it did not");
  s = s.replace(/\bme and (\w+) (is|are|was|were|go|want)\b/gi, (m, person, verb) => {
    // Subjective pronoun correction
    let subj = person;
    if (person.toLowerCase() === 'him') subj = 'he';
    else if (person.toLowerCase() === 'her') subj = 'she';
    else if (person.toLowerCase() === 'them') subj = 'they';
    const cleanVerb = (verb === 'is') ? 'are' : (verb === 'was') ? 'were' : verb;
    return `${subj} and I ${cleanVerb}`;
  });

  // 4. Clean up multiple whitespace and space before punctuation
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/\s+([.,?!;:])/g, '$1');

  // Fix missing space after commas/periods ONLY when between lower-case and capitalized word or clear word boundary
  // Does NOT split filenames (Node.js, index.js), domains (node.dev), numbers (3.14), or standard abbreviations (e.g., i.e., U.S.A.)
  s = s.replace(/,([A-Za-z])/g, ', $1');
  s = s.replace(/([.?!])([A-Z][a-z])/g, '$1 $2');

  // 5. Ensure first letter of sentences and standalone "i" are capitalized
  s = s.replace(/\bi\b/g, 'I');
  s = s.replace(/(^\s*|[.?!]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());

  // 6. Ensure ending punctuation
  s = s.trim();
  if (s && !/[.?!…]$/.test(s)) {
    s += '.';
  }

  return s;
}
