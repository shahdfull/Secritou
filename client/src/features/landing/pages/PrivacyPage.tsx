export function PrivacyPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-surface-warm/70 to-background pt-20 pb-10 sm:pt-28">
        <div className="container-page max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Secritou</p>
          <h1 className="mt-3 font-display text-4xl font-bold text-ink sm:text-5xl">
            Politique de confidentialité
          </h1>
        </div>
      </section>

      <section className="bg-background pb-24">
        <div className="container-page max-w-3xl prose prose-neutral prose-sm sm:prose-base">
          <p className="text-muted-foreground text-sm">Dernière mise à jour : juillet 2026</p>

          <h2>Qui sommes-nous ?</h2>
          <p>
            Secritou est une agence de services digitaux basée à Tunis, Tunisie. Notre site est
            accessible à l'adresse <strong>secritou.tn</strong>.
          </p>

          <h2>Données collectées</h2>
          <p>Nous collectons uniquement les données que vous nous transmettez volontairement :</p>
          <ul>
            <li>Via le formulaire de contact : nom, email, téléphone, entreprise, message.</li>
            <li>
              Via notre outil d'analyse d'audience auto-hébergé : données de navigation
              anonymisées (page consultée, référent), sans identifiant persistant ni profilage
              entre visites.
            </li>
          </ul>
          <p>
            Nous ne collectons aucune donnée sensible et nous ne revendons jamais vos informations à
            des tiers.
          </p>

          <h2>Finalité du traitement</h2>
          <ul>
            <li>Répondre à vos demandes de contact et de devis.</li>
            <li>Améliorer l'expérience utilisateur de notre site (analytics).</li>
          </ul>

          <h2>Durée de conservation</h2>
          <p>
            Vos données de contact sont conservées le temps nécessaire au traitement de votre
            demande, et au maximum 3 ans à compter du dernier contact.
          </p>

          <h2>Vos droits</h2>
          <p>
            Conformément à la loi tunisienne n° 2004-63 du 27 juillet 2004 portant sur la protection
            des données à caractère personnel, vous disposez d'un droit d'accès, de rectification et
            de suppression de vos données. Pour exercer ces droits, contactez-nous à{" "}
            <a href="mailto:hello@secritou.com">hello@secritou.com</a>.
          </p>

          <h2>Cookies</h2>
          <p>
            Notre outil de mesure d'audience est auto-hébergé et ne dépose aucun cookie : un
            identifiant de session temporaire est généré en mémoire à chaque visite et n'est
            jamais conservé au-delà de la session en cours (pas de suivi d'un visiteur d'une
            visite à l'autre). Ces données ne collectent aucune donnée personnelle identifiable.
          </p>

          <h2>Contact</h2>
          <p>
            Pour toute question relative à cette politique :{" "}
            <a href="mailto:hello@secritou.com">hello@secritou.com</a>
          </p>
        </div>
      </section>
    </>
  );
}
