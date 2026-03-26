import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiException } from '../common/exceptions/api.exception';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { SellerApplication } from '../database/entities/seller-application.entity';
import { User } from '../database/entities/user.entity';
import { SellerApplicationStatus, UserRole } from '../database/enums';
import { CreateSellerApplicationDto } from './dto/create-seller-application.dto';

export type SellerApplicationMePayload = {
  status: 'pending' | 'rejected';
  shop_name: string;
  shop_address: string;
  shop_phone: string;
  logo_storage_key: string | null;
  rejection_reason: string | null;
  created_at: string;
};

@Injectable()
export class SellerApplicationsService {
  constructor(
    @InjectRepository(SellerApplication)
    private readonly applications: Repository<SellerApplication>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async getForMe(
    userId: string,
    role: UserRole,
  ): Promise<SellerApplicationMePayload | null> {
    if (role === UserRole.SELLER || role === UserRole.ADMIN) {
      return null;
    }
    const pending = await this.applications.findOne({
      where: { user: { id: userId }, status: SellerApplicationStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
    if (pending) {
      return this.toMePayload(pending);
    }
    const rejected = await this.applications.find({
      where: { user: { id: userId }, status: SellerApplicationStatus.REJECTED },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    if (rejected[0]) {
      return this.toMePayload(rejected[0]);
    }
    return null;
  }

  private toMePayload(app: SellerApplication): SellerApplicationMePayload {
    return {
      status:
        app.status === SellerApplicationStatus.PENDING ? 'pending' : 'rejected',
      shop_name: app.shopName,
      shop_address: app.shopAddress,
      shop_phone: app.shopPhone,
      logo_storage_key: app.logoStorageKey,
      rejection_reason: app.rejectionReason,
      created_at: app.createdAt.toISOString(),
    };
  }

  async create(jwt: JwtUserPayload, dto: CreateSellerApplicationDto) {
    if (jwt.role !== UserRole.USER) {
      throw new ApiException(
        'seller_application_forbidden',
        'Only buyers can apply to become a seller.',
        HttpStatus.FORBIDDEN,
      );
    }

    const user = await this.users.findOne({ where: { id: jwt.sub } });
    if (!user || user.role !== UserRole.USER) {
      throw new ApiException(
        'seller_application_forbidden',
        'Only buyers can apply to become a seller.',
        HttpStatus.FORBIDDEN,
      );
    }

    const existingPending = await this.applications.findOne({
      where: { user: { id: jwt.sub }, status: SellerApplicationStatus.PENDING },
    });
    if (existingPending) {
      throw new ApiException(
        'seller_application_pending',
        'You already have a pending seller application.',
        HttpStatus.CONFLICT,
      );
    }

    const app = this.applications.create({
      user,
      shopName: dto.shop_name.trim(),
      shopAddress: dto.shop_address.trim(),
      shopPhone: dto.shop_phone.trim(),
      logoStorageKey: dto.logo_storage_key?.trim() || null,
      status: SellerApplicationStatus.PENDING,
    });
    await this.applications.save(app);

    return {
      id: app.id,
      status: app.status,
      created_at: app.createdAt.toISOString(),
    };
  }
}
