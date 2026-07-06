import { test, expect } from '@playwright/test';
import { CLUB_URL, SALON_NAME, servicesUrl } from './constants';

/**
 * READ-ONLY rendering checks against the live club SPA. We never start a
 * booking nor submit anything — we only load public pages and assert what the
 * customer sees.
 */

type Service = { id: string; name: string; imageUrl: string | null };

async function fetchServices(request: import('@playwright/test').APIRequestContext) {
  const { data } = (await (await request.get(servicesUrl())).json()) as {
    data: Service[];
  };
  return data;
}

test.describe('club SPA — shell', () => {
  test('home responds 200', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
  });

  test('document title is the Salonpass booking title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Salonpass/i);
  });

  test('mounts the SPA root', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#root')).toBeAttached();
  });

  test('registers a PWA manifest', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  });

  test('renders the salon name somewhere on the page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(SALON_NAME, { exact: false }).first()).toBeVisible();
  });

  test('has no console page errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
});

test.describe('club SPA — services section', () => {
  test('shows the first service name from the API', async ({ page, request }) => {
    const services = await fetchServices(request);
    await page.goto('/#servicos');
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText(services[0].name, { exact: false }).first(),
    ).toBeVisible();
  });

  test('renders service thumbnails for services that have a photo', async ({
    page,
    request,
  }) => {
    const services = await fetchServices(request);
    const withImg = services.filter((s) => s.imageUrl);
    test.skip(withImg.length === 0, 'no service has an image yet');

    await page.goto('/#servicos');
    await page.waitForLoadState('networkidle');

    // At least one <img> on the page points at the uploads bucket.
    const bucketImg = page.locator('img[src*="beautypass-uploads"]');
    await expect(bucketImg.first()).toBeVisible();
  });

  test('every uploads-bucket <img> actually loads (naturalWidth > 0)', async ({
    page,
  }) => {
    await page.goto('/#servicos');
    await page.waitForLoadState('networkidle');
    const imgs = page.locator('img[src*="beautypass-uploads"]');
    const count = await imgs.count();
    test.skip(count === 0, 'no bucket images rendered');
    for (let i = 0; i < count; i++) {
      const ok = await imgs.nth(i).evaluate(
        (el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0,
      );
      expect(ok).toBe(true);
    }
  });
});

test.describe('club SPA — responsive', () => {
  test('renders on a narrow mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.locator('#root')).toBeAttached();
    await expect(page.getByText(SALON_NAME, { exact: false }).first()).toBeVisible();
  });

  test('renders on a wide desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('#root')).toBeAttached();
    await expect(page.getByText(SALON_NAME, { exact: false }).first()).toBeVisible();
  });

  test('does not overflow horizontally on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    // Allow a 1px rounding fudge.
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('club SPA — deep links', () => {
  for (const hash of ['#servicos', '#profissionais', '#sobre']) {
    test(`hash route ${hash} keeps the app mounted`, async ({ page }) => {
      const res = await page.goto(`/${hash}`);
      expect(res?.status()).toBe(200);
      await expect(page.locator('#root')).toBeAttached();
    });
  }

  test('unknown SPA path still serves the app (client routing)', async ({ page }) => {
    const res = await page.goto('/this-route-does-not-exist');
    expect(res?.status()).toBe(200);
    await expect(page.locator('#root')).toBeAttached();
  });
});
