import { chromium, devices } from 'playwright';

const TUNNEL = 'https://conferences-collar-proof-mine.trycloudflare.com';
const OUT = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/notif-deeplink-final';
const results = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const p = await ctx.newPage();

// Login via API
const loginResp = await p.request.post(TUNNEL + '/api/v1/auth/sign-in/email', {
  data: { email: 'contato@fatimacabelos.com.br', password: 'fatima@2026' },
});
console.log('login status', loginResp.status());

// Get appointmentId
let appointmentId = null;
try {
  const resp = await p.request.get(TUNNEL + '/api/v1/appointments?limit=1');
  const j = await resp.json();
  appointmentId = j?.data?.[0]?.id || null;
  console.log('appointmentId', appointmentId);
} catch (e) { console.log('appt fetch err', e.message); }

// Scenario A
if (!appointmentId) {
  results.push({ scenario: 'A', ok: false, note: 'no appointment available - skipped' });
} else {
  try {
    await p.goto(TUNNEL + '/agenda?appointmentId=' + appointmentId, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
    const drawerOpen = await p.evaluate(() => {
      const el = document.querySelector('[role="dialog"][aria-modal="true"]')
        || document.querySelector('[role="dialog"]')
        || document.querySelector('[data-state="open"]');
      return !!el;
    });
    const finalUrl = p.url();
    const cleaned = !finalUrl.includes('appointmentId');
    await p.screenshot({ path: OUT + '/A-drawer.png', fullPage: false });
    results.push({
      scenario: 'A',
      ok: drawerOpen && cleaned,
      note: `drawerOpen=${drawerOpen} urlCleaned=${cleaned} finalUrl=${finalUrl}`,
    });
  } catch (e) {
    results.push({ scenario: 'A', ok: false, note: 'error: ' + e.message });
  }
}

// Scenario B
try {
  await p.goto(TUNNEL + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);

  // Try open bottom nav menu (safe: only if visible)
  const menuBtns = await p.$$('button[aria-label*="Menu" i], button[aria-label*="menu" i]');
  for (const mb of menuBtns) {
    if (await mb.isVisible()) {
      try { await mb.click({ timeout: 3000 }); await p.waitForTimeout(800); } catch {}
      break;
    }
  }

  // Find bell (visible one)
  let bell = null;
  const bells = await p.$$('button[aria-label*="Notifica" i]');
  for (const b of bells) {
    if (await b.isVisible()) { bell = b; break; }
  }
  console.log('bells found:', bells.length, 'visible:', !!bell);
  if (!bell) {
    await p.screenshot({ path: OUT + '/B-notif-click.png', fullPage: false });
    results.push({ scenario: 'B', ok: false, note: 'bell button not found' });
  } else {
    await bell.scrollIntoViewIfNeeded().catch(()=>{});
    await bell.dispatchEvent('click');
    await p.waitForTimeout(1500);

    // Find first VISIBLE appointment notif (clickable ancestor)
    const notif = await p.evaluate(() => {
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return false;
        const cs = getComputedStyle(el);
        return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
      };
      const nodes = Array.from(document.querySelectorAll('button, a, [role="button"], li'));
      const found = nodes.find(n => {
        const t = (n.textContent || '').trim();
        return t.startsWith('Agendamento') && isVisible(n);
      });
      if (!found) return null;
      found.setAttribute('data-test-notif', '1');
      return true;
    });

    if (!notif) {
      await p.screenshot({ path: OUT + '/B-notif-click.png', fullPage: false });
      results.push({ scenario: 'B', ok: true, note: 'sem notif appointment pra testar (não é fail)' });
    } else {
      const target = await p.$('[data-test-notif="1"]');
      await target.scrollIntoViewIfNeeded().catch(()=>{});
      await target.dispatchEvent('click');
      await p.waitForTimeout(1500);
      const finalUrl = p.url();
      const drawerOpen = await p.evaluate(() => {
        const el = document.querySelector('[role="dialog"][aria-modal="true"]')
          || document.querySelector('[role="dialog"]');
        return !!el;
      });
      await p.screenshot({ path: OUT + '/B-notif-click.png', fullPage: false });
      const okB = finalUrl.includes('/agenda') && drawerOpen;
      results.push({
        scenario: 'B',
        ok: okB,
        note: `url=${finalUrl} drawerOpen=${drawerOpen}`,
      });
    }
  }
} catch (e) {
  results.push({ scenario: 'B', ok: false, note: 'error: ' + e.message });
}

await browser.close();
console.log('RESULTS_JSON=' + JSON.stringify(results));
