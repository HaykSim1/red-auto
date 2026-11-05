jest.mock('expo-server-sdk', () => ({
  Expo: class MockExpo {
    static isExpoPushToken(tok: unknown) {
      return typeof tok === 'string' && tok.length > 0;
    }
    chunkPushNotifications(messages: unknown[]) {
      return [messages];
    }
    sendPushNotificationsAsync() {
      return Promise.resolve([]);
    }
  },
}));

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { User } from '../src/database/entities';
import { UserRole } from '../src/database/enums';
import { S3ObjectReader } from '../src/inventory/recognition/object-reader';
import { RECOGNITION_CLIENT } from '../src/inventory/recognition/recognition-client';

const SELLER_PHONE = '+37477100201';
const BUYER_PHONE = '+37477100202';
const OTP = '123456';

// 1x1 transparent PNG
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const RECOGNITION_RESULT = {
  brand: 'Bosch',
  part_number: '0 986 AB1 234',
  barcode: null,
  name: 'Brake pads front',
  name_en: 'Brake pads front',
  name_hy: null,
  category_key: 'car_parts.braking_systems.brake_pads_and_shoes',
  oem_numbers: [],
  fitments: [],
  fitment_note: null,
  condition: 'new',
  confidence: {
    brand: 0.9,
    part_number: 0.9,
    barcode: 0,
    name: 0.9,
    category_key: 0.9,
    fitments: 0,
  },
  needs_review: [],
  notes_for_seller: null,
};

interface CatalogItem {
  id: string;
  in_stock: boolean;
}

describe('Shop inventory (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let sellerId: string;
  let sellerToken: string;
  let buyerToken: string;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function login(phone: string) {
    await http().post('/v1/auth/otp/request').send({ phone }).expect(201);
    const res = await http()
      .post('/v1/auth/otp/verify')
      .send({ phone, code: OTP })
      .expect(201);
    return res.body as {
      access_token: string;
      refresh_token: string;
      user: { id: string };
    };
  }

  beforeAll(async () => {
    process.env.TEST_PHONE = SELLER_PHONE;
    process.env.TEST_OTP_CODE = OTP;
    process.env.TEST_PHONE_BUYER = BUYER_PHONE;
    process.env.TEST_OTP_CODE_BUYER = OTP;
    process.env.ANTHROPIC_API_KEY ??= 'e2e-dummy-key';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RECOGNITION_CLIENT)
      .useValue({
        isConfigured: () => true,
        recognize: () =>
          Promise.resolve({
            parsed: RECOGNITION_RESULT,
            stopReason: 'end_turn',
            usage: { inputTokens: 10, outputTokens: 5, webSearchUses: 0 },
            model: 'test',
          }),
      })
      .overrideProvider(S3ObjectReader)
      .useValue({
        getImage: () =>
          Promise.resolve({ media_type: 'image/png', data: TINY_PNG }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    dataSource = app.get(DataSource);

    // Buyer: plain USER via the test-phone OTP path.
    buyerToken = (await login(BUYER_PHONE)).access_token;

    // Seller: no API-only path exists, so promote the OTP-created user
    // directly and re-issue tokens through POST /v1/auth/refresh.
    const s = await login(SELLER_PHONE);
    sellerId = s.user.id;
    await dataSource
      .getRepository(User)
      .update(sellerId, { role: UserRole.SELLER, shopName: 'E2E Shop' });
    const refreshed = await http()
      .post('/v1/auth/refresh')
      .send({ refresh_token: s.refresh_token })
      .expect(200);
    sellerToken = (refreshed.body as { access_token: string }).access_token;
  });

  afterAll(async () => {
    try {
      await dataSource.query(`DELETE FROM inventory_items WHERE shop_id = $1`, [
        sellerId,
      ]);
      await dataSource.query(
        `DELETE FROM inventory_recognitions WHERE shop_id = $1`,
        [sellerId],
      );
    } catch {
      /* best effort */
    }
    await app.close();
  });

  const photoKey = () => `inventory/${sellerId}/${Date.now()}-a.png`;

  async function createItem(body: Record<string, unknown> = {}) {
    const res = await http()
      .post('/v1/inventory/items')
      .set(auth(sellerToken))
      .send({
        name: `E2E part ${Math.random().toString(36).slice(2, 8)}`,
        status: 'active',
        quantity: 3,
        shelf_location: 'A-1',
        price_amount: 100,
        ...body,
      })
      .expect(201);
    return res.body as { id: string; name: string };
  }

  it('buyer gets 403 on GET /inventory/items', async () => {
    await http().get('/v1/inventory/items').set(auth(buyerToken)).expect(403);
  });

  it('seller creates an item with a foreign storage key -> 403 inventory_photo_key_forbidden', async () => {
    const res = await http()
      .post('/v1/inventory/items')
      .set(auth(sellerToken))
      .send({
        name: 'Foreign photo',
        photo_storage_keys: [
          'inventory/00000000-0000-0000-0000-000000000000/x.png',
        ],
      })
      .expect(403);
    expect(JSON.stringify(res.body)).toContain('inventory_photo_key_forbidden');
  });

  it('seller creates an active item and it appears in GET /shops/:id/items for the buyer, with in_stock true and no shelf_location', async () => {
    const item = await createItem();
    const res = await http()
      .get(`/v1/shops/${sellerId}/items`)
      .set(auth(buyerToken))
      .expect(200);
    const list = res.body as { items: CatalogItem[] };
    const found = list.items.find((i) => i.id === item.id);
    expect(found).toBeDefined();
    expect(found?.in_stock).toBe(true);
    expect(found).not.toHaveProperty('shelf_location');

    const one = await http()
      .get(`/v1/shops/${sellerId}/items/${item.id}`)
      .set(auth(buyerToken))
      .expect(200);
    expect((one.body as CatalogItem).id).toBe(item.id);
    expect(one.body).not.toHaveProperty('shelf_location');
  });

  it('PATCH quantity -1 -> 400; PATCH quantity 0 -> public in_stock false', async () => {
    const item = await createItem();
    await http()
      .patch(`/v1/inventory/items/${item.id}`)
      .set(auth(sellerToken))
      .send({ quantity: -1 })
      .expect(400);
    await http()
      .patch(`/v1/inventory/items/${item.id}`)
      .set(auth(sellerToken))
      .send({ quantity: 0 })
      .expect(200);
    const res = await http()
      .get(`/v1/shops/${sellerId}/items/${item.id}`)
      .set(auth(buyerToken))
      .expect(200);
    expect((res.body as CatalogItem).in_stock).toBe(false);

    const live = await createItem();
    const ids = async (q: string) =>
      (
        (
          await http()
            .get(`/v1/inventory/items?in_stock=${q}`)
            .set(auth(sellerToken))
            .expect(200)
        ).body as { items: { id: string }[] }
      ).items.map((i) => i.id);
    const outIds = await ids('false');
    expect(outIds).toContain(item.id);
    expect(outIds).not.toContain(live.id);
    const inIds = await ids('true');
    expect(inIds).toContain(live.id);
    expect(inIds).not.toContain(item.id);
    await http()
      .get('/v1/inventory/items?in_stock=maybe')
      .set(auth(sellerToken))
      .expect(400);
  });

  it('archived item disappears from the public list and GET /shops/:id/items/:itemId -> 404', async () => {
    const item = await createItem();
    await http()
      .delete(`/v1/inventory/items/${item.id}`)
      .set(auth(sellerToken))
      .expect(204);
    const list = await http()
      .get(`/v1/shops/${sellerId}/items`)
      .set(auth(buyerToken))
      .expect(200);
    expect(
      (list.body as { items: CatalogItem[] }).items.some(
        (i) => i.id === item.id,
      ),
    ).toBe(false);
    await http()
      .get(`/v1/shops/${sellerId}/items/${item.id}`)
      .set(auth(buyerToken))
      .expect(404);
  });

  it('POST /inventory/recognitions -> 202 pending, GET -> done with the stubbed result', async () => {
    const postedKey = photoKey();
    const created = await http()
      .post('/v1/inventory/recognitions')
      .set(auth(sellerToken))
      .send({ photo_storage_keys: [postedKey] })
      .expect(202);
    const createdBody = created.body as { id: string; status: string };
    expect(createdBody.status).toBe('pending');

    let body: {
      status: string;
      result?: Record<string, unknown>;
      photo_storage_keys?: string[];
    } = {
      status: 'pending',
    };
    for (let i = 0; i < 40 && body.status !== 'done'; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const res = await http()
        .get(`/v1/inventory/recognitions/${createdBody.id}`)
        .set(auth(sellerToken))
        .expect(200);
      body = res.body as typeof body;
    }
    expect(body.status).toBe('done');
    expect(body.photo_storage_keys).toEqual([postedKey]);
    expect(body.result).toMatchObject({
      brand: 'Bosch',
      name: 'Brake pads front',
      category_key: 'car_parts.braking_systems.brake_pads_and_shoes',
    });
  });

  it('GET /shops/:id returns items_count', async () => {
    const res = await http()
      .get(`/v1/shops/${sellerId}`)
      .set(auth(buyerToken))
      .expect(200);
    const count = (res.body as { items_count: number }).items_count;
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('shop items 404 for a non-seller user id', async () => {
    const buyer = await dataSource
      .getRepository(User)
      .findOneByOrFail({ phone: BUYER_PHONE });
    await http()
      .get(`/v1/shops/${buyer.id}/items`)
      .set(auth(buyerToken))
      .expect(404);
  });

  it('GET /inventory/categories returns the three-level tree', async () => {
    const res = await http().get('/v1/inventory/categories').expect(200);
    type Node = {
      key: string;
      labels: Record<string, string>;
      children: Node[];
    };
    const sections = res.body as Node[];
    expect(sections).toHaveLength(9);
    const carParts = sections.find((s) => s.key === 'car_parts');
    const braking = carParts?.children.find(
      (g) => g.key === 'car_parts.braking_systems',
    );
    const pads = braking?.children.find(
      (l) => l.key === 'car_parts.braking_systems.brake_pads_and_shoes',
    );
    expect(pads?.labels).toEqual({
      hy: 'Արգելակման կոճղակներ',
      ru: 'Тормозные колодки',
      en: 'Brake Pads and Shoes',
    });
    expect(pads?.children).toEqual([]);
    const batteries = sections.find((s) => s.key === 'car_batteries');
    expect(batteries?.children).toEqual([]);
  });

  it('item create rejects a non-leaf category key', async () => {
    const res = await http()
      .post('/v1/inventory/items')
      .set(auth(sellerToken))
      .send({ name: 'Bad category', category_key: 'car_parts.braking_systems' })
      .expect(400);
    expect((res.body as { code: string }).code).toBe('category_unknown');
  });

  describe('search, category filter, paging, photos', () => {
    const tag = () =>
      `t${Math.random().toString(36).slice(2, 8)}${Date.now() % 1000}`;
    const digits = () => String(Math.floor(Math.random() * 1e8));

    async function listIds(path: string, token = sellerToken) {
      const res = await http().get(path).set(auth(token)).expect(200);
      return (res.body as { items: { id: string }[] }).items.map((i) => i.id);
    }
    const shopIds = (query: string) => listIds(`/v1/inventory/items?${query}`);
    const publicIds = (query: string) =>
      listIds(`/v1/shops/${sellerId}/items?${query}`, buyerToken);

    it('q matches the name', async () => {
      const t = tag();
      const item = await createItem({ name: `Brake pad ${t}` });
      const other = await createItem();
      const ids = await shopIds(`q=${t}`);
      expect(ids).toContain(item.id);
      expect(ids).not.toContain(other.id);
    });

    it('q matches name_en and name_hy text (shop list and public catalog)', async () => {
      const en = tag();
      const hy = tag();
      const a = await createItem({ name: 'Колодки', name_en: `Pads ${en}` });
      const b = await createItem({ name: 'Диск', name_hy: `Սկավառակ ${hy}` });
      expect(await shopIds(`q=${en}`)).toEqual([a.id]);
      expect(await publicIds(`q=${en}`)).toEqual([a.id]);
      expect(await shopIds(`q=${encodeURIComponent(hy)}`)).toEqual([b.id]);
    });

    it('q matches a part number typed with spaces and dashes', async () => {
      const n = digits();
      const item = await createItem({ part_number: `ZX${n}-445 B` });
      const q = encodeURIComponent(`zx ${n}-445-b`);
      expect(await shopIds(`q=${q}`)).toEqual([item.id]);
    });

    it('q matches an OEM number exactly after normalization', async () => {
      const n = digits();
      const item = await createItem({ oem_numbers: [`OE${n}77`] });
      const q = encodeURIComponent(`oe-${n} 77`);
      expect(await shopIds(`q=${q}`)).toEqual([item.id]);
      expect(await publicIds(`q=${q}`)).toEqual([item.id]);
    });

    it('q treats % as a literal, not a wildcard', async () => {
      const t = tag();
      const pct = await createItem({ name: `100% ${t}` });
      const plain = await createItem({ name: `Plain ${t}` });
      const ids = await shopIds(`q=${encodeURIComponent('%')}`);
      expect(ids).toContain(pct.id);
      expect(ids).not.toContain(plain.id);
      const scoped = await shopIds(`q=${encodeURIComponent(`0% ${t}`)}`);
      expect(scoped).toEqual([pct.id]);
    });

    it('category filters by section, group (prefix) and leaf (equality)', async () => {
      const t = tag();
      const pads = await createItem({
        name: `Pads ${t}`,
        category_key: 'car_parts.braking_systems.brake_pads_and_shoes',
      });
      const discs = await createItem({
        name: `Discs ${t}`,
        category_key: 'car_parts.braking_systems.brake_discs_and_drums',
      });
      const belt = await createItem({
        name: `Belt ${t}`,
        category_key: 'car_parts.engine_parts.belts_chains_and_tensioners',
      });
      const battery = await createItem({
        name: `Battery ${t}`,
        category_key: 'car_batteries',
      });
      const section = await shopIds(`q=${t}&category=car_parts`);
      expect(section.sort()).toEqual([pads.id, discs.id, belt.id].sort());
      const group = await shopIds(`q=${t}&category=car_parts.braking_systems`);
      expect(group.sort()).toEqual([pads.id, discs.id].sort());
      expect(
        await shopIds(
          `q=${t}&category=car_parts.braking_systems.brake_pads_and_shoes`,
        ),
      ).toEqual([pads.id]);
      expect(await shopIds(`q=${t}&category=car_batteries`)).toEqual([
        battery.id,
      ]);
      expect(
        await publicIds(`q=${t}&category=car_parts.braking_systems`),
      ).toHaveLength(2);
    });

    it('limit=1 pages across two pages without duplicates', async () => {
      const t = tag();
      const a = await createItem({ name: `Page ${t} a` });
      const b = await createItem({ name: `Page ${t} b` });
      const first = await http()
        .get(`/v1/inventory/items?q=${t}&limit=1`)
        .set(auth(sellerToken))
        .expect(200);
      const p1 = first.body as {
        items: { id: string }[];
        next_cursor: string | null;
      };
      expect(p1.items).toHaveLength(1);
      expect(p1.next_cursor).toEqual(expect.any(String));
      const second = await http()
        .get(
          `/v1/inventory/items?q=${t}&limit=1&cursor=${encodeURIComponent(p1.next_cursor!)}`,
        )
        .set(auth(sellerToken))
        .expect(200);
      const p2 = second.body as typeof p1;
      expect(p2.items).toHaveLength(1);
      expect(p2.next_cursor).toBeNull();
      const all = [...p1.items, ...p2.items].map((i) => i.id);
      expect(new Set(all).size).toBe(2);
      expect(all.sort()).toEqual([a.id, b.id].sort());
    });

    it('PATCH photo_storage_keys replaces the photos', async () => {
      const oldKey = `inventory/${sellerId}/${Date.now()}-old.png`;
      const newKey = `inventory/${sellerId}/${Date.now()}-new.png`;
      const item = await createItem({ photo_storage_keys: [oldKey] });
      const res = await http()
        .patch(`/v1/inventory/items/${item.id}`)
        .set(auth(sellerToken))
        .send({ photo_storage_keys: [newKey] })
        .expect(200);
      const keys = (body: unknown) =>
        (body as { photos: { storage_key: string }[] }).photos.map(
          (p) => p.storage_key,
        );
      expect(keys(res.body)).toEqual([newKey]);
      const again = await http()
        .get(`/v1/inventory/items/${item.id}`)
        .set(auth(sellerToken))
        .expect(200);
      expect(keys(again.body)).toEqual([newKey]);
      expect(keys(again.body)).not.toContain(oldKey);
    });
  });
});
