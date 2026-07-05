import { baseTemplate, h1, p, infoBox } from "./base.js";

// ─── Application templates ────────────────────────────────────────────────────

export function newApplicationAdminTemplate(opts: {
  adminName: string;
  applicantName: string;
  applicantEmail: string;
  position: string;
  dashboardUrl: string;
}): string {
  return baseTemplate(
    "Nouvelle candidature",
    [
      h1("Nouvelle candidature reçue"),
      p(`Bonjour ${opts.adminName},`),
      p(`Un nouveau candidat vient de soumettre sa candidature sur la plateforme Secritou.`),
      infoBox([
        ["Candidat", opts.applicantName],
        ["Email", opts.applicantEmail],
        ["Poste souhaité", opts.position],
      ]),
      p("Vous pouvez consulter et traiter cette candidature depuis le tableau de bord."),
    ].join(""),
    opts.dashboardUrl,
    "Voir la candidature"
  );
}

export function applicationReceivedTemplate(firstName: string): {
  subject: string;
  html: string;
} {
  return {
    subject: "Nous avons bien reçu votre candidature : Secritou",
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
    subject: "Félicitations : Votre candidature a été acceptée",
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
    subject: "Suite donnée à votre candidature : Secritou",
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

// ─── Proposal templates ──────────────────────────────────────────────────────

export function proposalSentTemplate(
  clientName: string,
  proposalTitle: string,
  amount: number | null | undefined,
  currency: string,
  viewUrl: string
): { subject: string; html: string } {
  const formattedAmount =
    amount != null
      ? new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount)
      : null;

  return {
    subject: `Nouvelle proposition : "${proposalTitle}"`,
    html: baseTemplate(
      `Proposition : ${proposalTitle}`,
      [
        h1("Vous avez reçu une proposition"),
        p(`Bonjour ${clientName},`),
        p(`Nous avons le plaisir de vous soumettre la proposition <strong>${proposalTitle}</strong>.`),
        infoBox([
          ["Intitulé", proposalTitle],
          ...(formattedAmount ? ([["Montant", formattedAmount]] as [string, string][]) : []),
        ]),
        p("Vous pouvez consulter le détail, accepter ou refuser depuis votre espace client."),
      ].join(""),
      viewUrl,
      "Voir la proposition"
    ),
  };
}

export function proposalAcceptedTemplate(
  adminName: string,
  proposalTitle: string,
  clientName: string,
  amount: number | null | undefined,
  currency: string,
  dashboardUrl: string
): { subject: string; html: string } {
  const formattedAmount =
    amount != null
      ? new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount)
      : null;

  return {
    subject: `Proposition acceptée : ${proposalTitle}`,
    html: baseTemplate(
      `Acceptée : ${proposalTitle}`,
      [
        h1("Bonne nouvelle : Proposition acceptée ✅"),
        p(`Bonjour ${adminName},`),
        p(`Le client <strong>${clientName}</strong> a accepté la proposition suivante :`),
        infoBox([
          ["Proposition", proposalTitle],
          ...(formattedAmount ? ([["Montant", formattedAmount]] as [string, string][]) : []),
          ["Client", clientName],
        ]),
        p("Vous pouvez maintenant créer la facture correspondante depuis le tableau de bord."),
      ].join(""),
      dashboardUrl,
      "Voir la proposition"
    ),
  };
}

export function proposalRejectedTemplate(
  adminName: string,
  proposalTitle: string,
  clientName: string,
  comment?: string
): { subject: string; html: string } {
  return {
    subject: `Proposition refusée : ${proposalTitle}`,
    html: baseTemplate(
      `Refusée : ${proposalTitle}`,
      [
        h1("Proposition refusée ❌"),
        p(`Bonjour ${adminName},`),
        p(`Le client <strong>${clientName}</strong> a refusé la proposition suivante :`),
        infoBox([
          ["Proposition", proposalTitle],
          ["Client", clientName],
          ...(comment ? ([["Motif", comment]] as [string, string][]) : []),
        ]),
        p("N'hésitez pas à contacter le client pour en savoir plus et soumettre une nouvelle proposition."),
      ].join("")
    ),
  };
}

// ─── User invitation template ─────────────────────────────────────────────────

export function userInvitationTemplate(
  name: string,
  email: string,
  tempPassword: string,
  loginUrl: string
): { subject: string; html: string } {
  return {
    subject: "Bienvenue sur Secritou : Vos accès",
    html: baseTemplate(
      "Invitation Secritou",
      [
        h1("Votre compte a été créé 🎉"),
        p(`Bonjour ${name},`),
        p("Un compte vous a été créé sur la plateforme Secritou. Voici vos identifiants de connexion :"),
        infoBox([
          ["Email", email],
          ["Mot de passe temporaire", tempPassword],
        ]),
        p("Pour des raisons de sécurité, vous devrez changer ce mot de passe lors de votre première connexion."),
      ].join(""),
      loginUrl,
      "Se connecter"
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
    subject: `Facture ${invoiceNumber} : ${formattedAmount}`,
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
    subject: `Rappel de paiement : Facture ${invoiceNumber}`,
    html: baseTemplate(
      `Rappel : Facture ${invoiceNumber}`,
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
    subject: `Votre projet "${projectName}" démarre : Secritou`,
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
    subject: `Étape validée : "${stepTitle}" : ${projectName}`,
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
  decision: "APPROVED" | "REJECTED",
  deciderName: string,
  comment?: string
): { subject: string; html: string } {
  const decisionLabel = decision === "APPROVED" ? "approuvée ✅" : "refusée ❌";

  return {
    subject: `Décision sur "${approvalTitle}" : ${decision === "APPROVED" ? "Approuvée" : "Refusée"}`,
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

// ─── Auth templates ───────────────────────────────────────────────────────────

export function passwordResetTemplate(
  name: string,
  resetUrl: string
): { subject: string; html: string } {
  return {
    subject: "Réinitialisation de votre mot de passe Secritou",
    html: baseTemplate(
      "Réinitialisation de mot de passe",
      [
        h1("Réinitialisez votre mot de passe"),
        p(`Bonjour ${name},`),
        p(
          "Nous avons reçu une demande de réinitialisation du mot de passe associé à votre compte Secritou."
        ),
        p(
          "Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. " +
          "<strong>Ce lien expire dans 1 heure.</strong>"
        ),
        p(
          "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email : " +
          "votre mot de passe reste inchangé."
        ),
      ].join(""),
      resetUrl,
      "Réinitialiser mon mot de passe"
    ),
  };
}

// ─── Client portal invitation template ───────────────────────────────────────

export function clientInvitationTemplate(opts: {
  name: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
  companyName: string;
}): { subject: string; html: string } {
  return {
    subject: `Accès à votre portail client : ${opts.companyName}`,
    html: baseTemplate(
      "Invitation portail client",
      [
        h1("Votre espace client est prêt 🎉"),
        p(`Bonjour ${opts.name},`),
        p(
          `<strong>${opts.companyName}</strong> vous invite à accéder à votre portail client sur Secritou.` +
          " Vous pouvez y consulter vos propositions, factures et documents en temps réel."
        ),
        infoBox([
          ["Email de connexion", opts.email],
          ["Mot de passe temporaire", opts.tempPassword],
        ]),
        p(
          "Pour des raisons de sécurité, vous devrez changer ce mot de passe lors de votre première connexion."
        ),
      ].join(""),
      opts.loginUrl,
      "Accéder à mon portail"
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

// ─── Custom question templates ────────────────────────────────────────────────

/** Email 1 : confirmation to the user after they submit a custom question. */
export function customQuestionReceivedTemplate(opts: {
  userName: string;
  subject: string;
  questionContent: string;
  portalUrl: string;
}): { subject: string; html: string } {
  return {
    subject: "Nous avons bien reçu votre question : Secritou",
    html: baseTemplate(
      "Question reçue",
      [
        h1("Votre question a bien été reçue 🎉"),
        p(`Bonjour ${opts.userName},`),
        p(
          "Merci de nous avoir contactés. Notre équipe va étudier votre question et vous répondra personnellement sous 24–48h."
        ),
        infoBox([
          ["Sujet", opts.subject],
          ["Votre question", opts.questionContent],
        ]),
        p("Vous recevrez un email dès que nous y aurons répondu. Vous pouvez aussi suivre la conversation depuis votre espace."),
      ].join(""),
      opts.portalUrl,
      "Voir ma question"
    ),
  };
}

/** Email 2 : notification to the admin when a new custom question is posted. */
export function customQuestionAdminNotificationTemplate(opts: {
  adminName: string;
  userName: string;
  userEmail: string;
  subject: string;
  questionContent: string;
  dashboardUrl: string;
}): string {
  return baseTemplate(
    "Nouvelle question",
    [
      h1("Nouvelle question personnalisée"),
      p(`Bonjour ${opts.adminName},`),
      p("Un utilisateur vient de poser une question depuis la FAQ de la plateforme Secritou."),
      infoBox([
        ["Utilisateur", opts.userName],
        ["Email", opts.userEmail],
        ["Sujet", opts.subject],
        ["Question", opts.questionContent],
      ]),
      p("Vous pouvez répondre directement depuis le tableau de bord."),
    ].join(""),
    opts.dashboardUrl,
    "Répondre à la question"
  );
}

/** Email 3 : notification to the user when the admin replies. */
export function customQuestionAnsweredTemplate(opts: {
  userName: string;
  subject: string;
  adminReply: string;
  portalUrl: string;
}): { subject: string; html: string } {
  return {
    subject: "Nous avons répondu à votre question : Secritou",
    html: baseTemplate(
      "Réponse à votre question",
      [
        h1("Nous avons répondu à votre question ✉️"),
        p(`Bonjour ${opts.userName},`),
        p("Notre équipe vient de répondre à votre question :"),
        infoBox([
          ["Sujet", opts.subject],
          ["Réponse", opts.adminReply],
        ]),
        p("Consultez la conversation complète et continuez l'échange depuis votre espace."),
      ].join(""),
      opts.portalUrl,
      "Voir la réponse"
    ),
  };
}

/** Notification to the manager when a client approves the project. */
export function projectApprovedManagerTemplate(opts: {
  managerName: string;
  clientName: string;
  projectName: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Projet approuvé : ${opts.projectName}`,
    html: baseTemplate(
      `Approuvé : ${opts.projectName}`,
      [
        h1("Projet approuvé par le client ✅"),
        p(`Bonjour ${opts.managerName},`),
        p(`Le client <strong>${opts.clientName}</strong> a approuvé la livraison du projet suivant :`),
        infoBox([
          ["Projet", opts.projectName],
          ["Client", opts.clientName],
        ]),
        p("Le projet est maintenant clôturé. La facture de solde a été générée et est disponible dans votre tableau de bord."),
      ].join(""),
      opts.dashboardUrl,
      "Voir le projet"
    ),
  };
}

/** Confirmation to the client after they approve the project. */
export function projectApprovedClientTemplate(opts: {
  clientName: string;
  projectName: string;
  portalUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Votre projet est terminé : ${opts.projectName}`,
    html: baseTemplate(
      `Projet terminé : ${opts.projectName}`,
      [
        h1("Votre projet est officiellement terminé 🎉"),
        p(`Bonjour ${opts.clientName},`),
        p(`Vous avez validé la livraison du projet <strong>${opts.projectName}</strong>. Merci pour votre confiance !`),
        infoBox([["Projet", opts.projectName], ["Statut", "Terminé"]]),
        p("Votre facture de solde est maintenant disponible dans votre espace client."),
      ].join(""),
      opts.portalUrl,
      "Voir ma facture"
    ),
  };
}
