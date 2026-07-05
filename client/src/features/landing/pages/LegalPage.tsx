import { useTranslation } from "react-i18next";

export function LegalPage() {
  const { t } = useTranslation();
  return (
    <>
      <section className="bg-gradient-to-b from-surface-warm/70 to-background pt-20 pb-10 sm:pt-28">
        <div className="container-page max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Secritou</p>
          <h1 className="mt-3 font-display text-4xl font-bold text-ink sm:text-5xl">
            Mentions légales
          </h1>
        </div>
      </section>

      <section className="bg-background pb-24">
        <div className="container-page max-w-3xl prose prose-neutral prose-sm sm:prose-base">
          <h2>Éditeur du site</h2>
          <p>
            <strong>Secritou</strong><br />
            Agence de services digitaux<br />
            Tunis, Tunisie<br />
            Email : <a href="mailto:hello@secritou.com">hello@secritou.com</a><br />
            Téléphone : <a href="tel:+21694243333">+216 94 243 333</a>
          </p>

          <h2>Hébergement</h2>
          <p>
            Ce site est hébergé par un prestataire tiers. Les coordonnées de l'hébergeur sont
            disponibles sur demande à l'adresse hello@secritou.com.
          </p>

          <h2>Propriété intellectuelle</h2>
          <p>
            L'ensemble du contenu de ce site (textes, images, logos, graphismes) est la propriété
            exclusive de Secritou ou de ses partenaires. Toute reproduction, même partielle, est
            interdite sans autorisation préalable écrite.
          </p>

          <h2>Responsabilité</h2>
          <p>
            Secritou s'efforce de maintenir les informations publiées à jour mais ne saurait être
            tenu responsable des erreurs, omissions ou indisponibilités du service.
          </p>

          <h2>Droit applicable</h2>
          <p>
            Le présent site et ses contenus sont soumis au droit tunisien. Tout litige relève de la
            compétence des tribunaux compétents de Tunis.
          </p>
        </div>
      </section>
    </>
  );
}
