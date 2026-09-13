// Contract tests for the spoken-text pipeline: voice-command grammar and
// the correction dictionary. These run before text lands in the editor or
// relays to a linked device, so the edge cases here are load-bearing.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyCorrections,
  escapeRegExp,
  parseVoiceCommands,
  processSpokenTurn,
} from '../public/text-pipeline.js';

describe('voice-command grammar', () => {
  it('strips paragraph and line commands, preserving the rest in order', () => {
    const r = parseVoiceCommands('Meeting notes new paragraph budget is tight new line action items follow');
    assert.equal(r.text, 'Meeting notes budget is tight action items follow');
    assert.deepEqual(r.commands, ['new_paragraph', 'new_line']);
  });

  it('recognizes the scratch variants including delete that', () => {
    for (const phrase of ['scratch that', 'scratch the last', 'scratch the last sentence', 'delete that']) {
      const r = parseVoiceCommands(`this part is wrong ${phrase}`);
      assert.deepEqual(r.commands, ['scratch'], phrase);
      assert.equal(r.text, 'this part is wrong');
    }
  });

  it('is case-insensitive and tolerant of extra spaces', () => {
    const r = parseVoiceCommands('Okay   NEW   PARAGRAPH now continue');
    assert.deepEqual(r.commands, ['new_paragraph']);
    assert.equal(r.text, 'Okay now continue');
  });

  it('never false-triggers on words containing command substrings', () => {
    const r = parseVoiceCommands('the paragrapher broke a newline character in my parallelogram');
    assert.deepEqual(r.commands, []);
    assert.equal(r.text, 'the paragrapher broke a newline character in my parallelogram');
  });

  it('returns empty text and the command when nothing else was said', () => {
    const r = parseVoiceCommands('new paragraph');
    assert.equal(r.text, '');
    assert.deepEqual(r.commands, ['new_paragraph']);
  });
});

describe('correction dictionary', () => {
  const fixes = { 'ecg': 'ECG', 'jonh smith': 'John Smith', 'audiopen': 'AudioPen' };

  it('replaces whole words case-insensitively, preserving leading capitals', () => {
    assert.equal(applyCorrections('the ecg looks fine', fixes), 'the ECG looks fine');
    assert.equal(applyCorrections('The Ecg looks fine', fixes), 'The ECG looks fine');
    assert.equal(applyCorrections('audiopen wrote it', fixes), 'AudioPen wrote it');
  });

  it('matches multi-word keys but never inside other words', () => {
    assert.equal(applyCorrections('send it to jonh smith today', fixes), 'send it to John Smith today');
    assert.equal(applyCorrections('the decoding held', fixes), 'the decoding held', 'no substring hits');
  });

  it('leaves text untouched with an empty dictionary', () => {
    assert.equal(applyCorrections('untouched text', {}), 'untouched text');
    assert.equal(applyCorrections('untouched text', null), 'untouched text');
  });

  it('escapeRegExp neutralizes regex metacharacters in keys', () => {
    assert.equal(escapeRegExp('a.b(c)*'), 'a\\.b\\(c\\)\\*');
    assert.equal(applyCorrections('node dot js', { 'node dot js': 'Node.js' }), 'Node.js');
  });
});

describe('full pipeline', () => {
  it('strips commands and applies corrections in one pass, idempotently', () => {
    const corrections = { 'ecg': 'ECG' };
    const first = processSpokenTurn('new line the ecg was normal scratch that new paragraph discharge today', corrections);
    assert.equal(first.text, 'the ECG was normal discharge today');
    assert.deepEqual(first.commands, ['new_line', 'scratch', 'new_paragraph']);
    const second = processSpokenTurn(first.text, corrections);
    assert.equal(second.text, first.text);
    assert.deepEqual(second.commands, [], 're-running the pipeline changes nothing');
  });
});
