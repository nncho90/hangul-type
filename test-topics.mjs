// Topic-data regression tests for index.html.
// Run: node test-topics.mjs

import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const cases = [];

function expect(name, ok, detail = '') {
  cases.push({ name, ok, detail });
}

const t2Ids = ['t2_verbs', 't2_adj', 't2_nouns', 't2_phrases', 't2_sentences'];
for (const id of t2Ids) {
  const start = html.indexOf(`id: '${id}'`);
  const next = html.indexOf(`{ id: '`, start + 1);
  const block = html.slice(start, next === -1 ? html.indexOf('];', start) : next);
  expect(`${id}: exists`, start !== -1);
  expect(`${id}: declares topikLevel 2`, /topikLevel:\s*2/.test(block));
  expect(`${id}: does not overwrite level back to 1`, !/\],\s*topikLevel:\s*1\s*}/.test(block));
}

let pass = 0, fail = 0;
for (const c of cases) {
  if (c.ok) {
    pass++;
    console.log('PASS  ' + c.name);
  } else {
    fail++;
    console.log('FAIL  ' + c.name + (c.detail ? ' :: ' + c.detail : ''));
  }
}

console.log(`\n${pass}/${cases.length} topic cases passed`);
process.exit(fail > 0 ? 1 : 0);
