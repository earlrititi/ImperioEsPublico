import assert from "node:assert/strict";
import test from "node:test";
import { READER_FAQ, readerFaqSchema } from "../src/config/reader-faq";

test("FAQ schema contains exactly the questions and answers rendered by the page", () => {
  assert.ok(READER_FAQ.length >= 26);
  assert.equal(new Set(READER_FAQ.map(item => item.question)).size, READER_FAQ.length);
  assert.deepEqual(readerFaqSchema.mainEntity.map(item => ({
    question: item.name, answer: item.acceptedAnswer.text,
  })), READER_FAQ);
  assert.ok(READER_FAQ.every(item => item.question.length > 10 && item.answer.length > 40));
});
