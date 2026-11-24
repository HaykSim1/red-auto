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

import { randomUUID } from 'node:crypto';
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
  is_part: true,
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
      await dataSource.query(
        `DELETE FROM inventory_suppliers WHERE shop_id = $1`,
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

  describe('stock movements, scan, cost and suppliers', () => {
    interface Movement {
      id: string;
      item_id: string;
      item_name: string;
      type: string;
      delta: number;
      quantity_after: number;
      unit_cost: number | null;
    }
    interface Item {
      id: string;
      quantity: number;
      cost_amount: number | null;
      supplier: { id: string; name: string } | null;
    }
    interface Result {
      movement: Movement;
      item: Item;
    }

    const seller = () => auth(sellerToken);
    // 13 digits, unique per call; by-code does not require a GS1 check digit.
    const barcode = () =>
      `29${String(Date.now()).slice(-7)}${Math.floor(Math.random() * 1e4)
        .toString()
        .padStart(4, '0')}`;

    const history = async (itemId: string) =>
      (
        (
          await http()
            .get(`/v1/inventory/items/${itemId}/movements`)
            .set(seller())
            .expect(200)
        ).body as { items: Movement[] }
      ).items;

    it('creating an item records its opening stock as a receive movement', async () => {
      const item = await createItem({ quantity: 3, cost_amount: 70 });
      const rows = await history(item.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        type: 'receive',
        delta: 3,
        quantity_after: 3,
        unit_cost: 70,
        item_name: item.name,
      });
    });

    it('scan-sell by barcode, raise the amount on the same movement, then undo', async () => {
      const code = barcode();
      const item = await createItem({ quantity: 5, barcode: code });

      const sold = (
        await http()
          .post('/v1/inventory/movements/by-code')
          .set(seller())
          .send({ code, type: 'sell' })
          .expect(201)
      ).body as Result;
      expect(sold.movement).toMatchObject({
        type: 'sell',
        delta: -1,
        quantity_after: 4,
      });
      expect(sold.item.quantity).toBe(4);

      const three = (
        await http()
          .patch(`/v1/inventory/movements/${sold.movement.id}`)
          .set(seller())
          .send({ quantity: 3 })
          .expect(200)
      ).body as Result;
      expect(three.movement).toMatchObject({ delta: -3, quantity_after: 2 });
      expect(three.item.quantity).toBe(2);
      // One sale row, not three.
      expect(
        (await history(item.id)).filter((m) => m.type === 'sell'),
      ).toHaveLength(1);

      // Cannot sell more than there was before this sale.
      const tooMany = await http()
        .patch(`/v1/inventory/movements/${sold.movement.id}`)
        .set(seller())
        .send({ quantity: 6 })
        .expect(400);
      expect((tooMany.body as { code: string }).code).toBe(
        'movement_insufficient_stock',
      );

      const undone = (
        await http()
          .delete(`/v1/inventory/movements/${sold.movement.id}`)
          .set(seller())
          .expect(200)
      ).body as Item;
      expect(undone.quantity).toBe(5);
      expect((await history(item.id)).map((m) => m.type)).toEqual(['receive']);
    });

    it('selling out of stock -> 400 movement_insufficient_stock and nothing is recorded', async () => {
      const code = barcode();
      const item = await createItem({ quantity: 0, barcode: code });
      const res = await http()
        .post('/v1/inventory/movements/by-code')
        .set(seller())
        .send({ code, type: 'sell' })
        .expect(400);
      expect(res.body).toMatchObject({
        code: 'movement_insufficient_stock',
        details: { available: 0 },
      });
      expect(await history(item.id)).toHaveLength(0);
    });

    it('by-code: unknown code -> 404, part number resolves, two items with one code -> 409 with candidates', async () => {
      const miss = await http()
        .post('/v1/inventory/movements/by-code')
        .set(seller())
        .send({ code: barcode(), type: 'sell' })
        .expect(404);
      expect((miss.body as { code: string }).code).toBe(
        'inventory_item_not_found',
      );

      const pn = `E2E-${Math.random().toString(36).slice(2, 10)}`;
      const byPn = await createItem({ quantity: 2, part_number: pn });
      const sold = (
        await http()
          .post('/v1/inventory/movements/by-code')
          .set(seller())
          .send({ code: pn.toLowerCase().replace('-', ' '), type: 'sell' })
          .expect(201)
      ).body as Result;
      expect(sold.item.id).toBe(byPn.id);

      const code = barcode();
      const a = await createItem({ quantity: 1, barcode: code });
      const b = await createItem({ quantity: 1, barcode: code });
      const amb = await http()
        .post('/v1/inventory/movements/by-code')
        .set(seller())
        .send({ code, type: 'sell' })
        .expect(409);
      const body = amb.body as { code: string; details: { items: Item[] } };
      expect(body.code).toBe('movement_code_ambiguous');
      expect(body.details.items.map((i) => i.id).sort()).toEqual(
        [a.id, b.id].sort(),
      );

      const looked = (
        await http()
          .get('/v1/inventory/items/lookup')
          .query({ code })
          .set(seller())
          .expect(200)
      ).body as { items: Item[] };
      expect(looked.items).toHaveLength(2);
    });

    it('two simultaneous sales of the last unit: exactly one succeeds', async () => {
      const item = await createItem({ quantity: 1 });
      const sell = () =>
        http()
          .post(`/v1/inventory/items/${item.id}/movements`)
          .set(seller())
          .send({ type: 'sell', quantity: 1 });
      const [a, b] = await Promise.all([sell(), sell()]);
      expect([a.status, b.status].sort()).toEqual([201, 400]);
      expect(
        (await history(item.id)).filter((m) => m.type === 'sell'),
      ).toHaveLength(1);
    });

    it('only the latest movement of an item can be changed or undone', async () => {
      const item = await createItem({ quantity: 5 });
      const post = async (body: Record<string, unknown>) =>
        (
          await http()
            .post(`/v1/inventory/items/${item.id}/movements`)
            .set(seller())
            .send(body)
            .expect(201)
        ).body as Result;
      const first = await post({ type: 'sell', quantity: 1 });
      await post({ type: 'sell', quantity: 1 });
      const res = await http()
        .delete(`/v1/inventory/movements/${first.movement.id}`)
        .set(seller())
        .expect(409);
      expect((res.body as { code: string }).code).toBe('movement_locked');
    });

    it('receive with a unit cost raises stock and updates the item cost; adjust sets a level', async () => {
      const item = await createItem({ quantity: 4, cost_amount: 50 });
      const received = (
        await http()
          .post(`/v1/inventory/items/${item.id}/movements`)
          .set(seller())
          .send({ type: 'receive', quantity: 10, unit_cost: 65.5 })
          .expect(201)
      ).body as Result;
      expect(received.item).toMatchObject({ quantity: 14, cost_amount: 65.5 });

      const adjusted = (
        await http()
          .post(`/v1/inventory/items/${item.id}/movements`)
          .set(seller())
          .send({ type: 'adjust', quantity: 9, note: 'recount' })
          .expect(201)
      ).body as Result;
      expect(adjusted.movement).toMatchObject({ delta: -5, quantity_after: 9 });

      const same = await http()
        .post(`/v1/inventory/items/${item.id}/movements`)
        .set(seller())
        .send({ type: 'adjust', quantity: 9 })
        .expect(400);
      expect((same.body as { code: string }).code).toBe('movement_no_change');
    });

    it('legacy PATCH quantity is recorded as an adjust movement', async () => {
      const item = await createItem({ quantity: 3 });
      await http()
        .patch(`/v1/inventory/items/${item.id}`)
        .set(seller())
        .send({ quantity: 8, note: 'x' })
        .expect(200);
      const rows = await history(item.id);
      expect(rows[0]).toMatchObject({
        type: 'adjust',
        delta: 5,
        quantity_after: 8,
      });
      // An unchanged quantity adds no movement.
      await http()
        .patch(`/v1/inventory/items/${item.id}`)
        .set(seller())
        .send({ quantity: 8 })
        .expect(200);
      expect(await history(item.id)).toHaveLength(2);
    });

    it('GET /inventory/movements lists the shop feed newest first and pages by cursor', async () => {
      const item = await createItem({ quantity: 2 });
      await http()
        .post(`/v1/inventory/items/${item.id}/movements`)
        .set(seller())
        .send({ type: 'sell', quantity: 1 })
        .expect(201);
      const page1 = (
        await http()
          .get('/v1/inventory/movements')
          .query({ limit: 1 })
          .set(seller())
          .expect(200)
      ).body as { items: Movement[]; next_cursor: string | null };
      expect(page1.items[0]).toMatchObject({ item_id: item.id, type: 'sell' });
      expect(page1.next_cursor).toEqual(expect.any(String));
      const page2 = (
        await http()
          .get('/v1/inventory/movements')
          .query({ limit: 1, cursor: page1.next_cursor })
          .set(seller())
          .expect(200)
      ).body as { items: Movement[] };
      expect(page2.items[0]).toMatchObject({
        item_id: item.id,
        type: 'receive',
      });
    });

    it('buyer gets 403 on movements and suppliers', async () => {
      await http()
        .get('/v1/inventory/movements')
        .set(auth(buyerToken))
        .expect(403);
      await http()
        .get('/v1/inventory/suppliers')
        .set(auth(buyerToken))
        .expect(403);
    });

    it('suppliers: create, unique name, attach to an item, private in the public catalog, delete unlinks', async () => {
      const name = `E2E Supplier ${Math.random().toString(36).slice(2, 8)}`;
      const supplier = (
        await http()
          .post('/v1/inventory/suppliers')
          .set(seller())
          .send({ name, phone: '+37499000000', telegram: '@e2e' })
          .expect(201)
      ).body as { id: string; name: string };

      const dup = await http()
        .post('/v1/inventory/suppliers')
        .set(seller())
        .send({ name: name.toUpperCase() })
        .expect(409);
      expect((dup.body as { code: string }).code).toBe('supplier_name_taken');

      const item = await createItem({
        cost_amount: 40,
        supplier_id: supplier.id,
      });
      const mine = (
        await http()
          .get(`/v1/inventory/items/${item.id}`)
          .set(seller())
          .expect(200)
      ).body as Item;
      expect(mine).toMatchObject({
        cost_amount: 40,
        supplier: { id: supplier.id, name },
      });

      const pub = (
        await http()
          .get(`/v1/shops/${sellerId}/items/${item.id}`)
          .set(auth(buyerToken))
          .expect(200)
      ).body as Record<string, unknown>;
      expect(pub).not.toHaveProperty('cost_amount');
      expect(pub).not.toHaveProperty('supplier');
      expect(pub).not.toHaveProperty('quantity');

      const foreign = await http()
        .patch(`/v1/inventory/items/${item.id}`)
        .set(seller())
        .send({ supplier_id: '00000000-0000-4000-8000-000000000000' })
        .expect(404);
      expect((foreign.body as { code: string }).code).toBe(
        'supplier_not_found',
      );

      await http()
        .delete(`/v1/inventory/suppliers/${supplier.id}`)
        .set(seller())
        .expect(204);
      const after = (
        await http()
          .get(`/v1/inventory/items/${item.id}`)
          .set(seller())
          .expect(200)
      ).body as Item;
      expect(after.supplier).toBeNull();
      const list = (
        await http().get('/v1/inventory/suppliers').set(seller()).expect(200)
      ).body as { items: { id: string }[] };
      expect(list.items.find((x) => x.id === supplier.id)).toBeUndefined();

      // The name is free again after deletion.
      await http()
        .post('/v1/inventory/suppliers')
        .set(seller())
        .send({ name })
        .expect(201);
    });

    describe('offline operations', () => {
      interface BatchResult {
        client_op_id: string;
        status: 'applied' | 'duplicate' | 'rejected';
        error_code?: string;
        movement?: Movement & { forced: boolean; occurred_at: string | null };
        item?: Item & { needs_review: string[] };
      }
      interface IndexRow {
        id: string;
        status: string;
        quantity: number;
        barcode: string | null;
      }
      interface IndexPage {
        items: IndexRow[];
        next_cursor: string | null;
        server_time: string;
      }

      const op = (itemId: string, type: 'sell' | 'receive', quantity = 1) => ({
        client_op_id: randomUUID(),
        item_id: itemId,
        type,
        quantity,
        occurred_at: new Date(Date.now() - 60_000).toISOString(),
      });
      const batch = async (operations: unknown[], status = 200) =>
        (
          await http()
            .post('/v1/inventory/movements/batch')
            .set(seller())
            .send({ operations })
            .expect(status)
        ).body as { results: BatchResult[] };
      const getItem = async (id: string) =>
        (
          await http()
            .get(`/v1/inventory/items/${id}`)
            .set(seller())
            .expect(200)
        ).body as Item & { needs_review: string[] };
      const index = async (query: Record<string, string | number> = {}) =>
        (
          await http()
            .get('/v1/inventory/items/index')
            .query(query)
            .set(seller())
            .expect(200)
        ).body as IndexPage;

      it('applies a batch in order; a repeated id is a duplicate; an archived item is rejected', async () => {
        const item = await createItem({ quantity: 5 });
        const gone = await createItem({ quantity: 5 });
        await http()
          .delete(`/v1/inventory/items/${gone.id}`)
          .set(seller())
          .expect(204);

        const sell = op(item.id, 'sell', 2);
        const receive = op(item.id, 'receive', 10);
        const { results } = await batch([
          sell,
          receive,
          sell,
          op(gone.id, 'sell'),
        ]);

        expect(results.map((r) => r.status)).toEqual([
          'applied',
          'applied',
          'duplicate',
          'rejected',
        ]);
        expect(results.map((r) => r.client_op_id)).toEqual([
          sell.client_op_id,
          receive.client_op_id,
          sell.client_op_id,
          results[3].client_op_id,
        ]);
        expect(results[0].movement).toMatchObject({
          delta: -2,
          quantity_after: 3,
          forced: false,
          occurred_at: sell.occurred_at,
        });
        expect(results[2].movement?.id).toBe(results[0].movement?.id);
        expect(results[3].error_code).toBe('inventory_item_not_found');
        expect(results[1].item?.quantity).toBe(13);

        // opening receive + sell + receive: the repeated sale was not recorded twice
        expect(await history(item.id)).toHaveLength(3);
        expect((await getItem(item.id)).quantity).toBe(13);
      });

      it('sending the same batch again changes nothing', async () => {
        const item = await createItem({ quantity: 4 });
        const ops = [op(item.id, 'sell'), op(item.id, 'sell')];
        await batch(ops);
        const again = await batch(ops);
        expect(again.results.map((r) => r.status)).toEqual([
          'duplicate',
          'duplicate',
        ]);
        expect((await getItem(item.id)).quantity).toBe(2);
      });

      it('a sale beyond the stock is forced: stock 0, flagged for a recount, cleared by an adjust', async () => {
        const item = await createItem({ quantity: 1 });
        const { results } = await batch([
          op(item.id, 'sell'),
          op(item.id, 'sell'),
        ]);
        expect(results[0].movement).toMatchObject({
          forced: false,
          quantity_after: 0,
        });
        expect(results[1]).toMatchObject({ status: 'applied' });
        expect(results[1].movement).toMatchObject({
          forced: true,
          delta: -1,
          quantity_after: 0,
        });
        const flagged = await getItem(item.id);
        expect(flagged.quantity).toBe(0);
        expect(flagged.needs_review).toContain('quantity');

        await http()
          .post(`/v1/inventory/items/${item.id}/movements`)
          .set(seller())
          .send({ type: 'adjust', quantity: 2 })
          .expect(201);
        const counted = await getItem(item.id);
        expect(counted.quantity).toBe(2);
        expect(counted.needs_review).not.toContain('quantity');
      });

      it('the single endpoints stay strict and become idempotent with client_op_id', async () => {
        const code = barcode();
        const item = await createItem({ quantity: 1, barcode: code });
        const client_op_id = randomUUID();
        const send = () =>
          http()
            .post('/v1/inventory/movements/by-code')
            .set(seller())
            .send({ code, type: 'sell', client_op_id })
            .expect(201);
        const first = (await send()).body as Result;
        const second = (await send()).body as Result;
        expect(second.movement.id).toBe(first.movement.id);
        expect((await getItem(item.id)).quantity).toBe(0);
        expect(await history(item.id)).toHaveLength(2);

        // A different operation on the empty item is still refused here.
        await http()
          .post('/v1/inventory/movements/by-code')
          .set(seller())
          .send({ code, type: 'sell', client_op_id: randomUUID() })
          .expect(400);
      });

      it('batch validation: only sell / receive, 1 to 100 operations', async () => {
        const item = await createItem({ quantity: 1 });
        await batch([{ ...op(item.id, 'sell'), type: 'adjust' }], 400);
        await batch([], 400);
        await batch(
          Array.from({ length: 101 }, () => op(item.id, 'receive')),
          400,
        );
        expect(await history(item.id)).toHaveLength(1);
      });

      it('items/index lists every item, archived ones as tombstones, and pages without repeats', async () => {
        const code = barcode();
        const kept = await createItem({ quantity: 2, barcode: code });
        const gone = await createItem({ quantity: 1 });
        await http()
          .delete(`/v1/inventory/items/${gone.id}`)
          .set(seller())
          .expect(204);

        const seen = new Map<string, IndexRow>();
        let cursor: string | null = null;
        let pages = 0;
        do {
          const page: IndexPage = await index(
            cursor ? { limit: 2, cursor } : { limit: 2 },
          );
          for (const row of page.items) {
            expect(seen.has(row.id)).toBe(false);
            seen.set(row.id, row);
          }
          cursor = page.next_cursor;
          pages += 1;
        } while (cursor && pages < 500);

        expect(cursor).toBeNull();
        expect(seen.get(kept.id)).toMatchObject({
          status: 'active',
          quantity: 2,
          barcode: code,
        });
        expect(seen.get(gone.id)).toMatchObject({ status: 'archived' });
        expect(seen.get(kept.id)).toHaveProperty('cover_storage_key', null);
      });

      it('items/index with updated_since returns what changed, including a stock change', async () => {
        const item = await createItem({ quantity: 3 });
        const other = await createItem({ quantity: 3 });
        await new Promise((r) => setTimeout(r, 20));
        const since = new Date().toISOString();
        await new Promise((r) => setTimeout(r, 20));
        await batch([op(item.id, 'sell')]);

        const page = await index({ updated_since: since });
        const row = page.items.find((r) => r.id === item.id);
        expect(row).toMatchObject({ quantity: 2 });
        expect(page.items.find((r) => r.id === other.id)).toBeUndefined();
        expect(Date.parse(page.server_time)).toBeLessThan(Date.now());
      });

      it('buyer gets 403 on batch and index', async () => {
        await http()
          .post('/v1/inventory/movements/batch')
          .set(auth(buyerToken))
          .send({ operations: [op(randomUUID(), 'sell')] })
          .expect(403);
        await http()
          .get('/v1/inventory/items/index')
          .set(auth(buyerToken))
          .expect(403);
      });
    });
  });
});
