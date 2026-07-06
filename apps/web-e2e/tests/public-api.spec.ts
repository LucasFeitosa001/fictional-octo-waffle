import { test, expect, request as pwRequest } from '@playwright/test';
import {
  API_BASE,
  SALON_NAME,
  SALON_SLUG,
  portalUrl,
  servicesUrl,
  professionalsUrl,
} from './constants';

/**
 * READ-ONLY checks against the live public booking API. These assert the data
 * contract the club SPA depends on — nothing is created/updated/deleted.
 */

type Service = {
  id: string;
  name: string;
  price: string | number;
  durationMin: number;
  description: string | null;
  imageUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  favorite?: boolean;
  isNew?: boolean;
};

test.describe('public booking API — portal', () => {
  test('portal endpoint returns 200', async ({ request }) => {
    const res = await request.get(portalUrl());
    expect(res.status()).toBe(200);
  });

  test('portal advertises the right tenant', async ({ request }) => {
    const body = await (await request.get(portalUrl())).json();
    expect(body.slug).toBe(SALON_SLUG);
    expect(body.name).toBe(SALON_NAME);
  });

  test('portal exposes a Brazilian timezone', async ({ request }) => {
    const body = await (await request.get(portalUrl())).json();
    expect(body.timezone).toBe('America/Sao_Paulo');
  });

  test('portal carries an https logo on the uploads bucket', async ({ request }) => {
    const body = await (await request.get(portalUrl())).json();
    expect(typeof body.logoUrl).toBe('string');
    expect(body.logoUrl).toMatch(/^https:\/\//);
    expect(body.logoUrl).toContain('beautypass-uploads');
  });

  test('portal carries the documented keys', async ({ request }) => {
    const body = await (await request.get(portalUrl())).json();
    for (const k of ['slug', 'name', 'logoUrl', 'timezone', 'open']) {
      expect(body).toHaveProperty(k);
    }
  });

  test('open flag is a boolean', async ({ request }) => {
    const body = await (await request.get(portalUrl())).json();
    expect(typeof body.open).toBe('boolean');
  });

  test('unknown tenant slug does not 200 with our data', async ({ request }) => {
    const res = await request.get(portalUrl('definitely-not-a-real-salon-xyz'));
    // Either a 404, or the SPA HTML fallback — never our tenant payload.
    if (res.status() === 200) {
      const ct = res.headers()['content-type'] ?? '';
      expect(ct).toContain('text/html');
    } else {
      expect(res.status()).toBeGreaterThanOrEqual(400);
    }
  });
});

test.describe('public booking API — services', () => {
  test('services endpoint returns a data array', async ({ request }) => {
    const body = await (await request.get(servicesUrl())).json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test('every service has the required shape', async ({ request }) => {
    const { data } = (await (await request.get(servicesUrl())).json()) as {
      data: Service[];
    };
    for (const s of data) {
      expect(typeof s.id).toBe('string');
      expect(s.id.length).toBeGreaterThan(0);
      expect(typeof s.name).toBe('string');
      expect(s.name.trim().length).toBeGreaterThan(0);
      expect(Number(s.price)).not.toBeNaN();
      expect(Number(s.durationMin)).toBeGreaterThan(0);
    }
  });

  test('service prices are non-negative', async ({ request }) => {
    const { data } = (await (await request.get(servicesUrl())).json()) as {
      data: Service[];
    };
    for (const s of data) expect(Number(s.price)).toBeGreaterThanOrEqual(0);
  });

  test('service durations are multiples of 5 minutes', async ({ request }) => {
    const { data } = (await (await request.get(servicesUrl())).json()) as {
      data: Service[];
    };
    for (const s of data) expect(s.durationMin % 5).toBe(0);
  });

  test('service ids are unique', async ({ request }) => {
    const { data } = (await (await request.get(servicesUrl())).json()) as {
      data: Service[];
    };
    const ids = data.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('at least one service carries a real photo', async ({ request }) => {
    const { data } = (await (await request.get(servicesUrl())).json()) as {
      data: Service[];
    };
    const withImg = data.filter((s) => s.imageUrl);
    expect(withImg.length).toBeGreaterThan(0);
  });

  test('service images are https JPEGs on the uploads bucket', async ({ request }) => {
    const { data } = (await (await request.get(servicesUrl())).json()) as {
      data: Service[];
    };
    for (const s of data) {
      if (!s.imageUrl) continue;
      expect(s.imageUrl).toMatch(/^https:\/\//);
      expect(s.imageUrl).toContain('beautypass-uploads');
      expect(s.imageUrl).toMatch(/\.jpe?g$/i);
    }
  });

  test('every service image URL actually resolves (200, image/*)', async ({ request }) => {
    const { data } = (await (await request.get(servicesUrl())).json()) as {
      data: Service[];
    };
    const imgs = data.filter((s) => s.imageUrl).map((s) => s.imageUrl as string);
    for (const url of imgs) {
      const res = await request.get(url);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type'] ?? '').toMatch(/^image\//);
    }
  });
});

test.describe('public booking API — professionals', () => {
  test('professionals endpoint requires a serviceId', async ({ request }) => {
    const res = await request.get(`${portalUrl()}/professionals`);
    expect(res.status()).toBe(400);
  });

  test('professionals endpoint returns a data array for a real service', async ({
    request,
  }) => {
    const { data } = (await (await request.get(servicesUrl())).json()) as {
      data: Service[];
    };
    const res = await request.get(professionalsUrl(data[0].id));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});

test.describe('public booking API — hardening', () => {
  test('serves JSON content-type for the portal', async ({ request }) => {
    const res = await request.get(portalUrl());
    expect(res.headers()['content-type'] ?? '').toContain('application/json');
  });

  test('a fresh request context (no cookies) still reads services', async () => {
    const ctx = await pwRequest.newContext();
    const res = await ctx.get(servicesUrl());
    expect(res.status()).toBe(200);
    await ctx.dispose();
  });

  test('API base is same-origin with the club host', async ({ request }) => {
    expect(API_BASE).toContain('studioborboletas.salonpass.com.br');
    const res = await request.get(portalUrl());
    expect(res.ok()).toBe(true);
  });
});
