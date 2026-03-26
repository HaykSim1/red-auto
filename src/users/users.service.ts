import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiException } from '../common/exceptions/api.exception';
import { User } from '../database/entities/user.entity';
import { UserRole } from '../database/enums';
import { SellerApplicationsService } from '../seller-applications/seller-applications.service';
import { UpdateMeDto } from './dto/update-me.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly sellerApplications: SellerApplicationsService,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  async getMe(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return null;
    const seller_application = await this.sellerApplications.getForMe(
      userId,
      user.role,
    );
    return this.toMeResponse(user, seller_application);
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const existing = await this.users.findOne({ where: { id: userId } });
    if (!existing) {
      throw new ApiException(
        'not_found',
        'User not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const touchesShop =
      dto.shop_name !== undefined ||
      dto.shop_address !== undefined ||
      dto.shop_logo_storage_key !== undefined;
    if (touchesShop && existing.role !== UserRole.SELLER) {
      throw new ApiException(
        'seller_shop_fields_forbidden',
        'Only sellers can update shop fields.',
        HttpStatus.FORBIDDEN,
      );
    }

    const patch: Partial<
      Pick<
        User,
        | 'displayName'
        | 'preferredLocale'
        | 'sellerPhone'
        | 'sellerTelegram'
        | 'shopName'
        | 'shopAddress'
        | 'shopLogoStorageKey'
      >
    > = {};
    if (dto.display_name !== undefined) patch.displayName = dto.display_name;
    if (dto.preferred_locale !== undefined)
      patch.preferredLocale = dto.preferred_locale;
    if (dto.seller_phone !== undefined) patch.sellerPhone = dto.seller_phone;
    if (dto.seller_telegram !== undefined)
      patch.sellerTelegram = dto.seller_telegram;
    if (dto.shop_name !== undefined) patch.shopName = dto.shop_name;
    if (dto.shop_address !== undefined) patch.shopAddress = dto.shop_address;
    if (dto.shop_logo_storage_key !== undefined)
      patch.shopLogoStorageKey = dto.shop_logo_storage_key;
    if (Object.keys(patch).length > 0) {
      await this.users.update(userId, patch);
    }
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    const seller_application = await this.sellerApplications.getForMe(
      userId,
      user.role,
    );
    return this.toMeResponse(user, seller_application);
  }

  private toMeResponse(
    user: User,
    seller_application: Awaited<
      ReturnType<SellerApplicationsService['getForMe']>
    >,
  ) {
    return {
      id: user.id,
      phone: user.phone,
      role: user.role,
      display_name: user.displayName,
      preferred_locale: user.preferredLocale,
      seller_phone: user.sellerPhone,
      seller_telegram: user.sellerTelegram,
      shop_name: user.shopName,
      shop_address: user.shopAddress,
      shop_logo_storage_key: user.shopLogoStorageKey,
      seller_application,
      created_at: user.createdAt.toISOString(),
    };
  }
}
