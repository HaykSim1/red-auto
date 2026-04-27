import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import dataSource from './data-source';
import { User } from './entities/user.entity';
import { UserRole } from './enums';

const BCRYPT_ROUNDS = 10;

type SeedUserSpec = {
  phone: string;
  role: UserRole;
  displayName: string;
  email?: string | null;
  passwordHash?: string | null;
  sellerPhone?: string | null;
  sellerTelegram?: string | null;
};

async function upsertUser(
  repo: Repository<User>,
  spec: SeedUserSpec,
  label: string,
): Promise<void> {
  const existing = await repo.findOne({ where: { phone: spec.phone } });
  if (existing) {
    existing.role = spec.role;
    existing.displayName = spec.displayName;
    if (spec.email !== undefined) existing.email = spec.email ?? null;
    if (spec.passwordHash !== undefined)
      existing.passwordHash = spec.passwordHash ?? null;
    existing.sellerPhone = spec.sellerPhone ?? null;
    existing.sellerTelegram = spec.sellerTelegram ?? null;
    await repo.save(existing);

    console.log(`Updated ${label}:`, spec.phone);
    return;
  }

  await repo.save(
    repo.create({
      phone: spec.phone,
      role: spec.role,
      displayName: spec.displayName,
      email: spec.email ?? null,
      passwordHash: spec.passwordHash ?? null,
      sellerPhone: spec.sellerPhone ?? null,
      sellerTelegram: spec.sellerTelegram ?? null,
    }),
  );

  console.log(`Created ${label}:`, spec.phone);
}

async function seed(): Promise<void> {
  const seedAll = process.env.SEED === 'true';
  const seedAdminOnly = process.env.SEED_ADMIN === 'true';

  if (
    process.env.NODE_ENV === 'production' &&
    (seedAll || seedAdminOnly) &&
    process.env.ALLOW_DANGEROUS_SEED !== 'true'
  ) {
    console.error(
      'Refusing to run seed with NODE_ENV=production. Set ALLOW_DANGEROUS_SEED=true only if you intend to mutate production data.',
    );
    process.exit(1);
  }

  if (!seedAll && !seedAdminOnly) {
    console.log(
      'Skip seed (set SEED=true for client + admin, or SEED_ADMIN=true for admin only).',
    );
    return;
  }

  await dataSource.initialize();
  const users = dataSource.getRepository(User);

  const adminPhone = process.env.SEED_ADMIN_PHONE ?? '+37400000000';
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@red-auto.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'changeme123';
  const adminPasswordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

  const clientPhone = process.env.SEED_CLIENT_PHONE ?? '+37400000001';

  if (seedAll) {
    await upsertUser(
      users,
      {
        phone: clientPhone,
        role: UserRole.USER,
        displayName: 'Dev client',
        sellerPhone: null,
        sellerTelegram: null,
      },
      'client (buyer)',
    );
  }

  await upsertUser(
    users,
    {
      phone: adminPhone,
      role: UserRole.ADMIN,
      displayName: 'Dev admin',
      email: adminEmail,
      passwordHash: adminPasswordHash,
      sellerPhone: null,
      sellerTelegram: null,
    },
    'admin',
  );

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
