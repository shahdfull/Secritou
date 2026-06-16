import { PrismaClient, Role, LeadStatus, ProjectStatus, TaskStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create a company (required for all other models)
  const company = await prisma.company.create({
    data: {
      name: 'Sécritou Solutions',
      website: 'https://secritou.tn',
    },
  });
  console.log('Created company:', company.name);

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@secritou.tn',
      name: 'Ahmed Ben Ali',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      companyId: company.id,
    },
  });
  console.log('Created admin user:', admin.email);

  // Create 2 client users
  const clientPassword = await bcrypt.hash('client123', 10);
  const clients = await Promise.all([
    prisma.user.create({
      data: {
        email: 'client1@example.tn',
        name: 'Fatma Khelifi',
        passwordHash: clientPassword,
        role: Role.CLIENT,
        companyId: company.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'client2@example.tn',
        name: 'Mohamed Trabelsi',
        passwordHash: clientPassword,
        role: Role.CLIENT,
        companyId: company.id,
      },
    }),
  ]);
  console.log('Created client users:', clients.map(c => c.email));

  // Create 10 leads with Tunisian company names
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
    { name: 'Tunisian Company of Electricity and Gas', email: 'contact@steg.tn', phone: '+216 71 890 123', source: 'Referral', status: LeadStatus.NEW },
  ];

  const leads = await Promise.all(
    leadsData.map(lead => prisma.lead.create({
      data: { ...lead, companyId: company.id },
    }))
  );
  console.log('Created leads:', leads.length);

  // Create 3 clients (Client model) with Tunisian company names
  const clientCompanies = await Promise.all([
    prisma.client.create({
      data: {
        name: 'Carrefour Tunisia',
        email: 'contact@carrefour.tn',
        phone: '+216 71 901 234',
        companyId: company.id,
      },
    }),
    prisma.client.create({
      data: {
        name: 'Monoprix Tunisia',
        email: 'info@monoprix.tn',
        phone: '+216 71 012 345',
        companyId: company.id,
      },
    }),
    prisma.client.create({
      data: {
        name: 'Geant Tunisia',
        email: 'contact@geant.tn',
        phone: '+216 71 123 456',
        companyId: company.id,
      },
    }),
  ]);
  console.log('Created client companies:', clientCompanies.map(c => c.name));

  // Create 3 projects
  const projects = await Promise.all([
    prisma.project.create({
      data: {
        name: 'E-commerce Website Redesign',
        description: 'Complete redesign of Carrefour Tunisia e-commerce platform',
        status: ProjectStatus.IN_PROGRESS,
        companyId: company.id,
        clientId: clientCompanies[0].id,
      },
    }),
    prisma.project.create({
      data: {
        name: 'Mobile App Development',
        description: 'Native mobile app for Monoprix Tunisia',
        status: ProjectStatus.PLANNING,
        companyId: company.id,
        clientId: clientCompanies[1].id,
      },
    }),
    prisma.project.create({
      data: {
        name: 'ERP System Integration',
        description: 'Integration of ERP system for Geant Tunisia',
        status: ProjectStatus.REVIEW,
        companyId: company.id,
        clientId: clientCompanies[2].id,
      },
    }),
  ]);
  console.log('Created projects:', projects.map(p => p.name));

  // Create 10 tasks
  const tasksData = [
    { title: 'Design homepage mockups', description: 'Create high-fidelity mockups for homepage', status: TaskStatus.DONE, projectId: projects[0].id, assigneeId: admin.id },
    { title: 'Develop product catalog', description: 'Implement product catalog with filtering', status: TaskStatus.IN_PROGRESS, projectId: projects[0].id, assigneeId: clients[0].id },
    { title: 'Set up payment gateway', description: 'Integrate payment gateway with e-commerce site', status: TaskStatus.TODO, projectId: projects[0].id, assigneeId: admin.id },
    { title: 'Mobile app wireframes', description: 'Create wireframes for mobile app screens', status: TaskStatus.IN_PROGRESS, projectId: projects[1].id, assigneeId: clients[1].id },
    { title: 'Choose tech stack', description: 'Finalize technology stack for mobile app', status: TaskStatus.TODO, projectId: projects[1].id, assigneeId: admin.id },
    { title: 'API integration planning', description: 'Plan API integration with ERP system', status: TaskStatus.REVIEW, projectId: projects[2].id, assigneeId: admin.id },
    { title: 'Data migration script', description: 'Write script for data migration to ERP', status: TaskStatus.DONE, projectId: projects[2].id, assigneeId: clients[0].id },
    { title: 'User testing', description: 'Conduct user testing sessions', status: TaskStatus.TODO, projectId: projects[0].id, assigneeId: clients[1].id },
    { title: 'Performance optimization', description: 'Optimize website performance', status: TaskStatus.IN_PROGRESS, projectId: projects[0].id, assigneeId: admin.id },
    { title: 'Security audit', description: 'Perform security audit on the system', status: TaskStatus.TODO, projectId: projects[2].id, assigneeId: clients[0].id },
  ];

  const tasks = await Promise.all(
    tasksData.map(task => prisma.task.create({
      data: task,
    }))
  );
  console.log('Created tasks:', tasks.length);

  console.log('Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

