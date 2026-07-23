import { chromium } from 'playwright';

const urls = [
  'http://127.0.0.1:5173/configuracoes',
  'http://127.0.0.1:5173/financeiro/contas',
  'http://127.0.0.1:5174/',
  'http://127.0.0.1:5174/studio-bella-demo',
];

const browser = await chromium.launch({ headless: true });

for (const url of urls) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  const failedRequests = [];

  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText}`);
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
  await page.waitForTimeout(7_000);

  const result = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    body: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 500),
    splashVisible: Boolean(document.querySelector('#app-splash:not(.app-splash--hidden)')),
    progressBars: document.querySelectorAll('[role="progressbar"]').length,
  }));

  console.log(JSON.stringify({ requestedUrl: url, ...result, errors, failedRequests }, null, 2));
  await context.close();
}

await browser.close();
