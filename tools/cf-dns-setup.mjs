// Playwright-driven Cloudflare DNS setup for typehangeul.com.
// Adds an A record pointing at Vercel's edge (76.76.21.21), proxy off.
//
// Uses a persistent profile so the user only logs in once across runs.
// Headed mode so the user can see what's happening and handle 2FA.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const PROFILE_DIR = '/Users/nelsoncho/.claude/playwright-profiles/cloudflare';
mkdirSync(PROFILE_DIR, { recursive: true });

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  channel: 'chrome',
  headless: false,
  viewport: { width: 1400, height: 900 },
  args: ['--start-maximized'],
});
const page = ctx.pages()[0] || await ctx.newPage();

console.log('→ Opening Cloudflare dashboard');
await page.goto('https://dash.cloudflare.com/', { waitUntil: 'domcontentloaded' });

// Wait for sign-in. We poll for the dashboard URL pattern (account-scoped).
// User has up to 5 minutes to sign in if needed (handles 2FA, etc).
console.log('→ Waiting for sign-in (up to 5 min). If you see a login page, please sign in.');
await page.waitForURL(/dash\.cloudflare\.com\/[a-f0-9]{32}/, { timeout: 300_000 });
console.log('✅ Signed in. URL:', page.url());

// Now navigate to typehangeul.com → DNS records.
// Cloudflare's account-scoped URL format:
// https://dash.cloudflare.com/{accountId}/{zoneName}/dns/records
const accountIdMatch = page.url().match(/dash\.cloudflare\.com\/([a-f0-9]{32})/);
const accountId = accountIdMatch?.[1];
if (!accountId) { console.log('⚠️  could not parse account id from URL'); process.exit(1); }
console.log('→ Account ID:', accountId);

const dnsUrl = `https://dash.cloudflare.com/${accountId}/typehangeul.com/dns/records`;
console.log('→ Navigating to:', dnsUrl);
await page.goto(dnsUrl, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
await page.waitForTimeout(2000);

console.log('→ Looking for "Add record" button');
// Cloudflare's button text varies; try a few patterns
const addButton = page.getByRole('button', { name: /add record/i }).first();
await addButton.waitFor({ timeout: 30_000 });
await addButton.click();
console.log('✅ Clicked Add record');
await page.waitForTimeout(1000);

// The Add Record form: Type dropdown defaults to A, which is what we want.
// Name field needs "@" or "typehangeul.com" — Cloudflare accepts either.
// IPv4 address: 76.76.21.21
// Proxy status: OFF (DNS only)

// Fill the Name field — Cloudflare's input has placeholder "Use @ for root"
const nameInput = page.getByLabel(/^name$/i).first().or(page.locator('input[name="name"]')).first();
await nameInput.waitFor({ timeout: 10_000 });
await nameInput.fill('@');
console.log('✅ Filled name = @');

// Fill IPv4 address
const ipInput = page.getByLabel(/ipv4 address/i).first().or(page.locator('input[name="content"]')).first();
await ipInput.waitFor({ timeout: 10_000 });
await ipInput.fill('76.76.21.21');
console.log('✅ Filled IPv4 = 76.76.21.21');

// Toggle proxy OFF — it's an orange-cloud switch. Default is ON (proxied).
// Vercel needs unproxied (DNS only / gray cloud) to issue the TLS cert.
const proxyToggle = page.getByRole('switch', { name: /proxy status|proxied|dns only/i }).first();
const isProxied = await proxyToggle.isChecked().catch(() => false);
if (isProxied) {
  await proxyToggle.click();
  console.log('✅ Toggled proxy OFF (DNS only)');
} else {
  console.log('ℹ️  Proxy already off (or toggle not detected — verify manually)');
}

// Take a screenshot before saving so we can inspect if anything looks wrong
await page.screenshot({ path: '/tmp/cf-dns-before-save.png', fullPage: false });
console.log('📸 Screenshot saved to /tmp/cf-dns-before-save.png');

// Click Save
const saveButton = page.getByRole('button', { name: /^save$/i }).first();
await saveButton.waitFor({ timeout: 10_000 });
await saveButton.click();
console.log('✅ Clicked Save — record submitted');

// Wait a moment and screenshot the records list to confirm the new entry
await page.waitForTimeout(3000);
await page.screenshot({ path: '/tmp/cf-dns-after-save.png', fullPage: false });
console.log('📸 Post-save screenshot at /tmp/cf-dns-after-save.png');

console.log('\n✨ DONE. Verify in browser, then close. Vercel will pick up the A record within 1-10 min.');
console.log('   Run: curl -I https://typehangeul.com  → should return 200 once Vercel issues TLS.\n');

// Leave the browser open so user can verify visually
await page.waitForTimeout(120_000);
await ctx.close();
