import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiException } from '../common/exceptions/api.exception';
import { Vehicle } from '../database/entities/vehicle.entity';
import { User } from '../database/entities/user.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicles: Repository<Vehicle>,
  ) {}

  private assertIdentity(dto: CreateVehicleDto | UpdateVehicleDto): void {
    const vin = dto.vin?.trim();
    const hasVin = Boolean(vin);
    const hasTriple =
      dto.brand?.trim() &&
      dto.model?.trim() &&
      dto.year != null &&
      dto.year !== undefined;
    if (!hasVin && !hasTriple) {
      throw new ApiException(
        'vehicle_identity',
        'Provide VIN or brand, model, and year.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async list(userId: string) {
    const list = await this.vehicles.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
    return list.map((v) => this.serialize(v));
  }

  async create(userId: string, dto: CreateVehicleDto) {
    this.assertIdentity(dto);
    const v = this.vehicles.create({
      user: { id: userId } as User,
      brand: dto.brand?.trim() ?? null,
      model: dto.model?.trim() ?? null,
      year: dto.year ?? null,
      engine: dto.engine?.trim() ?? null,
      vin: dto.vin?.trim() ?? null,
      label: dto.label?.trim() ?? null,
    });
    const saved = await this.vehicles.save(v);
    return this.serialize(saved);
  }

  async getOne(userId: string, id: string) {
    const v = await this.vehicles.findOne({
      where: { id, user: { id: userId } },
    });
    if (!v) {
      throw new ApiException(
        'not_found',
        'Vehicle not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return this.serialize(v);
  }

  async update(userId: string, id: string, dto: UpdateVehicleDto) {
    const v = await this.vehicles.findOne({
      where: { id, user: { id: userId } },
    });
    if (!v) {
      throw new ApiException(
        'not_found',
        'Vehicle not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    const merged = {
      brand: dto.brand !== undefined ? dto.brand?.trim() ?? null : v.brand,
      model: dto.model !== undefined ? dto.model?.trim() ?? null : v.model,
      year: dto.year !== undefined ? dto.year ?? null : v.year,
      engine:
        dto.engine !== undefined ? dto.engine?.trim() ?? null : v.engine,
      vin: dto.vin !== undefined ? dto.vin?.trim() ?? null : v.vin,
      label:
        dto.label !== undefined ? dto.label?.trim() ?? null : v.label,
    };
    this.assertIdentity(merged);
    Object.assign(v, merged);
    const saved = await this.vehicles.save(v);
    return this.serialize(saved);
  }

  async remove(userId: string, id: string): Promise<void> {
    const res = await this.vehicles.delete({ id, user: { id: userId } });
    if (!res.affected) {
      throw new ApiException(
        'not_found',
        'Vehicle not found.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async assertOwnerVehicle(userId: string, vehicleId: string): Promise<void> {
    const n = await this.vehicles.count({
      where: { id: vehicleId, user: { id: userId } },
    });
    if (!n) {
      throw new ApiException(
        'forbidden',
        'Vehicle does not belong to user.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private serialize(v: Vehicle) {
    return {
      id: v.id,
      brand: v.brand,
      model: v.model,
      year: v.year,
      engine: v.engine,
      vin: v.vin,
      label: v.label,
      created_at: v.createdAt.toISOString(),
      updated_at: v.updatedAt.toISOString(),
    };
  }
}
