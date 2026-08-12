import { config } from 'dotenv';
import * as bcrypt from 'bcrypt';
import AppDataSource from '../data-source';

config({ path: `.env.${process.env.NODE_ENV ?? 'development'}` });
import { Role } from '../../roles/role.entity';
import { Department } from '../../departments/department.entity';
import { Employee } from '../../employees/employee.entity';

const ROLE_NAMES = ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'];

async function seed() {
  await AppDataSource.initialize();

  const roleRepo = AppDataSource.getRepository(Role);
  const departmentRepo = AppDataSource.getRepository(Department);
  const employeeRepo = AppDataSource.getRepository(Employee);

  const roles: Record<string, Role> = {};
  for (const name of ROLE_NAMES) {
    let role = await roleRepo.findOne({ where: { name } });
    if (!role) {
      role = await roleRepo.save(roleRepo.create({ name }));
      console.log(`Created role ${name}`);
    }
    roles[name] = role;
  }

  let department = await departmentRepo.findOne({ where: { name: 'Administration' } });
  if (!department) {
    department = await departmentRepo.save(departmentRepo.create({ name: 'Administration' }));
    console.log('Created department Administration');
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@timecamp.local';
  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  const existingAdmin = await employeeRepo.findOne({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);
    const passwordHash = await bcrypt.hash(adminPassword, saltRounds);
    await employeeRepo.save(
      employeeRepo.create({
        fullName: 'System Admin',
        email: adminEmail,
        username: adminUsername,
        passwordHash,
        status: 'active',
        department,
        role: roles.ADMIN,
      }),
    );
    console.log(`Created admin user ${adminEmail} / ${adminPassword} — change this password immediately.`);
  } else {
    console.log(`Admin user ${adminEmail} already exists, skipping.`);
  }

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
