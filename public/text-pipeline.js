/**
 * LumiNote spoken-text pipeline. Pure functions only: usable in the browser
 * module graph and in Node tests (no DOM, no Web Audio).
 *
 * Two stages applied to every committed dictation turn, before it lands in
 * the editor or relays to a linked device:
 * 1. Voice-command grammar — command phrases are stripped from the text and
 *    returned as structured actions ("new paragraph", "new line", "scratch
 *    that"), following the mainstream dictation command sets (Microsoft
 *    Word dictation, Apple/Windows voice control).
 * 2. Correction dictionary — "heard X, write Y" whole-word replacements
 *    (the pattern Wispr/Willow use), case-insensitive with leading
 *    capitalization preserved on the replacement.
 *
 * Both stages are idempotent: applying them twice changes nothing, so a
 * receiving device can safely re-run the pipeline on relayed turns.
 */

export function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Single-pass pattern so commands are reported in SPEECH order (rule-by-
// rule scanning would reorder them). Capture groups: 1-2 paragraph, 3-4
// line, 5-7 scratch (including "delete that").
const COMMAND_PATTERN = /\b(?:(new\s+paragraph)|(paragraph\s+break)|(new\s+line)|(line\s+break)|(scratch\s+that)|(scratch\s+the\s+last(?:\s+(?:sentence|line|part|word))?))\b|\b(delete\s+that)\b/gi;
const COMMAND_GROUP_NAMES = [
  'new_paragraph', 'new_paragraph',
  'new_line', 'new_line',
  'scratch', 'scratch', 'scratch',
];

/**
 * Strips command phrases out of spoken text and reports them in order.
 * Returns { text, commands } where text has the phrases removed (never
 * empty-only whitespace collapses to '') and commands is one of
 * 'new_paragraph' | 'new_line' | 'scratch' per occurrence, in speech order.
 */
export function parseVoiceCommands(text) {
  const commands = [];
  const out = String(text ?? '').replace(COMMAND_PATTERN, (...args) => {
    // args = [fullMatch, ...7 capture groups, offset, string]
    const groups = args.slice(1, 1 + COMMAND_GROUP_NAMES.length);
    const idx = groups.findIndex((g) => g !== undefined);
    if (idx !== -1) commands.push(COMMAND_GROUP_NAMES[idx]);
    return ' ';
  });
  return { text: out.replace(/\s{2,}/g, ' ').trim(), commands };
}

/**
 * Applies the correction dictionary: whole-word, case-insensitive
 * replacements. If the spoken form was capitalized, the correction keeps a
 * leading capital ("ecg" → "ECG" stays "ECG"; "Ecg" → "ECG").
 */
export function applyCorrections(text, corrections) {
  let out = String(text ?? '');
  for (const [wrong, right] of Object.entries(corrections || {})) {
    const target = String(right ?? '');
    if (!wrong || !target) continue;
    const re = new RegExp(`\\b${escapeRegExp(wrong)}\\b`, 'gi');
    out = out.replace(re, (match) =>
      /^[A-Z]/.test(match) ? target.charAt(0).toUpperCase() + target.slice(1) : target
    );
  }
  return out;
}

/**
 * Full spoken-turn pipeline. Returns the corrected text plus the command
 * actions to perform in the editor, in speech order:
 * { text, commands: ['new_paragraph' | 'new_line' | 'scratch', ...] }
 */
export function processSpokenTurn(text, corrections) {
  const { text: stripped, commands } = parseVoiceCommands(text);
  return { text: applyCorrections(stripped, corrections), commands };
}
