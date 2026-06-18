const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageOrientation, Header, Footer, PageNumber
} = require('docx');
const fs = require('fs');

const COLOR = {
  red: "C00000",
  orange: "C55A11",
  green: "375623",
  blue: "1F3864",
  lightBlue: "DAEEF3",
  lightRed: "FCE4D6",
  lightOrange: "FFF2CC",
  lightGreen: "E2EFDA",
  gray: "595959",
  lightGray: "F2F2F2",
  midGray: "BFBFBF",
  white: "FFFFFF",
  darkBlue: "1F3864",
  headerBg: "1F3864",
  rowAlt: "EEF3F8",
};

const border = (color = "CCCCCC") => ({ style: BorderStyle.SINGLE, size: 4, color });
const cellBorders = (color = "D0D7E2") => ({
  top: border(color), bottom: border(color), left: border(color), right: border(color)
});

function h1(text, color = COLOR.blue) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: COLOR.blue, space: 4 } },
    children: [new TextRun({ text, color, bold: true, size: 36, font: "Arial" })]
  });
}

function h2(text, color = COLOR.blue) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 120 },
    children: [new TextRun({ text, color, bold: true, size: 28, font: "Arial" })]
  });
}

function h3(text, color = COLOR.gray) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, color, bold: true, size: 24, font: "Arial" })]
  });
}

function para(text, options = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 20, font: "Arial", ...options })]
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 20, font: "Arial" })]
  });
}

function badgePara(emoji, label, text, badgeColor = COLOR.red, bgColor = COLOR.lightRed) {
  return new Paragraph({
    spacing: { after: 100, before: 60 },
    shading: { fill: bgColor, type: ShadingType.CLEAR },
    indent: { left: 200, right: 200 },
    children: [
      new TextRun({ text: `${emoji} `, size: 22, font: "Arial" }),
      new TextRun({ text: `[${label}]  `, size: 20, bold: true, color: badgeColor, font: "Arial" }),
      new TextRun({ text, size: 20, font: "Arial" })
    ]
  });
}

function codeBlock(text) {
  return new Paragraph({
    spacing: { after: 80, before: 80 },
    indent: { left: 400, right: 400 },
    shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
    children: [new TextRun({ text, size: 18, font: "Courier New", color: "333333" })]
  });
}

function makeSummaryTable(rows) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3000, 3000, 1680, 1680],
    rows: [
      new TableRow({
        tableHeader: true,
        children: ["Catégorie", "Avant", "Après", "Gain"].map(h => new TableCell({
          borders: cellBorders(COLOR.darkBlue),
          shading: { fill: COLOR.headerBg, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: COLOR.white, size: 20, font: "Arial" })] })]
        }))
      }),
      ...rows.map((row, i) => new TableRow({
        children: row.map((cell, j) => new TableCell({
          borders: cellBorders(),
          shading: { fill: i % 2 === 0 ? COLOR.white : COLOR.rowAlt, type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, font: "Arial", bold: j === 3 })] })]
        }))
      }))
    ]
  });
}

function makeEndpointTable(rows, cols = ["Method", "Route", "Contrôleur", "Service", "Frontend", "Notes"]) {
  const colWidths = cols.length === 6 ? [700, 1800, 1400, 1200, 1000, 1260] : [800, 2000, 1800, 1560, 1200];
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: cols.map(h => new TableCell({
          borders: cellBorders(COLOR.darkBlue),
          shading: { fill: COLOR.headerBg, type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: COLOR.white, size: 16, font: "Arial" })] })]
        }))
      }),
      ...rows.map((row, i) => new TableRow({
        children: row.map((cell, j) => {
          let txtColor = "333333";
          if (j === 0) {
            if (cell === "GET") txtColor = "007700";
            else if (cell === "POST") txtColor = "0000AA";
            else if (cell === "PUT" || cell === "PATCH") txtColor = "AA6600";
            else if (cell === "DELETE") txtColor = COLOR.red;
          }
          return new TableCell({
            borders: cellBorders(),
            shading: { fill: i % 2 === 0 ? COLOR.white : COLOR.rowAlt, type: ShadingType.CLEAR },
            margins: { top: 40, bottom: 40, left: 80, right: 80 },
            children: [new Paragraph({ children: [new TextRun({ text: String(cell), size: 16, font: j === 0 ? "Courier New" : "Arial", color: txtColor, bold: j === 0 })] })]
          });
        })
      }))
    ]
  });
}

function makeStatusTable(rows) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3200, 1400, 4760],
    rows: [
      new TableRow({
        tableHeader: true,
        children: ["Endpoint", "Statut", "Raison"].map(h => new TableCell({
          borders: cellBorders(COLOR.darkBlue),
          shading: { fill: COLOR.headerBg, type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: COLOR.white, size: 18, font: "Arial" })] })]
        }))
      }),
      ...rows.map((row, i) => new TableRow({
        children: row.map((cell, j) => {
          let fill = i % 2 === 0 ? COLOR.white : COLOR.rowAlt;
          let txtColor = "333333";
          if (j === 1) {
            if (cell === "INUTILISÉ") { fill = COLOR.lightRed; txtColor = COLOR.red; }
            else if (cell === "LEGACY") { fill = COLOR.lightOrange; txtColor = COLOR.orange; }
            else if (cell === "MANQUANT") { fill = "FCE4D6"; txtColor = "C00000"; }
          }
          return new TableCell({
            borders: cellBorders(),
            shading: { fill, type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: cell, size: 17, font: "Arial", color: txtColor, bold: j === 1 })] })]
          });
        })
      }))
    ]
  });
}

function spacer() {
  return new Paragraph({ spacing: { after: 160 }, children: [new TextRun("")] });
}

function sectionBox(title, color, bgColor, content) {
  return [
    new Paragraph({
      spacing: { before: 200, after: 0 },
      border: {
        left: { style: BorderStyle.SINGLE, size: 20, color, space: 8 }
      },
      indent: { left: 200 },
      shading: { fill: bgColor, type: ShadingType.CLEAR },
      children: [new TextRun({ text: title, bold: true, size: 22, color, font: "Arial" })]
    }),
    ...content.map(p => {
      p.properties = p.properties || {};
      if (p.indent) p.indent.left = (p.indent.left || 0) + 300;
      else p.indent = { left: 300 };
      if (!p.shading) p.shading = { fill: bgColor, type: ShadingType.CLEAR };
      return p;
    }),
    spacer()
  ];
}

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 560, hanging: 280 } } }
        }, {
          level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 900, hanging: 280 } } }
        }]
      }
    ]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: COLOR.blue },
        paragraph: { spacing: { before: 400, after: 160 }, outlineLevel: 0 }
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: COLOR.blue },
        paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 1 }
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: COLOR.gray },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 }
      }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.blue, space: 4 } },
          children: [
            new TextRun({ text: "RAPPORT D'AUDIT API — SECRITOU", bold: true, size: 18, color: COLOR.blue, font: "Arial" }),
            new TextRun({ text: "        Confidentiel — Usage interne", size: 16, color: COLOR.gray, font: "Arial" }),
          ]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: COLOR.midGray, space: 4 } },
          children: [
            new TextRun({ text: "Secritou CRM — Audit Architecture API    ", size: 16, color: COLOR.gray, font: "Arial" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: COLOR.gray, font: "Arial" }),
            new TextRun({ text: " / ", size: 16, color: COLOR.gray, font: "Arial" }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: COLOR.gray, font: "Arial" }),
          ]
        })]
      })
    },
    children: [
      // ══════════════════════════════════════════════
      // COVER
      // ══════════════════════════════════════════════
      new Paragraph({
        spacing: { before: 1000, after: 200 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "RAPPORT D'AUDIT", size: 56, bold: true, color: COLOR.blue, font: "Arial" })]
      }),
      new Paragraph({
        spacing: { after: 100 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "ARCHITECTURE API", size: 48, bold: true, color: COLOR.blue, font: "Arial" })]
      }),
      new Paragraph({
        spacing: { after: 600 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Secritou CRM Platform", size: 28, color: COLOR.gray, font: "Arial" })]
      }),
      new Paragraph({
        spacing: { after: 100 },
        alignment: AlignmentType.CENTER,
        shading: { fill: COLOR.lightBlue, type: ShadingType.CLEAR },
        children: [new TextRun({ text: "Backend: Node.js / Express / Prisma / Redis/BullMQ", size: 20, font: "Arial", color: COLOR.blue })]
      }),
      new Paragraph({
        spacing: { after: 600 },
        alignment: AlignmentType.CENTER,
        shading: { fill: COLOR.lightBlue, type: ShadingType.CLEAR },
        children: [new TextRun({ text: "Frontend: React / TypeScript / Vite / TanStack Query", size: 20, font: "Arial", color: COLOR.blue })]
      }),
      new Paragraph({
        spacing: { after: 80 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Analyse complète • Juin 2025", size: 22, font: "Arial", color: COLOR.gray })]
      }),
      spacer(),

      // ══════════════════════════════════════════════
      // 1. CARTOGRAPHIE DES ENDPOINTS
      // ══════════════════════════════════════════════
      h1("1. Cartographie Complète des Endpoints"),
      para("Le projet backend expose 164 endpoints répartis sur 27 fichiers de routes. Voici la cartographie complète par domaine fonctionnel."),
      spacer(),

      h2("1.1 Auth & Utilisateurs"),
      makeEndpointTable([
        ["POST", "/auth/register", "auth.controller", "AuthService", "✅ authApi", "Public, rate-limited"],
        ["POST", "/auth/login", "auth.controller", "AuthService", "✅ authApi", "Public, rate-limited"],
        ["POST", "/auth/refresh", "auth.controller", "AuthService", "✅ authApi", "Cookie refresh token"],
        ["POST", "/auth/logout", "auth.controller", "AuthService", "✅ authApi", "—"],
        ["GET",  "/auth/me", "auth.controller", "AuthService", "✅ authApi", "⚠️ Duplique /users/me"],
        ["POST", "/auth/forgot-password", "auth.controller", "AuthService", "✅ authApi", "Public"],
        ["POST", "/auth/reset-password", "auth.controller", "AuthService", "✅ authApi", "Public"],
        ["POST", "/auth/change-password", "auth.controller", "AuthService", "✅ authApi + ⚠️ dupliqué", "Copié dans freelancerApplications.api.ts"],
        ["GET",  "/users/me", "user.controller", "UserService", "✅ usersApi", "⚠️ Duplique /auth/me"],
        ["PATCH","/users/me", "user.controller", "UserService", "✅ usersApi", "—"],
        ["GET",  "/users", "user.controller", "UserService", "✅ usersApi", "ADMIN/MANAGER"],
        ["POST", "/users", "user.controller", "UserService", "✅ usersApi", "ADMIN — invite"],
        ["PATCH","/users/:id", "user.controller", "UserService", "✅ usersApi", "ADMIN"],
        ["DELETE","/users/:id", "user.controller", "UserService", "✅ usersApi", "ADMIN"],
        ["GET",  "/users/permissions", "user.controller", "UserService", "✅ usersApi", "—"],
      ]),
      spacer(),

      h2("1.2 Entreprise & Tableau de Bord"),
      makeEndpointTable([
        ["GET",  "/companies", "company.controller", "CompanyService", "✅ companyApi", "ADMIN seulement"],
        ["GET",  "/companies/users", "company.controller", "CompanyService", "⚠️ (1 usage)", "⚠️ Duplique /users"],
        ["PUT",  "/companies", "company.controller", "CompanyService", "✅ companyApi", "ADMIN"],
        ["GET",  "/dashboard/summary", "dashboard.controller", "DashboardService", "✅ dashboardApi", "⚠️ Duplique /analytics/summary + /summaries/dashboard"],
        ["GET",  "/analytics/summary", "analytics.controller", "AnalyticsService", "✅ analyticsApi", "Avec filtre date"],
        ["GET",  "/summaries/dashboard", "summary.controller", "SummaryService", "🔴 INUTILISÉ frontend", "⚠️ 3ème endpoint dashboard"],
        ["GET",  "/summaries/clients/:id", "summary.controller", "SummaryService", "🔴 INUTILISÉ frontend", "—"],
        ["GET",  "/summaries/projects/:id", "summary.controller", "SummaryService", "🔴 INUTILISÉ frontend", "—"],
      ]),
      spacer(),

      h2("1.3 CRM — Leads, Clients, Projets, Tâches"),
      makeEndpointTable([
        ["GET",    "/leads", "lead.controller", "LeadService", "✅", "ADMIN uniquement"],
        ["GET",    "/leads/:id", "lead.controller", "LeadService", "✅", "—"],
        ["POST",   "/leads", "lead.controller", "LeadService", "✅", "—"],
        ["PUT",    "/leads/:id", "lead.controller", "LeadService", "✅", "—"],
        ["DELETE", "/leads/:id", "lead.controller", "LeadService", "✅", "—"],
        ["POST",   "/leads/:id/convert", "lead.controller", "LeadService", "✅", "Lead → Client"],
        ["GET",    "/clients", "client.controller", "ClientService", "✅", "ADMIN uniquement"],
        ["GET",    "/clients/:id", "client.controller", "ClientService", "✅", "—"],
        ["POST",   "/clients", "client.controller", "ClientService", "✅", "—"],
        ["PUT",    "/clients/:id", "client.controller", "ClientService", "✅", "—"],
        ["DELETE", "/clients/:id", "client.controller", "ClientService", "✅", "—"],
        ["GET",    "/projects", "project.controller", "ProjectService", "✅", "Filtrage par rôle"],
        ["GET",    "/projects/:id", "project.controller", "ProjectService", "✅", "—"],
        ["POST",   "/projects", "project.controller", "ProjectService", "✅", "ADMIN"],
        ["PUT",    "/projects/:id", "project.controller", "ProjectService", "✅", "ADMIN"],
        ["DELETE", "/projects/:id", "project.controller", "ProjectService", "✅", "ADMIN"],
        ["GET",    "/tasks", "task.controller", "TaskService", "✅", "Filtrage rôle"],
        ["GET",    "/tasks/:id", "task.controller", "TaskService", "✅", "—"],
        ["POST",   "/tasks", "task.controller", "TaskService", "✅", "ADMIN"],
        ["PUT",    "/tasks/:id", "task.controller", "TaskService", "✅", "ADMIN"],
        ["DELETE", "/tasks/:id", "task.controller", "TaskService", "✅", "ADMIN"],
        ["GET",    "/tasks/:id/comments", "comment.controller", "CommentService", "✅", "—"],
        ["POST",   "/tasks/:id/comments", "comment.controller", "CommentService", "✅", "—"],
      ]),
      spacer(),

      h2("1.4 Documents"),
      makeEndpointTable([
        ["GET",    "/documents/client/:id", "document.controller", "DocumentService", "⚠️ (limité)", "ADMIN — ancien système"],
        ["POST",   "/documents", "document.controller", "DocumentService", "⚠️ (limité)", "ADMIN — ancien système"],
        ["GET",    "/enhanced-documents", "enhancedDocument.controller", "EnhancedDocumentService", "✅", "Système complet"],
        ["GET",    "/enhanced-documents/:id", "enhancedDocument.controller", "EnhancedDocumentService", "✅", "—"],
        ["POST",   "/enhanced-documents", "enhancedDocument.controller", "EnhancedDocumentService", "✅", "—"],
        ["PUT",    "/enhanced-documents/:id", "enhancedDocument.controller", "EnhancedDocumentService", "✅", "—"],
        ["DELETE", "/enhanced-documents/:id", "enhancedDocument.controller", "EnhancedDocumentService", "✅", "—"],
        ["POST",   "/enhanced-documents/:id/versions", "enhancedDocument.controller", "EnhancedDocumentService", "✅", "Versioning"],
      ]),
      spacer(),

      h2("1.5 Freelancers & Missions"),
      makeEndpointTable([
        ["GET",    "/freelancers", "freelancer.controller", "FreelancerService", "✅ frontend appelle", "🔴 ROUTE NON ENREGISTRÉE"],
        ["GET",    "/freelancers/:id", "freelancer.controller", "FreelancerService", "✅ frontend appelle", "🔴 ROUTE NON ENREGISTRÉE"],
        ["POST",   "/freelancers/me", "freelancer.controller", "FreelancerService", "✅", "FREELANCER role"],
        ["PUT",    "/freelancers/me", "freelancer.controller", "FreelancerService", "✅", "—"],
        ["DELETE", "/freelancers/me", "freelancer.controller", "FreelancerService", "✅", "—"],
        ["GET",    "/freelancers/missions", "freelancer.controller", "MissionService", "✅", "Auth multi-rôle"],
        ["POST",   "/freelancers/missions", "freelancer.controller", "MissionService", "✅", "ADMIN/CLIENT"],
        ["PUT",    "/freelancers/missions/:id", "freelancer.controller", "MissionService", "✅", "—"],
        ["DELETE", "/freelancers/missions/:id", "freelancer.controller", "MissionService", "✅", "—"],
        ["GET",    "/freelancers/missions/:id/applications", "freelancer.controller", "MissionService", "✅", "ADMIN/CLIENT"],
        ["PATCH",  "/freelancers/missions/:id/applications/:appId", "freelancer.controller", "MissionService", "✅", "ADMIN/CLIENT"],
        ["POST",   "/freelancers/missions/:id/apply", "freelancer.controller", "MissionService", "✅", "FREELANCER"],
        ["POST",   "/freelancer-applications", "freelancerApp.controller", "FreelancerAppService", "✅", "Public — form"],
        ["GET",    "/freelancer-applications", "freelancerApp.controller", "FreelancerAppService", "✅", "ADMIN"],
        ["GET",    "/freelancer-applications/:id", "freelancerApp.controller", "FreelancerAppService", "✅", "ADMIN"],
        ["POST",   "/freelancer-applications/:id/reject", "freelancerApp.controller", "FreelancerAppService", "✅", "ADMIN"],
        ["POST",   "/freelancer-applications/:id/accept", "freelancerApp.controller", "FreelancerAppService", "✅", "ADMIN"],
      ]),
      spacer(),

      h2("1.6 Portal Premium — Proposals, Approvals, Invoices"),
      makeEndpointTable([
        ["GET",    "/proposals", "proposal.controller", "ProposalService", "✅", "ADMIN/MANAGER"],
        ["GET",    "/proposals/:id", "proposal.controller", "ProposalService", "✅", "—"],
        ["POST",   "/proposals", "proposal.controller", "ProposalService", "✅", "—"],
        ["PUT",    "/proposals/:id", "proposal.controller", "ProposalService", "✅", "—"],
        ["DELETE", "/proposals/:id", "proposal.controller", "ProposalService", "✅", "ADMIN"],
        ["POST",   "/proposals/:id/send", "proposal.controller", "ProposalService", "✅", "—"],
        ["POST",   "/proposals/:id/accept", "proposal.controller", "ProposalService", "✅", "—"],
        ["POST",   "/proposals/:id/reject", "proposal.controller", "ProposalService", "✅", "—"],
        ["POST",   "/proposals/:id/view", "proposal.controller", "ProposalService", "✅", "tracking"],
        ["POST",   "/proposals/:id/sections", "proposal.controller", "ProposalService", "✅", "—"],
        ["PUT",    "/proposals/:id/sections/:sid", "proposal.controller", "ProposalService", "✅", "—"],
        ["DELETE", "/proposals/:id/sections/:sid", "proposal.controller", "ProposalService", "✅", "ADMIN"],
        ["GET",    "/approvals", "approval.controller", "ApprovalService", "✅", "—"],
        ["GET",    "/approvals/:id", "approval.controller", "ApprovalService", "✅", "—"],
        ["POST",   "/approvals", "approval.controller", "ApprovalService", "✅", "—"],
        ["PUT",    "/approvals/:id", "approval.controller", "ApprovalService", "✅", "—"],
        ["DELETE", "/approvals/:id", "approval.controller", "ApprovalService", "✅", "—"],
        ["POST",   "/approvals/:id/approve", "approval.controller", "ApprovalService", "✅", "—"],
        ["POST",   "/approvals/:id/reject", "approval.controller", "ApprovalService", "✅", "—"],
        ["POST",   "/approvals/:id/comment", "approval.controller", "ApprovalService", "✅", "—"],
        ["POST",   "/approvals/:id/attachments", "approval.controller", "ApprovalService", "✅", "—"],
        ["DELETE", "/approvals/:id/attachments/:aid", "approval.controller", "ApprovalService", "✅", "—"],
        ["GET",    "/invoices", "invoice.controller", "InvoiceService", "✅", "—"],
        ["GET",    "/invoices/:id", "invoice.controller", "InvoiceService", "✅", "—"],
        ["POST",   "/invoices", "invoice.controller", "InvoiceService", "✅", "—"],
        ["PUT",    "/invoices/:id", "invoice.controller", "InvoiceService", "✅", "—"],
        ["DELETE", "/invoices/:id", "invoice.controller", "InvoiceService", "✅", "—"],
        ["POST",   "/invoices/:id/send", "invoice.controller", "InvoiceService", "✅", "—"],
        ["POST",   "/invoices/:id/payments", "invoice.controller", "InvoiceService", "✅", "—"],
        ["POST",   "/invoices/:id/reminders", "invoice.controller", "InvoiceService", "✅", "—"],
        ["POST",   "/invoices/:id/items", "invoice.controller", "InvoiceService", "✅", "—"],
        ["PUT",    "/invoices/:id/items/:iid", "invoice.controller", "InvoiceService", "✅", "—"],
        ["DELETE", "/invoices/:id/items/:iid", "invoice.controller", "InvoiceService", "✅", "—"],
      ]),
      spacer(),

      h2("1.7 Onboarding, Client Success & Notifications"),
      makeEndpointTable([
        ["GET",    "/client-onboardings", "onboarding.controller", "ClientOnboardingService", "✅", "21 routes totales"],
        ["POST",   "/client-onboardings/steps/:sid/contract", "onboarding.controller", "ClientOnboardingService", "✅", "⚠️ 12 endpoints similaires"],
        ["GET",    "/notifications", "notification.controller", "NotificationService", "✅", "—"],
        ["PATCH",  "/notifications/:id/read", "notification.controller", "NotificationService", "✅", "—"],
        ["PATCH",  "/notifications/read-all", "notification.controller", "NotificationService", "✅", "—"],
        ["GET",    "/client-success/:clientId", "clientSuccess.controller", "ClientSuccessService", "✅", "—"],
        ["PUT",    "/client-success/:clientId/score", "clientSuccess.controller", "ClientSuccessService", "✅", "—"],
        ["POST",   "/client-success/:clientId/calculate-score", "clientSuccess.controller", "ClientSuccessService", "✅", "⚠️ Action via POST"],
      ]),
      spacer(),

      h2("1.8 Service Requests, Uploads, Ratings, AI"),
      makeEndpointTable([
        ["GET",    "/service-requests/client", "serviceRequest.controller", "SRService", "✅", "CLIENT role"],
        ["POST",   "/service-requests/client", "serviceRequest.controller", "SRService", "✅", "—"],
        ["GET",    "/service-requests/admin", "serviceRequest.controller", "SRService", "✅", "ADMIN/MANAGER"],
        ["GET",    "/service-requests/admin/:id", "serviceRequest.controller", "SRService", "✅", "—"],
        ["PATCH",  "/service-requests/admin/:id", "serviceRequest.controller", "SRService", "✅", "—"],
        ["DELETE", "/service-requests/admin/:id", "serviceRequest.controller", "SRService", "✅", "—"],
        ["POST",   "/service-requests/admin/:id/comments", "serviceRequest.controller", "SRService", "✅", "—"],
        ["DELETE", "/service-requests/admin/:id/comments/:cid", "serviceRequest.controller", "SRService", "✅", "—"],
        ["GET",    "/service-requests/company", "serviceRequest.controller", "SRService", "🔴 LEGACY", "Non utilisé frontend"],
        ["PUT",    "/service-requests/:id", "serviceRequest.controller", "SRService", "🔴 LEGACY", "Non utilisé frontend"],
        ["POST",   "/upload/:context", "upload.controller", "UploadService", "✅", "cv/portfolio/doc/image"],
        ["DELETE", "/upload", "upload.controller", "UploadService", "✅", "—"],
        ["GET",    "/upload/signed-url", "upload.controller", "UploadService", "✅", "Authentifié"],
        ["GET",    "/ratings/freelancers/:id", "rating.controller", "RatingService", "✅", "Public"],
        ["GET",    "/ratings/freelancers/:id/stats", "rating.controller", "RatingService", "✅", "Public"],
        ["GET",    "/ratings/:id", "rating.controller", "RatingService", "✅", "—"],
        ["POST",   "/ratings", "rating.controller", "RatingService", "✅", "CLIENT/ADMIN"],
        ["PATCH",  "/ratings/:id", "rating.controller", "RatingService", "✅", "—"],
        ["DELETE", "/ratings/:id", "rating.controller", "RatingService", "✅", "—"],
        ["POST",   "/ai/chat", "ai.controller", "OpenAI direct", "✅", "ADMIN/MANAGER"],
        ["GET",    "/search", "search.controller", "SearchService", "✅", "—"],
        ["POST",   "/contact", "contact.controller", "ContactService", "✅", "Public"],
        ["GET",    "/contact", "contact.controller", "ContactService", "✅", "ADMIN"],
        ["PATCH",  "/contact/:id", "contact.controller", "ContactService", "✅", "ADMIN"],
      ]),
      spacer(),

      // ══════════════════════════════════════════════
      // 2. ENDPOINTS REDONDANTS
      // ══════════════════════════════════════════════
      h1("2. 🔴 Endpoints Redondants — Analyse Détaillée"),

      h2("2.1 Triple Redondance : Dashboard Summary"),
      para("Trois endpoints retournent des données de tableau de bord très similaires, alimentées par le même repository (summaryRepository.getEnhancedDashboardSummary) :"),
      spacer(),
      makeEndpointTable([
        ["GET", "/dashboard/summary", "dashboard.controller", "DashboardService", "✅ DashboardPage (KPIs)", "Données simples (4 compteurs)"],
        ["GET", "/analytics/summary", "analytics.controller", "AnalyticsService", "✅ DashboardPage + AnalyticsPage", "Avec filtre date, charts"],
        ["GET", "/summaries/dashboard", "summary.controller", "SummaryService", "🔴 JAMAIS APPELÉ", "Données enrichies non utilisées"],
      ], ["Method", "Route", "Contrôleur", "Service", "Frontend", "Notes"]),
      spacer(),
      para("Problème : DashboardPage effectue 2 appels API au chargement (/dashboard/summary ET /analytics/summary). Le frontend attend deux promesses distinctes pour afficher la même page. SummaryService.getEnhancedDashboardSummary() est une copie quasi-identique de DashboardService.getSummary() : même clé de cache (cacheKeys.dashboardSummary), même repository, même TTL.", { color: COLOR.red }),
      spacer(),

      h2("2.2 Double Système de Documents"),
      para("Deux systèmes de gestion de documents coexistent :"),
      makeEndpointTable([
        ["GET",  "/documents/client/:clientId", "document.controller", "DocumentService", "⚠️ usage minimal", "Système simple (INVOICE/CONTRACT/OTHER)"],
        ["POST", "/documents", "document.controller", "DocumentService", "⚠️ usage minimal", "Validation inline dans le contrôleur"],
        ["GET",  "/enhanced-documents", "enhancedDocument.controller", "EnhancedDocumentService", "✅ pleinement utilisé", "Système complet avec versioning, tags, accès"],
        ["POST", "/enhanced-documents", "enhancedDocument.controller", "EnhancedDocumentService", "✅ pleinement utilisé", "—"],
      ], ["Method", "Route", "Contrôleur", "Service", "Frontend", "Notes"]),
      spacer(),
      para("document.controller.ts contient une définition de schéma Zod (createDocumentSchema) en dur dans le fichier contrôleur au lieu d'utiliser le dossier /validators, contrairement à toutes les autres ressources. DocumentService est un vestige de la V1 remplacé par EnhancedDocumentService.", { color: COLOR.orange }),
      spacer(),

      h2("2.3 Double Route Utilisateurs"),
      para("Deux routes retournent la liste des utilisateurs de la même compagnie :"),
      makeEndpointTable([
        ["GET", "/companies/users", "company.controller → companyService.getCompanyUsers", "→ userRepository.findByCompanyId", "1 seul usage (TasksPage)", "ADMIN"],
        ["GET", "/users", "user.controller → userService.getUsersByCompany", "→ userRepository.findByCompanyId", "usersApi.getUsers()", "ADMIN/MANAGER"],
      ], ["Method", "Route", "Contrôleur/Service", "Repository", "Frontend", "Rôles"]),
      spacer(),
      para("Les deux routes appellent exactement la même méthode repository : userRepository.findByCompanyId(companyId, options). La seule différence est que /users est accessible aux MANAGER en plus des ADMIN.", { color: COLOR.orange }),
      spacer(),

      h2("2.4 Double Endpoint « Profil Actuel »"),
      makeEndpointTable([
        ["GET", "/auth/me", "auth.controller → authService.me → findById", "authApi.getMe()", "✅ utilisé dans axios.ts interceptors", "—"],
        ["GET", "/users/me", "user.controller → userService.getMe → findById", "usersApi.getMe()", "✅ utilisé dans useAuth.ts", "—"],
      ], ["Method", "Route", "Chaîne d'appel", "Client API", "Utilisation", "Notes"]),
      spacer(),
      para("Les deux endpoints consultent la même entité User par userId. auth/me appelle authService.me() → userRepository.findById(). users/me appelle userService.getMe() → userRepository.findById(). Résultat identique, doublon de logique.", { color: COLOR.orange }),
      spacer(),

      h2("2.5 Redondance changePassword"),
      para("L'endpoint POST /auth/change-password est déclaré deux fois dans le frontend :"),
      bullet("client/src/api/auth.api.ts → authApi.changePassword() → correctement importé"),
      bullet("client/src/api/freelancerApplications.api.ts → authApi re-déclaré localement (lignes 73-78 du fichier) → utilisé dans useFreelancerApplications.ts"),
      spacer(),
      para("Cette duplication provient d'un copier-coller. Si l'endpoint change, la mise à jour devra être faite à deux endroits.", { color: COLOR.orange }),
      spacer(),

      // ══════════════════════════════════════════════
      // 3. ENDPOINTS INUTILISÉS
      // ══════════════════════════════════════════════
      h1("3. Endpoints Inutilisés / Manquants / Legacy"),

      makeStatusTable([
        ["GET /summaries/dashboard", "INUTILISÉ", "Aucun appel frontend. DashboardPage utilise /dashboard/summary et /analytics/summary à la place."],
        ["GET /summaries/clients/:id", "INUTILISÉ", "Aucun hook ni appel dans le frontend (grep exhaustif réalisé)."],
        ["GET /summaries/projects/:id", "INUTILISÉ", "Idem — aucun consommateur frontend."],
        ["GET /service-requests/company", "LEGACY", "Alias de adminGetServiceRequests. Commenté 'legacy backward compat'. Non utilisé par le frontend."],
        ["PUT /service-requests/:id", "LEGACY", "Ancien endpoint générique. Remplacé par PATCH /admin/:id. Non appelé par le frontend."],
        ["GET /freelancers", "MANQUANT", "frontend appelle GET /freelancers (freelancersApi.getAll()) mais AUCUNE route n'est enregistrée côté backend. → 404 garanti."],
        ["GET /freelancers/:id", "MANQUANT", "Idem — freelancersApi.getById() appelle /freelancers/:id qui n'existe pas en backend. Les handlers (getPublicFreelancers, getFreelancerById) existent dans le contrôleur mais ne sont jamais montés sur le router."],
        ["POST /metrics/web-vitals", "PARTIEL", "Existe dans /api/v1/metrics (observability/routes.ts) mais NON enregistré dans routes/index.ts. metrics.api.ts du frontend envoie vers cette URL. Peut fonctionner si app.ts monte metricsRoutes avant apiRoutes."],
        ["GET /documents", "INUTILISÉ", "Le ancien système document.* n'est plus utilisé en frontend (remplacé par /enhanced-documents)."],
      ]),
      spacer(),

      // ══════════════════════════════════════════════
      // 4. ANALYSE REST
      // ══════════════════════════════════════════════
      h1("4. Analyse REST — Violations et Incohérences"),

      h2("4.1 Actions déguisées en POST — State Machine"),
      para("Plusieurs endpoints utilisent des verbes dans l'URL au lieu d'utiliser des sous-ressources ou des PATCH pour changer d'état :"),
      makeEndpointTable([
        ["POST", "/proposals/:id/send", "→ action métier", "Problème : verbe dans l'URL", "Suggestion", "PATCH /proposals/:id {status:'SENT'}"],
        ["POST", "/proposals/:id/accept", "→ action métier", "Problème : verbe dans l'URL", "Suggestion", "PATCH /proposals/:id {status:'ACCEPTED'}"],
        ["POST", "/proposals/:id/reject", "→ action métier", "Problème : verbe dans l'URL", "Suggestion", "PATCH /proposals/:id {status:'REJECTED'}"],
        ["POST", "/proposals/:id/view", "→ tracking vue", "Problème : verbe dans l'URL", "Peut rester", "Tracking implicite, acceptable"],
        ["POST", "/approvals/:id/approve", "→ action métier", "Problème : verbe dans l'URL", "Suggestion", "PATCH /approvals/:id {status:'APPROVED'}"],
        ["POST", "/approvals/:id/reject", "→ action métier", "Problème : verbe dans l'URL", "Suggestion", "PATCH /approvals/:id {status:'REJECTED'}"],
        ["POST", "/invoices/:id/send", "→ action métier", "Problème : verbe dans l'URL", "Suggestion", "PATCH /invoices/:id {status:'SENT'}"],
        ["POST", "/leads/:id/convert", "→ conversion", "Semi-acceptable", "Acceptable", "Action non-CRUD justifiée"],
        ["POST", "/client-success/:id/calculate-score", "→ compute", "Action side-effect", "Alternative", "POST /client-success/:id/score ou PATCH"],
        ["POST", "/freelancer-applications/:id/accept", "→ action", "Problème : verbe", "Suggestion", "PATCH /freelancer-applications/:id {status:'ACCEPTED'}"],
        ["POST", "/freelancer-applications/:id/reject", "→ action", "Problème : verbe", "Suggestion", "PATCH /freelancer-applications/:id {status:'REJECTED'}"],
      ]),
      spacer(),

      h2("4.2 Incohérence PATCH vs PUT"),
      para("Le projet mélange PATCH et PUT sans règle cohérente :"),
      bullet("PUT utilisé pour les mises à jour partielles de clients, leads, projets, tâches, missions (sémantique incorrect — PUT est pour le remplacement complet)"),
      bullet("PATCH utilisé pour les utilisateurs, notifications, service-requests, ratings (correct)"),
      bullet("Les validators côté backend utilisent .optional() pour tous les champs → toutes les routes PUT agissent en réalité comme des PATCH"),
      spacer(),
      para("Recommandation : harmoniser vers PATCH pour toutes les mises à jour partielles. PUT uniquement si le payload remplace l'entité entière (rare)."),
      spacer(),

      h2("4.3 Architecture URL ServiceRequests non-RESTful"),
      para("Le préfixe /admin et /client dans les URLs viole les conventions REST :"),
      codeBlock("GET /service-requests/client        → devrait être GET /service-requests?scope=mine"),
      codeBlock("GET /service-requests/admin         → devrait être GET /service-requests"),
      codeBlock("GET /service-requests/admin/:id     → devrait être GET /service-requests/:id"),
      codeBlock("PATCH /service-requests/admin/:id   → devrait être PATCH /service-requests/:id"),
      para("Le rôle de l'utilisateur (CLIENT vs ADMIN) doit être déterminé par le middleware d'authentification, pas encodé dans l'URL."),
      spacer(),

      h2("4.4 Route path ambiguë — clientOnboarding"),
      para("Le mixte de :id et de sous-ressources distinctes crée des ambiguïtés de routage Express :"),
      codeBlock("PUT /client-onboardings/steps/:stepId         ← conflict potentiel avec /:id"),
      codeBlock("PUT /client-onboardings/contracts/:contractId  ← mieux : /client-onboardings/:id/steps/:stepId"),
      codeBlock("PUT /client-onboardings/payments/:paymentId"),
      para("Chaque sous-ressource (contract, payment, questionnaire...) possède des routes indépendantes avec des IDs hors contexte de l'onboarding parent, rendant les URLs imprévisibles."),
      spacer(),

      // ══════════════════════════════════════════════
      // 5. ANALYSE DES SERVICES
      // ══════════════════════════════════════════════
      h1("5. Analyse des Services — Duplications et Anti-patterns"),

      h2("5.1 DashboardService vs SummaryService — Clone partiel"),
      para("Fichiers concernés :"),
      bullet("server/src/services/dashboard.service.ts"),
      bullet("server/src/services/summary.service.ts"),
      spacer(),
      codeBlock("// dashboard.service.ts"),
      codeBlock("async getSummary(companyId) {"),
      codeBlock("  const cacheKey = cacheKeys.dashboardSummary(companyId);"),
      codeBlock("  const cached = await cacheGet(cacheKey);"),
      codeBlock("  if (cached) return cached;"),
      codeBlock("  const summary = await summaryRepository.getEnhancedDashboardSummary(companyId);"),
      codeBlock("  await cacheSet(cacheKey, summary, cacheTTL.dashboard, [...]);"),
      codeBlock("  return summary;"),
      codeBlock("}"),
      spacer(),
      codeBlock("// summary.service.ts — IDENTIQUE"),
      codeBlock("async getEnhancedDashboardSummary(companyId) {"),
      codeBlock("  const cacheKey = cacheKeys.dashboardSummary(companyId);  // même clé!"),
      codeBlock("  const cached = await cacheGet(cacheKey);"),
      codeBlock("  if (cached) return cached;"),
      codeBlock("  const summary = await summaryRepository.getEnhancedDashboardSummary(companyId); // même call!"),
      codeBlock("  await cacheSet(cacheKey, summary, cacheTTL.dashboard, [...]);"),
      codeBlock("  return summary;"),
      codeBlock("}"),
      spacer(),
      para("Résultat : les deux services utilisent la même clé de cache. Un write via l'un invalide l'autre. C'est une source potentielle de bugs de cohérence."),
      spacer(),

      h2("5.2 ClientOnboardingService — 12 méthodes transparentes"),
      para("Fichier : server/src/services/clientOnboarding.service.ts"),
      para("12 méthodes (createContract, updateContract, createPayment, updatePayment, createQuestionnaire, updateQuestionnaire, etc.) sont des proxies transparents sans aucune logique :"),
      codeBlock("async createContract(stepId, companyId, data) {"),
      codeBlock("  return clientOnboardingRepository.createContract(stepId, companyId, data);"),
      codeBlock("}"),
      codeBlock("async updateContract(contractId, companyId, data) {"),
      codeBlock("  return clientOnboardingRepository.updateContract(contractId, companyId, data);"),
      codeBlock("}"),
      codeBlock("// × 6 types × 2 (create/update) = 12 méthodes identiques en structure"),
      spacer(),
      para("Ces méthodes n'ajoutent aucune valeur : pas de validation, pas de notification, pas de cache invalidation. Elles pourraient être soit supprimées (appel direct au repository), soit mutualisées avec une méthode générique upsertOnboardingStep(type, id, companyId, data)."),
      spacer(),

      h2("5.3 ClientSuccessService — pattern addX/updateX/deleteX répété ×4"),
      para("Fichier : server/src/services/clientSuccess.service.ts"),
      para("Le même pattern CRUD est répété 4 fois pour Objective, Metric, Recommendation et Timeline :"),
      codeBlock("async addObjective(clientId, companyId, data) → validateOwnership + create"),
      codeBlock("async updateObjective(objectiveId, companyId, data) → validateOwnership + update"),
      codeBlock("async deleteObjective(objectiveId, companyId) → validateOwnership + delete"),
      codeBlock("// × 4 sous-entités = 12 méthodes identiques en structure"),
      para("Une abstraction générique (type SuccessSubEntity = 'objective' | 'metric' | ...) réduirait ce service de ~60%."),
      spacer(),

      h2("5.4 textQuery/queryText — helpers dupliqués"),
      para("La même fonction utilitaire est re-définie dans plusieurs contrôleurs :"),
      bullet("approval.controller.ts → function queryText(value) { return typeof value === 'string' ? value : undefined; }"),
      bullet("invoice.controller.ts → function textQuery(value) { return typeof value === 'string' ? value : undefined; }"),
      bullet("proposal.controller.ts → function textQuery(value) { ... } (identique)"),
      bullet("enhancedDocument.controller.ts → function textQuery(value) { ... } (identique)"),
      spacer(),
      para("Fichier manquant : utils/queryHelpers.ts (ou équivalent) qui centraliserait ces helpers."),
      spacer(),

      // ══════════════════════════════════════════════
      // 6. ANALYSE PRISMA
      // ══════════════════════════════════════════════
      h1("6. Analyse Prisma — Requêtes et Performance"),

      h2("6.1 Validation d'ownership en double requête"),
      para("Plusieurs repositories effectuent une requête de validation d'existence AVANT l'opération principale :"),
      codeBlock("// clientSuccessRepository.addObjective()"),
      codeBlock("await prisma.clientSuccess.findFirstOrThrow({"),
      codeBlock("  where: { id: successId, client: { companyId } },"),
      codeBlock("  select: { id: true },   // requête 1 — validation uniquement"),
      codeBlock("});"),
      codeBlock("return prisma.successObjective.create({ data: { ...data, successId } }); // requête 2"),
      spacer(),
      para("Ce pattern (findFirstOrThrow puis create/update) effectue 2 aller-retours DB pour chaque opération. Il est répété dans clientSuccess.repository.ts pour chaque sous-entité (×8 méthodes). Prisma permet de fusionner ces opérations avec des nested writes ou des transactions."),
      spacer(),

      h2("6.2 Potentiel N+1 — summaryRepository.getClientSummary"),
      para("Fichier : server/src/repositories/summary.repository.ts"),
      codeBlock("const projects = await prisma.project.findMany({"),
      codeBlock("  where: { companyId, clientId },"),
      codeBlock("  select: { id, name, status, tasks: { select: { id, status } } }"),
      codeBlock("});"),
      codeBlock("const projectIds = projects.map(p => p.id);"),
      codeBlock("const progressMap = await getProgressByProjectIds(projectIds); // 2ème requête"),
      spacer(),
      para("getProgressByProjectIds() pourrait déclencher des requêtes supplémentaires par projet selon son implémentation. Le résultat est une requête projet + N requêtes de progress. À vérifier et potentiellement fusionner en un seul include si possible."),
      spacer(),

      h2("6.3 select trop large — clientSuccessRepository.findByClientId"),
      para("Fichier : server/src/repositories/clientSuccess.repository.ts"),
      codeBlock("return prisma.clientSuccess.findFirst({"),
      codeBlock("  include: {"),
      codeBlock("    client: true,                              // ALL client fields"),
      codeBlock("    objectives: { orderBy: { createdAt: 'desc' } },   // ALL objective fields"),
      codeBlock("    metrics: {"),
      codeCheck("      include: { history: { take: 30 } }   // ALL metric + 30 history entries"),
      codeBlock("    },"),
      codeBlock("    recommendations: { orderBy: ... },"),
      codeBlock("    timeline: { orderBy: ... },"),
      codeBlock("  }"),
      codeBlock("});"),
      spacer(),
      para("L'utilisation de include: true (sans select) charge toutes les colonnes de toutes les tables liées. Pour client: true notamment, cela inclut des champs potentiellement volumineux. Préférer des select explicites."),
      spacer(),

      h2("6.4 Requêtes prisma.$executeRawUnsafe — Risque sécurité"),
      para("Fichier : server/src/jobs/processors/maintenance.processor.ts"),
      codeBlock("await prisma.$executeRawUnsafe(`"),
      codeBlock("  CREATE TABLE IF NOT EXISTS \"${partitionName}\""),
      codeBlock("  PARTITION OF \"${archiveTable}\""),
      codeBlock("  FOR VALUES FROM ('${rangeStart}') TO ('${next}');"),
      codeBlock(");"),
      spacer(),
      para("$executeRawUnsafe avec interpolation de chaînes est risqué même si les valeurs viennent d'une source interne. Le nom de table (archiveTable) vient de la constante ARCHIVE_RULES — acceptable — mais les dates (rangeStart, next) proviennent de calculs Date. Utiliser $executeRaw avec des tagged templates ou valider strictement les inputs."),
      spacer(),

      // ══════════════════════════════════════════════
      // 7. ANALYSE DES CONTRÔLEURS
      // ══════════════════════════════════════════════
      h1("7. Analyse des Contrôleurs"),

      h2("7.1 Pattern try/catch identique dans tous les contrôleurs CRUD"),
      para("Chaque handler dans les contrôleurs de base (lead, client, project, task) suit exactement le même pattern :"),
      codeBlock("export const getLeads: RequestHandler = async (req, res, next) => {"),
      codeBlock("  try {"),
      codeBlock("    const companyId = req.user?.companyId!;"),
      codeBlock("    const options = parseListQuery(req.query);"),
      codeBlock("    const result = await leadService.getLeads(companyId, options);"),
      codeBlock("    res.json(result);"),
      codeBlock("  } catch (error) { next(error); }"),
      codeBlock("};"),
      spacer(),
      para("Ce pattern est répété 5 fois (getLeads, getLead, createLead, updateLead, deleteLead) et dupliqué dans client.controller, project.controller, task.controller. Un wrapper asyncHandler(fn) éliminerait les 40+ blocs try/catch redondants."),
      spacer(),

      h2("7.2 Contrôleur document.controller.ts — Validation hors convention"),
      para("Fichier : server/src/controllers/document.controller.ts"),
      para("La validation Zod est définie directement dans le contrôleur (ligne 10-15) au lieu d'utiliser le middleware validate() et le dossier /validators :"),
      codeBlock("// document.controller.ts (MAUVAISE PRATIQUE)"),
      codeBlock("const createDocumentSchema = z.object({ name, type, url, projectId, clientId });"),
      codeBlock("// ..."),
      codeBlock("const data = createDocumentSchema.parse(req.body); // dans le handler"),
      spacer(),
      para("Tous les autres contrôleurs utilisent validate(schema) depuis /validators/*.ts. document.controller.ts crée une incohérence architecturale."),
      spacer(),

      h2("7.3 clientOnboarding.controller — Handlers en tableaux (RequestHandler[])"),
      para("Fichier : server/src/controllers/clientOnboarding.controller.ts"),
      para("12 des 14 exports sont des RequestHandler[] (tableaux avec validation + handler) au lieu d'un RequestHandler simple. Cela complique l'inférence de types et la lecture :"),
      codeBlock("export const createContract: RequestHandler[] = ["),
      codeBlock("  validate(updateContractValidator),  // middleware inline dans contrôleur"),
      codeBlock("  async (req, res, next) => { ... }"),
      codeBlock("];"),
      para("La convention habituelle du projet met validate() dans le fichier de routes. Cette incohérence oblige le routeur à faire un spread (...createContract) au lieu d'un simple passage de fonction."),
      spacer(),

      // ══════════════════════════════════════════════
      // 8. ANALYSE DES MIDDLEWARES
      // ══════════════════════════════════════════════
      h1("8. Analyse des Middlewares"),

      h2("8.1 Middlewares en bonne santé"),
      para("Les middlewares existants sont bien structurés et non redondants :"),
      bullet("auth.middleware.ts — JWT vérification, bien ciblé"),
      bullet("rbac.middleware.ts — authorize() générique avec spread de rôles"),
      bullet("tenant.middleware.ts — requireCompanyTenant() et requireClientTenant() distincts et bien séparés"),
      bullet("validate.middleware.ts — wrapper Zod, pattern uniforme"),
      bullet("cache.middleware.ts — httpCache() et dashboardCache, lisibles"),
      bullet("rateLimit.middleware.ts — 4 limiteurs différents selon le contexte"),
      bullet("upload.middleware.ts — createUploadMiddleware() par contexte"),
      spacer(),

      h2("8.2 sensitiveWriteRateLimit — Non utilisé"),
      para("Fichier : server/src/middlewares/rateLimit.middleware.ts"),
      para("sensitiveWriteRateLimit est défini (windowMs: 60s, limit: 30) mais n'est appliqué sur aucune route dans le projet. Soit l'utiliser sur les routes sensibles (création de compte, reset password en plus de authRateLimit), soit le supprimer."),
      spacer(),

      h2("8.3 requireCompanyTenant() redondance partielle"),
      para("Sur clientOnboarding.routes.ts, auth.routes.ts et freelancer-applications.routes.ts, le middleware requireCompanyTenant() est appliqué globalement (router.use()) mais certaines routes sous ces groupes n'ont pas de companyId associé (freelancer public, auth public). Aucun bug réel, mais cela force un contrôle inutile sur les routes publiques correctement séparées."),
      spacer(),

      h2("8.4 metricsAuth.middleware.ts — Non inclus dans les tests"),
      para("Fichier : server/src/middlewares/metricsAuth.middleware.ts"),
      para("Ce middleware protège /metrics (prometheus) mais n'est pas couvert par la suite de tests existante (test/). Les 5 tests existants couvrent auth, rateLimit, rbac, rating et listQuery — mais pas metricsAuth."),
      spacer(),

      // ══════════════════════════════════════════════
      // 9. ANALYSE DES UPLOADS
      // ══════════════════════════════════════════════
      h1("9. Analyse des Uploads"),

      h2("9.1 Deux systèmes d'upload en parallèle"),
      para("Le projet dispose de deux mécanismes d'upload distincts :"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3000, 3000, 3360],
        rows: [
          new TableRow({
            tableHeader: true,
            children: ["Système", "Utilisé pour", "Mécanisme"].map(h => new TableCell({
              borders: cellBorders(COLOR.darkBlue),
              shading: { fill: COLOR.headerBg, type: ShadingType.CLEAR },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: COLOR.white, size: 18, font: "Arial" })] })]
            }))
          }),
          new TableRow({ children: ["POST /upload/:context", "cv, portfolio, document, image", "Multer → S3 via UploadService. Contexte dans l'URL. Générique."].map(cell => new TableCell({ borders: cellBorders(), shading: { fill: COLOR.white, type: ShadingType.CLEAR }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: cell, size: 18, font: "Arial" })] })] })) }),
          new TableRow({ children: ["POST /freelancer-applications (multipart)", "cvFile, portfolioFile uniquement", "Multer en mémoire dans le contrôleur lui-même (multer.memoryStorage()). Upload géré dans freelancerApplication.service.ts."].map(cell => new TableCell({ borders: cellBorders(), shading: { fill: COLOR.rowAlt, type: ShadingType.CLEAR }, margins: { top: 60, bottom: 60, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: cell, size: 18, font: "Arial" })] })] })) }),
        ]
      }),
      spacer(),
      para("Problème : la route /freelancer-applications gère l'upload en interne alors que POST /upload/cv et POST /upload/portfolio existent déjà dans le système générique. Les deux contextes ('cv' et 'portfolio') sont dans PUBLIC_UPLOAD_CONTEXTS sans authentification. Le formulaire Join-Us pourrait donc : (1) uploader CV via POST /upload/cv → récupérer l'URL, (2) uploader portfolio via POST /upload/portfolio → récupérer l'URL, (3) soumettre POST /freelancer-applications avec les URLs.", { color: COLOR.orange }),
      spacer(),

      h2("9.2 Opportunité de fusion"),
      para("Simplification possible : supprimer le multer de freelancerApplication.controller.ts et freelancerApplication.service.ts, et utiliser le système générique /upload/:context déjà en place. Cela :"),
      bullet("Éliminerait ~40 lignes de code dans le contrôleur"),
      bullet("Réduirait la complexité de freelancerApplication.service.ts"),
      bullet("Unifierait le comportement d'upload dans un seul service"),
      bullet("Permettrait de réutiliser les validations de type/taille déjà implémentées dans upload.middleware.ts"),
      spacer(),

      // ══════════════════════════════════════════════
      // 10. ANALYSE BULLMQ / REDIS
      // ══════════════════════════════════════════════
      h1("10. Analyse BullMQ / Redis"),

      h2("10.1 Utilisation réelle de Redis"),
      para("Redis est utilisé pour deux fonctions dans ce projet :"),
      bullet("Cache HTTP (cacheService.ts) — cacheGet/cacheSet/cacheDel — utilisé par dashboard, analytics, summary, authMe"),
      bullet("Queue BullMQ (jobs/) — deux queues : communication et maintenance"),
      spacer(),

      h2("10.2 Jobs actifs et leur utilité"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2800, 2000, 1400, 3160],
        rows: [
          new TableRow({
            tableHeader: true,
            children: ["Job", "Queue", "Planification", "Nécessité"].map(h => new TableCell({
              borders: cellBorders(COLOR.darkBlue),
              shading: { fill: COLOR.headerBg, type: ShadingType.CLEAR },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: COLOR.white, size: 18, font: "Arial" })] })]
            }))
          }),
          ...([
            ["send-notification", "communication", "À la demande", "✅ Utile — notifications asynchrones"],
            ["send-email", "communication", "À la demande", "✅ Utile — emails transactionnels avec retry"],
            ["cleanup-refresh-tokens", "maintenance", "3h00 quotidien", "✅ Utile — nettoyage tokens expirés DB"],
            ["archive-cold-data", "maintenance", "3h30 quotidien", "⚠️ Complexe — executeRawUnsafe, partitioning SQL manuel. Vérifier si les tables archive existent en schema Prisma."],
            ["warm-dashboard-summaries", "maintenance", "Toutes 6h", "⚠️ Questionnable — préchauffe le cache Redis. Utile seulement si le TTL cache expire avant les 6h ET si le trafic est faible la nuit. À évaluer selon l'usage réel."],
          ].map((row, i) => new TableRow({
            children: row.map((cell, j) => {
              let fill = i % 2 === 0 ? COLOR.white : COLOR.rowAlt;
              return new TableCell({
                borders: cellBorders(),
                shading: { fill, type: ShadingType.CLEAR },
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: cell, size: 17, font: "Arial" })] })]
              });
            })
          })))
        ]
      }),
      spacer(),

      h2("10.3 Redis est-il nécessaire ?"),
      para("Redis remplit deux rôles essentiels :"),
      bullet("Cache : Oui, le cache est utilisé activement sur les endpoints lents (dashboard, analytics). Sans Redis, chaque requête dashboard recalcule les agrégats depuis la DB. Nécessaire en production."),
      bullet("BullMQ queues : Les emails et notifications sont des workloads asynchrones avec retry. Sans queue, un échec email bloquerait la réponse HTTP. Nécessaire."),
      spacer(),
      para("Verdict : Redis est justifié dans ce projet. Il n'est pas possible de le supprimer sans réarchitecturer les emails (sync) et le cache (in-memory limité). En revanche, le job warm-dashboard-summaries pourrait être supprimé si le TTL cache (cacheTTL.dashboard) est jugé suffisant.", { color: COLOR.green }),
      spacer(),

      h2("10.4 Double connexion Redis dans index.ts"),
      para("Fichier : server/src/routes/index.ts"),
      para("La route /health/ready instancie un client Redis temporaire à chaque requête de health-check :"),
      codeBlock("const redis = createClient({ url: process.env.REDIS_URL });"),
      codeBlock("await redis.connect();"),
      codeBlock("const pong = await redis.ping();"),
      codeBlock("await redis.quit();  // créé et détruit à chaque appel"),
      spacer(),
      para("Ce pattern crée une nouvelle connexion Redis pour chaque health check (utilisé par les load balancers en continu). Utiliser le client singleton partagé (getBullRedisConnection()) ou le client Redis du cacheService."),
      spacer(),

      // ══════════════════════════════════════════════
      // LIVRABLE FINAL
      // ══════════════════════════════════════════════
      h1("Livrable Final — Synthèse et Plan d'Action"),

      h2("🔴 Redondances Critiques"),
      badgePara("🔴", "CRITIQUE", "Triple dashboard endpoint : /dashboard/summary + /analytics/summary + /summaries/dashboard → 2 appels HTTP par page, caches identiques, services dupliqués", COLOR.red, COLOR.lightRed),
      badgePara("🔴", "CRITIQUE", "GET /freelancers et GET /freelancers/:id : routes frontend appelées mais NON ENREGISTRÉES en backend → 404 en production", COLOR.red, COLOR.lightRed),
      badgePara("🔴", "CRITIQUE", "Double système document : /documents (V1) + /enhanced-documents (V2) coexistent. L'ancien n'est plus utilisé mais toujours monté.", COLOR.red, COLOR.lightRed),
      badgePara("🔴", "CRITIQUE", "authApi dupliqué dans freelancerApplications.api.ts : changePassword déclaré 2× dans le frontend", COLOR.red, COLOR.lightRed),
      spacer(),

      h2("🟠 Optimisations Recommandées"),
      badgePara("🟠", "IMPORTANT", "Routes legacy service-requests : GET /company et PUT /:id non utilisés → à supprimer", COLOR.orange, COLOR.lightOrange),
      badgePara("🟠", "IMPORTANT", "3 endpoints /summaries/* jamais appelés par le frontend → à supprimer ou à connecter", COLOR.orange, COLOR.lightOrange),
      badgePara("🟠", "IMPORTANT", "GET /companies/users duplique GET /users (même repository) → 1 seule route suffit", COLOR.orange, COLOR.lightOrange),
      badgePara("🟠", "IMPORTANT", "GET /auth/me duplique GET /users/me (même logique) → 1 seule route suffit", COLOR.orange, COLOR.lightOrange),
      badgePara("🟠", "IMPORTANT", "upload dans freelancerApplication.controller.ts : doublon du système /upload/:context", COLOR.orange, COLOR.lightOrange),
      badgePara("🟠", "IMPORTANT", "12 méthodes transparentes dans clientOnboardingService → proxies sans valeur ajoutée", COLOR.orange, COLOR.lightOrange),
      badgePara("🟠", "IMPORTANT", "textQuery/queryText redéfini dans 4 contrôleurs → extraire dans utils/queryHelpers.ts", COLOR.orange, COLOR.lightOrange),
      badgePara("🟠", "IMPORTANT", "40+ blocs try/catch identiques → wrapper asyncHandler(fn)", COLOR.orange, COLOR.lightOrange),
      badgePara("🟠", "IMPORTANT", "Double connexion Redis dans /health/ready → utiliser le client singleton", COLOR.orange, COLOR.lightOrange),
      badgePara("🟠", "IMPORTANT", "sensitiveWriteRateLimit défini mais jamais appliqué → utiliser ou supprimer", COLOR.orange, COLOR.lightOrange),
      spacer(),

      h2("🟢 Architecture Correcte"),
      badgePara("🟢", "OK", "Séparation routes/controllers/services/repositories bien appliquée", COLOR.green, COLOR.lightGreen),
      badgePara("🟢", "OK", "RBAC avec authorize() générique, bien structuré et cohérent", COLOR.green, COLOR.lightGreen),
      badgePara("🟢", "OK", "Tenant isolation (requireCompanyTenant / requireClientTenant) systématique", COLOR.green, COLOR.lightGreen),
      badgePara("🟢", "OK", "Système de cache par tags (invalidateTags) bien conçu", COLOR.green, COLOR.lightGreen),
      badgePara("🟢", "OK", "BullMQ avec retry, dead-letter logging, et workers cloisonnés : bonne pratique", COLOR.green, COLOR.lightGreen),
      badgePara("🟢", "OK", "Upload générique /upload/:context avec contextes PUBLIC/PRIVATE bien géré", COLOR.green, COLOR.lightGreen),
      badgePara("🟢", "OK", "Validators Zod dans /validators/*.ts — bonne séparation (sauf document.controller.ts)", COLOR.green, COLOR.lightGreen),
      badgePara("🟢", "OK", "Frontend API files bien organisés par domaine dans /api/", COLOR.green, COLOR.lightGreen),
      spacer(),

      // ══════════════════════════════════════════════
      // TABLEAUX D'ACTION
      // ══════════════════════════════════════════════
      h1("Plan d'Action Détaillé"),

      h2("Endpoints à Supprimer"),
      makeStatusTable([
        ["GET /summaries/dashboard", "SUPPRIMER", "Inutilisé. summary.controller.ts → getEnhancedDashboardSummary. Fusionner dans /dashboard/summary ou /analytics/summary."],
        ["GET /summaries/clients/:id", "SUPPRIMER", "Aucun consommateur frontend. Si besoin, enrichir GET /clients/:id."],
        ["GET /summaries/projects/:id", "SUPPRIMER", "Aucun consommateur frontend. Si besoin, enrichir GET /projects/:id."],
        ["GET /service-requests/company", "SUPPRIMER", "Legacy — alias de adminGetServiceRequests. Non utilisé."],
        ["PUT /service-requests/:id", "SUPPRIMER", "Legacy — remplacé par PATCH /service-requests/admin/:id."],
        ["GET /documents/client/:id", "DÉPRÉCIER", "Remplacé par /enhanced-documents?clientId=. Garder 1 mois max pour migration."],
        ["POST /documents", "DÉPRÉCIER", "Idem — remplacé par POST /enhanced-documents."],
      ]),
      spacer(),

      h2("Endpoints à Fusionner"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3600, 3600, 2160],
        rows: [
          new TableRow({
            tableHeader: true,
            children: ["Endpoints actuels", "Endpoint unifié proposé", "Impact"].map(h => new TableCell({
              borders: cellBorders(COLOR.darkBlue),
              shading: { fill: COLOR.headerBg, type: ShadingType.CLEAR },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: COLOR.white, size: 18, font: "Arial" })] })]
            }))
          }),
          ...[
            ["/dashboard/summary + /summaries/dashboard", "→ GET /analytics/summary (sans date = période courante)", "Supprime 2 endpoints, 2 services, 1 double appel HTTP par page"],
            ["/companies/users + /users", "→ GET /users (ADMIN + MANAGER)", "Supprime 1 route, 1 méthode service"],
            ["/auth/me + /users/me", "→ GET /users/me uniquement", "Supprime 1 endpoint auth, aligne avec la convention REST"],
            ["POST /auth/change-password (auth.api.ts + freelancerApplications.api.ts)", "→ authApi.changePassword() unique dans auth.api.ts", "Supprime duplicata frontend"],
          ].map((row, i) => new TableRow({
            children: row.map(cell => new TableCell({
              borders: cellBorders(),
              shading: { fill: i % 2 === 0 ? COLOR.white : COLOR.rowAlt, type: ShadingType.CLEAR },
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: cell, size: 17, font: "Arial" })] })]
            }))
          }))
        ]
      }),
      spacer(),

      h2("Services à Mutualiser"),
      bullet("Créer utils/asyncHandler.ts → wrapper try/catch pour tous les contrôleurs CRUD (+40 blocs supprimés)"),
      bullet("Créer utils/queryHelpers.ts → textQuery() partagé (4 contrôleurs concernés)"),
      bullet("Fusionner DashboardService.getSummary dans SummaryService.getEnhancedDashboardSummary (même clé cache, même repository)"),
      bullet("Refactoriser clientOnboarding.service.ts → méthode générique upsertStep(type, id, data) (-12 méthodes proxy)"),
      bullet("Refactoriser clientSuccess.service.ts → méthode générique manageSub(entity, action, id, data) (-60% du service)"),
      bullet("Migrer la validation Zod de document.controller.ts vers validators/document.validator.ts"),
      spacer(),

      h2("Middlewares à Corriger"),
      bullet("sensitiveWriteRateLimit : l'appliquer sur POST /users (invite), POST /auth/register, ou le supprimer"),
      bullet("health/ready : remplacer la création de client Redis ad-hoc par le singleton getBullRedisConnection()"),
      spacer(),

      h2("Routes à Ajouter"),
      bullet("GET /freelancers → enregistrer dans freelancer.routes.ts (contrôleur existant : getPublicFreelancers)"),
      bullet("GET /freelancers/:id → enregistrer dans freelancer.routes.ts (contrôleur existant : getFreelancerById)"),
      spacer(),

      h2("Jobs Redis à Revoir"),
      bullet("warm-dashboard-summaries (toutes 6h) : évaluer si le TTL cache dashboard est < 6h. Si TTL > 6h, le job est inutile."),
      bullet("archive-cold-data : vérifier que les tables *Archive existent dans le schéma Prisma. executeRawUnsafe est risqué — envisager des migrations Prisma dédiées."),
      spacer(),

      // ══════════════════════════════════════════════
      // GAIN ESTIMÉ
      // ══════════════════════════════════════════════
      h1("Gain Estimé"),
      makeSummaryTable([
        ["Endpoints backend", "164", "~152", "-12 endpoints (-7%)"],
        ["Fichiers de routes", "27", "~24", "-3 fichiers"],
        ["Services backend", "30", "~27", "-3 services"],
        ["Méthodes service (ClientOnboarding)", "12 proxies", "1 générique", "-11 méthodes"],
        ["Méthodes service (ClientSuccess)", "12 CRUD répétés", "~4 génériques", "-60%"],
        ["Blocs try/catch contrôleurs", "40+", "0", "asyncHandler"],
        ["Helpers queryText dupliqués", "4 fichiers", "1 utilitaire", "-3 redondances"],
        ["Appels HTTP page Dashboard", "2 simultanés", "1", "-50% réseau"],
        ["Complexité upload freelancer", "2 systèmes", "1 système", "Unifié"],
        ["Lignes de code (estimation)", "~8500 lignes", "~7200 lignes", "~-15%"],
      ]),
      spacer(),
      spacer(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
        children: [new TextRun({ text: "— Fin du rapport d'audit —", size: 18, color: COLOR.gray, font: "Arial", italics: true })]
      }),
    ]
  }]
});

function codeCheck(text) {
  return new Paragraph({
    spacing: { after: 0, before: 0 },
    indent: { left: 400, right: 400 },
    shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
    children: [new TextRun({ text, size: 18, font: "Courier New", color: "333333" })]
  });
}

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("audit_api_secritou.docx", buffer);
  console.log("Report generated successfully: audit_api_secritou.docx");
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
