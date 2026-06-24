import {
  PrismaClient,
  Role,
  LeadStatus,
  ProjectStatus,
  TaskStatus,
  ServiceRequestStatus,
  ProposalStatus,
  InvoiceStatus,
  ApprovalStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { COMPANY_ID } from '../src/config/constants.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // ── Company ────────────────────────────────────────────────────────────────
  const company = await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: {},
    create: {
      id: COMPANY_ID,
      name: 'Secritou',
      website: 'https://secritou.tn',
    },
  });
  console.log('Company ready:', company.name);

  // ── Services (poles) ──────────────────────────────────────────────────────
  const SERVICE_NAMES = [
    'Business Performance',
    'Digital Growth',
    'Technology Solutions',
    'AI & Automation',
  ];
  const services: Record<string, { id: string }> = {};
  for (const name of SERVICE_NAMES) {
    services[name] = await prisma.service.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log('Services ready:', SERVICE_NAMES.join(', '));

  // ── Users ──────────────────────────────────────────────────────────────────
  const adminPassword   = await bcrypt.hash('admin123',      10);
  const managerPassword = await bcrypt.hash('manager123',    10);
  const clientPassword  = await bcrypt.hash('client123',     10);
  const freelancerPass  = await bcrypt.hash('freelancer123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@secritou.tn' },
    update: {},
    create: {
      email: 'admin@secritou.tn',
      name: 'Ahmed Ben Ali',
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@secritou.tn' },
    update: {},
    create: {
      email: 'manager@secritou.tn',
      name: 'Sarra Mansouri',
      passwordHash: managerPassword,
      role: Role.MANAGER,
      serviceId: services['Digital Growth'].id,
    },
  });

  const [clientUser1, clientUser2] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'client1@example.tn' },
      update: {},
      create: {
        email: 'client1@example.tn',
        name: 'Fatma Khelifi',
        passwordHash: clientPassword,
        role: Role.CLIENT,
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
      },
    }),
  ]);

  const [freelancerUser1, freelancerUser2, freelancerUser3] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'yassine.dev@freelance.tn' },
      update: {},
      create: {
        email: 'yassine.dev@freelance.tn',
        name: 'Yassine Gharbi',
        passwordHash: freelancerPass,
        role: Role.FREELANCER,
      },
    }),
    prisma.user.upsert({
      where: { email: 'ines.design@freelance.tn' },
      update: {},
      create: {
        email: 'ines.design@freelance.tn',
        name: 'Inès Bouali',
        passwordHash: freelancerPass,
        role: Role.FREELANCER,
      },
    }),
    prisma.user.upsert({
      where: { email: 'omar.data@freelance.tn' },
      update: {},
      create: {
        email: 'omar.data@freelance.tn',
        name: 'Omar Cherif',
        passwordHash: freelancerPass,
        role: Role.FREELANCER,
      },
    }),
  ]);

  console.log('Users ready:', [admin, manager, clientUser1, clientUser2, freelancerUser1, freelancerUser2, freelancerUser3].map(u => u.email));

  // ── Leads ──────────────────────────────────────────────────────────────────
  const existingLeadCount = await prisma.lead.count();
  if (existingLeadCount === 0) {
    const leadsData = [
      { name: 'Tunisie Telecom',              email: 'contact@tunisietelecom.tn',  phone: '+216 70 000 000', source: 'Website',  status: LeadStatus.NEW },
      { name: 'Orange Tunisia',               email: 'info@orange.tn',             phone: '+216 71 000 000', source: 'LinkedIn', status: LeadStatus.CONTACTED },
      { name: 'Ooredoo Tunisia',              email: 'support@ooredoo.tn',         phone: '+216 72 000 000', source: 'Referral', status: LeadStatus.QUALIFIED },
      { name: 'Banque de Tunisie',            email: 'contact@banquetunisie.tn',   phone: '+216 71 234 567', source: 'Email',    status: LeadStatus.PROPOSAL },
      { name: 'Société Tunisienne de Banque', email: 'info@stb.tn',               phone: '+216 71 345 678', source: 'Website',  status: LeadStatus.WON },
      { name: 'Vermeg',                       email: 'contact@vermeg.com',         phone: '+216 71 456 789', source: 'LinkedIn', status: LeadStatus.NEW },
      { name: 'Tunisie Lease',                email: 'info@tunisielease.tn',       phone: '+216 71 567 890', source: 'Referral', status: LeadStatus.CONTACTED },
      { name: 'Sopra Banking Software TN',    email: 'contact@soprabanking.tn',    phone: '+216 71 678 901', source: 'Website',  status: LeadStatus.QUALIFIED },
      { name: 'Tunisavia',                    email: 'info@tunisavia.tn',          phone: '+216 71 789 012', source: 'Email',    status: LeadStatus.LOST },
      { name: 'STEG',                         email: 'contact@steg.tn',            phone: '+216 71 890 123', source: 'Referral', status: LeadStatus.NEW },
    ];
    await Promise.all(leadsData.map(lead => prisma.lead.create({ data: lead })));
    console.log('Created leads:', leadsData.length);
  } else {
    console.log('Leads already exist, skipping.');
  }

  // ── Client companies ────────────────────────────────────────────────────────
  const upsertClient = async (name: string, email: string, phone: string) => {
    const existing = await prisma.client.findFirst({ where: { email } });
    if (existing) return existing;
    return prisma.client.create({ data: { name, email, phone } });
  };
  const [carrefour, monoprix, geant] = await Promise.all([
    upsertClient('Carrefour Tunisia', 'contact@carrefour.tn', '+216 71 901 234'),
    upsertClient('Monoprix Tunisia',  'info@monoprix.tn',     '+216 71 012 345'),
    upsertClient('Geant Tunisia',     'contact@geant.tn',     '+216 71 123 456'),
  ]);
  console.log('Client companies ready:', [carrefour, monoprix, geant].map(c => c.name));

  // ── Projects & Tasks ────────────────────────────────────────────────────────
  const existingProjectCount = await prisma.project.count();
  let projects: { id: string }[] = [];
  if (existingProjectCount === 0) {
    projects = await Promise.all([
      prisma.project.create({ data: { name: 'E-commerce Website Redesign',  description: 'Complete redesign of Carrefour Tunisia e-commerce platform', status: ProjectStatus.IN_PROGRESS, clientId: carrefour.id } }),
      prisma.project.create({ data: { name: 'Mobile App Development',       description: 'Native mobile app for Monoprix Tunisia',                     status: ProjectStatus.PLANNING,     clientId: monoprix.id } }),
      prisma.project.create({ data: { name: 'ERP System Integration',       description: 'Integration of ERP system for Geant Tunisia',                status: ProjectStatus.REVIEW,       clientId: geant.id } }),
    ]);
    console.log('Created projects:', projects.length);

    const tasksData = [
      { title: 'Design homepage mockups',   description: 'Create high-fidelity mockups for homepage',           status: TaskStatus.DONE,        projectId: projects[0].id, assigneeId: admin.id },
      { title: 'Develop product catalog',   description: 'Implement product catalog with filtering',             status: TaskStatus.IN_PROGRESS, projectId: projects[0].id, assigneeId: clientUser1.id },
      { title: 'Set up payment gateway',    description: 'Integrate payment gateway',                            status: TaskStatus.TODO,        projectId: projects[0].id, assigneeId: admin.id },
      { title: 'Mobile app wireframes',     description: 'Create wireframes for mobile app screens',             status: TaskStatus.IN_PROGRESS, projectId: projects[1].id, assigneeId: clientUser2.id },
      { title: 'Choose tech stack',         description: 'Finalize technology stack',                            status: TaskStatus.TODO,        projectId: projects[1].id, assigneeId: manager.id },
      { title: 'API integration planning',  description: 'Plan API integration with ERP system',                 status: TaskStatus.REVIEW,      projectId: projects[2].id, assigneeId: manager.id },
      { title: 'Data migration script',     description: 'Write script for data migration to ERP',               status: TaskStatus.DONE,        projectId: projects[2].id, assigneeId: clientUser1.id },
      { title: 'User testing',              description: 'Conduct user testing sessions',                         status: TaskStatus.TODO,        projectId: projects[0].id, assigneeId: clientUser2.id },
      { title: 'Performance optimization',  description: 'Optimize website performance',                         status: TaskStatus.IN_PROGRESS, projectId: projects[0].id, assigneeId: admin.id },
      { title: 'Security audit',            description: 'Perform security audit',                               status: TaskStatus.TODO,        projectId: projects[2].id, assigneeId: clientUser1.id },
    ];
    await Promise.all(tasksData.map(task => prisma.task.create({ data: task })));
    console.log('Created tasks:', tasksData.length);
  } else {
    console.log('Projects already exist, skipping tasks.');
    projects = await prisma.project.findMany({ select: { id: true } });
  }

  // ── Skills ──────────────────────────────────────────────────────────────────
  const skillNames = ['React', 'Node.js', 'TypeScript', 'UI/UX Design', 'Figma', 'Python', 'Data Analysis', 'PostgreSQL'];
  const skills = await Promise.all(
    skillNames.map(name =>
      prisma.skill.upsert({ where: { name }, update: {}, create: { name } })
    )
  );
  console.log('Skills ready:', skills.length);

  // ── Freelancer Profiles ─────────────────────────────────────────────────────
  const existingFreelancerCount = await prisma.freelancerProfile.count();
  if (existingFreelancerCount === 0) {
    const [fp1, fp2, fp3] = await Promise.all([
      prisma.freelancerProfile.create({
        data: {
          userId: freelancerUser1.id,
          bio: 'Développeur full-stack avec 5 ans d\'expérience sur React et Node.js.',
          hourlyRate: 60,
          availability: true,
          skills: { connect: [{ name: 'React' }, { name: 'Node.js' }, { name: 'TypeScript' }] },
        },
      }),
      prisma.freelancerProfile.create({
        data: {
          userId: freelancerUser2.id,
          bio: 'Designer UI/UX passionnée par l\'expérience utilisateur et Figma.',
          hourlyRate: 50,
          availability: true,
          skills: { connect: [{ name: 'UI/UX Design' }, { name: 'Figma' }] },
        },
      }),
      prisma.freelancerProfile.create({
        data: {
          userId: freelancerUser3.id,
          bio: 'Data analyst et développeur Python, spécialisé en PostgreSQL.',
          hourlyRate: 55,
          availability: false,
          skills: { connect: [{ name: 'Python' }, { name: 'Data Analysis' }, { name: 'PostgreSQL' }] },
        },
      }),
    ]);

    await Promise.all([
      prisma.portfolioItem.create({ data: { title: 'Dashboard SaaS',        description: 'Tableau de bord React/TypeScript pour une startup FinTech', freelancerId: fp1.id } }),
      prisma.portfolioItem.create({ data: { title: 'API REST Express',       description: 'API REST pour une plateforme e-commerce',                   freelancerId: fp1.id } }),
      prisma.portfolioItem.create({ data: { title: 'Application mobile UX',  description: 'Refonte UX d\'une application de livraison',                freelancerId: fp2.id } }),
      prisma.portfolioItem.create({ data: { title: 'Design system',          description: 'Système de design complet avec Figma',                      freelancerId: fp2.id } }),
      prisma.portfolioItem.create({ data: { title: 'Pipeline ETL',           description: 'Pipeline ETL Python pour une banque tunisienne',            freelancerId: fp3.id } }),
    ]);

    console.log('Created freelancer profiles.');
  } else {
    console.log('Freelancer profiles already exist, skipping.');
  }

  // ── Service Requests ──────────────────────────────────────────────────────
  const existingSRCount = await prisma.serviceRequest.count();
  if (existingSRCount === 0) {
    const srData = [
      { title: 'Problème de connexion au portail client',    description: 'Le client ne parvient pas à se connecter depuis ce matin.',  status: ServiceRequestStatus.IN_PROGRESS,    priority: 'HIGH'   as const, clientId: carrefour.id, type: 'SUPPORT'     as const },
      { title: 'Demande de rapport mensuel personnalisé',    description: 'Export Excel avec filtres par région et catégorie.',          status: ServiceRequestStatus.NEW,            priority: 'NORMAL' as const, clientId: monoprix.id,  type: 'SUPPORT'     as const },
      { title: 'Bug affichage sur mobile Safari',            description: 'Les images produits ne s\'affichent pas sur iPhone 14.',      status: ServiceRequestStatus.IN_REVIEW,      priority: 'HIGH'   as const, clientId: carrefour.id, type: 'SUPPORT'     as const },
      { title: 'Ajout d\'un utilisateur supplémentaire',     description: 'Besoin d\'un accès pour un nouveau responsable régional.',   status: ServiceRequestStatus.COMPLETED,      priority: 'LOW'    as const, clientId: geant.id,     type: 'SUPPORT'     as const },
      { title: 'Intégration API livraison tierce partie',    description: 'Connecter l\'API de Aramex pour le suivi des colis.',        status: ServiceRequestStatus.WAITING_CLIENT, priority: 'NORMAL' as const, clientId: monoprix.id,  type: 'NEW_PROJECT' as const },
    ];
    await Promise.all(
      srData.map(sr =>
        prisma.serviceRequest.create({ data: { ...sr, assignedToId: manager.id } })
      )
    );
    console.log('Created service requests:', srData.length);
  } else {
    console.log('Service requests already exist, skipping.');
  }

  // ── Proposals ────────────────────────────────────────────────────────────────
  const existingProposalCount = await prisma.proposal.count();
  if (existingProposalCount === 0) {
    const proposal1 = await prisma.proposal.create({
      data: {
        title: 'Refonte complète e-commerce Carrefour Tunisia',
        description: 'Proposition commerciale pour la refonte de la plateforme e-commerce incluant design, développement et déploiement.',
        status: ProposalStatus.ACCEPTED,
        amount: 28500,
        currency: 'TND',
        acceptedAt: new Date('2026-01-15'),
        clientId: carrefour.id,
        projectId: projects[0]?.id,
        sections: {
          create: [
            { title: 'Contexte & Objectifs',  content: 'Moderniser l\'expérience d\'achat en ligne pour 2M+ d\'utilisateurs tunisiens.', orderIndex: 0 },
            { title: 'Périmètre technique',   content: 'React 18, Node.js, PostgreSQL, CI/CD GitHub Actions, hébergement AWS.',          orderIndex: 1 },
            { title: 'Planning & Livrables',  content: 'Phase 1 : Design (4 semaines). Phase 2 : Dev (12 semaines). Phase 3 : Recette.', orderIndex: 2 },
            { title: 'Tarification',          content: 'Forfait global : 28 500 TND HT. Paiement en 3 tranches.',                       orderIndex: 3 },
          ],
        },
      },
    });

    const proposal2 = await prisma.proposal.create({
      data: {
        title: 'Application mobile Monoprix Tunisia',
        description: 'Développement d\'une application native iOS/Android pour la fidélisation client.',
        status: ProposalStatus.SENT,
        amount: 18000,
        currency: 'TND',
        clientId: monoprix.id,
        projectId: projects[1]?.id,
        sections: {
          create: [
            { title: 'Vision du projet', content: 'Application de fidélité avec scan en magasin, promotions géolocalisées et paiement mobile.', orderIndex: 0 },
            { title: 'Stack technique',  content: 'React Native + Expo, API REST Node.js, notifications push via Firebase.',                   orderIndex: 1 },
            { title: 'Budget & délais',  content: '18 000 TND HT : livraison estimée en 5 mois.',                                             orderIndex: 2 },
          ],
        },
      },
    });

    await prisma.proposal.create({
      data: {
        title: 'Audit & migration ERP Geant Tunisia',
        description: 'Mission d\'audit des systèmes existants et plan de migration vers le nouvel ERP.',
        status: ProposalStatus.DRAFT,
        amount: 12000,
        currency: 'TND',
        clientId: geant.id,
      },
    });

    console.log('Created proposals: 3');

    // ── Invoices ──────────────────────────────────────────────────────────────
    const inv1 = await prisma.invoice.create({
      data: {
        number: 'INV-2026-001',
        title: 'Acompte 1/3 : Refonte e-commerce Carrefour',
        amount: 9500,
        currency: 'TND',
        amountPaid: 9500,
        status: InvoiceStatus.PAID,
        paidAt: new Date('2026-01-20'),
        dueDate: new Date('2026-02-01'),
        clientId: carrefour.id,
        projectId: projects[0]?.id,
        proposalId: proposal1.id,
        items: {
          create: [
            { description: 'Phase Design : maquettes et prototypes',   quantity: 1, unitPrice: 6000, total: 6000 },
            { description: 'Mise en place environnement dev/staging',  quantity: 1, unitPrice: 3500, total: 3500 },
          ],
        },
      },
    });

    await prisma.invoice.create({
      data: {
        number: 'INV-2026-002',
        title: 'Acompte 2/3 : Refonte e-commerce Carrefour',
        amount: 9500,
        currency: 'TND',
        amountPaid: 4750,
        status: InvoiceStatus.PARTIAL,
        dueDate: new Date('2026-03-15'),
        sentAt: new Date('2026-02-28'),
        clientId: carrefour.id,
        projectId: projects[0]?.id,
        items: {
          create: [
            { description: 'Développement catalogue produits & panier', quantity: 1, unitPrice: 5500, total: 5500 },
            { description: 'Intégration passerelle paiement',           quantity: 1, unitPrice: 4000, total: 4000 },
          ],
        },
      },
    });

    await prisma.invoice.create({
      data: {
        number: 'INV-2026-003',
        title: 'Développement App Mobile : Monoprix (acompte)',
        amount: 6000,
        currency: 'TND',
        status: InvoiceStatus.SENT,
        dueDate: new Date('2026-04-01'),
        sentAt: new Date('2026-03-10'),
        clientId: monoprix.id,
        projectId: projects[1]?.id,
        proposalId: proposal2.id,
        items: {
          create: [
            { description: 'Kickoff & spécifications techniques', quantity: 1, unitPrice: 2000, total: 2000 },
            { description: 'Design UI/UX application mobile',     quantity: 1, unitPrice: 4000, total: 4000 },
          ],
        },
      },
    });

    await prisma.invoice.create({
      data: {
        number: 'INV-2026-004',
        title: 'Audit ERP Geant Tunisia',
        amount: 3500,
        currency: 'TND',
        status: InvoiceStatus.OVERDUE,
        dueDate: new Date('2026-02-15'),
        sentAt: new Date('2026-01-30'),
        clientId: geant.id,
        items: {
          create: [
            { description: 'Audit systèmes existants (5 jours)', quantity: 5, unitPrice: 700, total: 3500 },
          ],
        },
      },
    });

    await prisma.invoicePayment.create({
      data: { invoiceId: inv1.id, amount: 9500, method: 'Virement bancaire', reference: 'VIR-2026-0120', paidAt: new Date('2026-01-20') },
    });

    console.log('Created invoices: 4');
  } else {
    console.log('Proposals/Invoices already exist, skipping.');
  }

  // ── Approvals ────────────────────────────────────────────────────────────────
  const existingApprovalCount = await prisma.approval.count();
  if (existingApprovalCount === 0) {
    const approvalData = [
      { title: 'Validation maquettes homepage Carrefour',    description: 'Approbation des maquettes Figma avant passage en développement.', status: ApprovalStatus.APPROVED,  clientId: carrefour.id, projectId: projects[0]?.id },
      { title: 'Validation wireframes app mobile Monoprix',  description: 'Validation des wireframes basse fidélité pour toutes les vues.',   status: ApprovalStatus.PENDING,   clientId: monoprix.id,  projectId: projects[1]?.id },
      { title: 'Validation du cahier des charges ERP Geant', description: 'Document de spécifications fonctionnelles à valider.',             status: ApprovalStatus.COMMENTED, clientId: geant.id,     projectId: projects[2]?.id },
    ];
    await Promise.all(
      approvalData.map(a => prisma.approval.create({ data: a }))
    );
    console.log('Created approvals:', approvalData.length);
  } else {
    console.log('Approvals already exist, skipping.');
  }

  // ── Notifications ─────────────────────────────────────────────────────────────
  const existingNotifCount = await prisma.notification.count({ where: { userId: admin.id } });
  if (existingNotifCount === 0) {
    await prisma.notification.createMany({
      data: [
        { userId: admin.id,       title: 'Nouvelle demande de service', message: 'Carrefour Tunisia a ouvert une demande de priorité haute.',    read: false },
        { userId: admin.id,       title: 'Proposition acceptée',        message: 'Carrefour Tunisia a accepté la proposition INV-2026-001.',      read: true  },
        { userId: admin.id,       title: 'Facture en retard',           message: 'La facture INV-2026-004 de Geant Tunisia est en retard.',       read: false },
        { userId: manager.id,     title: 'Tâche assignée',              message: 'Vous avez été assigné à la tâche "API integration planning".', read: false },
        { userId: clientUser1.id, title: 'Bienvenue sur Sécritou',      message: 'Votre compte a été créé avec succès.',                         read: true  },
      ],
    });
    console.log('Created notifications: 5');
  } else {
    console.log('Notifications already exist, skipping.');
  }

  // ── Permission Profiles ───────────────────────────────────────────────────
  const FULL       = { read: true,  create: true,  update: true,  delete: true  };
  const READ_UPDATE = { read: true,  create: false, update: true,  delete: false };
  const READ       = { read: true,  create: false, update: false, delete: false };
  const NO_ACCESS  = { read: false, create: false, update: false, delete: false };

  const existingProfileCount = await prisma.permissionProfile.count();
  if (existingProfileCount === 0) {
    await Promise.all([
      prisma.permissionProfile.create({
        data: {
          name: "Opérations",
          description: "Accès complet aux projets, tâches et freelances",
          permissions: {
            projects:   FULL,
            tasks:      FULL,
            freelancers: READ_UPDATE,
            clients:    NO_ACCESS,
            leads:      NO_ACCESS,
            invoices:   NO_ACCESS,
            analytics:  NO_ACCESS,
            approvals:  NO_ACCESS,
            documents:  NO_ACCESS,
          },
        },
      }),
      prisma.permissionProfile.create({
        data: {
          name: "Commercial",
          description: "Accès aux leads, clients et propositions",
          permissions: {
            projects:   NO_ACCESS,
            tasks:      NO_ACCESS,
            freelancers: NO_ACCESS,
            clients:    READ,
            leads:      FULL,
            invoices:   NO_ACCESS,
            analytics:  NO_ACCESS,
            approvals:  NO_ACCESS,
            documents:  NO_ACCESS,
          },
        },
      }),
      prisma.permissionProfile.create({
        data: {
          name: "Technique",
          description: "Accès aux projets, tâches et documents",
          permissions: {
            projects:   READ_UPDATE,
            tasks:      FULL,
            freelancers: NO_ACCESS,
            clients:    NO_ACCESS,
            leads:      NO_ACCESS,
            invoices:   NO_ACCESS,
            analytics:  NO_ACCESS,
            approvals:  NO_ACCESS,
            documents:  FULL,
          },
        },
      }),
    ]);
    console.log('Created permission profiles: 3');
  } else {
    console.log('Permission profiles already exist, skipping.');
  }

  console.log('\n─────────────────────────────────────────');
  console.log('Database seed completed successfully!');
  console.log('─────────────────────────────────────────');
  console.log('Credentials:');
  console.log('  Admin       → admin@secritou.tn              / admin123');
  console.log('  Manager     → manager@secritou.tn            / manager123');
  console.log('  Client 1    → client1@example.tn             / client123');
  console.log('  Client 2    → client2@example.tn             / client123');
  console.log('  Freelancer 1 → yassine.dev@freelance.tn      / freelancer123');
  console.log('  Freelancer 2 → ines.design@freelance.tn      / freelancer123');
  console.log('  Freelancer 3 → omar.data@freelance.tn        / freelancer123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
