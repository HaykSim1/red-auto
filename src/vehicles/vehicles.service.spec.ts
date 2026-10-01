import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { ApiException } from '../common/exceptions/api.exception';
import { Vehicle } from '../database/entities/vehicle.entity';
import { VehiclesService, normalizeVin } from './vehicles.service';

const USER = 'user-1';

function makeVehicle(over: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'veh-1',
    user: { id: USER } as Vehicle['user'],
    brand: 'BMW',
    model: 'X5',
    year: 2011,
    engine: null,
    vin: 'WBAPH5C55BA123456',
    label: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  } as Vehicle;
}

async function expectApiError(
  p: Promise<unknown>,
  code: string,
  status: HttpStatus,
): Promise<void> {
  await expect(p).rejects.toBeInstanceOf(ApiException);
  await p.catch((e: ApiException) => {
    expect(e.code).toBe(code);
    expect(e.getStatus()).toBe(status);
  });
}

describe('normalizeVin', () => {
  it('uppercases and strips spaces and dashes', () => {
    expect(normalizeVin(' wba-ph5c 55ba123456 ')).toBe('WBAPH5C55BA123456');
  });
  it('returns null for empty / whitespace / undefined', () => {
    expect(normalizeVin('')).toBeNull();
    expect(normalizeVin('  - ')).toBeNull();
    expect(normalizeVin(undefined)).toBeNull();
    expect(normalizeVin(null)).toBeNull();
  });
});

describe('VehiclesService VIN uniqueness', () => {
  let service: VehiclesService;
  const repo = {
    count: jest.fn(),
    create: jest.fn((v: Partial<Vehicle>) => v),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    repo.create.mockImplementation((v: Partial<Vehicle>) => v);
    const moduleRef = await Test.createTestingModule({
      providers: [
        VehiclesService,
        { provide: getRepositoryToken(Vehicle), useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(VehiclesService);
  });

  it('rejects creating a second car with the same VIN for the same user', async () => {
    repo.count.mockResolvedValue(1);
    await expectApiError(
      service.create(USER, { vin: 'wbaph5c55ba123456' }),
      'vehicle_vin_duplicate',
      HttpStatus.CONFLICT,
    );
    expect(repo.save).not.toHaveBeenCalled();
    // The lookup must use the normalized VIN so case / spacing variants collide
    expect(repo.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ vin: 'WBAPH5C55BA123456' }),
      }),
    );
  });

  it('stores the normalized VIN on create', async () => {
    repo.count.mockResolvedValue(0);
    repo.save.mockImplementation(async (v: Vehicle) =>
      makeVehicle({ ...v, id: 'veh-2' }),
    );
    const out = await service.create(USER, { vin: ' wba-ph5c55ba123456 ' });
    expect(out.vin).toBe('WBAPH5C55BA123456');
  });

  it('lets a car keep its own VIN on update', async () => {
    repo.findOne.mockResolvedValue(makeVehicle());
    repo.save.mockImplementation(async (v: Vehicle) => v);
    await expect(
      service.update(USER, 'veh-1', { vin: 'WBAPH5C55BA123456', label: 'Mine' }),
    ).resolves.toMatchObject({ vin: 'WBAPH5C55BA123456', label: 'Mine' });
    expect(repo.count).not.toHaveBeenCalled();
  });

  it('rejects changing a car to a VIN another car of the user already has', async () => {
    repo.findOne.mockResolvedValue(makeVehicle({ vin: 'OTHER000000000001' }));
    repo.count.mockResolvedValue(1);
    await expectApiError(
      service.update(USER, 'veh-1', { vin: 'WBAPH5C55BA123456' }),
      'vehicle_vin_duplicate',
      HttpStatus.CONFLICT,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('maps a unique-index violation (race) to the same error', async () => {
    repo.count.mockResolvedValue(0);
    const pgErr = Object.assign(
      new QueryFailedError('INSERT', [], new Error('dup')),
      { code: '23505', constraint: 'UQ_vehicles_user_vin' },
    );
    repo.save.mockRejectedValue(pgErr);
    await expectApiError(
      service.create(USER, { vin: 'WBAPH5C55BA123456' }),
      'vehicle_vin_duplicate',
      HttpStatus.CONFLICT,
    );
  });
});
