import assert from "node:assert/strict";
import test from "node:test";
import {
  audioRequest,
  checkedTextResponse,
  correctAnswer,
  quizLine,
  readFacts,
  validateDraft,
  validateLyrics,
} from "./core.js";

const facts = [
  "Water freezes at 0 degrees Celsius.",
  "Water boils at 100 degrees Celsius.",
];
const draft = {
  title: "Water Waltz",
  lyrics: `${facts.join("\n")}\nFreeze and flow, now you know!`,
  quiz: [
    { factIndex: 0, answer: "0" },
    { factIndex: 1, answer: "100" },
  ],
};
test("facts survive drafting and edits; changed numbers cannot reach music generation", () => {
  assert.deepEqual(validateDraft(draft, facts).facts, facts);
  assert.throws(
    () => audioRequest(draft.lyrics.replace("100", "10"), facts, "pop"),
    /Missing/,
  );
  assert.doesNotThrow(() =>
    validateLyrics(`${draft.lyrics}\nSing it slow.`, facts),
  );
});
test("quiz items cannot invent an answer, repeat a fact, or omit a fact", () => {
  assert.throws(
    () =>
      validateDraft(
        {
          ...draft,
          quiz: [
            { factIndex: 0, answer: facts[0] },
            { factIndex: 1, answer: "100" },
          ],
        },
        facts,
      ),
    /original facts/,
  );
  assert.throws(
    () =>
      validateDraft(
        {
          ...draft,
          quiz: [
            { factIndex: 0, answer: "ice" },
            { factIndex: 1, answer: "100" },
          ],
        },
        facts,
      ),
    /original facts/,
  );
  assert.throws(
    () =>
      validateDraft(
        {
          ...draft,
          quiz: [
            { factIndex: 0, answer: "0" },
            { factIndex: 0, answer: "0" },
          ],
        },
        facts,
      ),
    /original facts/,
  );
  assert.throws(
    () => validateDraft({ ...draft, quiz: [] }, facts),
    /incomplete/,
  );
});
test("literal quiz blanks handle punctuation and answer marking ignores case/spacing", () => {
  assert.equal(quizLine("Area = pi * r^2.", "r^2"), "Area = pi * _____.");
  assert.ok(correctAnswer("  CELSIUS.  ", "Celsius"));
  assert.ok(!correctAnswer("10", "100"));
});
test("oversized notes and incomplete provider responses are rejected", () => {
  assert.throws(() => readFacts("a\nb\nc\nd\ne"), /1–4/);
  assert.throws(
    () =>
      checkedTextResponse(
        { choices: [{ message: { content: null } }], usage: {} },
        facts,
      ),
    /no usable/,
  );
  assert.throws(
    () =>
      checkedTextResponse(
        { choices: [{ message: { content: JSON.stringify(draft) } }] },
        facts,
      ),
    /usage receipt/,
  );
});
