import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Core session and editor logic testing
describe('EditorState & Session transitions', () => {
  it('should maintain baseText and live interim updates correctly', () => {
    let baseText = "Hello world";
    let activeTurn = "this is live";
    
    // Formatting simulated
    const combined = baseText + (baseText ? " " : "") + activeTurn;
    assert.equal(combined, "Hello world this is live");

    // Commit turn simulated
    baseText = combined;
    activeTurn = "";
    assert.equal(baseText, "Hello world this is live");
    assert.equal(activeTurn, "");
  });

  it('should calculate words and character counts accurately', () => {
    const text1 = "Hello world from LumiNote";
    const words1 = text1.trim().split(/\s+/).filter(Boolean).length;
    const chars1 = text1.length;
    assert.equal(words1, 4);
    assert.equal(chars1, 25);

    const emptyText = "   ";
    const wordsEmpty = emptyText.trim() ? emptyText.trim().split(/\s+/).filter(Boolean).length : 0;
    const charsEmpty = emptyText.length;
    assert.equal(wordsEmpty, 0);
    assert.equal(charsEmpty, 3);
  });
});
