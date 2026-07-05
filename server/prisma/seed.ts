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
  NotificationType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { COMPANY_ID } from '../src/config/constants.js';

const prisma = new PrismaClient();

// Helper: skip creation if already has rows
async function skipIf(model: { count: () => Promise<number> }, label: string): Promise<boolean> {
  const n = await model.count();
  if (n > 0) { console.log(`${label} already exist (${n}), skipping.`); return true; }
  return false;
}

async function main() {
  console.log('Starting database seed...\n');

  // ── Company ────────────────────────────────────────────────────────────────
  const company = await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: {},
    create: { id: COMPANY_ID, name: 'Secritou', website: 'https://secritou.tn' },
  });
  console.log('✅ Company:', company.name);

  // ── Services ──────────────────────────────────────────────────────────────
  const svcNames = ['Business Performance', 'Digital Growth', 'Technology Solutions', 'AI & Automation'];
  const svc: Record<string, string> = {};
  for (const name of svcNames) {
    const s = await prisma.service.upsert({ where: { name }, update: {}, create: { name } });
    svc[name] = s.id;
  }
  console.log('✅ Services:', svcNames.join(', '));

  // ── Passwords ─────────────────────────────────────────────────────────────
  const [adminHash, mgrHash, clientHash, freelancerHash] = await Promise.all([
    bcrypt.hash('admin123', 10),
    bcrypt.hash('manager123', 10),
    bcrypt.hash('client123', 10),
    bcrypt.hash('freelancer123', 10),
  ]);

  // ── Users ─────────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@secritou.tn' },
    update: {},
    create: { email: 'admin@secritou.tn', name: 'Ahmed Ben Ali', passwordHash: adminHash, role: Role.ADMIN },
  });

  const manager1 = await prisma.user.upsert({
    where: { email: 'manager@secritou.tn' },
    update: {},
    create: { email: 'manager@secritou.tn', name: 'Sarra Mansouri', passwordHash: mgrHash, role: Role.MANAGER, serviceId: svc['Digital Growth'] },
  });

  const manager2 = await prisma.user.upsert({
    where: { email: 'manager2@secritou.tn' },
    update: {},
    create: { email: 'manager2@secritou.tn', name: 'Karim Jebali', passwordHash: mgrHash, role: Role.MANAGER, serviceId: svc['Technology Solutions'] },
  });

  // Client users (will be linked to Client records below)
  const rawClientUsers = await Promise.all([
    prisma.user.upsert({ where: { email: 'client1@example.tn' }, update: {}, create: { email: 'client1@example.tn', name: 'Fatma Khelifi',     passwordHash: clientHash, role: Role.CLIENT } }),
    prisma.user.upsert({ where: { email: 'client2@example.tn' }, update: {}, create: { email: 'client2@example.tn', name: 'Mohamed Trabelsi',  passwordHash: clientHash, role: Role.CLIENT } }),
    prisma.user.upsert({ where: { email: 'client3@example.tn' }, update: {}, create: { email: 'client3@example.tn', name: 'Nadia Gharbi',      passwordHash: clientHash, role: Role.CLIENT } }),
    prisma.user.upsert({ where: { email: 'client4@example.tn' }, update: {}, create: { email: 'client4@example.tn', name: 'Bilel Hammami',     passwordHash: clientHash, role: Role.CLIENT } }),
  ]);

  const [freelancer1, freelancer2, freelancer3, freelancer4] = await Promise.all([
    prisma.user.upsert({ where: { email: 'yassine.dev@freelance.tn'   }, update: {}, create: { email: 'yassine.dev@freelance.tn',   name: 'Yassine Gharbi', passwordHash: freelancerHash, role: Role.FREELANCER } }),
    prisma.user.upsert({ where: { email: 'ines.design@freelance.tn'   }, update: {}, create: { email: 'ines.design@freelance.tn',   name: 'Inès Bouali',    passwordHash: freelancerHash, role: Role.FREELANCER } }),
    prisma.user.upsert({ where: { email: 'omar.data@freelance.tn'     }, update: {}, create: { email: 'omar.data@freelance.tn',     name: 'Omar Cherif',    passwordHash: freelancerHash, role: Role.FREELANCER } }),
    prisma.user.upsert({ where: { email: 'salma.mobile@freelance.tn'  }, update: {}, create: { email: 'salma.mobile@freelance.tn',  name: 'Salma Zribi',    passwordHash: freelancerHash, role: Role.FREELANCER } }),
  ]);

  console.log('✅ Users created');

  // ── Clients ───────────────────────────────────────────────────────────────
  const upsertClient = async (name: string, email: string, phone: string, userId: string) => {
    let client = await prisma.client.findFirst({ where: { email } });
    if (!client) client = await prisma.client.create({ data: { name, email, phone } });
    // Link user → client (both directions)
    await prisma.user.update({ where: { id: userId }, data: { clientId: client.id } });
    await prisma.client.update({ where: { id: client.id }, data: {} }); // touch
    return client;
  };

  const [carrefour, monoprix, geant, vermeg] = await Promise.all([
    upsertClient('Carrefour Tunisia',  'contact@carrefour.tn',   '+216 71 901 234', rawClientUsers[0].id),
    upsertClient('Monoprix Tunisia',   'info@monoprix.tn',       '+216 71 012 345', rawClientUsers[1].id),
    upsertClient('Géant Tunisia',      'contact@geant.tn',       '+216 71 123 456', rawClientUsers[2].id),
    upsertClient('Vermeg Digital',     'contact@vermeg.tn',      '+216 71 234 567', rawClientUsers[3].id),
  ]);

  // Reload client users with clientId
  const [clientUser1, clientUser2, clientUser3, clientUser4] = await Promise.all(
    rawClientUsers.map(u => prisma.user.findUniqueOrThrow({ where: { id: u.id } }))
  );

  console.log('✅ Clients:', [carrefour, monoprix, geant, vermeg].map(c => c.name).join(', '));

  // ── Skills ────────────────────────────────────────────────────────────────
  const skillNames = ['React', 'Node.js', 'TypeScript', 'UI/UX Design', 'Figma', 'Python', 'Data Analysis', 'PostgreSQL', 'React Native', 'AWS'];
  const skills: Record<string, string> = {};
  for (const name of skillNames) {
    const s = await prisma.skill.upsert({ where: { name }, update: {}, create: { name } });
    skills[name] = s.id;
  }

  // ── Freelancer Profiles ───────────────────────────────────────────────────
  if (!(await skipIf(prisma.freelancerProfile, 'Freelancer profiles'))) {
    const [fp1, fp2, fp3, fp4] = await Promise.all([
      prisma.freelancerProfile.create({ data: { userId: freelancer1.id, bio: "Développeur full-stack React/Node.js, 5 ans d'XP, spécialiste e-commerce.",     hourlyRate: 60, availability: true,  skills: { connect: [{ name: 'React' }, { name: 'Node.js' }, { name: 'TypeScript' }, { name: 'AWS' }] } } }),
      prisma.freelancerProfile.create({ data: { userId: freelancer2.id, bio: "Designer UI/UX senior, passionnée Figma et systèmes de design scalables.",         hourlyRate: 50, availability: true,  skills: { connect: [{ name: 'UI/UX Design' }, { name: 'Figma' }] } } }),
      prisma.freelancerProfile.create({ data: { userId: freelancer3.id, bio: "Data analyst et développeur Python, expert PostgreSQL et pipelines ETL.",          hourlyRate: 55, availability: false, skills: { connect: [{ name: 'Python' }, { name: 'Data Analysis' }, { name: 'PostgreSQL' }] } } }),
      prisma.freelancerProfile.create({ data: { userId: freelancer4.id, bio: "Dev mobile React Native iOS/Android, 4 ans sur des apps à fort trafic.",           hourlyRate: 58, availability: true,  skills: { connect: [{ name: 'React Native' }, { name: 'TypeScript' }, { name: 'Node.js' }] } } }),
    ]);

    await Promise.all([
      prisma.portfolioItem.create({ data: { title: 'Dashboard SaaS FinTech',     description: 'Tableau de bord React/TypeScript pour une startup FinTech tunisienne', freelancerId: fp1.id } }),
      prisma.portfolioItem.create({ data: { title: 'API e-commerce REST',         description: 'API REST Node.js haute performance pour une plateforme e-commerce',     freelancerId: fp1.id } }),
      prisma.portfolioItem.create({ data: { title: 'Design system Aria',          description: 'Système de design complet avec Figma + Storybook',                      freelancerId: fp2.id } }),
      prisma.portfolioItem.create({ data: { title: 'Refonte UX app livraison',    description: 'Refonte UX d\'une app de livraison à domicile — +40% conversion',       freelancerId: fp2.id } }),
      prisma.portfolioItem.create({ data: { title: 'Pipeline ETL bancaire',       description: 'Pipeline ETL Python pour une banque tunisienne — 10M rows/jour',        freelancerId: fp3.id } }),
      prisma.portfolioItem.create({ data: { title: 'App fidélité iOS/Android',    description: 'Application mobile React Native pour programme de fidélité (50K users)', freelancerId: fp4.id } }),
    ]);

    // Ratings
    await Promise.all([
      prisma.rating.create({ data: { freelancerId: fp1.id, score: 5, comment: 'Excellent travail, code propre et livraison dans les délais.',   ratedByUserId: admin.id } }),
      prisma.rating.create({ data: { freelancerId: fp1.id, score: 4, comment: 'Très bon dev, quelques ajustements mineurs demandés.',           ratedByUserId: manager1.id } }),
      prisma.rating.create({ data: { freelancerId: fp2.id, score: 5, comment: 'Designs magnifiques, très à l\'écoute des retours clients.',     ratedByUserId: admin.id } }),
      prisma.rating.create({ data: { freelancerId: fp3.id, score: 4, comment: 'Analyse rigoureuse, bonne documentation.',                       ratedByUserId: manager2.id } }),
      prisma.rating.create({ data: { freelancerId: fp4.id, score: 5, comment: 'Application livrée en avance, performances excellentes.',         ratedByUserId: admin.id } }),
    ]);

    // Update average ratings
    for (const fp of [fp1, fp2, fp3, fp4]) {
      const agg = await prisma.rating.aggregate({ where: { freelancerId: fp.id }, _avg: { score: true }, _count: { score: true } });
      await prisma.freelancerProfile.update({ where: { id: fp.id }, data: { rating: agg._avg.score ?? 0, reviewCount: agg._count.score } });
    }

    console.log('✅ Freelancer profiles + ratings');
  }

  // ── Leads ─────────────────────────────────────────────────────────────────
  if (!(await skipIf(prisma.lead, 'Leads'))) {
    await prisma.lead.createMany({
      data: [
        { name: 'Tunisie Telecom',              email: 'contact@tunisietelecom.tn',  phone: '+216 70 000 000', source: 'Website',  status: LeadStatus.NEW,       createdAt: new Date('2026-01-05') },
        { name: 'Orange Tunisia',               email: 'info@orange.tn',             phone: '+216 71 000 000', source: 'LinkedIn', status: LeadStatus.CONTACTED, createdAt: new Date('2026-01-10') },
        { name: 'Ooredoo Tunisia',              email: 'support@ooredoo.tn',         phone: '+216 72 000 000', source: 'Referral', status: LeadStatus.QUALIFIED, createdAt: new Date('2026-01-15') },
        { name: 'Banque de Tunisie',            email: 'contact@banquetunisie.tn',   phone: '+216 71 234 567', source: 'Email',    status: LeadStatus.PROPOSAL,  createdAt: new Date('2026-01-20') },
        { name: 'Société Tunisienne de Banque', email: 'info@stb.tn',               phone: '+216 71 345 678', source: 'Website',  status: LeadStatus.WON,       createdAt: new Date('2025-11-01'), convertedClientId: carrefour.id },
        { name: 'Tunisie Lease',                email: 'info@tunisielease.tn',       phone: '+216 71 567 890', source: 'Referral', status: LeadStatus.CONTACTED, createdAt: new Date('2026-02-01') },
        { name: 'Sopra Banking Software TN',    email: 'contact@soprabanking.tn',    phone: '+216 71 678 901', source: 'Website',  status: LeadStatus.QUALIFIED, createdAt: new Date('2026-02-05') },
        { name: 'Tunisavia',                    email: 'info@tunisavia.tn',           phone: '+216 71 789 012', source: 'Email',    status: LeadStatus.LOST,      createdAt: new Date('2025-12-15') },
        { name: 'STEG Digital',                 email: 'contact@steg.tn',            phone: '+216 71 890 123', source: 'Referral', status: LeadStatus.NEW,       createdAt: new Date('2026-03-01') },
        { name: 'Attijari Bank',                email: 'digital@attijari.tn',        phone: '+216 71 901 000', source: 'LinkedIn', status: LeadStatus.QUALIFIED, createdAt: new Date('2026-03-10') },
        { name: 'Biat Digital',                 email: 'innovation@biat.tn',         phone: '+216 71 902 000', source: 'Referral', status: LeadStatus.PROPOSAL,  createdAt: new Date('2026-03-15') },
        { name: 'Délice Danone',                email: 'marketing@delice.tn',        phone: '+216 71 903 000', source: 'Website',  status: LeadStatus.WON,       createdAt: new Date('2025-10-20'), convertedClientId: monoprix.id },
      ],
    });
    console.log('✅ Created 12 leads');
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  if (!(await skipIf(prisma.project, 'Projects'))) {

    // ── Proposal 1: Accepted → linked to Project 1 (COMPLETED)
    const proposal1 = await prisma.proposal.create({
      data: {
        title: 'Refonte e-commerce Carrefour Tunisia',
        description: 'Refonte complète de la plateforme e-commerce : design, dev, déploiement AWS.',
        status: ProposalStatus.ACCEPTED,
        amount: 28500,
        currency: 'TND',
        acceptedAt: new Date('2025-11-01'),
        expiresAt: new Date('2026-01-01'),
        clientId: carrefour.id,
        sections: { create: [
          { title: 'Contexte & Objectifs',  content: 'Moderniser l\'expérience d\'achat en ligne pour 2M+ utilisateurs tunisiens. Objectif : +35% taux de conversion.',   orderIndex: 0 },
          { title: 'Périmètre technique',   content: 'Stack : React 19, Node.js, PostgreSQL, Redis, déploiement AWS ECS. Intégration paiement : Flouci + virement.',       orderIndex: 1 },
          { title: 'Planning & Livrables',  content: 'Phase 1 — Design UI/UX (4 sem). Phase 2 — Dev back + front (12 sem). Phase 3 — Tests, recette, mise en prod.',      orderIndex: 2 },
          { title: 'Tarification',          content: 'Forfait global : 28 500 TND HT. Paiement en 3 tranches : 33% signature, 33% livraison phase 2, 34% recette.',       orderIndex: 3 },
        ]},
      },
    });

    // Project 1 — COMPLETED (Carrefour)
    const project1 = await prisma.project.create({
      data: {
        name: 'E-commerce Carrefour Tunisia',
        description: 'Refonte complète de la plateforme e-commerce — catalogue, panier, paiement, espace client.',
        status: ProjectStatus.COMPLETED,
        clientId: carrefour.id,
        serviceId: svc['Digital Growth'],
        proposalId: proposal1.id,
        budget: '28 500 TND',
        deadline: new Date('2026-04-30'),
        serviceType: 'web',
        briefCompleted: true,
        briefCompletedAt: new Date('2025-11-15'),
        clientApprovedAt: new Date('2026-04-28'),
        clientApprovedById: admin.id,
        createdAt: new Date('2025-11-05'),
      },
    });
    await prisma.proposal.update({ where: { id: proposal1.id }, data: { projectId: project1.id } });

    // ── Proposal 2: ACCEPTED → Project 2 (IN_PROGRESS, Monoprix)
    const proposal2 = await prisma.proposal.create({
      data: {
        title: 'Application mobile Monoprix Tunisia',
        description: 'Développement d\'une app native iOS/Android pour la fidélisation client.',
        status: ProposalStatus.ACCEPTED,
        amount: 18000,
        currency: 'TND',
        acceptedAt: new Date('2026-01-20'),
        expiresAt: new Date('2026-04-01'),
        clientId: monoprix.id,
        sections: { create: [
          { title: 'Vision produit',   content: 'App fidélité : scan en magasin, promotions géolocalisées, wallet de points, paiement mobile.',          orderIndex: 0 },
          { title: 'Architecture',     content: 'React Native Expo + Node.js BFF + PostgreSQL. Notifications push via Firebase. CI/CD Bitrise.',          orderIndex: 1 },
          { title: 'Budget & délais',  content: '18 000 TND HT. Livraison estimée en 5 mois. Support 3 mois post-lancement inclus.',                     orderIndex: 2 },
        ]},
      },
    });

    const project2 = await prisma.project.create({
      data: {
        name: 'App Mobile Monoprix Tunisia',
        description: 'Application iOS/Android pour le programme de fidélité Monoprix.',
        status: ProjectStatus.IN_PROGRESS,
        clientId: monoprix.id,
        serviceId: svc['Digital Growth'],
        proposalId: proposal2.id,
        budget: '18 000 TND',
        deadline: new Date('2026-07-15'),
        serviceType: 'mobile',
        briefCompleted: true,
        briefCompletedAt: new Date('2026-02-01'),
        createdAt: new Date('2026-01-25'),
      },
    });
    await prisma.proposal.update({ where: { id: proposal2.id }, data: { projectId: project2.id } });

    // ── Proposal 3: ACCEPTED → Project 3 (REVIEW, Géant)
    const proposal3 = await prisma.proposal.create({
      data: {
        title: 'Intégration ERP Géant Tunisia',
        description: 'Audit et migration vers le nouvel ERP SAP pour la gestion des stocks et des achats.',
        status: ProposalStatus.ACCEPTED,
        amount: 35000,
        currency: 'TND',
        acceptedAt: new Date('2025-12-10'),
        expiresAt: new Date('2026-02-01'),
        clientId: geant.id,
        sections: { create: [
          { title: 'Périmètre mission',  content: 'Audit des systèmes legacy, cartographie des données, plan de migration, intégration SAP S/4HANA.',     orderIndex: 0 },
          { title: 'Équipe projet',      content: '2 chefs de projet, 1 data engineer, 1 consultant SAP externe, 1 chef de projet client.',                orderIndex: 1 },
          { title: 'Budget & phasage',   content: 'Phase 1 — Audit (35K TND). Phase 2 — Dev & migration (estimé 80K TND, nouvelle proposition à venir).', orderIndex: 2 },
        ]},
      },
    });

    const project3 = await prisma.project.create({
      data: {
        name: 'Intégration ERP Géant Tunisia',
        description: 'Audit, cartographie données, migration vers SAP S/4HANA.',
        status: ProjectStatus.REVIEW,
        clientId: geant.id,
        serviceId: svc['Technology Solutions'],
        proposalId: proposal3.id,
        budget: '35 000 TND',
        deadline: new Date('2026-06-01'),
        serviceType: 'erp',
        briefCompleted: true,
        briefCompletedAt: new Date('2025-12-20'),
        createdAt: new Date('2025-12-12'),
      },
    });
    await prisma.proposal.update({ where: { id: proposal3.id }, data: { projectId: project3.id } });

    // ── Proposal 4: SENT (en attente, Vermeg)
    await prisma.proposal.create({
      data: {
        title: 'Plateforme IA de scoring crédit — Vermeg Digital',
        description: 'Développement d\'un moteur ML de scoring crédit intégré à l\'ERP bancaire.',
        status: ProposalStatus.SENT,
        amount: 55000,
        currency: 'TND',
        expiresAt: new Date('2026-07-30'),
        clientId: vermeg.id,
        sections: { create: [
          { title: 'Contexte',          content: 'Vermeg souhaite remplacer son scoring manuel par un moteur ML temps réel.',                              orderIndex: 0 },
          { title: 'Solution proposée', content: 'Modèle XGBoost + FastAPI + intégration REST dans l\'ERP. Dashboard analytique pour les agents.',         orderIndex: 1 },
          { title: 'Budget',            content: '55 000 TND HT. Maintenance 12 mois incluse. SLA 99.5%.',                                                 orderIndex: 2 },
        ]},
      },
    });

    // ── Proposal 5: DRAFT (Monoprix phase 2)
    await prisma.proposal.create({
      data: {
        title: 'Phase 2 — Monoprix : paiement intégré',
        description: 'Extension de l\'app mobile Monoprix avec wallet digital et paiement NFC.',
        status: ProposalStatus.DRAFT,
        amount: 12000,
        currency: 'TND',
        clientId: monoprix.id,
      },
    });

    console.log('✅ Created 5 proposals');

    // ── Tasks (Project 1 — COMPLETED) ─────────────────────────────────────
    const tasks1 = await Promise.all([
      prisma.task.create({ data: { title: 'Analyse des besoins & brief UX',    description: 'Interviews utilisateurs, personas, user journey maps.',                       status: TaskStatus.DONE,        projectId: project1.id, assigneeId: freelancer2.id, createdAt: new Date('2025-11-06') } }),
      prisma.task.create({ data: { title: 'Maquettes Figma homepage',           description: 'High-fidelity mockups homepage, catégories, fiche produit.',                  status: TaskStatus.DONE,        projectId: project1.id, assigneeId: freelancer2.id, createdAt: new Date('2025-11-20') } }),
      prisma.task.create({ data: { title: 'Design system & composants',         description: 'Création du design system : couleurs, typo, composants réutilisables.',       status: TaskStatus.DONE,        projectId: project1.id, assigneeId: freelancer2.id, createdAt: new Date('2025-12-01') } }),
      prisma.task.create({ data: { title: 'Architecture backend & BDD',         description: 'Schéma PostgreSQL, ERD, choix des index, plan de scalabilité.',               status: TaskStatus.DONE,        projectId: project1.id, assigneeId: freelancer1.id, createdAt: new Date('2025-12-10') } }),
      prisma.task.create({ data: { title: 'Catalogue produits & recherche',     description: 'API produits, filtres, recherche Elasticsearch, pagination.',                 status: TaskStatus.DONE,        projectId: project1.id, assigneeId: freelancer1.id, createdAt: new Date('2026-01-05') } }),
      prisma.task.create({ data: { title: 'Panier & processus de commande',     description: 'Panier persistant (Redis), étapes de commande, récapitulatif.',               status: TaskStatus.DONE,        projectId: project1.id, assigneeId: freelancer1.id, createdAt: new Date('2026-01-20') } }),
      prisma.task.create({ data: { title: 'Intégration passerelle Flouci',      description: 'Intégration paiement Flouci + virement bancaire + webhook confirmation.',     status: TaskStatus.DONE,        projectId: project1.id, assigneeId: freelancer1.id, createdAt: new Date('2026-02-01') } }),
      prisma.task.create({ data: { title: 'Tests E2E & performance',            description: 'Playwright E2E, Lighthouse perf (score > 90), tests de charge k6.',           status: TaskStatus.DONE,        projectId: project1.id, assigneeId: admin.id,        createdAt: new Date('2026-03-01') } }),
      prisma.task.create({ data: { title: 'Déploiement AWS & CI/CD',            description: 'Pipeline GitHub Actions, Docker, ECS Fargate, RDS, ElastiCache.',             status: TaskStatus.DONE,        projectId: project1.id, assigneeId: freelancer1.id, createdAt: new Date('2026-04-01') } }),
      prisma.task.create({ data: { title: 'Formation équipe Carrefour',         description: 'Formation admin back-office (2 jours) + documentation utilisateur.',           status: TaskStatus.DONE,        projectId: project1.id, assigneeId: manager1.id,     createdAt: new Date('2026-04-15') } }),
    ]);

    // ── Tasks (Project 2 — IN_PROGRESS) ──────────────────────────────────
    const tasks2 = await Promise.all([
      prisma.task.create({ data: { title: 'Cahier des charges app mobile',      description: 'Spécifications fonctionnelles et techniques complètes.',                      status: TaskStatus.DONE,        projectId: project2.id, assigneeId: manager1.id,     createdAt: new Date('2026-01-26') } }),
      prisma.task.create({ data: { title: 'Wireframes basse fidélité',          description: 'Wireframes pour 15 écrans clés : onboarding, home, scan, wallet.',           status: TaskStatus.DONE,        projectId: project2.id, assigneeId: freelancer2.id, createdAt: new Date('2026-02-05') } }),
      prisma.task.create({ data: { title: 'Validation wireframes client',       description: 'Session de review avec l\'équipe Monoprix.',                                  status: TaskStatus.DONE,        projectId: project2.id, assigneeId: manager1.id,     createdAt: new Date('2026-02-15') } }),
      prisma.task.create({ data: { title: 'Maquettes haute fidélité',           description: 'Design complet UI/UX — toutes les vues de l\'application.',                   status: TaskStatus.IN_PROGRESS, projectId: project2.id, assigneeId: freelancer2.id, dueDate: new Date('2026-07-01'), createdAt: new Date('2026-03-01') } }),
      prisma.task.create({ data: { title: 'Setup React Native & CI Bitrise',    description: 'Configuration projet Expo, pipeline CI/CD, publication TestFlight.',          status: TaskStatus.IN_PROGRESS, projectId: project2.id, assigneeId: freelancer4.id, dueDate: new Date('2026-06-15'), createdAt: new Date('2026-03-10') } }),
      prisma.task.create({ data: { title: 'API authentification & profil',      description: 'Inscription, connexion JWT, profil utilisateur, mise à jour.',                status: TaskStatus.IN_PROGRESS, projectId: project2.id, assigneeId: freelancer1.id, dueDate: new Date('2026-06-20'), createdAt: new Date('2026-03-15') } }),
      prisma.task.create({ data: { title: 'Module scan code-barres',            description: 'Intégration scanner via caméra, lookup produit en base.',                     status: TaskStatus.TODO,        projectId: project2.id, assigneeId: freelancer4.id, dueDate: new Date('2026-07-10'), createdAt: new Date('2026-03-20') } }),
      prisma.task.create({ data: { title: 'Wallet de points fidélité',          description: 'Affichage solde, historique, conversion points → bons de réduction.',         status: TaskStatus.TODO,        projectId: project2.id, assigneeId: freelancer1.id, dueDate: new Date('2026-07-20'), createdAt: new Date('2026-03-25') } }),
      prisma.task.create({ data: { title: 'Notifications push Firebase',        description: 'Setup Firebase Cloud Messaging, segmentation offres géolocalisées.',          status: TaskStatus.TODO,        projectId: project2.id, assigneeId: freelancer4.id, dueDate: new Date('2026-07-25'), createdAt: new Date('2026-04-01') } }),
      prisma.task.create({ data: { title: 'Tests QA mobile & soumission stores', description: 'Tests sur 10 devices, correction bugs, soumission App Store & Play Store.',  status: TaskStatus.TODO,        projectId: project2.id, assigneeId: manager1.id,    dueDate: new Date('2026-08-01'), createdAt: new Date('2026-04-05') } }),
    ]);

    // ── Tasks (Project 3 — REVIEW) ────────────────────────────────────────
    const tasks3 = await Promise.all([
      prisma.task.create({ data: { title: 'Audit systèmes existants',           description: 'Inventaire des applications et bases de données en production.',              status: TaskStatus.DONE,        projectId: project3.id, assigneeId: manager2.id,     createdAt: new Date('2025-12-13') } }),
      prisma.task.create({ data: { title: 'Cartographie des flux de données',   description: 'Mapping complet des flux inter-systèmes et dépendances.',                     status: TaskStatus.DONE,        projectId: project3.id, assigneeId: freelancer3.id, createdAt: new Date('2025-12-20') } }),
      prisma.task.create({ data: { title: 'Analyse des gaps SAP',               description: 'Comparaison processus existants vs modules SAP S/4HANA.',                     status: TaskStatus.DONE,        projectId: project3.id, assigneeId: manager2.id,     createdAt: new Date('2026-01-10') } }),
      prisma.task.create({ data: { title: 'Plan de migration des données',      description: 'Stratégie ETL, scripts de transformation, plan de bascule.',                  status: TaskStatus.DONE,        projectId: project3.id, assigneeId: freelancer3.id, createdAt: new Date('2026-02-01') } }),
      prisma.task.create({ data: { title: 'Rapport d\'audit livraison',         description: 'Rapport final 80 pages : recommandations, risques, planning phase 2.',        status: TaskStatus.REVIEW,      projectId: project3.id, assigneeId: manager2.id,     createdAt: new Date('2026-03-01') } }),
      prisma.task.create({ data: { title: 'Présentation comité de direction',   description: 'Préparation et animation de la présentation CODIR Géant.',                    status: TaskStatus.REVIEW,      projectId: project3.id, assigneeId: admin.id,        createdAt: new Date('2026-03-15') } }),
    ]);

    // Task comments
    const t1 = tasks1[4]; // Catalogue produits
    const t2 = tasks2[3]; // Maquettes HF
    const t3 = tasks3[4]; // Rapport audit

    await Promise.all([
      prisma.comment.create({ data: { content: 'Elasticsearch configuré avec analyzer arabe/français. Tests de perf OK (< 50ms p99).',  taskId: t1.id, authorId: freelancer1.id, createdAt: new Date('2026-01-10') } }),
      prisma.comment.create({ data: { content: 'Index produits optimisés. Filtres multi-attributs validés par l\'équipe Carrefour.',     taskId: t1.id, authorId: manager1.id,   createdAt: new Date('2026-01-12') } }),
      prisma.comment.create({ data: { content: 'Première version des maquettes envoyée pour review. 12 écrans livrés sur 15.',           taskId: t2.id, authorId: freelancer2.id, createdAt: new Date('2026-04-10') } }),
      prisma.comment.create({ data: { content: 'Retours client : modifier l\'écran wallet et ajouter un onboarding tutoriel.',           taskId: t2.id, authorId: manager1.id,   createdAt: new Date('2026-04-12') } }),
      prisma.comment.create({ data: { content: 'Rapport finalisé. 3 risques critiques identifiés sur la migration des données legacy.',   taskId: t3.id, authorId: manager2.id,   createdAt: new Date('2026-03-05') } }),
      prisma.comment.create({ data: { content: 'Revue juridique en cours pour le transfert des données (RGPD tunisien).',               taskId: t3.id, authorId: admin.id,        createdAt: new Date('2026-03-08') } }),
    ]);

    console.log('✅ Projects (3), tasks (26), comments');

    // ── Invoices & Payments ───────────────────────────────────────────────
    // Project 1 (COMPLETED) — 3 tranches payées
    const inv1 = await prisma.invoice.create({ data: {
      number: 'INV-2026-001', title: 'Acompte 1/3 — Refonte e-commerce Carrefour', invoiceType: 'DEPOSIT',
      amount: 9500, currency: 'TND', amountPaid: 9500, status: InvoiceStatus.PAID,
      sentAt: new Date('2025-11-05'), paidAt: new Date('2025-11-10'), dueDate: new Date('2025-11-20'),
      clientId: carrefour.id, projectId: project1.id, proposalId: proposal1.id,
      items: { create: [
        { description: 'Phase Design UI/UX — maquettes & prototypes',  quantity: 1, unitPrice: 6000, total: 6000 },
        { description: 'Setup environnement dev/staging AWS',           quantity: 1, unitPrice: 3500, total: 3500 },
      ]},
    }});
    await prisma.payment.create({ data: { invoiceId: inv1.id, amount: 9500, method: 'Virement bancaire', reference: 'VIR-2025-1110', paidAt: new Date('2025-11-10'), recordedById: admin.id } });

    const inv2 = await prisma.invoice.create({ data: {
      number: 'INV-2026-002', title: 'Acompte 2/3 — Refonte e-commerce Carrefour', invoiceType: 'STANDARD',
      amount: 9500, currency: 'TND', amountPaid: 9500, status: InvoiceStatus.PAID,
      sentAt: new Date('2026-02-01'), paidAt: new Date('2026-02-15'), dueDate: new Date('2026-02-28'),
      clientId: carrefour.id, projectId: project1.id,
      items: { create: [
        { description: 'Développement catalogue produits & panier',  quantity: 1, unitPrice: 5500, total: 5500 },
        { description: 'Intégration passerelle paiement Flouci',     quantity: 1, unitPrice: 4000, total: 4000 },
      ]},
    }});
    await prisma.payment.create({ data: { invoiceId: inv2.id, amount: 9500, method: 'Virement bancaire', reference: 'VIR-2026-0215', paidAt: new Date('2026-02-15'), recordedById: admin.id } });

    const inv3 = await prisma.invoice.create({ data: {
      number: 'INV-2026-003', title: 'Solde final — Refonte e-commerce Carrefour', invoiceType: 'BALANCE',
      amount: 9500, currency: 'TND', amountPaid: 9500, status: InvoiceStatus.PAID,
      sentAt: new Date('2026-04-29'), paidAt: new Date('2026-05-05'), dueDate: new Date('2026-05-28'),
      clientId: carrefour.id, projectId: project1.id,
      items: { create: [
        { description: 'Tests, déploiement AWS & formation équipe', quantity: 1, unitPrice: 7000, total: 7000 },
        { description: 'Documentation technique & support 3 mois',  quantity: 1, unitPrice: 2500, total: 2500 },
      ]},
    }});
    await prisma.payment.create({ data: { invoiceId: inv3.id, amount: 9500, method: 'Virement bancaire', reference: 'VIR-2026-0505', paidAt: new Date('2026-05-05'), recordedById: admin.id } });

    // Project 2 (IN_PROGRESS) — acompte payé, deuxième tranche en attente
    const inv4 = await prisma.invoice.create({ data: {
      number: 'INV-2026-004', title: 'Acompte 1/2 — App Mobile Monoprix', invoiceType: 'DEPOSIT',
      amount: 9000, currency: 'TND', amountPaid: 9000, status: InvoiceStatus.PAID,
      sentAt: new Date('2026-01-25'), paidAt: new Date('2026-02-03'), dueDate: new Date('2026-02-15'),
      clientId: monoprix.id, projectId: project2.id, proposalId: proposal2.id,
      items: { create: [
        { description: 'Kickoff, cahier des charges & architecture',  quantity: 1, unitPrice: 3000, total: 3000 },
        { description: 'Design UI/UX — maquettes complètes',          quantity: 1, unitPrice: 6000, total: 6000 },
      ]},
    }});
    await prisma.payment.create({ data: { invoiceId: inv4.id, amount: 9000, method: 'Chèque', reference: 'CHQ-20260203', paidAt: new Date('2026-02-03'), recordedById: admin.id } });

    await prisma.invoice.create({ data: {
      number: 'INV-2026-005', title: 'Acompte 2/2 — App Mobile Monoprix (dev)', invoiceType: 'STANDARD',
      amount: 9000, currency: 'TND', status: InvoiceStatus.SENT,
      sentAt: new Date('2026-05-01'), dueDate: new Date('2026-05-31'),
      clientId: monoprix.id, projectId: project2.id,
      items: { create: [
        { description: 'Développement modules : auth, scan, wallet, notifs', quantity: 1, unitPrice: 9000, total: 9000 },
      ]},
    }});

    // Project 3 (REVIEW) — première tranche payée, solde en retard
    const inv6 = await prisma.invoice.create({ data: {
      number: 'INV-2026-006', title: 'Mission audit ERP — Géant Tunisia (acompte)', invoiceType: 'DEPOSIT',
      amount: 17500, currency: 'TND', amountPaid: 17500, status: InvoiceStatus.PAID,
      sentAt: new Date('2025-12-12'), paidAt: new Date('2025-12-20'), dueDate: new Date('2026-01-05'),
      clientId: geant.id, projectId: project3.id, proposalId: proposal3.id,
      items: { create: [
        { description: 'Audit systèmes & cartographie données (15j)', quantity: 15, unitPrice: 900, total: 13500 },
        { description: 'Frais de déplacement & fournitures',          quantity:  1, unitPrice: 4000, total: 4000 },
      ]},
    }});
    await prisma.payment.create({ data: { invoiceId: inv6.id, amount: 17500, method: 'Virement bancaire', reference: 'VIR-2025-1220', paidAt: new Date('2025-12-20'), recordedById: admin.id } });

    await prisma.invoice.create({ data: {
      number: 'INV-2026-007', title: 'Solde mission audit ERP — Géant Tunisia', invoiceType: 'BALANCE',
      amount: 17500, currency: 'TND', status: InvoiceStatus.OVERDUE,
      sentAt: new Date('2026-03-15'), dueDate: new Date('2026-04-15'),
      clientId: geant.id, projectId: project3.id,
      items: { create: [
        { description: 'Analyse des gaps SAP, plan de migration, rapport final (20j)', quantity: 20, unitPrice: 875, total: 17500 },
      ]},
    }});

    console.log('✅ Invoices (7) + payments (5)');

    // ── Time Entries ──────────────────────────────────────────────────────
    await prisma.timeEntry.createMany({ data: [
      // Project 1 (COMPLETED) — retroactive
      { projectId: project1.id, userId: freelancer2.id, taskId: tasks1[0].id, description: 'Interviews & personas', minutes: 480, date: new Date('2025-11-08') },
      { projectId: project1.id, userId: freelancer2.id, taskId: tasks1[1].id, description: 'Maquettes homepage',    minutes: 720, date: new Date('2025-11-25') },
      { projectId: project1.id, userId: freelancer1.id, taskId: tasks1[3].id, description: 'Schéma BDD & ERD',      minutes: 480, date: new Date('2025-12-12') },
      { projectId: project1.id, userId: freelancer1.id, taskId: tasks1[4].id, description: 'API catalogue',         minutes: 960, date: new Date('2026-01-08') },
      { projectId: project1.id, userId: freelancer1.id, taskId: tasks1[5].id, description: 'Module panier',         minutes: 720, date: new Date('2026-01-22') },
      { projectId: project1.id, userId: freelancer1.id, taskId: tasks1[6].id, description: 'Intégration Flouci',    minutes: 480, date: new Date('2026-02-05') },
      // Project 2 (IN_PROGRESS) — recent
      { projectId: project2.id, userId: freelancer4.id, taskId: tasks2[4].id, description: 'Setup Expo + Bitrise',  minutes: 480, date: new Date('2026-03-12') },
      { projectId: project2.id, userId: freelancer1.id, taskId: tasks2[5].id, description: 'Auth JWT mobile',       minutes: 360, date: new Date('2026-03-18') },
      { projectId: project2.id, userId: freelancer2.id, taskId: tasks2[3].id, description: 'Maquettes HF — lot 1',  minutes: 600, date: new Date('2026-04-14') },
      { projectId: project2.id, userId: freelancer2.id, taskId: tasks2[3].id, description: 'Maquettes HF — lot 2',  minutes: 480, date: new Date('2026-05-02') },
      // Project 3
      { projectId: project3.id, userId: manager2.id,    taskId: tasks3[0].id, description: 'Audit on-site',          minutes: 840, date: new Date('2025-12-15') },
      { projectId: project3.id, userId: freelancer3.id, taskId: tasks3[1].id, description: 'Cartographie flux',      minutes: 720, date: new Date('2025-12-22') },
      { projectId: project3.id, userId: freelancer3.id, taskId: tasks3[3].id, description: 'Scripts ETL Python',     minutes: 600, date: new Date('2026-02-10') },
    ]});
    console.log('✅ Time entries (13)');

    // ── Approvals ──────────────────────────────────────────────────────────
    await Promise.all([
      prisma.approval.create({ data: { title: 'Validation maquettes homepage Carrefour',    description: 'Approbation Figma avant passage en dev.',                status: ApprovalStatus.APPROVED,  clientId: carrefour.id, projectId: project1.id } }),
      prisma.approval.create({ data: { title: 'Validation design system Carrefour',         description: 'Composants et tokens validés par le directeur marketing.', status: ApprovalStatus.APPROVED,  clientId: carrefour.id, projectId: project1.id } }),
      prisma.approval.create({ data: { title: 'Validation wireframes Monoprix (v1)',        description: 'Wireframes BF à approuver avant démarrage des maquettes.', status: ApprovalStatus.APPROVED,  clientId: monoprix.id,  projectId: project2.id } }),
      prisma.approval.create({ data: { title: 'Validation maquettes HF Monoprix (lot 1)', description: '12 écrans livrés, feedback attendu sous 5 jours.',          status: ApprovalStatus.PENDING,   clientId: monoprix.id,  projectId: project2.id } }),
      prisma.approval.create({ data: { title: 'Rapport d\'audit ERP Géant — V1',           description: 'Document de 80 pages à valider en CODIR.',                  status: ApprovalStatus.COMMENTED, clientId: geant.id,     projectId: project3.id } }),
    ]);
    console.log('✅ Approvals (5)');

  } else {
    console.log('Projects already exist, skipping dependent data.');
  }

  // ── Service Requests ──────────────────────────────────────────────────────
  if (!(await skipIf(prisma.serviceRequest, 'Service requests'))) {
    await Promise.all([
      prisma.serviceRequest.create({ data: { title: 'Bug affichage Safari mobile',               description: 'Images produits ne s\'affichent pas sur iPhone 14 (iOS 17).', status: ServiceRequestStatus.IN_PROGRESS,    priority: 'HIGH'   as const, clientId: carrefour.id, type: 'SUPPORT'     as const, assignedToId: manager1.id  } }),
      prisma.serviceRequest.create({ data: { title: 'Export rapport mensuel personnalisé',        description: 'Besoin d\'un export Excel avec filtres par région et catégorie.', status: ServiceRequestStatus.WAITING_CLIENT, priority: 'NORMAL' as const, clientId: monoprix.id,  type: 'SUPPORT'     as const, assignedToId: manager1.id  } }),
      prisma.serviceRequest.create({ data: { title: 'Ajout utilisateur accès back-office',        description: 'Nouveau responsable régional a besoin d\'un accès admin limité.', status: ServiceRequestStatus.COMPLETED,      priority: 'LOW'    as const, clientId: geant.id,     type: 'SUPPORT'     as const, assignedToId: manager2.id  } }),
      prisma.serviceRequest.create({ data: { title: 'Intégration API livraison Aramex',           description: 'Connecter l\'API Aramex pour le suivi des colis en temps réel.',   status: ServiceRequestStatus.NEW,            priority: 'NORMAL' as const, clientId: monoprix.id,  type: 'NEW_PROJECT' as const, assignedToId: manager1.id  } }),
      prisma.serviceRequest.create({ data: { title: 'Audit sécurité RGPD plateforme Vermeg',     description: 'Audit conformité RGPD demandé par le DPO avant lancement prod.',   status: ServiceRequestStatus.IN_REVIEW,      priority: 'HIGH'   as const, clientId: vermeg.id,    type: 'SUPPORT'     as const, assignedToId: manager2.id  } }),
    ]);
    console.log('✅ Service requests (5)');
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  if (!(await skipIf(prisma.notification, 'Notifications'))) {
    await prisma.notification.createMany({ data: [
      { userId: admin.id,       title: 'Projet Carrefour livré ✅',         message: 'Le projet e-commerce Carrefour Tunisia a été approuvé par le client.',     read: true,  type: NotificationType.PROJECT_STATUS_CHANGED,  link: '/app/projects' },
      { userId: admin.id,       title: 'Facture en retard — Géant',        message: 'La facture INV-2026-007 (17 500 TND) est en retard de paiement.',           read: false, type: NotificationType.INVOICE_OVERDUE,          link: '/app/commercial?tab=invoices' },
      { userId: admin.id,       title: 'Proposition envoyée — Vermeg',     message: 'La proposition "IA scoring crédit" a été envoyée à Vermeg Digital.',        read: true,  type: NotificationType.PROPOSAL_SENT,            link: '/app/commercial?tab=proposals' },
      { userId: admin.id,       title: 'Approbation en attente',           message: 'Monoprix attend la validation des maquettes HF (lot 1).',                   read: false, type: NotificationType.APPROVAL_REQUESTED,       link: '/app/commercial?tab=approvals' },
      { userId: manager1.id,    title: 'Nouvelle tâche assignée',          message: 'Vous avez été assigné à "Validation wireframes app mobile Monoprix".',      read: false, type: NotificationType.TASK_ASSIGNED,            link: '/app/projects' },
      { userId: manager1.id,    title: 'Demande de service urgente',       message: 'Carrefour a ouvert un ticket HIGH : "Bug affichage Safari mobile".',         read: true,  type: NotificationType.SERVICE_REQUEST_CREATED,  link: '/app/commercial?tab=service-requests' },
      { userId: manager2.id,    title: 'Rapport audit en attente review',  message: 'Le rapport d\'audit ERP Géant est en cours de validation CODIR.',           read: false, type: NotificationType.APPROVAL_REQUESTED,       link: '/app/commercial?tab=approvals' },
      { userId: clientUser1.id, title: 'Votre projet est livré ! 🎉',      message: 'La refonte e-commerce Carrefour Tunisia est terminée. Merci pour votre confiance.', read: true, type: NotificationType.PROJECT_STATUS_CHANGED, link: '/client/projects' },
      { userId: clientUser2.id, title: 'Nouvelle facture disponible',      message: 'La facture INV-2026-005 (9 000 TND) est disponible dans votre espace.',     read: false, type: NotificationType.INVOICE_SENT,             link: '/client/invoices' },
      { userId: clientUser3.id, title: 'Brief projet reçu',                message: 'Nous avons reçu votre brief. Votre chef de projet vous contacte sous 24h.', read: true,  type: NotificationType.BRIEF_COMPLETED,          link: '/client/projects' },
    ]});
    console.log('✅ Notifications (10)');
  }

  // ── Permission Profiles ───────────────────────────────────────────────────
  if (!(await skipIf(prisma.permissionProfile, 'Permission profiles'))) {
    const FULL        = { read: true,  create: true,  update: true,  delete: true  };
    const READ_UPDATE = { read: true,  create: false, update: true,  delete: false };
    const READ        = { read: true,  create: false, update: false, delete: false };
    const NONE        = { read: false, create: false, update: false, delete: false };

    await Promise.all([
      prisma.permissionProfile.create({ data: { name: 'Opérations',  description: 'Accès complet projets, tâches, freelances',    permissions: { projects: FULL,        tasks: FULL,        freelancers: READ_UPDATE, clients: NONE,  leads: NONE,  invoices: NONE,  analytics: NONE,  approvals: READ_UPDATE, documents: FULL  } } }),
      prisma.permissionProfile.create({ data: { name: 'Commercial',  description: 'Accès leads, clients, propositions, factures',  permissions: { projects: READ,        tasks: NONE,        freelancers: NONE,         clients: FULL,  leads: FULL,  invoices: READ,  analytics: READ,  approvals: NONE,        documents: NONE  } } }),
      prisma.permissionProfile.create({ data: { name: 'Technique',   description: 'Accès projets, tâches, documents',             permissions: { projects: READ_UPDATE, tasks: FULL,        freelancers: NONE,         clients: NONE,  leads: NONE,  invoices: NONE,  analytics: NONE,  approvals: READ_UPDATE, documents: FULL  } } }),
      prisma.permissionProfile.create({ data: { name: 'Analytique',  description: 'Lecture seule — analytics et reporting',       permissions: { projects: READ,        tasks: READ,        freelancers: READ,          clients: READ,  leads: READ,  invoices: READ,  analytics: FULL,  approvals: NONE,        documents: READ  } } }),
    ]);
    console.log('✅ Permission profiles (4)');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════');
  // ── Site Content defaults (bilingual: FR + EN) ────────────────────────────
  type SiteContentEntry = {
    key: string;
    locale: string;
    value: string;
    type: 'TEXT' | 'RICHTEXT' | 'IMAGE' | 'BOOLEAN';
    section: 'HERO' | 'SERVICES' | 'ABOUT' | 'TESTIMONIALS' | 'CONTACT' | 'SEO';
    label: string;
  };

  const siteContentDefaults: SiteContentEntry[] = [
    // ── HERO — EN ──────────────────────────────────────────────────────────
    { locale:'en', key:'hero.tagline',            section:'HERO',     type:'TEXT',    label:'Hero tagline (badge)',         value:'Management · Marketing · Technology' },
    { locale:'en', key:'hero.title.0',            section:'HERO',     type:'TEXT',    label:'Hero title — part 1',          value:'The partner who' },
    { locale:'en', key:'hero.title.1',            section:'HERO',     type:'TEXT',    label:'Hero title — highlighted',     value:'structures, digitizes and grows' },
    { locale:'en', key:'hero.title.2',            section:'HERO',     type:'TEXT',    label:'Hero title — part 3',          value:'your business.' },
    { locale:'en', key:'hero.description',        section:'HERO',     type:'TEXT',    label:'Hero description',             value:'We help SMEs, startuppers and brands organize, digitize and grow : through strategy, technology, marketing and data-driven decision making.' },
    { locale:'en', key:'hero.cta.primary',        section:'HERO',     type:'TEXT',    label:'Primary CTA button',           value:'Book a free consultation' },
    { locale:'en', key:'hero.cta.secondary',      section:'HERO',     type:'TEXT',    label:'Secondary CTA button',         value:'Explore our services' },
    // ── HERO — FR ──────────────────────────────────────────────────────────
    { locale:'fr', key:'hero.tagline',            section:'HERO',     type:'TEXT',    label:'Hero tagline (badge)',         value:'Management · Marketing · Technologie' },
    { locale:'fr', key:'hero.title.0',            section:'HERO',     type:'TEXT',    label:'Hero title — partie 1',        value:'Le partenaire qui' },
    { locale:'fr', key:'hero.title.1',            section:'HERO',     type:'TEXT',    label:'Hero title — en évidence',     value:'structure, digitalise et fait grandir' },
    { locale:'fr', key:'hero.title.2',            section:'HERO',     type:'TEXT',    label:'Hero title — partie 3',        value:'votre entreprise.' },
    { locale:'fr', key:'hero.description',        section:'HERO',     type:'TEXT',    label:'Hero description',             value:'Nous aidons les PME, les startuppers et les créateurs à s\'organiser, à se digitaliser et à croître : grâce à la stratégie, la technologie, le marketing et la prise de décision basée sur les données.' },
    { locale:'fr', key:'hero.cta.primary',        section:'HERO',     type:'TEXT',    label:'Bouton CTA principal',         value:'Réserver une consultation gratuite' },
    { locale:'fr', key:'hero.cta.secondary',      section:'HERO',     type:'TEXT',    label:'Bouton CTA secondaire',        value:'Voir nos services' },

    // ── SERVICES — EN ──────────────────────────────────────────────────────
    { locale:'en', key:'services.subtitle',       section:'SERVICES', type:'TEXT',    label:'Services subtitle',            value:"Here's how we solve them" },
    { locale:'en', key:'services.title',          section:'SERVICES', type:'TEXT',    label:'Services title',               value:'One partner : Multiple growth solutions' },
    { locale:'en', key:'services.items.0.title',  section:'SERVICES', type:'TEXT',    label:'Service 1 title',              value:'Management & Performance' },
    { locale:'en', key:'services.items.0.body',   section:'SERVICES', type:'TEXT',    label:'Service 1 description',        value:'KPI tracking, dashboards, objectives and business analytics : finally one place for the numbers that matter.' },
    { locale:'en', key:'services.items.1.title',  section:'SERVICES', type:'TEXT',    label:'Service 2 title',              value:'Digital Growth' },
    { locale:'en', key:'services.items.1.body',   section:'SERVICES', type:'TEXT',    label:'Service 2 description',        value:'Social media, content, SEO and paid acquisition : coordinated to compound, not to spread thin.' },
    { locale:'en', key:'services.items.2.title',  section:'SERVICES', type:'TEXT',    label:'Service 3 title',              value:'Technology' },
    { locale:'en', key:'services.items.2.body',   section:'SERVICES', type:'TEXT',    label:'Service 3 description',        value:'Websites, e-commerce, inventory systems and the digital tools you need to operate at the next level.' },
    { locale:'en', key:'services.items.3.title',  section:'SERVICES', type:'TEXT',    label:'Service 4 title',              value:'AI & Automation' },
    { locale:'en', key:'services.items.3.body',   section:'SERVICES', type:'TEXT',    label:'Service 4 description',        value:'AI chatbots, workflow automation and AI assistants that compress hours of busywork into seconds.' },
    // ── SERVICES — FR ──────────────────────────────────────────────────────
    { locale:'fr', key:'services.subtitle',       section:'SERVICES', type:'TEXT',    label:'Sous-titre services',          value:'Voici comment nous résolvons les problèmes' },
    { locale:'fr', key:'services.title',          section:'SERVICES', type:'TEXT',    label:'Titre services',               value:'Un partenaire : Plusieurs solutions de croissance' },
    { locale:'fr', key:'services.items.0.title',  section:'SERVICES', type:'TEXT',    label:'Service 1 titre',              value:'Management & Performance' },
    { locale:'fr', key:'services.items.0.body',   section:'SERVICES', type:'TEXT',    label:'Service 1 description',        value:'Suivi des KPI, tableaux de bord, objectifs et analyses commerciales : enfin un seul endroit pour les chiffres qui comptent.' },
    { locale:'fr', key:'services.items.1.title',  section:'SERVICES', type:'TEXT',    label:'Service 2 titre',              value:'Croissance digitale' },
    { locale:'fr', key:'services.items.1.body',   section:'SERVICES', type:'TEXT',    label:'Service 2 description',        value:'Réseaux sociaux, contenu, SEO et acquisition payante : coordonnés pour se cumuler, pas pour s\'éparpiller.' },
    { locale:'fr', key:'services.items.2.title',  section:'SERVICES', type:'TEXT',    label:'Service 3 titre',              value:'Technologie' },
    { locale:'fr', key:'services.items.2.body',   section:'SERVICES', type:'TEXT',    label:'Service 3 description',        value:'Sites web, e-commerce, systèmes d\'inventaire et les outils digitaux dont vous avez besoin pour opérer au niveau supérieur.' },
    { locale:'fr', key:'services.items.3.title',  section:'SERVICES', type:'TEXT',    label:'Service 4 titre',              value:'IA & Automatisation' },
    { locale:'fr', key:'services.items.3.body',   section:'SERVICES', type:'TEXT',    label:'Service 4 description',        value:'Chatbots IA, automatisation des flux de travail et assistants IA qui compressent des heures de travail fastidieux en quelques secondes.' },

    // ── CONTACT — EN ───────────────────────────────────────────────────────
    { locale:'en', key:'contact.title',           section:'CONTACT',  type:'TEXT',    label:'Contact page title',           value:"Let's talk about your growth." },
    { locale:'en', key:'contact.subtitle',        section:'CONTACT',  type:'TEXT',    label:'Contact page subtitle',        value:"30 minutes. No slides, no pitch. Just a conversation about where you are, where you want to be, and what's standing in the way." },
    { locale:'en', key:'contact.email',           section:'CONTACT',  type:'TEXT',    label:'Contact email',                value:'hello@secritou.com' },
    { locale:'en', key:'contact.location',        section:'CONTACT',  type:'TEXT',    label:'Location text',                value:'Tunis · Remote across Tunisia.' },
    { locale:'en', key:'contact.replyTime',       section:'CONTACT',  type:'TEXT',    label:'Reply time note',              value:'We typically reply within one business day.' },
    // ── CONTACT — FR ───────────────────────────────────────────────────────
    { locale:'fr', key:'contact.title',           section:'CONTACT',  type:'TEXT',    label:'Titre page contact',           value:'Parlons de votre croissance.' },
    { locale:'fr', key:'contact.subtitle',        section:'CONTACT',  type:'TEXT',    label:'Sous-titre page contact',      value:'30 minutes. Pas de slides, pas de pitch. Juste une conversation sur où vous en êtes, où vous voulez aller, et ce qui vous en empêche.' },
    { locale:'fr', key:'contact.email',           section:'CONTACT',  type:'TEXT',    label:'Email de contact',             value:'hello@secritou.com' },
    { locale:'fr', key:'contact.location',        section:'CONTACT',  type:'TEXT',    label:'Texte localisation',           value:'Tunis · À distance partout en Tunisie.' },
    { locale:'fr', key:'contact.replyTime',       section:'CONTACT',  type:'TEXT',    label:'Délai de réponse',             value:'Nous répondons généralement dans un délai d\'un jour ouvrable.' },

    // ── SEO — EN ───────────────────────────────────────────────────────────
    { locale:'en', key:'seo.title',               section:'SEO',      type:'TEXT',    label:'Page title (SEO)',             value:'Secritou — Management · Marketing · Technology' },
    { locale:'en', key:'seo.description',         section:'SEO',      type:'TEXT',    label:'Meta description (SEO)',       value:'We help Tunisian SMEs organize, digitize and grow through strategy, technology, marketing and data.' },
    // ── SEO — FR ───────────────────────────────────────────────────────────
    { locale:'fr', key:'seo.title',               section:'SEO',      type:'TEXT',    label:'Titre de page (SEO)',          value:'Secritou — Management · Marketing · Technologie' },
    { locale:'fr', key:'seo.description',         section:'SEO',      type:'TEXT',    label:'Meta description (SEO)',       value:'Nous aidons les PME tunisiennes à s\'organiser, à se digitaliser et à croître grâce à la stratégie, la technologie, le marketing et les données.' },

    // ── PACKS — EN ─────────────────────────────────────────────────────────
    { locale:'en', key:'packs.badge',             section:'SERVICES', type:'TEXT',    label:'Packs section badge',          value:'Our offers' },
    { locale:'en', key:'packs.title',             section:'SERVICES', type:'TEXT',    label:'Packs section title',          value:'Simple, transparent pricing' },
    { locale:'en', key:'packs.subtitle',          section:'SERVICES', type:'TEXT',    label:'Packs section subtitle',       value:'Choose the pack that fits your ambition. All packs include a free 30-min kickoff.' },
    { locale:'en', key:'packs.items.0.name',      section:'SERVICES', type:'TEXT',    label:'Pack 1 name',                  value:'Starter' },
    { locale:'en', key:'packs.items.0.price',     section:'SERVICES', type:'TEXT',    label:'Pack 1 price',                 value:'990 TND / month' },
    { locale:'en', key:'packs.items.0.description', section:'SERVICES', type:'TEXT',  label:'Pack 1 description',           value:'For businesses taking their first structured steps.' },
    { locale:'en', key:'packs.items.0.features',  section:'SERVICES', type:'RICHTEXT',label:'Pack 1 features (one per line)', value:'1 active workstream\nMonthly KPI dashboard\nEmail & WhatsApp support\n30-min monthly review' },
    { locale:'en', key:'packs.items.1.name',      section:'SERVICES', type:'TEXT',    label:'Pack 2 name',                  value:'Growth' },
    { locale:'en', key:'packs.items.1.price',     section:'SERVICES', type:'TEXT',    label:'Pack 2 price',                 value:'2 490 TND / month' },
    { locale:'en', key:'packs.items.1.description', section:'SERVICES', type:'TEXT',  label:'Pack 2 description',           value:'For businesses ready to scale with a full-service partner.' },
    { locale:'en', key:'packs.items.1.features',  section:'SERVICES', type:'RICHTEXT',label:'Pack 2 features (one per line)', value:'Up to 3 active workstreams\nWeekly KPI dashboard\nPriority support (< 4h)\nBi-weekly strategy session\nOne custom automation included' },
    { locale:'en', key:'packs.items.2.name',      section:'SERVICES', type:'TEXT',    label:'Pack 3 name',                  value:'Transform' },
    { locale:'en', key:'packs.items.2.price',     section:'SERVICES', type:'TEXT',    label:'Pack 3 price',                 value:'Custom quote' },
    { locale:'en', key:'packs.items.2.description', section:'SERVICES', type:'TEXT',  label:'Pack 3 description',           value:'Custom engagements for ambitious projects and full digital transformation.' },
    { locale:'en', key:'packs.items.2.features',  section:'SERVICES', type:'RICHTEXT',label:'Pack 3 features (one per line)', value:'Unlimited workstreams\nDedicated project manager\n24/7 priority support\nMonthly CODIR presentation\nFull automation & AI stack' },

    // ── PACKS — FR ─────────────────────────────────────────────────────────
    { locale:'fr', key:'packs.badge',             section:'SERVICES', type:'TEXT',    label:'Badge section offres',         value:'Nos offres' },
    { locale:'fr', key:'packs.title',             section:'SERVICES', type:'TEXT',    label:'Titre section offres',         value:'Des tarifs simples et transparents' },
    { locale:'fr', key:'packs.subtitle',          section:'SERVICES', type:'TEXT',    label:'Sous-titre section offres',    value:'Choisissez le pack adapté à votre ambition. Tous les packs incluent un kickoff gratuit de 30 min.' },
    { locale:'fr', key:'packs.items.0.name',      section:'SERVICES', type:'TEXT',    label:'Pack 1 nom',                   value:'Starter' },
    { locale:'fr', key:'packs.items.0.price',     section:'SERVICES', type:'TEXT',    label:'Pack 1 prix',                  value:'990 TND / mois' },
    { locale:'fr', key:'packs.items.0.description', section:'SERVICES', type:'TEXT',  label:'Pack 1 description',           value:'Pour les entreprises qui font leurs premiers pas structurés.' },
    { locale:'fr', key:'packs.items.0.features',  section:'SERVICES', type:'RICHTEXT',label:'Pack 1 fonctionnalités (une par ligne)', value:'1 chantier actif\nTableau de bord KPI mensuel\nSupport email & WhatsApp\nRevue mensuelle de 30 min' },
    { locale:'fr', key:'packs.items.1.name',      section:'SERVICES', type:'TEXT',    label:'Pack 2 nom',                   value:'Croissance' },
    { locale:'fr', key:'packs.items.1.price',     section:'SERVICES', type:'TEXT',    label:'Pack 2 prix',                  value:'2 490 TND / mois' },
    { locale:'fr', key:'packs.items.1.description', section:'SERVICES', type:'TEXT',  label:'Pack 2 description',           value:'Pour les entreprises prêtes à passer à l\'échelle avec un partenaire complet.' },
    { locale:'fr', key:'packs.items.1.features',  section:'SERVICES', type:'RICHTEXT',label:'Pack 2 fonctionnalités (une par ligne)', value:'Jusqu\'à 3 chantiers actifs\nTableau de bord KPI hebdomadaire\nSupport prioritaire (< 4h)\nSession stratégie bi-mensuelle\nUne automatisation sur mesure incluse' },
    { locale:'fr', key:'packs.items.2.name',      section:'SERVICES', type:'TEXT',    label:'Pack 3 nom',                   value:'Transformation' },
    { locale:'fr', key:'packs.items.2.price',     section:'SERVICES', type:'TEXT',    label:'Pack 3 prix',                  value:'Sur devis' },
    { locale:'fr', key:'packs.items.2.description', section:'SERVICES', type:'TEXT',  label:'Pack 3 description',           value:'Engagements sur mesure pour projets ambitieux et transformation digitale complète.' },
    { locale:'fr', key:'packs.items.2.features',  section:'SERVICES', type:'RICHTEXT',label:'Pack 3 fonctionnalités (une par ligne)', value:'Chantiers illimités\nChef de projet dédié\nSupport prioritaire 24/7\nPrésentation CODIR mensuelle\nStack complet IA & automatisation' },
  ];

  let siteContentCreated = 0;
  for (const item of siteContentDefaults) {
    await prisma.siteContent.upsert({
      where: { key_locale: { key: item.key, locale: item.locale } },
      update: {},
      create: item,
    });
    siteContentCreated++;
  }
  console.log(`✅ Site Content: ${siteContentCreated} bilingual entries seeded (FR + EN)`);

  console.log('  ✅  Database seeded successfully — Secritou v2');
  console.log('══════════════════════════════════════════════════════');
  console.log('\n  Credentials');
  console.log('  ─────────────────────────────────────────────────────');
  console.log('  Admin         admin@secritou.tn           admin123');
  console.log('  Manager 1     manager@secritou.tn         manager123');
  console.log('  Manager 2     manager2@secritou.tn        manager123');
  console.log('  Client 1      client1@example.tn  (Carrefour)   client123');
  console.log('  Client 2      client2@example.tn  (Monoprix)    client123');
  console.log('  Client 3      client3@example.tn  (Géant)       client123');
  console.log('  Client 4      client4@example.tn  (Vermeg)      client123');
  console.log('  Freelancer 1  yassine.dev@freelance.tn    freelancer123');
  console.log('  Freelancer 2  ines.design@freelance.tn    freelancer123');
  console.log('  Freelancer 3  omar.data@freelance.tn      freelancer123');
  console.log('  Freelancer 4  salma.mobile@freelance.tn   freelancer123');
  console.log('  ─────────────────────────────────────────────────────\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
