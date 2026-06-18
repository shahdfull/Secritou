import { baseTemplate, h1, p, infoBox } from "./base.js";

// ─── Application templates ────────────────────────────────────────────────────

export function applicationReceivedTemplate(firstName: string): {
  subject: string;
  html: string;
} {
  return {
    subject: "Nous avons bien reçu votre candidature — Secritou",
    html: baseTemplate(
      "Candidature reçue",
      [
        h1("Votre candidature a été reçue 🎉"),
        p(`Bonjour ${firstName},`),
        p(
          "Merci d'avoir postulé sur la plateforme Secritou. Notre équipe va examiner votre profil et revenir vers vous dans les plus brefs délais."
        ),
        p("Vous recevrez un email dès que votre candidature aura été étudiée."),
      ].join("")
    ),
  };
}

export function applicationAcceptedTemplate(
  firstName: string,
  username: string,
  password: string,
  loginUrl: string
): { subject: string; html: string } {
  return {
    subject: "Félicitations — Votre candidature a été acceptée",
    html: baseTemplate(
      "Candidature acceptée",
      [
        h1("Bienvenue dans l'équipe ! 🚀"),
        p(`Bonjour ${firstName},`),
        p(
          "Nous avons le plaisir de vous informer que votre candidature a été acceptée. Votre compte est désormais actif."
        ),
        infoBox([
          ["Identifiant", username],
          ["Mot de passe temporaire", password],
        ]),
        p(
          "Pour des raisons de sécurité, vous devrez changer ce mot de passe lors de votre première connexion."
        ),
      ].join(""),
      loginUrl,
      "Se connecter maintenant"
    ),
  };
}

export function applicationRejectedTemplate(
  firstName: string,
  reason?: string
): { subject: string; html: string } {
  return {
    subject: "Suite donnée à votre candidature — Secritou",
    html: baseTemplate(
      "Candidature étudiée",
      [
        h1("Merci de l'intérêt que vous nous portez"),
        p(`Bonjour ${firstName},`),
        p(
          "Après examen attentif de votre candidature, nous ne sommes pas en mesure de donner suite à ce stade."
        ),
        reason
          ? infoBox([["Motif", reason]])
          : p("N'hésitez pas à repostuler ultérieurement, nos besoins évoluent régulièrement."),
        p("Nous vous souhaitons le meilleur dans votre recherche."),
      ].join("")
    ),
  };
}

// ─── Invoice templates ────────────────────────────────────────────────────────

export function invoiceSentTemplate(
  clientName: string,
  invoiceNumber: string,
  amount: number,
  currency: string,
  dueDate: string,
  invoiceUrl?: string
): { subject: string; html: string } {
  const formattedAmount = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(amount);

  return {
    subject: `Facture ${invoiceNumber} — ${formattedAmount}`,
    html: baseTemplate(
      `Facture ${invoiceNumber}`,
      [
        h1(`Facture ${invoiceNumber}`),
        p(`Bonjour ${clientName},`),
        p("Veuillez trouver ci-dessous le récapitulatif de votre facture :"),
        infoBox([
          ["Numéro", invoiceNumber],
          ["Montant", formattedAmount],
          ["Échéance", dueDate],
        ]),
      ].join(""),
      invoiceUrl,
      "Voir la facture"
    ),
  };
}

export function invoiceReminderTemplate(
  clientName: string,
  invoiceNumber: string,
  amount: number,
  currency: string,
  dueDate: string,
  daysOverdue: number,
  invoiceUrl?: string
): { subject: string; html: string } {
  const formattedAmount = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(amount);

  return {
    subject: `Rappel de paiement — Facture ${invoiceNumber}`,
    html: baseTemplate(
      `Rappel — Facture ${invoiceNumber}`,
      [
        h1("Rappel de paiement"),
        p(`Bonjour ${clientName},`),
        p(
          daysOverdue > 0
            ? `La facture ${invoiceNumber} est en souffrance depuis <strong>${daysOverdue} jour(s)</strong>.`
            : `La facture ${invoiceNumber} arrive à échéance prochainement.`
        ),
        infoBox([
          ["Numéro", invoiceNumber],
          ["Montant dû", formattedAmount],
          ["Date d'échéance", dueDate],
        ]),
        p("Si vous avez déjà effectué le règlement, veuillez ignorer cet email."),
      ].join(""),
      invoiceUrl,
      "Régler la facture"
    ),
  };
}

// ─── Onboarding templates ─────────────────────────────────────────────────────

export function onboardingStartedTemplate(
  clientName: string,
  projectName: string,
  portalUrl: string
): { subject: string; html: string } {
  return {
    subject: `Votre projet "${projectName}" démarre — Secritou`,
    html: baseTemplate(
      "Démarrage de projet",
      [
        h1("Votre projet est lancé ! 🎯"),
        p(`Bonjour ${clientName},`),
        p(
          `Nous avons le plaisir de vous informer que le projet <strong>${projectName}</strong> est officiellement démarré.`
        ),
        p(
          "Vous pouvez suivre l'avancement, consulter les documents et communiquer avec l'équipe directement depuis votre espace client."
        ),
      ].join(""),
      portalUrl,
      "Accéder à mon espace"
    ),
  };
}

export function onboardingStepCompletedTemplate(
  clientName: string,
  projectName: string,
  stepTitle: string,
  nextStepTitle?: string
): { subject: string; html: string } {
  return {
    subject: `Étape validée : "${stepTitle}" — ${projectName}`,
    html: baseTemplate(
      "Étape validée",
      [
        h1("Une étape est franchie ✅"),
        p(`Bonjour ${clientName},`),
        infoBox([
          ["Projet", projectName],
          ["Étape validée", stepTitle],
          ...(nextStepTitle ? ([["Prochaine étape", nextStepTitle]] as [string, string][]) : []),
        ]),
        p("Merci de votre implication. L'équipe continue à avancer sur votre projet."),
      ].join("")
    ),
  };
}

// ─── Approval templates ───────────────────────────────────────────────────────

export function approvalRequestedTemplate(
  assigneeName: string,
  approvalTitle: string,
  requesterName: string,
  dueDate: string,
  approvalUrl: string
): { subject: string; html: string } {
  return {
    subject: `Demande d'approbation : "${approvalTitle}"`,
    html: baseTemplate(
      "Demande d'approbation",
      [
        h1("Une approbation vous est demandée"),
        p(`Bonjour ${assigneeName},`),
        p(`<strong>${requesterName}</strong> sollicite votre approbation sur le point suivant :`),
        infoBox([
          ["Objet", approvalTitle],
          ["Échéance", dueDate],
        ]),
        p("Merci de traiter cette demande avant l'échéance indiquée."),
      ].join(""),
      approvalUrl,
      "Voir la demande"
    ),
  };
}

export function approvalDecisionTemplate(
  requesterName: string,
  approvalTitle: string,
  decision: "APPROVED" | "REJECTED" | "COMMENTED",
  deciderName: string,
  comment?: string
): { subject: string; html: string } {
  const decisionLabel =
    decision === "APPROVED"
      ? "approuvée ✅"
      : decision === "REJECTED"
      ? "refusée ❌"
      : "commentée 💬";

  return {
    subject: `Décision sur "${approvalTitle}" — ${decision === "APPROVED" ? "Approuvée" : decision === "REJECTED" ? "Refusée" : "Commentaire"}`,
    html: baseTemplate(
      `Décision : ${approvalTitle}`,
      [
        h1(`Votre demande a été ${decisionLabel}`),
        p(`Bonjour ${requesterName},`),
        infoBox([
          ["Objet", approvalTitle],
          ["Décision", decisionLabel.replace(/ [^ ]+$/, "")],
          ["Par", deciderName],
          ...(comment ? ([["Commentaire", comment]] as [string, string][]) : []),
        ]),
      ].join("")
    ),
  };
}

// ─── Service request templates ────────────────────────────────────────────────

export function serviceRequestReceivedTemplate(
  adminName: string,
  clientName: string,
  requestTitle: string,
  dashboardUrl: string
): { subject: string; html: string } {
  return {
    subject: `Nouvelle demande de service : "${requestTitle}"`,
    html: baseTemplate(
      "Nouvelle demande",
      [
        h1("Nouvelle demande de service reçue"),
        p(`Bonjour ${adminName},`),
        p(
          `Le client <strong>${clientName}</strong> a soumis une nouvelle demande de service :`
        ),
        infoBox([["Demande", requestTitle]]),
        p("Merci de traiter cette demande dans les meilleurs délais."),
      ].join(""),
      dashboardUrl,
      "Voir la demande"
    ),
  };
}

export function serviceRequestStatusTemplate(
  clientName: string,
  requestTitle: string,
  newStatus: string
): { subject: string; html: string } {
  const statusLabel: Record<string, string> = {
    IN_PROGRESS: "En cours de traitement 🔄",
    DONE: "Traitée ✅",
    NEW: "Reçue",
  };

  return {
    subject: `Mise à jour : "${requestTitle}"`,
    html: baseTemplate(
      "Mise à jour demande",
      [
        h1("Votre demande a été mise à jour"),
        p(`Bonjour ${clientName},`),
        infoBox([
          ["Demande", requestTitle],
          ["Statut", statusLabel[newStatus] ?? newStatus],
        ]),
        p("Vous recevrez une notification dès que votre demande sera entièrement traitée."),
      ].join("")
    ),
  };
}
