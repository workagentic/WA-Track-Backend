import { config } from 'dotenv';
import * as bcrypt from 'bcrypt';
import AppDataSource from '../data-source';

config({ path: `.env.${process.env.NODE_ENV ?? 'development'}` });
import { Role } from '../../roles/role.entity';
import { Department } from '../../departments/department.entity';
import { Employee } from '../../employees/employee.entity';
import { Client } from '../../clients/client.entity';
import { Task } from '../../tasks/task.entity';

const ROLE_NAMES = ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'];

interface EmployeeSeed {
  fullName: string;
  email: string;
  username: string;
  roleName: string;
  departmentName: string;
  /** Email of another seeded employee to set as `manager` — resolved after every employee exists. */
  managerEmail?: string;
}

// One manager + one employee per non-Administration department, plus an HR
// generalist in Administration alongside the admin bootstrapped below —
// enough to exercise every role's RBAC scoping (self/department/org-wide)
// without needing to click through the UI to create test accounts first.
const EMPLOYEE_SEEDS: EmployeeSeed[] = [
  {
    fullName: 'Sara HR',
    email: 'sara.hr@company.local',
    username: 'sara.hr',
    roleName: 'HR',
    departmentName: 'Administration',
  },
  {
    fullName: 'Ali Manager',
    email: 'ali.manager@company.local',
    username: 'ali.manager',
    roleName: 'MANAGER',
    departmentName: 'Engineering',
  },
  {
    fullName: 'Bilal Employee',
    email: 'bilal.employee@company.local',
    username: 'bilal.employee',
    roleName: 'EMPLOYEE',
    departmentName: 'Engineering',
    managerEmail: 'ali.manager@company.local',
  },
  {
    fullName: 'Sana Employee',
    email: 'sana.employee@company.local',
    username: 'sana.employee',
    roleName: 'EMPLOYEE',
    departmentName: 'Sales',
  },
];

interface ClientSeed {
  name: string;
  description: string;
  departmentName: string;
}

const CLIENT_SEEDS: ClientSeed[] = [
  { name: 'Acme Corp', description: 'Enterprise SaaS client', departmentName: 'Engineering' },
  { name: 'Globex Inc', description: 'Billing platform migration', departmentName: 'Engineering' },
  { name: 'Initech', description: 'Sales tooling client', departmentName: 'Sales' },
];

interface TaskSeed {
  title: string;
  description: string;
  clientName: string;
}

// department/createdBy are always the client's own department/creator —
// tasks are department+client scoped only (no per-employee assignment).
const TASK_SEEDS: TaskSeed[] = [
  { title: 'Build Authentication API', description: 'OAuth2 + refresh tokens', clientName: 'Acme Corp' },
  { title: 'Fix login issue', description: 'Investigate intermittent 401s', clientName: 'Acme Corp' },
  { title: 'Migrate billing service', description: 'Move billing to v2 schema', clientName: 'Globex Inc' },
  { title: 'Prepare sales deck', description: 'Q3 pipeline review deck', clientName: 'Initech' },
];

async function seed() {
  await AppDataSource.initialize();

  const roleRepo = AppDataSource.getRepository(Role);
  const departmentRepo = AppDataSource.getRepository(Department);
  const employeeRepo = AppDataSource.getRepository(Employee);
  const clientRepo = AppDataSource.getRepository(Client);
  const taskRepo = AppDataSource.getRepository(Task);

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD ?? 'ChangeMe123!';

  const roles: Record<string, Role> = {};
  for (const name of ROLE_NAMES) {
    let role = await roleRepo.findOne({ where: { name } });
    if (!role) {
      role = await roleRepo.save(roleRepo.create({ name }));
      console.log(`Created role ${name}`);
    }
    roles[name] = role;
  }

  const departments: Record<string, Department> = {};
  for (const name of ['Administration', 'Engineering', 'Sales']) {
    let department = await departmentRepo.findOne({ where: { name } });
    if (!department) {
      department = await departmentRepo.save(departmentRepo.create({ name }));
      console.log(`Created department ${name}`);
    }
    departments[name] = department;
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@timecamp.local';
  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? defaultPassword;

  let admin = await employeeRepo.findOne({ where: { email: adminEmail } });
  if (!admin) {
    const passwordHash = await bcrypt.hash(adminPassword, saltRounds);
    admin = await employeeRepo.save(
      employeeRepo.create({
        fullName: 'System Admin',
        email: adminEmail,
        username: adminUsername,
        passwordHash,
        status: 'active',
        department: departments.Administration,
        role: roles.ADMIN,
      }),
    );
    console.log(`Created admin user ${adminEmail} / ${adminPassword} — change this password immediately.`);
  } else {
    console.log(`Admin user ${adminEmail} already exists, skipping.`);
  }

  // Two passes: create every employee first, then resolve `managerEmail` ->
  // `manager` relations, since a manager may be seeded after the employee
  // that references them.
  const employees: Record<string, Employee> = { [adminEmail]: admin };
  for (const seedEmployee of EMPLOYEE_SEEDS) {
    let employee = await employeeRepo.findOne({ where: { email: seedEmployee.email } });
    if (!employee) {
      const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);
      employee = await employeeRepo.save(
        employeeRepo.create({
          fullName: seedEmployee.fullName,
          email: seedEmployee.email,
          username: seedEmployee.username,
          passwordHash,
          status: 'active',
          department: departments[seedEmployee.departmentName],
          role: roles[seedEmployee.roleName],
        }),
      );
      console.log(`Created ${seedEmployee.roleName.toLowerCase()} ${seedEmployee.email} / ${defaultPassword}`);
    } else {
      console.log(`Employee ${seedEmployee.email} already exists, skipping.`);
    }
    employees[seedEmployee.email] = employee;
  }

  for (const seedEmployee of EMPLOYEE_SEEDS) {
    if (!seedEmployee.managerEmail) continue;
    // findOne() above doesn't eagerly load the `manager` relation, so there's
    // no cheap way to tell if this is already linked — re-assigning the same
    // value on every run is a harmless no-op rather than worth a second
    // fetch just to skip it.
    const employee = employees[seedEmployee.email];
    employee.manager = employees[seedEmployee.managerEmail];
    await employeeRepo.save(employee);
    console.log(`Linked ${seedEmployee.email} -> manager ${seedEmployee.managerEmail}`);
  }

  const clients: Record<string, Client> = {};
  for (const seedClient of CLIENT_SEEDS) {
    const department = departments[seedClient.departmentName];
    let client = await clientRepo.findOne({ where: { name: seedClient.name, department: { id: department.id } } });
    if (!client) {
      client = await clientRepo.save(
        clientRepo.create({
          name: seedClient.name,
          description: seedClient.description,
          department,
          createdBy: admin,
        }),
      );
      console.log(`Created client ${seedClient.name}`);
    } else {
      console.log(`Client ${seedClient.name} already exists, skipping.`);
    }
    clients[seedClient.name] = client;
  }

  for (const seedTask of TASK_SEEDS) {
    const client = clients[seedTask.clientName];
    const existing = await taskRepo.findOne({ where: { title: seedTask.title, client: { id: client.id } } });
    if (existing) {
      console.log(`Task "${seedTask.title}" already exists, skipping.`);
      continue;
    }
    await taskRepo.save(
      taskRepo.create({
        title: seedTask.title,
        description: seedTask.description,
        department: client.department,
        createdBy: admin,
        client,
      }),
    );
    console.log(`Created task "${seedTask.title}" for ${seedTask.clientName}`);
  }

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
