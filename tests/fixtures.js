// @ts-check
// Shared Playwright test with production writes blocked. Every spec imports
// { test, expect } from here instead of '@playwright/test', so no test run
// can reach the live Supabase project (leaderboard submits, attempt logs,
// daily scores). Covers the default `page` / `context` and any context a
// test builds itself with browser.newContext() / browser.newPage().
const base = require('@playwright/test');

const SUPABASE = /^https?:\/\/([^/]+\.)?supabase\.co(\/|$)/;

async function blockProduction(context) {
  await context.route(SUPABASE, route => route.abort('blockedbyclient'));
}

const test = base.test.extend({
  context: async ({ context }, use) => {
    await blockProduction(context);
    await use(context);
  },
  browser: [async ({ browser }, use) => {
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (options) => {
      const ctx = await newContext(options);
      await blockProduction(ctx);
      return ctx;
    };
    browser.newPage = async (options) => {
      const ctx = await browser.newContext(options);
      const page = await ctx.newPage();
      page.on('close', () => ctx.close().catch(() => {}));
      return page;
    };
    await use(browser);
  }, { scope: 'worker' }],
});

module.exports = { test, expect: base.expect, SUPABASE };
