import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAcceptCharset, pickCharset, formatAcceptCharset } from '../src/index.js';

test('empty header returns empty array', () => {
  assert.deepEqual(parseAcceptCharset(''), []);
  assert.deepEqual(parseAcceptCharset(null), []);
  assert.deepEqual(parseAcceptCharset(undefined), []);
  assert.deepEqual(parseAcceptCharset('   '), []);
});

test('single charset without q defaults to 1', () => {
  const r = parseAcceptCharset('utf-8');
  assert.equal(r.length, 1);
  assert.equal(r[0].charset, 'UTF-8');
  assert.equal(r[0].q, 1);
});

test('multiple charsets with q values', () => {
  const r = parseAcceptCharset('iso-8859-5, unicode-1-1;q=0.8');
  assert.equal(r.length, 2);
  assert.equal(r[0].charset, 'ISO-8859-5');
  assert.equal(r[0].q, 1);
  assert.equal(r[1].charset, 'UNICODE-1-1');
  assert.equal(r[1].q, 0.8);
});

test('case normalization to uppercase', () => {
  const r = parseAcceptCharset('Utf-8');
  assert.equal(r[0].charset, 'UTF-8');
});

test('q value clamped to 1', () => {
  const r = parseAcceptCharset('utf-8;q=1.5');
  assert.equal(r[0].q, 1);
});

test('q value clamped to 0 on negative', () => {
  const r = parseAcceptCharset('utf-8;q=-0.1');
  assert.equal(r[0].q, 0);
});

test('q of 0 means not acceptable but preserved', () => {
  const r = parseAcceptCharset('utf-8;q=0');
  assert.equal(r[0].q, 0);
  assert.equal(r[0].charset, 'UTF-8');
});

test('wildcard token parsed', () => {
  const r = parseAcceptCharset('*;q=0.1');
  assert.equal(r[0].charset, '*');
  assert.equal(r[0].q, 0.1);
});

test('extra whitespace between tokens is tolerated', () => {
  const r = parseAcceptCharset('  utf-8  ;  q=0.9  ,  iso-8859-1  ');
  assert.equal(r.length, 2);
  assert.equal(r[0].charset, 'UTF-8');
  assert.equal(r[0].q, 0.9);
  assert.equal(r[1].charset, 'ISO-8859-1');
  assert.equal(r[1].q, 1);
});

test('unparseable q falls back to default 1', () => {
  const r = parseAcceptCharset('utf-8;q=banana');
  assert.equal(r[0].q, 1);
});

test('pickCharset selects highest q match', () => {
  const accepted = parseAcceptCharset('utf-8;q=0.9, iso-8859-1;q=0.1');
  assert.equal(pickCharset(accepted, ['iso-8859-1', 'utf-8']), 'UTF-8');
});

test('pickCharset uses wildcard match', () => {
  const accepted = parseAcceptCharset('utf-8;q=0.1, *;q=0.5');
  assert.equal(pickCharset(accepted, ['windows-1252']), 'WINDOWS-1252');
});

test('pickCharset excludes q=0 entries', () => {
  const accepted = parseAcceptCharset('utf-8;q=0, iso-8859-1;q=0.8');
  assert.equal(pickCharset(accepted, ['utf-8']), null);
  assert.equal(pickCharset(accepted, ['utf-8', 'iso-8859-1']), 'ISO-8859-1');
});

test('pickCharset returns null when nothing offered matches', () => {
  const accepted = parseAcceptCharset('utf-8');
  assert.equal(pickCharset(accepted, ['iso-8859-1']), null);
});

test('pickCharset returns null for empty offered', () => {
  const accepted = parseAcceptCharset('utf-8');
  assert.equal(pickCharset(accepted, []), null);
});

test('pickCharset server tie-break: first offered wins on equal q', () => {
  const accepted = parseAcceptCharset('utf-8, iso-8859-1');
  assert.equal(pickCharset(accepted, ['ISO-8859-1', 'UTF-8']), 'ISO-8859-1');
});

test('formatAcceptCharset round-trips a simple list', () => {
  const specs = [
    { charset: 'UTF-8', q: 1 },
    { charset: 'ISO-8859-1', q: 0.8 },
  ];
  assert.equal(formatAcceptCharset(specs), 'UTF-8, ISO-8859-1;q=0.8');
});

test('formatAcceptCharset emits q=0 explicitly', () => {
  const specs = [{ charset: 'UTF-8', q: 0 }];
  assert.equal(formatAcceptCharset(specs), 'UTF-8;q=0.0');
});
