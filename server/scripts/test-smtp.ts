import nodemailer from "nodemailer";
import { env } from "../src/config/env.js";
import { emailService } from "../src/services/email.service.js";

async function main() {
  const to = process.argv[2] ?? "contact@secritou.tn";

  console.log("SMTP config:", {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
  });

  console.log("Vérification de la connexion SMTP...");
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
    family: 4,
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
  });
  try {
    await transport.verify();
  } catch (err) {
    console.error("Échec de connexion SMTP:", err);
    process.exit(1);
  }
  console.log("Connexion SMTP OK.");

  console.log(`Envoi d'un email de test à ${to}...`);
  await emailService.send({
    to,
    subject: "Test SMTP Secritou",
    html: "<p>Ceci est un email de test envoyé depuis le script test-smtp.ts.</p>",
  });
  console.log("Email envoyé avec succès.");
}

main().catch((err) => {
  console.error("Erreur lors de l'envoi:", err);
  process.exit(1);
});
