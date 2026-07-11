import PDFDocument from "pdfkit";
import { uploadFile } from "./upload.service.js";
import { documentRepository } from "../repositories/document.repository.js";
import type { Document, DocumentType } from "@prisma/client";

// Minimal shapes: only the fields each generator needs, not full Prisma model types.
// This decouples the generator from query shape changes and avoids circular imports.
type GeneratorProposal = {
  id: string;
  title: string;
  description?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  expiresAt?: Date | null;
};

type GeneratorProject = {
  id: string;
  name: string;
  description?: string | null;
  budget?: string | null;
  deadline?: Date | null;
  serviceId?: string | null;
};

type GeneratorClient = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

type GeneratorManager = {
  id: string;
  name?: string | null;
  email: string;
};

type GeneratorInvoice = {
  id: string;
  number?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  dueDate?: Date | null;
};

// ---------------------------------------------------------------------------
// PDF helpers
// ---------------------------------------------------------------------------

function buildPdf(builder: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      builder(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function header(doc: PDFKit.PDFDocument, title: string) {
  doc
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("Secritou", { align: "left" })
    .moveDown(0.2)
    .fontSize(10)
    .font("Helvetica")
    .fillColor("#888888")
    .text("Agence digitale & IA", { align: "left" })
    .fillColor("#000000")
    .moveDown(1)
    .fontSize(16)
    .font("Helvetica-Bold")
    .text(title, { align: "center" })
    .moveDown(0.5)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke()
    .moveDown(1)
    .font("Helvetica")
    .fontSize(11);
}

function field(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.font("Helvetica-Bold").text(`${label} : `, { continued: true }).font("Helvetica").text(value);
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.8).fontSize(13).font("Helvetica-Bold").text(title).fontSize(11).font("Helvetica").moveDown(0.4);
}

function fmtAmount(amount: number | string | null | undefined, currency: string | null | undefined) {
  if (amount == null) return "N/A";
  return `${Number(amount).toLocaleString("fr-FR")} ${currency ?? "TND"}`;
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("fr-FR");
}

// ---------------------------------------------------------------------------
// Core: upload + persist
// ---------------------------------------------------------------------------

async function uploadAndCreate(
  buffer: Buffer,
  {
    type,
    filename,
    title,
    description,
    projectId,
    clientId,
    invoiceId,
    uploadedById,
  }: {
    type: DocumentType;
    filename: string;
    title: string;
    description?: string;
    projectId?: string;
    clientId?: string;
    invoiceId?: string;
    uploadedById: string;
  }
): Promise<Document> {
  const folder = projectId
    ? `projects/${projectId}/documents/${type.toLowerCase()}`
    : `documents/${type.toLowerCase()}`;

  const result = await uploadFile(buffer, `${filename}.pdf`, "application/pdf", buffer.length, "document", folder);

  return documentRepository.create({
    name: filename,
    title,
    description,
    type,
    url: result.url,
    fileUrl: result.url,
    fileKey: result.key,
    accessLevel: "CLIENT_ADMIN",
    tags: [],
    projectId,
    clientId,
    invoiceId,
    uploadedById,
  });
}

// ---------------------------------------------------------------------------
// PDF generators
// ---------------------------------------------------------------------------

const TIMELINE_STEPS = [
  "1. Réunion de lancement (kick-off)",
  "2. Validation du brief et des livrables",
  "3. Design & maquettes",
  "4. Développement / Production",
  "5. Tests & recette client",
  "6. Mise en ligne / Livraison",
  "7. Formation & suivi post-lancement",
];

export const documentGeneratorService = {
  async generateWelcomeLetter(
    proposal: GeneratorProposal,
    project: GeneratorProject,
    client: GeneratorClient,
    manager: GeneratorManager,
    uploadedById: string
  ): Promise<Document> {
    const buffer = await buildPdf((doc) => {
      header(doc, "Lettre de bienvenue");
      doc.text(`Date : ${fmtDate(new Date())}`).moveDown(0.5);
      doc.text(`Objet : Bienvenue chez Secritou : projet « ${project.name} »`).moveDown(1);
      doc.text(`Cher(e) ${client.name},`).moveDown(0.5);
      doc.text(
        `Nous sommes ravis de vous accueillir en tant que client Secritou et de vous accompagner dans la réalisation de votre projet. Votre proposition a été acceptée et nous allons désormais travailler ensemble pour atteindre vos objectifs.`
      ).moveDown(1);

      sectionTitle(doc, "Résumé du projet");
      field(doc, "Intitulé", project.name);
      if (proposal.description) doc.text(proposal.description).moveDown(0.3);
      field(doc, "Budget", fmtAmount(proposal.amount, proposal.currency));
      field(doc, "Échéance", fmtDate(project.deadline ?? proposal.expiresAt));
      field(doc, "Chef de projet", manager.name ?? manager.email);

      sectionTitle(doc, "Prochaines étapes");
      TIMELINE_STEPS.forEach((step) => doc.text(`  • ${step}`));

      doc.moveDown(1).text(
        "Nous nous engageons à vous répondre dans un délai de 48 heures ouvrées. N'hésitez pas à contacter votre chef de projet pour toute question."
      );
      doc.moveDown(2).text("Cordialement,").text(`L'équipe Secritou`);
    });

    return uploadAndCreate(buffer, {
      type: "WELCOME_LETTER",
      filename: `lettre-bienvenue-${project.id}`,
      title: `Lettre de bienvenue : ${project.name}`,
      projectId: project.id,
      clientId: client.id,
      uploadedById,
    });
  },

  async generateContract(
    proposal: GeneratorProposal,
    project: GeneratorProject,
    client: GeneratorClient,
    uploadedById: string
  ): Promise<Document> {
    const buffer = await buildPdf((doc) => {
      header(doc, "Contrat de prestation de services");
      doc.text(`Fait le ${fmtDate(new Date())}`).moveDown(1);

      sectionTitle(doc, "1. Parties");
      doc.text("Prestataire : Secritou, agence digitale & IA.");
      doc.text(`Client : ${client.name}${client.email ? ` : ${client.email}` : ""}.`).moveDown(0.5);

      sectionTitle(doc, "2. Objet et prestations incluses");
      doc.text(`Réalisation du projet « ${project.name} ».`);
      if (proposal.description) doc.text(proposal.description).moveDown(0.3);
      doc.text("Prestations incluses : conception, développement, mise en ligne, formation et suivi.").moveDown(0.3);

      sectionTitle(doc, "3. Prestations exclues");
      doc.text("Hébergement tiers, noms de domaine, licences logicielles tierces, contenu rédactionnel, traductions.");

      sectionTitle(doc, "4. Délais et responsabilités");
      doc.text(`Échéance cible : ${fmtDate(project.deadline ?? proposal.expiresAt)}.`);
      doc.text("Tout retard imputable au client (validation, fourniture des contenus) décale l'échéance d'autant.");

      sectionTitle(doc, "5. Conditions financières");
      field(doc, "Montant total HT", fmtAmount(proposal.amount, proposal.currency));
      doc.text("Acompte 30 % à la signature du contrat, solde 70 % à la livraison.");

      sectionTitle(doc, "6. Confidentialité");
      doc.text("Les parties s'engagent à traiter toutes informations échangées comme confidentielles pendant la durée du contrat et 3 ans après son terme.");

      sectionTitle(doc, "7. Propriété intellectuelle");
      doc.text("À réception du solde, le client devient propriétaire des livrables finaux. Le prestataire conserve le droit de citer le projet dans son portfolio.");

      sectionTitle(doc, "8. Résiliation");
      doc.text("En cas de résiliation anticipée, l'acompte reste acquis au prestataire. Les travaux réalisés sont facturés au prorata.");

      doc.moveDown(2);
      doc.text("Signature du client :", { continued: false }).moveDown(3);
      doc.moveTo(doc.page.margins.left, doc.y).lineTo(250, doc.y).stroke().moveDown(0.5);
      doc.text("Nom & date :");
    });

    return uploadAndCreate(buffer, {
      type: "CONTRACT",
      filename: `contrat-${project.id}`,
      title: `Contrat de service : ${project.name}`,
      projectId: project.id,
      clientId: client.id,
      uploadedById,
    });
  },

  async generateSpecs(
    project: GeneratorProject,
    client: GeneratorClient,
    uploadedById: string
  ): Promise<Document> {
    const buffer = await buildPdf((doc) => {
      header(doc, "Cahier des charges");
      field(doc, "Projet", project.name);
      field(doc, "Client", client.name);
      field(doc, "Date", fmtDate(new Date()));
      doc.moveDown(1);

      const sections = [
        ["1. Contexte", project.description ?? "[À compléter : contexte et enjeux du projet]"],
        ["2. Objectifs", "[À compléter : objectifs mesurables attendus]"],
        ["3. Besoins", "[À compléter : besoins fonctionnels et non fonctionnels]"],
        ["4. Fonctionnalités", "[À compléter : liste des fonctionnalités et leur priorité]"],
        ["5. Livrables", "[À compléter : liste des livrables attendus et leur format]"],
        ["6. Critères de validation", "[À compléter : conditions d'acceptation des livrables]"],
      ];
      sections.forEach(([title, content]) => {
        sectionTitle(doc, title);
        doc.text(content ?? "");
      });
    });

    return uploadAndCreate(buffer, {
      type: "SPECS",
      filename: `cahier-des-charges-${project.id}`,
      title: `Cahier des charges : ${project.name}`,
      description: project.description ?? undefined,
      projectId: project.id,
      clientId: client.id,
      uploadedById,
    });
  },

  async generateClientBrief(
    project: GeneratorProject,
    client: GeneratorClient,
    uploadedById: string
  ): Promise<Document> {
    // Question sets differ by service type (heuristic on serviceId presence / naming)
    const isMarketing = project.serviceId?.toLowerCase().includes("market");
    const isAI = project.serviceId?.toLowerCase().includes("ia") || project.serviceId?.toLowerCase().includes("ai");

    const questions: [string, string[]][] = isMarketing
      ? [
          ["Identité de marque", ["Quels sont vos valeurs et positionnement ?", "Avez-vous une charte graphique ?", "Quelles marques admirez-vous ?"]],
          ["Cible & marché", ["Qui est votre client idéal ?", "Quels canaux utilisez-vous actuellement ?", "Quels sont vos KPI prioritaires ?"]],
          ["Objectifs campagne", ["Quel est l'objectif principal (notoriété / conversion / fidélisation) ?", "Quel budget media est alloué ?", "Quelle durée prévoyez-vous ?"]],
        ]
      : isAI
      ? [
          ["Cas d'usage IA", ["Quel problème métier souhaitez-vous automatiser ?", "Quelles données sont disponibles ?", "Quels modèles ou outils utilisez-vous déjà ?"]],
          ["Contraintes", ["Exigences de latence ?", "Contraintes RGPD / souveraineté des données ?", "Intégration avec des systèmes existants ?"]],
          ["Succès", ["Comment mesurerez-vous le ROI ?", "Qui valide les outputs du modèle ?"]],
        ]
      : [
          ["Présentation du projet", ["Décrivez votre activité en 3 phrases.", "Quel est l'objectif principal du site ?", "Avez-vous un site existant ?"]],
          ["Design & contenu", ["Avez-vous une charte graphique ?", "Qui fournit les textes et visuels ?", "Des sites de référence que vous appréciez ?"]],
          ["Fonctionnalités", ["E-commerce ? Espace client ? Formulaires ?", "Langues souhaitées ?", "Intégrations (CRM, paiement, etc.) ?"]],
          ["Technique", ["Hébergement déjà prévu ?", "Nom de domaine existant ?", "Accès aux comptes existants (DNS, hébergeur) ?"]],
        ];

    const buffer = await buildPdf((doc) => {
      header(doc, "Questionnaire Brief Client");
      field(doc, "Projet", project.name);
      field(doc, "Client", client.name);
      field(doc, "Date", fmtDate(new Date()));
      doc.moveDown(1).text("Merci de compléter ce questionnaire avant notre réunion de lancement.").moveDown(1);

      questions.forEach(([section, qs]) => {
        sectionTitle(doc, section);
        qs.forEach((q, i) => {
          doc.font("Helvetica-Bold").text(`${i + 1}. ${q}`).font("Helvetica");
          doc.moveDown(0.3).text("[Votre réponse]").moveDown(0.8);
        });
      });
    });

    return uploadAndCreate(buffer, {
      type: "CLIENT_BRIEF",
      filename: `brief-client-${project.id}`,
      title: `Questionnaire brief : ${project.name}`,
      projectId: project.id,
      clientId: client.id,
      uploadedById,
    });
  },

  async generateQuotePDF(
    proposal: GeneratorProposal,
    project: GeneratorProject | null,
    client: GeneratorClient,
    uploadedById: string
  ): Promise<Document> {
    const totalHT = proposal.amount != null ? Number(proposal.amount) : 0;
    const tva = 0.19; // taux TVA Tunisie
    const totalTTC = Math.round(totalHT * (1 + tva) * 100) / 100;
    const acompte = Math.round(totalHT * 0.3 * 100) / 100;
    const solde = Math.round((totalHT - acompte) * 100) / 100;
    const cur = proposal.currency ?? "TND";

    const buffer = await buildPdf((doc) => {
      header(doc, "Devis");
      field(doc, "Référence", `DEV-${proposal.id.slice(0, 8).toUpperCase()}`);
      field(doc, "Date", fmtDate(new Date()));
      field(doc, "Client", `${client.name}${client.email ? ` : ${client.email}` : ""}`);
      if (project) field(doc, "Projet", project.name);
      doc.moveDown(1);

      sectionTitle(doc, "Prestations");
      if (proposal.description) {
        doc.text(proposal.description).moveDown(0.5);
      }

      // Simple totals table
      const col1 = doc.page.margins.left;
      const col2 = doc.page.width - doc.page.margins.right - 120;

      const row = (label: string, value: string, bold = false) => {
        if (bold) doc.font("Helvetica-Bold");
        else doc.font("Helvetica");
        doc.text(label, col1, doc.y, { continued: true, width: col2 - col1 });
        doc.text(value, { align: "right" });
      };

      doc.moveDown(0.5);
      row("Montant HT", `${totalHT.toLocaleString("fr-FR")} ${cur}`);
      row(`TVA (${tva * 100}%)`, `${(totalTTC - totalHT).toFixed(2)} ${cur}`);
      row("Montant TTC", `${totalTTC.toLocaleString("fr-FR")} ${cur}`, true);
      doc.moveDown(0.5);
      row("Acompte 30 %", `${acompte.toLocaleString("fr-FR")} ${cur}`);
      row("Solde 70 %", `${solde.toLocaleString("fr-FR")} ${cur}`);

      sectionTitle(doc, "Conditions de paiement");
      doc.text("• Acompte 30 % dû à la signature du contrat.");
      doc.text("• Solde 70 % dû à la livraison des livrables finaux.");
      doc.text("• Paiement par virement bancaire sous 14 jours.");
      doc.text("• Devis valable 30 jours à compter de la date d'émission.");
    });

    return uploadAndCreate(buffer, {
      type: "QUOTE",
      filename: project ? `devis-${project.id}` : `devis-proposal-${proposal.id}`,
      title: project ? `Devis : ${project.name}` : `Devis : ${proposal.title}`,
      projectId: project?.id,
      clientId: client.id,
      uploadedById,
    });
  },

  async generateInvoicePDF(
    invoice: GeneratorInvoice,
    project: GeneratorProject,
    client: GeneratorClient,
    uploadedById: string
  ): Promise<Document> {
    const buffer = await buildPdf((doc) => {
      header(doc, "Facture d'acompte");
      field(doc, "Référence", invoice.number ?? `FA-${invoice.id.slice(0, 8).toUpperCase()}`);
      field(doc, "Date d'émission", fmtDate(new Date()));
      field(doc, "Date limite de paiement", fmtDate(invoice.dueDate));
      doc.moveDown(0.5);
      field(doc, "Client", `${client.name}${client.email ? ` : ${client.email}` : ""}`);
      field(doc, "Projet", project.name);
      doc.moveDown(1);

      sectionTitle(doc, "Détail");
      doc.text(`Acompte 30 % sur la prestation « ${project.name} »`).moveDown(0.5);

      doc.font("Helvetica-Bold").text(`Montant total : ${fmtAmount(invoice.amount, invoice.currency)}`).font("Helvetica");
      doc.moveDown(1);

      sectionTitle(doc, "Modalités de règlement");
      doc.text("Paiement par virement bancaire.");
      doc.text("Titulaire : Secritou");
      doc.text("IBAN : [À compléter]");
      doc.text("BIC : [À compléter]");
      doc.text("Référence à indiquer : " + (invoice.number ?? project.name));
    });

    return uploadAndCreate(buffer, {
      type: "INVOICE_DEPOSIT",
      filename: `facture-acompte-${project.id}`,
      title: `Facture d'acompte : ${project.name}`,
      projectId: project.id,
      clientId: client.id,
      invoiceId: invoice.id,
      uploadedById,
    });
  },

  async generateRoadmap(
    project: GeneratorProject,
    uploadedById: string
  ): Promise<Document> {
    const buffer = await buildPdf((doc) => {
      header(doc, "Roadmap projet");
      field(doc, "Projet", project.name);
      field(doc, "Date", fmtDate(new Date()));
      if (project.deadline) field(doc, "Échéance cible", fmtDate(project.deadline));
      doc.moveDown(1);

      sectionTitle(doc, "Phases du projet");
      TIMELINE_STEPS.forEach((step, i) => {
        doc.font("Helvetica-Bold").text(step).font("Helvetica");
        doc.text(`   Statut : [ ] En attente   [ ] En cours   [ ] Terminé`);
        doc.text(`   Date prévue : _____________     Date réelle : _____________`);
        if (i < TIMELINE_STEPS.length - 1) doc.moveDown(0.5);
      });

      doc.moveDown(1);
      sectionTitle(doc, "Notes");
      doc.text("[À compléter au fil du projet]");
    });

    return uploadAndCreate(buffer, {
      type: "ROADMAP",
      filename: `roadmap-${project.id}`,
      title: `Roadmap : ${project.name}`,
      description: project.description ?? undefined,
      projectId: project.id,
      uploadedById,
    });
  },
};
