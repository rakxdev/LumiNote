import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSpokenEnglish } from '../functions/api/grammar.js';

describe('cleanSpokenEnglish rules matrix', () => {
  it('should remove pure spoken hesitations without corrupting legitimate words', () => {
    assert.equal(cleanSpokenEnglish('Uh, um, so anyway'), 'So anyway.');
    assert.equal(cleanSpokenEnglish('He said er and paused'), 'He said and paused.');
  });

  it('should PRESERVE legitimate uses of "like", "you know", "mean", "sort of", "kind of"', () => {
    assert.equal(cleanSpokenEnglish('I like pizza'), 'I like pizza.');
    assert.equal(cleanSpokenEnglish('I really like this app'), 'I really like this app.');
    assert.equal(cleanSpokenEnglish('Do you like it?'), 'Do you like it?');
    assert.equal(cleanSpokenEnglish('And I mean it'), 'And I mean it.');
    assert.equal(cleanSpokenEnglish('It was a sort of crisis'), 'It was a sort of crisis.');
    assert.equal(cleanSpokenEnglish('Kind of a big deal'), 'Kind of a big deal.');
    assert.equal(cleanSpokenEnglish('You know him?'), 'You know him?');
  });

  it('should PRESERVE uppercase ER (emergency room)', () => {
    assert.equal(cleanSpokenEnglish('The ER was crowded'), 'The ER was crowded.');
  });

  it('should collapse clear dictation duplicates while preserving legal doubles like "had had" and "that that"', () => {
    assert.equal(cleanSpokenEnglish('The the cat sat'), 'The cat sat.');
    assert.equal(cleanSpokenEnglish('I had had enough'), 'I had had enough.');
    assert.equal(cleanSpokenEnglish('She had had no choice'), 'She had had no choice.');
    assert.equal(cleanSpokenEnglish('that that is the point'), 'That that is the point.');
  });

  it('should fix broken English subject-verb agreement patterns', () => {
    assert.equal(cleanSpokenEnglish('i is going'), 'I am going.');
    assert.equal(cleanSpokenEnglish('we is here'), 'We are here.');
    assert.equal(cleanSpokenEnglish('they is here'), 'They are here.');
    assert.equal(cleanSpokenEnglish('he don\'t care'), 'He doesn\'t care.');
    assert.equal(cleanSpokenEnglish('she don\'t sing'), 'She doesn\'t sing.');
    assert.equal(cleanSpokenEnglish('it don\'t matter'), 'It doesn\'t matter.');
    assert.equal(cleanSpokenEnglish('it not work'), 'It did not work.');
  });

  it('should handle punctuation spacing without corrupting filenames, abbreviations or domains', () => {
    assert.equal(cleanSpokenEnglish('Hello,world'), 'Hello, world.');
    assert.equal(cleanSpokenEnglish('Node.js is great'), 'Node.js is great.');
    assert.equal(cleanSpokenEnglish('visit node.dev'), 'Visit node.dev.');
    assert.equal(cleanSpokenEnglish('index.js'), 'Index.js.');
    assert.equal(cleanSpokenEnglish('e.g. that thing'), 'E.g. That thing.');
    assert.equal(cleanSpokenEnglish('3.14'), '3.14.');
    assert.equal(cleanSpokenEnglish('9.99 dollars'), '9.99 dollars.');
  });

  it('should properly capitalize standalone "i" and sentence beginnings', () => {
    assert.equal(cleanSpokenEnglish('i went to the store. then i came back'), 'I went to the store. Then I came back.');
  });

  it('should handle terminal punctuation correctly', () => {
    assert.equal(cleanSpokenEnglish('go now'), 'Go now.');
    assert.equal(cleanSpokenEnglish('Let\'s go!'), 'Let\'s go!');
    assert.equal(cleanSpokenEnglish('Question?'), 'Question?');
    assert.equal(cleanSpokenEnglish('It ends...'), 'It ends...');
    assert.equal(cleanSpokenEnglish(''), '');
  });
});
