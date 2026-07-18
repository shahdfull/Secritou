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
  CommissionStatus,
  OnboardingStepStatus,
  DocumentType,
  DocumentAccessLevel,
  RecommendationPriority,
  RecommendationStatus,
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
    create: {
      id: COMPANY_ID,
      name: 'Secritou',
      website: 'https://secritou.tn',
      // Placeholder — replace with the agency's real matricule fiscal before issuing production invoices.
      matriculeFiscal: '0000000A/A/M/000',
      address: 'Tunis, Tunisie',
    },
  });
  console.log('✅ Company:', company.name);

  // ── Services ──────────────────────────────────────────────────────────────
  const svcNames = ['Management & Performance', 'Croissance digitale', 'Technologie', 'IA & Automatisation'];
  const svc: Record<string, string> = {};
  for (const name of svcNames) {
    const s = await prisma.service.upsert({ where: { name }, update: {}, create: { name } });
    svc[name] = s.id;
  }
  console.log('✅ Services:', svcNames.join(', '));

  // ── Project templates (one per pole, seeded as a starter checklist) ────────
  const projectTemplates: Record<string, { name: string; tasks: string[] }> = {
    'Management & Performance': {
      name: 'Audit & pilotage — standard',
      tasks: ['Cadrage de l\'audit', 'Collecte des données existantes', 'Analyse des KPI actuels', 'Restitution & recommandations', 'Mise en place du reporting'],
    },
    'Croissance digitale': {
      name: 'Marketing — lancement de campagne',
      tasks: ['Audit des canaux existants', 'Définition de la stratégie', 'Création des contenus', 'Lancement de la campagne', 'Suivi & optimisation'],
    },
    'Technologie': {
      name: 'Site web — standard',
      tasks: ['Brief & charte graphique', 'Maquettes (wireframes)', 'Intégration front-end', 'Développement back-end', 'Recette & mise en ligne'],
    },
    'IA & Automatisation': {
      name: 'Automatisation — standard',
      tasks: ['Cadrage du besoin', 'Audit des outils existants', 'Conception du workflow', 'Développement & intégration', 'Tests & mise en production'],
    },
  };
  for (const [serviceName, tpl] of Object.entries(projectTemplates)) {
    const serviceId = svc[serviceName];
    if (!serviceId) continue;
    const template = await prisma.projectTemplate.upsert({
      where: { serviceId },
      update: {},
      create: { serviceId, name: tpl.name },
    });
    const existingCount = await prisma.taskTemplate.count({ where: { templateId: template.id } });
    if (existingCount === 0) {
      await prisma.taskTemplate.createMany({
        data: tpl.tasks.map((title, i) => ({ templateId: template.id, title, orderIndex: i })),
      });
    }
  }
  console.log('✅ Project templates: 1 per pole');

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

  // ── Demo data gate ────────────────────────────────────────────────────────
  // Everything between here and the Permission Profiles section is demo/fixture
  // data (Carrefour, Monoprix, Géant, Vermeg, sample projects/invoices/tasks).
  // Set SEED_DEMO=false to get a production-ready seed: company, services,
  // admin account, permission profiles and site content only.
  const seedDemo = process.env.SEED_DEMO !== 'false';
  if (!seedDemo) console.log('⏭️  SEED_DEMO=false — skipping demo data (clients, projects, invoices...)');

  if (seedDemo) {
  const manager1 = await prisma.user.upsert({
    where: { email: 'manager@secritou.tn' },
    update: {},
    create: { email: 'manager@secritou.tn', name: 'Sarra Mansouri', passwordHash: mgrHash, role: Role.MANAGER, serviceId: svc['Croissance digitale'] },
  });

  const manager2 = await prisma.user.upsert({
    where: { email: 'manager2@secritou.tn' },
    update: {},
    create: { email: 'manager2@secritou.tn', name: 'Karim Jebali', passwordHash: mgrHash, role: Role.MANAGER, serviceId: svc['Technologie'] },
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
  const [clientUser1, clientUser2, clientUser3, _clientUser4] = await Promise.all(
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
        serviceId: svc['Croissance digitale'],
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
        serviceId: svc['Croissance digitale'],
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
        serviceId: svc['Technologie'],
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

  // ── Billing, Onboarding, Client Success & Documents (demo enrichment) ──────
  // Re-fetches the entities created above by their unique/stable identifiers rather
  // than relying on the const bindings above (which are scoped to the `if` block that
  // created Projects) — this section runs standalone and is idempotent via skipIf.
  {
    const [carrefour, monoprix, geant, vermeg] = await Promise.all([
      prisma.client.findFirstOrThrow({ where: { email: 'contact@carrefour.tn' } }),
      prisma.client.findFirstOrThrow({ where: { email: 'info@monoprix.tn' } }),
      prisma.client.findFirstOrThrow({ where: { email: 'contact@geant.tn' } }),
      prisma.client.findFirstOrThrow({ where: { email: 'contact@vermeg.tn' } }),
    ]);
    const [project1, project2, project3] = await Promise.all([
      prisma.project.findFirstOrThrow({ where: { name: 'E-commerce Carrefour Tunisia' } }),
      prisma.project.findFirstOrThrow({ where: { name: 'App Mobile Monoprix Tunisia' } }),
      prisma.project.findFirstOrThrow({ where: { name: 'Intégration ERP Géant Tunisia' } }),
    ]);
    const [inv1, inv2, inv3, inv4, inv5, inv6, inv7] = await Promise.all([
      prisma.invoice.findUniqueOrThrow({ where: { number: 'INV-2026-001' } }),
      prisma.invoice.findUniqueOrThrow({ where: { number: 'INV-2026-002' } }),
      prisma.invoice.findUniqueOrThrow({ where: { number: 'INV-2026-003' } }),
      prisma.invoice.findUniqueOrThrow({ where: { number: 'INV-2026-004' } }),
      prisma.invoice.findUniqueOrThrow({ where: { number: 'INV-2026-005' } }),
      prisma.invoice.findUniqueOrThrow({ where: { number: 'INV-2026-006' } }),
      prisma.invoice.findUniqueOrThrow({ where: { number: 'INV-2026-007' } }),
    ]);
    const [pay1, pay2, pay3, pay4, pay6] = await Promise.all([
      prisma.payment.findFirstOrThrow({ where: { reference: 'VIR-2025-1110' } }),
      prisma.payment.findFirstOrThrow({ where: { reference: 'VIR-2026-0215' } }),
      prisma.payment.findFirstOrThrow({ where: { reference: 'VIR-2026-0505' } }),
      prisma.payment.findFirstOrThrow({ where: { reference: 'CHQ-20260203' } }),
      prisma.payment.findFirstOrThrow({ where: { reference: 'VIR-2025-1220' } }),
    ]);
    const approvalGeant = await prisma.approval.findFirstOrThrow({ where: { title: { contains: 'Rapport d\'audit ERP Géant' } } });
    const approvalCarrefourHomepage = await prisma.approval.findFirstOrThrow({ where: { title: 'Validation maquettes homepage Carrefour' } });
    const approvalMonoprixHF = await prisma.approval.findFirstOrThrow({ where: { title: 'Validation maquettes HF Monoprix (lot 1)' } });
    const admin2 = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@secritou.tn' } });
    const manager1b = await prisma.user.findUniqueOrThrow({ where: { email: 'manager@secritou.tn' } });
    const manager2b = await prisma.user.findUniqueOrThrow({ where: { email: 'manager2@secritou.tn' } });
    const clientUser1b = await prisma.user.findUniqueOrThrow({ where: { email: 'client1@example.tn' } });
    const clientUser2b = await prisma.user.findUniqueOrThrow({ where: { email: 'client2@example.tn' } });
    const clientUser3b = await prisma.user.findUniqueOrThrow({ where: { email: 'client3@example.tn' } });

    // ── Commission splits + Commissions ──────────────────────────────────────
    // Two partners (admin + a manager) share revenue per project. Splits are set once
    // per project; Commission rows are derived per payment already recorded above,
    // mirroring commissionService.computeForPaymentTx (basis = amount received,
    // amount = basis * ratePct / 100).
    if (!(await skipIf(prisma.projectCommissionSplit, 'Commission splits'))) {
      await prisma.projectCommissionSplit.createMany({ data: [
        { projectId: project1.id, partnerId: admin2.id,    ratePct: 60 },
        { projectId: project1.id, partnerId: manager1b.id, ratePct: 40 },
        { projectId: project2.id, partnerId: admin2.id,    ratePct: 70 },
        { projectId: project2.id, partnerId: manager1b.id, ratePct: 30 },
        { projectId: project3.id, partnerId: admin2.id,    ratePct: 50 },
        { projectId: project3.id, partnerId: manager2b.id, ratePct: 50 },
      ]});
      console.log('✅ Commission splits (6)');
    }

    // Note: Commission.paymentId is @unique — exactly one Commission row per Payment
    // (not one per partner per payment). Since each project has two partners sharing
    // revenue, we attribute each payment's commission to a single partner, alternating
    // across payments of the same project so both partners end up with commissions
    // over the project's lifetime, each still computed at that partner's own ratePct.
    if (!(await skipIf(prisma.commission, 'Commissions'))) {
      const commissionRows: { partnerId: string; projectId: string; invoiceId: string; paymentId: string; basis: number; ratePct: number; amount: number; status: CommissionStatus; paidAt?: Date }[] = [
        // Project 1 (Carrefour) — 60/40 split, alternating attribution across the 3 tranches
        { partnerId: admin2.id,    projectId: project1.id, invoiceId: inv1.id, paymentId: pay1.id, basis: 9500, ratePct: 60, amount: 5700, status: CommissionStatus.PAID, paidAt: new Date('2025-11-20') },
        { partnerId: manager1b.id, projectId: project1.id, invoiceId: inv2.id, paymentId: pay2.id, basis: 9500, ratePct: 40, amount: 3800, status: CommissionStatus.PAID, paidAt: new Date('2026-02-25') },
        { partnerId: admin2.id,    projectId: project1.id, invoiceId: inv3.id, paymentId: pay3.id, basis: 9500, ratePct: 60, amount: 5700, status: CommissionStatus.PENDING },
        // Project 2 (Monoprix) — 70/30 split, only the deposit collected so far
        { partnerId: admin2.id,    projectId: project2.id, invoiceId: inv4.id, paymentId: pay4.id, basis: 9000, ratePct: 70, amount: 6300, status: CommissionStatus.PAID, paidAt: new Date('2026-02-10') },
        // Project 3 (Géant) — 50/50 split, deposit collected, balance overdue (no commission yet)
        { partnerId: manager2b.id, projectId: project3.id, invoiceId: inv6.id, paymentId: pay6.id, basis: 17500, ratePct: 50, amount: 8750, status: CommissionStatus.PENDING },
      ];
      for (const row of commissionRows) {
        await prisma.commission.create({ data: row });
      }
      console.log(`✅ Commissions (${commissionRows.length})`);
    }

    // ── Invoice reminders ─────────────────────────────────────────────────────
    if (!(await skipIf(prisma.invoiceReminder, 'Invoice reminders'))) {
      await prisma.invoiceReminder.createMany({ data: [
        { invoiceId: inv5.id, type: 'UPCOMING_DUE', sentAt: new Date('2026-05-24') },
        { invoiceId: inv7.id, type: 'OVERDUE_FIRST', sentAt: new Date('2026-04-16') },
        { invoiceId: inv7.id, type: 'OVERDUE_SECOND', sentAt: new Date('2026-05-01') },
        { invoiceId: inv7.id, type: 'OVERDUE_FINAL', sentAt: new Date('2026-06-01') },
      ]});
      console.log('✅ Invoice reminders (4)');
    }

    // ── Credit notes ──────────────────────────────────────────────────────────
    // Monoprix overpaid the deposit invoice slightly (bank fee rounding on their side);
    // a credit note was issued and later applied against invoice 5's balance.
    if (!(await skipIf(prisma.creditNote, 'Credit notes'))) {
      const cn1 = await prisma.creditNote.create({ data: {
        number: 'CN-2026-001', amount: 150, reason: 'Trop-perçu suite à un écart de change sur le virement du 03/02/2026.',
        invoiceId: inv4.id, clientId: monoprix.id, appliedAt: new Date('2026-05-10'), appliedToInvoiceId: inv5.id,
      }});
      const cn2 = await prisma.creditNote.create({ data: {
        number: 'CN-2026-002', amount: 500, reason: 'Avoir commercial suite au retard de livraison des maquettes (lot 1).',
        invoiceId: inv6.id, clientId: geant.id,
      }});
      console.log(`✅ Credit notes (2: ${cn1.number}, ${cn2.number})`);
    }

    // ── Client onboarding pipeline ────────────────────────────────────────────
    // 8-step sequence mirrors clientOnboardingService.createOnboarding's defaultSteps.
    // Project 1 (Carrefour) is fully COMPLETED — all steps done, all sub-records filled.
    // Project 2 (Monoprix) is IN_PROGRESS — production under way, delivery not yet reached.
    // Project 3 (Géant) is REVIEW — early steps done, still waiting on kickoff.
    if (!(await skipIf(prisma.clientOnboarding, 'Client onboardings'))) {
      const onboarding1 = await prisma.clientOnboarding.create({ data: {
        projectId: project1.id, clientId: carrefour.id, assignedUserId: manager1b.id,
        steps: { create: [
          { stepType: 'welcome',       title: 'Projet confirmé',        orderIndex: 0, status: OnboardingStepStatus.COMPLETED, deadline: new Date('2025-11-06'), completedAt: new Date('2025-11-05') },
          { stepType: 'contract',      title: 'Contrat',                 orderIndex: 1, status: OnboardingStepStatus.COMPLETED, deadline: new Date('2025-11-10'), completedAt: new Date('2025-11-08') },
          { stepType: 'payment',       title: 'Paiement',                orderIndex: 2, status: OnboardingStepStatus.COMPLETED, deadline: new Date('2025-11-20'), completedAt: new Date('2025-11-10') },
          { stepType: 'questionnaire', title: 'Questionnaire',           orderIndex: 3, status: OnboardingStepStatus.COMPLETED, deadline: new Date('2025-11-15'), completedAt: new Date('2025-11-14') },
          { stepType: 'specifications', title: 'Cahier des charges',     orderIndex: 4, status: OnboardingStepStatus.COMPLETED, deadline: new Date('2025-11-22'), completedAt: new Date('2025-11-20') },
          { stepType: 'kickoff',       title: 'Réunion de lancement',     orderIndex: 5, status: OnboardingStepStatus.COMPLETED, deadline: new Date('2025-11-25'), completedAt: new Date('2025-11-24') },
          { stepType: 'production',   title: 'Production',              orderIndex: 6, status: OnboardingStepStatus.COMPLETED, deadline: new Date('2026-04-15'), completedAt: new Date('2026-04-10') },
          { stepType: 'delivery',     title: 'Livraison',                orderIndex: 7, status: OnboardingStepStatus.COMPLETED, deadline: new Date('2026-04-30'), completedAt: new Date('2026-04-28') },
        ]},
      }, include: { steps: true } });

      const onboarding2 = await prisma.clientOnboarding.create({ data: {
        projectId: project2.id, clientId: monoprix.id, assignedUserId: manager1b.id,
        steps: { create: [
          { stepType: 'welcome',       title: 'Projet confirmé',        orderIndex: 0, status: OnboardingStepStatus.COMPLETED, deadline: new Date('2026-01-26'), completedAt: new Date('2026-01-25') },
          { stepType: 'contract',      title: 'Contrat',                 orderIndex: 1, status: OnboardingStepStatus.COMPLETED, deadline: new Date('2026-01-31'), completedAt: new Date('2026-01-29') },
          { stepType: 'payment',       title: 'Paiement',                orderIndex: 2, status: OnboardingStepStatus.COMPLETED, deadline: new Date('2026-02-15'), completedAt: new Date('2026-02-03') },
          { stepType: 'questionnaire', title: 'Questionnaire',           orderIndex: 3, status: OnboardingStepStatus.COMPLETED, deadline: new Date('2026-02-05'), completedAt: new Date('2026-02-01') },
          { stepType: 'specifications', title: 'Cahier des charges',     orderIndex: 4, status: OnboardingStepStatus.COMPLETED, deadline: new Date('2026-02-12'), completedAt: new Date('2026-02-10') },
          { stepType: 'kickoff',       title: 'Réunion de lancement',     orderIndex: 5, status: OnboardingStepStatus.COMPLETED, deadline: new Date('2026-02-18'), completedAt: new Date('2026-02-17') },
          { stepType: 'production',   title: 'Production',              orderIndex: 6, status: OnboardingStepStatus.IN_PROGRESS, deadline: new Date('2026-07-15') },
          { stepType: 'delivery',     title: 'Livraison',                orderIndex: 7, status: OnboardingStepStatus.PENDING,     deadline: new Date('2026-08-01') },
        ]},
      }, include: { steps: true } });

      const onboarding3 = await prisma.clientOnboarding.create({ data: {
        projectId: project3.id, clientId: geant.id, assignedUserId: manager2b.id,
        steps: { create: [
          { stepType: 'welcome',       title: 'Projet confirmé',        orderIndex: 0, status: OnboardingStepStatus.COMPLETED, deadline: new Date('2025-12-13'), completedAt: new Date('2025-12-12') },
          { stepType: 'contract',      title: 'Contrat',                 orderIndex: 1, status: OnboardingStepStatus.COMPLETED, deadline: new Date('2025-12-18'), completedAt: new Date('2025-12-16') },
          { stepType: 'payment',       title: 'Paiement',                orderIndex: 2, status: OnboardingStepStatus.COMPLETED, deadline: new Date('2026-01-05'), completedAt: new Date('2025-12-20') },
          { stepType: 'questionnaire', title: 'Questionnaire',           orderIndex: 3, status: OnboardingStepStatus.COMPLETED, deadline: new Date('2025-12-28'), completedAt: new Date('2025-12-27') },
          { stepType: 'specifications', title: 'Cahier des charges',     orderIndex: 4, status: OnboardingStepStatus.IN_PROGRESS, deadline: new Date('2026-07-25') },
          { stepType: 'kickoff',       title: 'Réunion de lancement',     orderIndex: 5, status: OnboardingStepStatus.PENDING,     deadline: new Date('2026-08-01') },
          { stepType: 'production',   title: 'Production',              orderIndex: 6, status: OnboardingStepStatus.PENDING,     deadline: new Date('2026-09-01') },
          { stepType: 'delivery',     title: 'Livraison',                orderIndex: 7, status: OnboardingStepStatus.PENDING,     deadline: new Date('2026-09-15') },
        ]},
      }, include: { steps: true } });

      const step = (onboarding: typeof onboarding1, type: string) => onboarding.steps.find((s) => s.stepType === type)!;

      // Questionnaires — one per onboarding, project1 & project2 submitted, project3 drafted.
      await Promise.all([
        prisma.questionnaire.create({ data: { onboardingStepId: step(onboarding1, 'questionnaire').id, serviceType: 'web',    data: { objectifs: 'Augmenter le taux de conversion de 35%', cible: 'Grand public tunisien', budgetMarketing: '5000 TND/mois' }, isDraft: false, submittedAt: new Date('2025-11-14') } }),
        prisma.questionnaire.create({ data: { onboardingStepId: step(onboarding2, 'questionnaire').id, serviceType: 'mobile', data: { objectifs: 'Application de fidélité pour 50K clients', plateformes: ['iOS', 'Android'], budgetMarketing: '3000 TND/mois' }, isDraft: false, submittedAt: new Date('2026-02-01') } }),
        prisma.questionnaire.create({ data: { onboardingStepId: step(onboarding3, 'questionnaire').id, serviceType: 'erp',    data: { objectifs: 'Migration ERP sans interruption de service', systemesExistants: ['SAP R/3', 'Excel'] }, isDraft: false, submittedAt: new Date('2025-12-27') } }),
      ]);

      // Kickoff meetings
      await Promise.all([
        prisma.kickoffMeeting.create({ data: { onboardingStepId: step(onboarding1, 'kickoff').id, meetingDate: new Date('2025-11-24'), participants: 'Ahmed Ben Ali, Sarra Mansouri, équipe marketing Carrefour', meetingLink: 'https://meet.google.com/carrefour-kickoff' } }),
        prisma.kickoffMeeting.create({ data: { onboardingStepId: step(onboarding2, 'kickoff').id, meetingDate: new Date('2026-02-17'), participants: 'Sarra Mansouri, Yassine Gharbi, Inès Bouali, équipe Monoprix', meetingLink: 'https://meet.google.com/monoprix-kickoff' } }),
      ]);

      // Production progress — completed for project1, mid-way for project2, not started for project3 (step still PENDING).
      await Promise.all([
        prisma.productionProgress.create({ data: { onboardingStepId: step(onboarding1, 'production').id, analysis: 100, design: 100, development: 100, testing: 100, deployment: 100 } }),
        prisma.productionProgress.create({ data: { onboardingStepId: step(onboarding2, 'production').id, analysis: 100, design: 90,  development: 45,  testing: 10,  deployment: 0   } }),
      ]);

      // Delivery — only project1 has actually delivered.
      await prisma.delivery.create({ data: {
        onboardingStepId: step(onboarding1, 'delivery').id,
        deliverables: 'Plateforme e-commerce complète (catalogue, panier, paiement Flouci, back-office admin).',
        documentation: 'https://docs.secritou.tn/carrefour/documentation-technique.pdf',
        accessDetails: 'Accès admin back-office transmis par email sécurisé. Identifiants AWS transmis via Bitwarden partagé.',
        userGuides: 'https://docs.secritou.tn/carrefour/guide-utilisateur.pdf',
      }});

      console.log('✅ Client onboardings (3), steps (24), questionnaires (3), kickoffs (2), production (2), delivery (1)');
    }

    // ── Client success tracking ───────────────────────────────────────────────
    if (!(await skipIf(prisma.clientSuccess, 'Client success records'))) {
      const successCarrefour = await prisma.clientSuccess.create({ data: {
        clientId: carrefour.id, score: 88,
        objectives: { create: [
          { title: 'Augmenter le taux de conversion',      description: 'Objectif fixé lors de la refonte de la plateforme e-commerce.', targetValue: 35, currentValue: 31, unit: '%',       targetDate: new Date('2026-09-30') },
          { title: 'Réduire le taux d\'abandon panier',    description: 'Suite à l\'intégration Flouci et au nouveau tunnel de commande.', targetValue: 20, currentValue: 24, unit: '%',       targetDate: new Date('2026-10-31') },
        ]},
        metrics: { create: [
          { name: 'Trafic mensuel (visiteurs uniques)', initialValue: 120000, currentValue: 168000, unit: 'visiteurs' },
          { name: 'Taux de conversion',                  initialValue: 2.1,    currentValue: 2.9,    unit: '%' },
        ]},
        recommendations: { create: [
          { title: 'Lancer une campagne de retargeting', description: 'Cibler les 24% de paniers abandonnés avec des emails personnalisés.', priority: RecommendationPriority.HIGH,   status: RecommendationStatus.IN_PROGRESS },
          { title: 'Ajouter le paiement en 3x sans frais', description: 'Réduire la friction sur les paniers > 200 TND.',                       priority: RecommendationPriority.MEDIUM, status: RecommendationStatus.PENDING },
        ]},
        timeline: { create: [
          { title: 'Mise en ligne de la plateforme',   description: 'Lancement officiel de la nouvelle plateforme e-commerce.', eventType: 'MILESTONE', date: new Date('2026-04-30') },
          { title: 'Score de satisfaction : 88/100',    description: 'Suite à l\'enquête de satisfaction post-livraison.',       eventType: 'SCORE_UPDATE', date: new Date('2026-05-15') },
        ]},
      }, include: { metrics: true } });

      const successMonoprix = await prisma.clientSuccess.create({ data: {
        clientId: monoprix.id, score: 72,
        objectives: { create: [
          { title: 'Atteindre 50 000 inscrits au programme fidélité', description: 'Objectif de la V1 de l\'application mobile.', targetValue: 50000, currentValue: 8200, unit: 'inscrits', targetDate: new Date('2026-12-31') },
        ]},
        metrics: { create: [
          { name: 'Utilisateurs actifs (bêta fermée)', initialValue: 0, currentValue: 1450, unit: 'utilisateurs' },
        ]},
        recommendations: { create: [
          { title: 'Prioriser le module scan code-barres', description: 'Fonctionnalité la plus demandée par les testeurs bêta.', priority: RecommendationPriority.HIGH, status: RecommendationStatus.PENDING },
        ]},
        timeline: { create: [
          { title: 'Démarrage du projet',  description: 'Acceptation de la proposition et lancement du projet.', eventType: 'MILESTONE', date: new Date('2026-01-25') },
        ]},
      }, include: { metrics: true } });

      const successGeant = await prisma.clientSuccess.create({ data: {
        clientId: geant.id, score: 65,
        objectives: { create: [
          { title: 'Migrer 100% des données vers SAP S/4HANA', description: 'Sans interruption de service en magasin.', targetValue: 100, currentValue: 40, unit: '%', targetDate: new Date('2027-01-31') },
        ]},
        recommendations: { create: [
          { title: 'Planifier une réunion CODIR de cadrage phase 2', description: 'Le rapport d\'audit signale 3 risques critiques à trancher avant la migration.', priority: RecommendationPriority.HIGH, status: RecommendationStatus.PENDING },
        ]},
        timeline: { create: [
          { title: 'Livraison du rapport d\'audit',  description: 'Rapport de 80 pages transmis pour validation CODIR.', eventType: 'MILESTONE', date: new Date('2026-03-01') },
        ]},
      }});

      // Metric history — a few months of trend data for each Carrefour metric.
      const trafficMetric = successCarrefour.metrics.find((m) => m.name.startsWith('Trafic'))!;
      const conversionMetric = successCarrefour.metrics.find((m) => m.name.startsWith('Taux de conversion'))!;
      await prisma.metricHistory.createMany({ data: [
        { metricId: trafficMetric.id,    value: 120000, date: new Date('2026-02-01') },
        { metricId: trafficMetric.id,    value: 138000, date: new Date('2026-03-01') },
        { metricId: trafficMetric.id,    value: 151000, date: new Date('2026-04-01') },
        { metricId: trafficMetric.id,    value: 168000, date: new Date('2026-05-01') },
        { metricId: conversionMetric.id, value: 2.1,     date: new Date('2026-02-01') },
        { metricId: conversionMetric.id, value: 2.4,     date: new Date('2026-03-01') },
        { metricId: conversionMetric.id, value: 2.7,     date: new Date('2026-04-01') },
        { metricId: conversionMetric.id, value: 2.9,     date: new Date('2026-05-01') },
      ]});
      void successMonoprix; void successGeant;

      console.log('✅ Client success records (3), objectives (4), metrics (3), metric history (8), recommendations (4), timeline (4)');
    }

    // ── Documents & approvals (attachments, timeline, access log) ────────────
    if (!(await skipIf(prisma.document, 'Documents'))) {
      const documents = await Promise.all([
        prisma.document.create({ data: { name: 'contrat-carrefour-signe.pdf',        title: 'Contrat — Refonte e-commerce Carrefour',  type: DocumentType.CONTRACT,        url: 'https://docs.secritou.tn/carrefour/contrat-signe.pdf',        accessLevel: DocumentAccessLevel.CLIENT_ADMIN, clientId: carrefour.id, projectId: project1.id, uploadedById: manager1b.id, signedAt: new Date('2025-11-08'), signedByClientId: clientUser1b.id } }),
        prisma.document.create({ data: { name: 'brief-carrefour.pdf',                title: 'Brief client — Carrefour Tunisia',        type: DocumentType.CLIENT_BRIEF,    url: 'https://docs.secritou.tn/carrefour/brief.pdf',                 accessLevel: DocumentAccessLevel.ADMIN_FREELANCER, clientId: carrefour.id, projectId: project1.id, uploadedById: manager1b.id } }),
        prisma.document.create({ data: { name: 'roadmap-carrefour-v1.pdf',           title: 'Roadmap projet — Carrefour Tunisia',      type: DocumentType.ROADMAP,         url: 'https://docs.secritou.tn/carrefour/roadmap-v1.pdf',            accessLevel: DocumentAccessLevel.CLIENT_ADMIN, clientId: carrefour.id, projectId: project1.id, uploadedById: admin2.id } }),
        prisma.document.create({ data: { name: 'livrable-final-carrefour.zip',       title: 'Livrable final — Plateforme e-commerce',  type: DocumentType.DELIVERABLE,     url: 'https://docs.secritou.tn/carrefour/livrable-final.zip',        accessLevel: DocumentAccessLevel.CLIENT_ADMIN, clientId: carrefour.id, projectId: project1.id, uploadedById: freelancer1.id } }),
        prisma.document.create({ data: { name: 'guide-utilisateur-carrefour.pdf',    title: 'Guide utilisateur back-office',            type: DocumentType.GUIDE,           url: 'https://docs.secritou.tn/carrefour/guide-utilisateur.pdf',     accessLevel: DocumentAccessLevel.ALL,          clientId: carrefour.id, projectId: project1.id, uploadedById: manager1b.id } }),
        prisma.document.create({ data: { name: 'contrat-monoprix-signe.pdf',        title: 'Contrat — App Mobile Monoprix',           type: DocumentType.CONTRACT,        url: 'https://docs.secritou.tn/monoprix/contrat-signe.pdf',          accessLevel: DocumentAccessLevel.CLIENT_ADMIN, clientId: monoprix.id,  projectId: project2.id, uploadedById: manager1b.id, signedAt: new Date('2026-01-29'), signedByClientId: clientUser2b.id } }),
        prisma.document.create({ data: { name: 'cahier-charges-monoprix.pdf',        title: 'Cahier des charges — App fidélité',        type: DocumentType.SPECS,           url: 'https://docs.secritou.tn/monoprix/cahier-charges.pdf',         accessLevel: DocumentAccessLevel.ADMIN_FREELANCER, clientId: monoprix.id, projectId: project2.id, uploadedById: manager1b.id } }),
        prisma.document.create({ data: { name: 'rapport-audit-geant-v1.pdf',         title: 'Rapport d\'audit ERP — V1',               type: DocumentType.REPORT,          url: 'https://docs.secritou.tn/geant/rapport-audit-v1.pdf',          accessLevel: DocumentAccessLevel.CLIENT_ADMIN, clientId: geant.id,     projectId: project3.id, uploadedById: manager2b.id } }),
        prisma.document.create({ data: { name: 'lettre-bienvenue-vermeg.pdf',        title: 'Lettre de bienvenue — Vermeg Digital',    type: DocumentType.WELCOME_LETTER,  url: 'https://docs.secritou.tn/vermeg/bienvenue.pdf',                accessLevel: DocumentAccessLevel.CLIENT_ADMIN, clientId: vermeg.id,    uploadedById: admin2.id } }),
      ]);
      const [docContrat, docBrief, docRoadmap, docLivrable, , docContratMonoprix, , docRapportAudit] = documents;

      await prisma.approvalAttachment.createMany({ data: [
        { name: 'maquettes-homepage-v2.fig',        url: 'https://docs.secritou.tn/carrefour/maquettes-homepage-v2.fig',        approvalId: approvalCarrefourHomepage.id },
        { name: 'maquettes-homepage-v2-export.pdf', url: 'https://docs.secritou.tn/carrefour/maquettes-homepage-v2-export.pdf', approvalId: approvalCarrefourHomepage.id },
        { name: 'maquettes-hf-lot1-monoprix.fig',   url: 'https://docs.secritou.tn/monoprix/maquettes-hf-lot1.fig',              approvalId: approvalMonoprixHF.id },
        { name: 'rapport-audit-geant-v1.pdf',       url: 'https://docs.secritou.tn/geant/rapport-audit-v1.pdf',                  approvalId: approvalGeant.id },
      ]});

      await prisma.approvalTimeline.createMany({ data: [
        { action: 'CREATED',  status: 'PENDING',  comment: 'Maquettes envoyées pour validation.',                                   userId: manager1b.id,  approvalId: approvalCarrefourHomepage.id, createdAt: new Date('2025-11-16') },
        { action: 'APPROVED', status: 'APPROVED', comment: 'Validé par le directeur marketing Carrefour, RAS.',                       userId: clientUser1b.id, approvalId: approvalCarrefourHomepage.id, createdAt: new Date('2025-11-19') },
        { action: 'CREATED',  status: 'PENDING',  comment: 'Lot 1 des maquettes HF envoyé (12 écrans sur 15).',                       userId: manager1b.id,  approvalId: approvalMonoprixHF.id,        createdAt: new Date('2026-04-10') },
        { action: 'COMMENTED', status: 'PENDING', comment: 'Merci de revoir l\'écran wallet et d\'ajouter un onboarding tutoriel.',   userId: clientUser2b.id, approvalId: approvalMonoprixHF.id,        createdAt: new Date('2026-04-12') },
        { action: 'CREATED',  status: 'PENDING',  comment: 'Rapport d\'audit transmis pour revue CODIR.',                            userId: manager2b.id,  approvalId: approvalGeant.id,              createdAt: new Date('2026-03-01') },
        { action: 'COMMENTED', status: 'PENDING', comment: '3 risques critiques signalés sur la migration des données legacy.',       userId: admin2.id,     approvalId: approvalGeant.id,              createdAt: new Date('2026-03-08') },
      ]});

      await prisma.documentAccessLog.createMany({ data: [
        { action: 'VIEW',     documentId: docContrat.id,         userId: clientUser1b.id, ipAddress: '105.235.12.44', createdAt: new Date('2025-11-08') },
        { action: 'DOWNLOAD', documentId: docContrat.id,         userId: clientUser1b.id, ipAddress: '105.235.12.44', createdAt: new Date('2025-11-08') },
        { action: 'VIEW',     documentId: docBrief.id,           userId: manager1b.id,    ipAddress: '41.226.10.201', createdAt: new Date('2025-11-15') },
        { action: 'VIEW',     documentId: docRoadmap.id,         userId: clientUser1b.id, ipAddress: '105.235.12.44', createdAt: new Date('2025-11-20') },
        { action: 'DOWNLOAD', documentId: docLivrable.id,        userId: clientUser1b.id, ipAddress: '105.235.12.44', createdAt: new Date('2026-04-29') },
        { action: 'VIEW',     documentId: docContratMonoprix.id, userId: clientUser2b.id, ipAddress: '197.15.88.6',   createdAt: new Date('2026-01-29') },
        { action: 'VIEW',     documentId: docRapportAudit.id,    userId: clientUser3b.id, ipAddress: '41.231.44.9',   createdAt: new Date('2026-03-02') },
        { action: 'DOWNLOAD', documentId: docRapportAudit.id,    userId: clientUser3b.id, ipAddress: '41.231.44.9',   createdAt: new Date('2026-03-02') },
      ]});

      console.log('✅ Documents (9), approval attachments (4), approval timeline (6), document access logs (8)');
    }
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
  } // end if (seedDemo)

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
  if (seedDemo) {
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
  }
  console.log('  ─────────────────────────────────────────────────────\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
