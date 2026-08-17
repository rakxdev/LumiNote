# APPENDIX A — Grammar Engine Rule Test Matrix

- Purpose: an exhaustive, table-driven specification of the *current* behavior of `cleanSpokenEnglish` (`functions/api/grammar.js:106-141`) and `checkLanguageTool` replacement logic — every rule, every edge case, every expected output. This is the contract any fix (C-06) should be validated against, and the input corpus for the Tier-1 unit tests (`06-code-quality/testing-gap-analysis.md`).

---

## A.1 `cleanSpokenEnglish` — Rule 1: filler removal (line 110)

```js
s = s.replace(/\b(uh|um|er|ah|like|you know|i mean|sort of|kind of)\b,?\s*/gi, ' ');
```

| # | Input | Current output | Verdict | Reason |
|---|---|---|---|---|
| 1 | "I like pizza" | "I pizza" | ❌ CORRUPT | "like" as verb destroyed |
| 2 | "I really like this app" | "I really this app" | ❌ CORRUPT | |
| 3 | "Do you like it?" | "Do you it?" | ❌ CORRUPT | |
| 4 | "like, I was there" | "I was there" | ⚠️ intended | conversational filler removed |
| 5 | "He said like five times" | "He said five times" | ❌ CORRUPT | measure-word "like" destroyed |
| 6 | "And I mean it" | "And it" | ❌ CORRUPT | |
| 7 | "I mean, let's go" | "let's go" | ⚠️ intended | |
| 8 | "Sort of, we left early" | "we left early" | ⚠️ intended | |
| 9 | "It was a sort of crisis" | "It was a crisis" | ❌ CORRUPT | idiomatic "sort of" as modifier |
| 10 | "Kind of a big deal" | "a big deal" | ❌ CORRUPT | |
| 11 | "You know him?" | "him?" | ❌ CORRUPT | "you know" as actual question |
| 12 | "You know, it's fine" | "it's fine" | ⚠️ intended | |
| 13 | "Uh, um, so anyway" | "so anyway" | ✅ intended | pure hesitations |
| 14 | "He said er and paused" | "He said and paused" | ⚠️ intended | |
| 15 | "The ER was crowded" | "The was crowded" | ❌ CORRUPT | "ER" (emergency room) — case-insensitive flag |

**Pattern defect summary:** the alternation contains real English words ("like", "you know", "i mean", "sort of", "kind of", "er") that are removed *unconditionally and case-insensitively*. Filler-vs-meaningful cannot be decided by word identity alone; it needs context (comma adjacency, position, or POS analysis). Recommended replacement (from C-06 fix): hesitation tokens only — `\b(?:uh+|um+|erm+|er|ah|hmm+)\b[,.]?\s*` — and even then "er" should require comma adjacency ("Er, yes" vs "the ER").

## A.2 Rule 2: duplicate-word collapse (line 113)

```js
s = s.replace(/\b(\w+)\s+\1\b/gi, '$1');
```

| # | Input | Current output | Verdict |
|---|---|---|---|
| 1 | "I had had enough" | "I had enough" | ❌ CORRUPT (past perfect) |
| 2 | "She had had no choice" | "She had no choice" | ❌ CORRUPT |
| 3 | "The the cat sat" | "The cat sat" | ✅ intended (dictation dup) |
| 4 | "was was that true?" | "was that true?" | ✅ intended |
| 5 | "that that is the point" | "that is the point" | ❌ CORRUPT (legal "that that") |
| 6 | "He lives lives here" | "He lives here" | ✅ intended |
| 7 | "very very good" | "very good" | ⚠️ style choice |
| 8 | "Had had anyone told me" | "Had anyone told me" | ❌ (case-insensitive collapse) |
| 9 | "no no" (dissent) | "no" | ⚠️ loses emphasis |
| 10 | "Polish polish the floor" | "Polish the floor" | ❌ ambiguous case-collapse |

**Pattern defect summary:** `gi` + `\b(\w+)` collapses any adjacent repeat including grammatical compounds; "had had" and "that that" are the most common victims. Fix direction (C-06): whitelist legitimate doubles or only collapse when the repeat spans a speaker-heuristic boundary (e.g., different capitalization).

## A.3 Rule 3: subject-verb "repairs" (lines 116-123)

```js
s = s.replace(/\bi is\b/gi, 'I am');
s = s.replace(/\bwe is\b/gi, 'we are');
s = s.replace(/\bthey is\b/gi, 'they are');
s = s.replace(/\bhe don't\b/gi, "he doesn't");
s = s.replace(/\bshe don't\b/gi, "she doesn't");
s = s.replace(/\bit don't\b/gi, "it doesn't");
s = s.replace(/\bit not\b/gi, "it did not");
s = s.replace(/\bme and (\w+) (is|are|was|were|go|want)\b/gi, '$1 and I $2');
```

| # | Input | Current output | Expected (README claim) | Verdict |
|---|---|---|---|---|
| 1 | "i is going" | "I am going" | — | ✅ |
| 2 | "we is here" | "we are here" | — | ✅ |
| 3 | "they is here" | "they are here" | — | ✅ |
| 4 | "he don't care" | "he doesn't care" | — | ✅ |
| 5 | "she don't sing" | "she doesn't sing" | — | ✅ |
| 6 | "it don't matter" | "it doesn't matter" | — | ✅ |
| 7 | "it not work" | "it did not work" | "it didn't work" | ⚠️ tense guess |
| 8 | "me and him is going" | "him and I is going" | "He and I are going" | ❌ verb + case unfixed; README mismatch |
| 9 | "me and her go there" | "her and I go there" | "She and I go there" | ❌ |
| 10 | "me and them want it" | "them and I want it" | "They and I want it" | ❌ |
| 11 | "It's me and dad" | "It's dad and I" | — | ❌ (false-positive reorder in an idiom) |

**Pattern defects:** (a) README documents "He and I are" but the code yields "him and I is" — pronoun case (him→he) and verb agreement with the new compound subject are both skipped; (b) the rule fires inside quoted speech and fixed idioms.

## A.4 Rule 4a: whitespace + pre-punctuation spacing (lines 126-127)

```js
s = s.replace(/\s+/g, ' ');
s = s.replace(/\s+([.,?!])/g, '$1');
```

| # | Input | Output | Verdict |
|---|---|---|---|
| 1 | "a  b    c" | "a b c" | ✅ |
| 2 | "hello , world" | "hello, world" | ✅ |
| 3 | "end . Start" | "end. Start" | ✅ |
| 4 | "3 . 14" | "3.14" | ✅ |
| 5 | "a . b" | "a.b" | ❌ corrupts "a . b" (rare; acceptable risk) |
| 6 | "Mr . Smith" | "Mr.Smith" | ❌ — dot-joining without space after removal |

## A.5 Rule 4b: post-punctuation spacing (line 128) — the C-06 core

```js
s = s.replace(/([.,?!])([A-Za-z])/g, '$1 $2');
```

| # | Input | Output | Verdict | Domain |
|---|---|---|---|---|
| 1 | "Hello,world" | "Hello, world" | ✅ | brutal typing fix |
| 2 | "end.Start" | "end. Start" | ✅ | |
| 3 | "Node.js" | "Node. js" | ❌ | filename |
| 4 | "index.js" | "index. js" | ❌ | filename |
| 5 | "visit node.dev" | "visit node. dev" | ❌ | domain |
| 6 | "api.example.com/v1" | "api. example. com/v1" | ❌ | URL |
| 7 | "e.g. that" | "e. g. that" | ❌ | abbreviation |
| 8 | "J.R.R. Tolkien" | "J. R. R. Tolkien" | ❌ | initials |
| 9 | "3.14" | "3.14" | ✅ (digit follower exempt) | number |
| 10 | "9.99 dollars" | "9.99 dollars" | ✅ | price |
| 11 | "2.1" then "beta" → "2.1 beta" | ✅ (digit follower) | version letter separated by space anyway |
| 12 | "v1.beta" | "v1. beta" | ❌ | alphanumeric version |
| 13 | "Mr.Jones" | "Mr. Jones" | ✅ (intended) | title |
| 14 | "U.S.A." | "U. S. A." | ❌ | acronym |
| 15 | "to-do,two" | "to-do, two" | ✅ | |
| 16 | "hello.I'm" | "hello. I'm" | ✅ (contraction is fine) | |

**Fix direction (C-06 refinement):** restrict to sentence-like boundaries — `([.?!])\s*([A-Z][a-z])` — which preserves "Hello,world"? (comma case dropped; acceptable: commas-after-letters rarely lack a space in ASR output) — or, better, only insert when the character before the punctuation is lowercase and the character after is uppercase. Full proposal in the critical report's fix section. **Numbers with letter suffixes remain the edge to guard ("v1.beta"—rare, accept).**

## A.6 Rule 5: capitalization (lines 131-132)

```js
s = s.replace(/\bi\b/g, 'I');
s = s.replace(/(^\s*|[.?!]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
```

| # | Input | Output | Verdict |
|---|---|---|---|
| 1 | "i went" | "I went" | ✅ |
| 2 | "i i pattern" | "I I pattern" | ⚠️ (Rule 2 would have fixed) |
| 3 | "x.i." | "x.I." | ⚠️ over-capitalizes "i" in abbreviations ("i.e." → "I.e.") |
| 4 | "hello. i am here" | "hello. I am here" | ✅ |
| 5 | "He said 'i can't'." | "He said 'I can't'." | ⚠️ inside quotes |
| 6 | "...Q. what now" | "...Q. What now" | ✅ intended |

**Note:** "i.e." → "I.e." is a real regression for a grammar fixer (the one abbreviation English uses lowercase-i). Add `i.e.` to a guard list.

## A.7 Rule 6: terminal punctuation (lines 135-138)

```js
s = s.trim();
if (s && !/[.?!]$/.test(s)) s += '.';
```

| # | Input | Output | Verdict |
|---|---|---|---|
| 1 | "go now" | "go now." | ✅ intended |
| 2 | "Let's go!" | "Let's go!" | ✅ |
| 3 | "It ends..." | "It ends..." | ✅ |
| 4 | "It ends…" (ellipsis char) | "It ends…." | ❌ double terminal |
| 5 | `"quote"` (closing quote) | `"quote".` | ⚠️ outside quote; acceptable |
| 6 | "Question?" | "Question?" | ✅ |
| 7 | "" | "" | ✅ (blank guard) |

## A.8 `checkLanguageTool` — replacement mechanics (lines 85-96)

```js
const sortedMatches = matches.sort((a, b) => b.offset - a.offset);
for (const match of sortedMatches) {
  if (match.replacements.length > 0) {
    const replacement = match.replacements[0].value;
    result = result.slice(0, start) + replacement + result.slice(end);
  }
}
```

| # | Scenario | Behavior | Verdict |
|---|---|---|---|
| 1 | Non-overlapping matches, right-to-left | correct splice order | ✅ |
| 2 | Overlapping matches (LT allows) | double-splice at overlap = garbage | ❌ H-09 |
| 3 | Replacement longer/shorter than original | length changes; later (earlier-offset) matches still apply to *modified* string? — NO: offsets come from the original text, applied right-to-left means earlier text is untouched by later edits **only if** the edited region length change doesn't shift *earlier* offsets. Right-to-left makes this safe. | ✅ correct |
| 4 | `replacements[0]` empty string (deletion suggestion) | deletion applied | ✅ |
| 5 | Match at offset 0 / end | boundary OK | ✅ |
| 6 | Same offset matches (multiple errors at one position) | first wins, second splices based on stale offsets — can corrupt | ❌ |
| 7 | 429 / 5xx / 413 from upstream | `return text` silently | ❌ H-09 (no degraded signal) |
| 8 | Text > 20,000 chars | upstream rejects (or truncates) | ❌ H-09 |

## A.9 COMPOSITE CASES (full-transcript simulations)

| # | Input transcript | Current full pipeline output | Regression watch |
|---|---|---|---|
| 1 | "i i really like node.js and it was 9.99 u.s dollars ok." | "I really node. js and it was 9.99 u. s dollars ok." | "like" gone; "node. js"; "u. s"; ending "." added |
| 2 | "we is going to had had fun you know" | "we are going to had fun" | "had had" collapsed; "you know" deleted |
| 3 | "me and him is going to the er on 5th street" | "him and I is going to the on 5th street" | "ER" deleted; verb unfixed |
| 4 | "Sort of a kind of problem but i mean it" | "a a problem but it" | triple damage |
| 5 | "she don't like coffee the the coffee" | "she doesn't coffee the coffee" | second "like" deleted; dup collapsed |

**These five composite cases are the acceptance tests any C-06 fix must make pass** (expected outputs defined in the revised rule spec, not the old behaviors).

---

*Appendix to the LumiNote audit. No source files modified. Master index: `reports/README.md`.*