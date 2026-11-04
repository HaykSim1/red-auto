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
  category_key: 'brakes.pads',
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
    const created = await http()
      .post('/v1/inventory/recognitions')
      .set(auth(sellerToken))
      .send({ photo_storage_keys: [photoKey()] })
      .expect(202);
    const createdBody = created.body as { id: string; status: string };
    expect(createdBody.status).toBe('pending');

    let body: { status: string; result?: Record<string, unknown> } = {
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
    expect(body.result).toMatchObject({
      brand: 'Bosch',
      name: 'Brake pads front',
      category_key: 'brakes.pads',
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
});
