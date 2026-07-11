import { baseTemplate, h1, p, infoBox, esc } from "./base.js";

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(value);
}

export function bookingCustomerConfirmedTemplate(opts: {
  name: string;
  slotStart: Date;
  slotEnd: Date;
  adminEmail: string;
  notes?: string | null;
}): { subject: string; html: string; text: string } {
  const subject = "Votre rendez-vous est confirmé";
  const html = baseTemplate(
    subject,
    [
      h1(subject),
      p(`Bonjour ${esc(opts.name)},`),
      p("Votre créneau a bien été réservé. Voici le récapitulatif :"),
      infoBox([
        ["Début", formatDateTime(opts.slotStart)],
        ["Fin", formatDateTime(opts.slotEnd)],
        ["Contact", esc(opts.adminEmail)],
      ]),
      opts.notes ? p(`Notes : ${esc(opts.notes)}`) : "",
      p("Vous recevrez une réponse de confirmation si nécessaire avant le rendez-vous."),
    ].join("")
  );

  const text = [
    subject,
    `Début: ${formatDateTime(opts.slotStart)}`,
    `Fin: ${formatDateTime(opts.slotEnd)}`,
    `Contact: ${opts.adminEmail}`,
    opts.notes ? `Notes: ${opts.notes}` : null,
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}

export function bookingAdminNotificationTemplate(opts: {
  adminName: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  slotStart: Date;
  slotEnd: Date;
  notes?: string | null;
  dashboardUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = "Nouveau rendez-vous réservé";
  const html = baseTemplate(
    subject,
    [
      h1(subject),
      p(`Bonjour ${esc(opts.adminName)},`),
      p("Un nouveau rendez-vous a été réservé depuis la page Contact."),
      infoBox([
        ["Nom", esc(opts.customerName)],
        ["Email", esc(opts.customerEmail)],
        ["Téléphone", opts.customerPhone ? esc(opts.customerPhone) : "N/A"],
        ["Début", formatDateTime(opts.slotStart)],
        ["Fin", formatDateTime(opts.slotEnd)],
      ]),
      opts.notes ? p(`Notes : ${esc(opts.notes)}`) : "",
    ].join(""),
    opts.dashboardUrl,
    "Ouvrir le tableau de bord"
  );

  const text = [
    subject,
    `Nom: ${opts.customerName}`,
    `Email: ${opts.customerEmail}`,
    `Téléphone: ${opts.customerPhone || "N/A"}`,
    `Début: ${formatDateTime(opts.slotStart)}`,
    `Fin: ${formatDateTime(opts.slotEnd)}`,
    opts.notes ? `Notes: ${opts.notes}` : null,
    `Dashboard: ${opts.dashboardUrl}`,
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}

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
      p(`Bonjour ${esc(opts.adminName)},`),
      p(`Un nouveau candidat vient de soumettre sa candidature sur la plateforme Secritou.`),
      infoBox([
        ["Candidat", esc(opts.applicantName)],
        ["Email", esc(opts.applicantEmail)],
        ["Poste souhaité", esc(opts.position)],
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
        p(`Bonjour ${esc(firstName)},`),
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
        p(`Bonjour ${esc(firstName)},`),
        p(
          "Nous avons le plaisir de vous informer que votre candidature a été acceptée. Votre compte est désormais actif."
        ),
        infoBox([
          ["Identifiant", esc(username)],
          ["Mot de passe temporaire", esc(password)],
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
        p(`Bonjour ${esc(firstName)},`),
        p(
          "Après examen attentif de votre candidature, nous ne sommes pas en mesure de donner suite à ce stade."
        ),
        reason
          ? infoBox([["Motif", esc(reason)]])
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
        p(`Bonjour ${esc(clientName)},`),
        p(`Nous avons le plaisir de vous soumettre la proposition <strong>${esc(proposalTitle)}</strong>.`),
        infoBox([
          ["Intitulé", esc(proposalTitle)],
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
        p(`Bonjour ${esc(adminName)},`),
        p(`Le client <strong>${esc(clientName)}</strong> a accepté la proposition suivante :`),
        infoBox([
          ["Proposition", esc(proposalTitle)],
          ...(formattedAmount ? ([["Montant", formattedAmount]] as [string, string][]) : []),
          ["Client", esc(clientName)],
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
        p(`Bonjour ${esc(adminName)},`),
        p(`Le client <strong>${esc(clientName)}</strong> a refusé la proposition suivante :`),
        infoBox([
          ["Proposition", esc(proposalTitle)],
          ["Client", esc(clientName)],
          ...(comment ? ([["Motif", esc(comment)]] as [string, string][]) : []),
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
        p(`Bonjour ${esc(name)},`),
        p("Un compte vous a été créé sur la plateforme Secritou. Voici vos identifiants de connexion :"),
        infoBox([
          ["Email", esc(email)],
          ["Mot de passe temporaire", esc(tempPassword)],
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
        h1(`Facture ${esc(invoiceNumber)}`),
        p(`Bonjour ${esc(clientName)},`),
        p("Veuillez trouver ci-dessous le récapitulatif de votre facture :"),
        infoBox([
          ["Numéro", esc(invoiceNumber)],
          ["Montant", formattedAmount],
          ["Échéance", esc(dueDate)],
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
        p(`Bonjour ${esc(clientName)},`),
        p(
          daysOverdue > 0
            ? `La facture ${esc(invoiceNumber)} est en souffrance depuis <strong>${daysOverdue} jour(s)</strong>.`
            : `La facture ${esc(invoiceNumber)} arrive à échéance prochainement.`
        ),
        infoBox([
          ["Numéro", esc(invoiceNumber)],
          ["Montant dû", formattedAmount],
          ["Date d'échéance", esc(dueDate)],
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
        p(`Bonjour ${esc(clientName)},`),
        p(
          `Nous avons le plaisir de vous informer que le projet <strong>${esc(projectName)}</strong> est officiellement démarré.`
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
        p(`Bonjour ${esc(clientName)},`),
        infoBox([
          ["Projet", esc(projectName)],
          ["Étape validée", esc(stepTitle)],
          ...(nextStepTitle ? ([["Prochaine étape", esc(nextStepTitle)]] as [string, string][]) : []),
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
        p(`Bonjour ${esc(assigneeName)},`),
        p(`<strong>${esc(requesterName)}</strong> sollicite votre approbation sur le point suivant :`),
        infoBox([
          ["Objet", esc(approvalTitle)],
          ["Échéance", esc(dueDate)],
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
        p(`Bonjour ${esc(requesterName)},`),
        infoBox([
          ["Objet", esc(approvalTitle)],
          ["Décision", decisionLabel.replace(/ [^ ]+$/, "")],
          ["Par", esc(deciderName)],
          ...(comment ? ([["Commentaire", esc(comment)]] as [string, string][]) : []),
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
        p(`Bonjour ${esc(name)},`),
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
        p(`Bonjour ${esc(opts.name)},`),
        p(
          `<strong>${esc(opts.companyName)}</strong> vous invite à accéder à votre portail client sur Secritou.` +
          " Vous pouvez y consulter vos propositions, factures et documents en temps réel."
        ),
        infoBox([
          ["Email de connexion", esc(opts.email)],
          ["Mot de passe temporaire", esc(opts.tempPassword)],
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
        p(`Bonjour ${esc(adminName)},`),
        p(
          `Le client <strong>${esc(clientName)}</strong> a soumis une nouvelle demande de service :`
        ),
        infoBox([["Demande", esc(requestTitle)]]),
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
        p(`Bonjour ${esc(clientName)},`),
        infoBox([
          ["Demande", esc(requestTitle)],
          ["Statut", esc(statusLabel[newStatus] ?? newStatus)],
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
        p(`Bonjour ${esc(opts.userName)},`),
        p(
          "Merci de nous avoir contactés. Notre équipe va étudier votre question et vous répondra personnellement sous 24–48h."
        ),
        infoBox([
          ["Sujet", esc(opts.subject)],
          ["Votre question", esc(opts.questionContent)],
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
      p(`Bonjour ${esc(opts.adminName)},`),
      p("Un utilisateur vient de poser une question depuis la FAQ de la plateforme Secritou."),
      infoBox([
        ["Utilisateur", esc(opts.userName)],
        ["Email", esc(opts.userEmail)],
        ["Sujet", esc(opts.subject)],
        ["Question", esc(opts.questionContent)],
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
        p(`Bonjour ${esc(opts.userName)},`),
        p("Notre équipe vient de répondre à votre question :"),
        infoBox([
          ["Sujet", esc(opts.subject)],
          ["Réponse", esc(opts.adminReply)],
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
        p(`Bonjour ${esc(opts.managerName)},`),
        p(`Le client <strong>${esc(opts.clientName)}</strong> a approuvé la livraison du projet suivant :`),
        infoBox([
          ["Projet", esc(opts.projectName)],
          ["Client", esc(opts.clientName)],
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
        p(`Bonjour ${esc(opts.clientName)},`),
        p(`Vous avez validé la livraison du projet <strong>${esc(opts.projectName)}</strong>. Merci pour votre confiance !`),
        infoBox([["Projet", esc(opts.projectName)], ["Statut", "Terminé"]]),
        p("Votre facture de solde est maintenant disponible dans votre espace client."),
      ].join(""),
      opts.portalUrl,
      "Voir ma facture"
    ),
  };
}
