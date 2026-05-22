import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { UserRole } from '../database/enums';
import { SellerApplicationsService } from '../seller-applications/seller-applications.service';
import { UsersService } from './users.service';

const mockUser = (): User =>
  ({
    id: 'user-uuid-1',
    phone: '+37400000000',
    role: UserRole.USER,
    displayName: 'Test User',
    preferredLocale: null,
    sellerPhone: null,
    sellerTelegram: null,
    shopName: null,
    shopAddress: null,
    shopLogoStorageKey: null,
    email: null,
    passwordHash: null,
    blockedAt: null,
    deletedAt: null,
    isFeatured: false,
    isSpecialBuyer: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User);

describe('UsersService.deleteMe', () => {
  let service: UsersService;
  let usersRepo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
            findOneOrFail: jest.fn(),
          },
        },
        {
          provide: SellerApplicationsService,
          useValue: { getForMe: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    usersRepo = module.get(getRepositoryToken(User));
  });

  it('anonymizes user data and sets deleted_at', async () => {
    const user = mockUser();
    usersRepo.findOne.mockResolvedValue(user);
    usersRepo.update.mockResolvedValue({ affected: 1 } as never);

    await service.deleteMe(user.id);

    expect(usersRepo.update).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({
        phone: `deleted:${user.id}`,
        displayName: null,
        sellerPhone: null,
        sellerTelegram: null,
        shopName: null,
        shopAddress: null,
        shopLogoStorageKey: null,
        preferredLocale: null,
        email: null,
        passwordHash: null,
        deletedAt: expect.any(Date),
      }),
    );
  });

  it('throws 404 when user not found', async () => {
    usersRepo.findOne.mockResolvedValue(null);

    await expect(service.deleteMe('nonexistent-id')).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
  });
});
