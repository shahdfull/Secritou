import { PrismaClient, Role, LeadStatus, ProjectStatus, TaskStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Upsert company so re-runs are safe
  const company = await prisma.company.upsert({
    where: { id: 'seed-company-001' },
    update: {},
    create: {
      id: 'seed-company-001',
      name: 'Sécritou Solutions',
      website: 'https://secritou.tn',
    },
  });
  console.log('Company ready:', company.name);

  // Upsert admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@secritou.tn' },
    update: {},
    create: {
      email: 'admin@secritou.tn',
      name: 'Ahmed Ben Ali',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      companyId: company.id,
    },
  });
  console.log('Admin user ready:', admin.email);

  // Upsert client users
  const clientPassword = await bcrypt.hash('client123', 10);
  const [client1, client2] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'client1@example.tn' },
      update: {},
      create: {
        email: 'client1@example.tn',
        name: 'Fatma Khelifi',
        passwordHash: clientPassword,
        role: Role.CLIENT,
        companyId: company.id,
      },
    }),
    prisma.user.upsert({
      where: { email: 'client2@example.tn' },
      update: {},
      create: {
        email: 'client2@example.tn',
        name: 'Mohamed Trabelsi',
        passwordHash: clientPassword,
        role: Role.CLIENT,
        companyId: company.id,
      },
    }),
  ]);
  const clients = [client1, client2];
  console.log('Client users ready:', clients.map(c => c.email));

  // Skip leads/projects/tasks if they already exist (idempotent check)
  const existingLeadCount = await prisma.lead.count({ where: { companyId: company.id } });
  if (existingLeadCount === 0) {
    const leadsData = [
      { name: 'Tunisie Telecom', email: 'contact@tunisietelecom.tn', phone: '+216 70 000 000', source: 'Website', status: LeadStatus.NEW },
      { name: 'Orange Tunisia', email: 'info@orange.tn', phone: '+216 71 000 000', source: 'LinkedIn', status: LeadStatus.CONTACTED },
      { name: 'Ooredoo Tunisia', email: 'support@ooredoo.tn', phone: '+216 72 000 000', source: 'Referral', status: LeadStatus.QUALIFIED },
      { name: 'Banque de Tunisie', email: 'contact@banquetunisie.tn', phone: '+216 71 234 567', source: 'Email', status: LeadStatus.PROPOSAL },
      { name: 'Société Tunisienne de Banque', email: 'info@stb.tn', phone: '+216 71 345 678', source: 'Website', status: LeadStatus.WON },
      { name: 'Vermeg', email: 'contact@vermeg.com', phone: '+216 71 456 789', source: 'LinkedIn', status: LeadStatus.NEW },
      { name: 'Tunisie Lease', email: 'info@tunisielease.tn', phone: '+216 71 567 890', source: 'Referral', status: LeadStatus.CONTACTED },
      { name: 'Sopra Banking Software Tunisia', email: 'contact@soprabanking.tn', phone: '+216 71 678 901', source: 'Website', status: LeadStatus.QUALIFIED },
      { name: 'Tunisavia', email: 'info@tunisavia.tn', phone: '+216 71 789 012', source: 'Email', status: LeadStatus.LOST },
      { name: 'STEG', email: 'contact@steg.tn', phone: '+216 71 890 123', source: 'Referral', status: LeadStatus.NEW },
    ];
    const leads = await Promise.all(
      leadsData.map(lead => prisma.lead.create({ data: { ...lead, companyId: company.id } }))
    );
    console.log('Created leads:', leads.length);
  } else {
    console.log('Leads already exist, skipping.');
  }

  // Upsert client companies
  const [carrefour, monoprix, geant] = await Promise.all([
    prisma.client.upsert({
      where: { companyId_email: { companyId: company.id, email: 'contact@carrefour.tn' } },
      update: {},
      create: { name: 'Carrefour Tunisia', email: 'contact@carrefour.tn', phone: '+216 71 901 234', companyId: company.id },
    }),
    prisma.client.upsert({
      where: { companyId_email: { companyId: company.id, email: 'info@monoprix.tn' } },
      update: {},
      create: { name: 'Monoprix Tunisia', email: 'info@monoprix.tn', phone: '+216 71 012 345', companyId: company.id },
    }),
    prisma.client.upsert({
      where: { companyId_email: { companyId: company.id, email: 'contact@geant.tn' } },
      update: {},
      create: { name: 'Geant Tunisia', email: 'contact@geant.tn', phone: '+216 71 123 456', companyId: company.id },
    }),
  ]);
  const clientCompanies = [carrefour, monoprix, geant];
  console.log('Client companies ready:', clientCompanies.map(c => c.name));

  // Projects & tasks only if none exist yet
  const existingProjectCount = await prisma.project.count({ where: { companyId: company.id } });
  if (existingProjectCount === 0) {
    const projects = await Promise.all([
      prisma.project.create({
        data: { name: 'E-commerce Website Redesign', description: 'Complete redesign of Carrefour Tunisia e-commerce platform', status: ProjectStatus.IN_PROGRESS, companyId: company.id, clientId: clientCompanies[0].id },
      }),
      prisma.project.create({
        data: { name: 'Mobile App Development', description: 'Native mobile app for Monoprix Tunisia', status: ProjectStatus.PLANNING, companyId: company.id, clientId: clientCompanies[1].id },
      }),
      prisma.project.create({
        data: { name: 'ERP System Integration', description: 'Integration of ERP system for Geant Tunisia', status: ProjectStatus.REVIEW, companyId: company.id, clientId: clientCompanies[2].id },
      }),
    ]);
    console.log('Created projects:', projects.map(p => p.name));

    const tasksData = [
      { title: 'Design homepage mockups', description: 'Create high-fidelity mockups for homepage', status: TaskStatus.DONE, projectId: projects[0].id, assigneeId: admin.id },
      { title: 'Develop product catalog', description: 'Implement product catalog with filtering', status: TaskStatus.IN_PROGRESS, projectId: projects[0].id, assigneeId: clients[0].id },
      { title: 'Set up payment gateway', description: 'Integrate payment gateway', status: TaskStatus.TODO, projectId: projects[0].id, assigneeId: admin.id },
      { title: 'Mobile app wireframes', description: 'Create wireframes for mobile app screens', status: TaskStatus.IN_PROGRESS, projectId: projects[1].id, assigneeId: clients[1].id },
      { title: 'Choose tech stack', description: 'Finalize technology stack', status: TaskStatus.TODO, projectId: projects[1].id, assigneeId: admin.id },
      { title: 'API integration planning', description: 'Plan API integration with ERP system', status: TaskStatus.REVIEW, projectId: projects[2].id, assigneeId: admin.id },
      { title: 'Data migration script', description: 'Write script for data migration to ERP', status: TaskStatus.DONE, projectId: projects[2].id, assigneeId: clients[0].id },
      { title: 'User testing', description: 'Conduct user testing sessions', status: TaskStatus.TODO, projectId: projects[0].id, assigneeId: clients[1].id },
      { title: 'Performance optimization', description: 'Optimize website performance', status: TaskStatus.IN_PROGRESS, projectId: projects[0].id, assigneeId: admin.id },
      { title: 'Security audit', description: 'Perform security audit', status: TaskStatus.TODO, projectId: projects[2].id, assigneeId: clients[0].id },
    ];
    const tasks = await Promise.all(tasksData.map(task => prisma.task.create({ data: task })));
    console.log('Created tasks:', tasks.length);
  } else {
    console.log('Projects already exist, skipping tasks.');
  }

  console.log('\nDatabase seed completed successfully!');
  console.log('Login with: admin@secritou.tn / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });