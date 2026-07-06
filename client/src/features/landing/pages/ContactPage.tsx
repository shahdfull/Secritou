import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Calendar, Mail, MapPin, Check, CheckCircle2, Phone } from "lucide-react";
import { type ReactNode, useState, useEffect } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import Cal, { getCalApi } from "@calcom/embed-react";
import { isValidTunisianPhone, CONTACT_SERVICE_TYPES, CONTACT_BUDGET_OPTIONS } from "@secritou/shared";
import { submitContactRequest, type ServiceType } from "@/services/contact.service";

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined;
import { trackContactFormSubmitted, trackContactFormFailed } from "@/services/analytics.service";
import { useLandingCms } from "@/providers/LandingCmsProvider";

// Single source of truth: shared/src/constants/contactForm.ts. Must stay
// identical to server/src/validators/contact.validator.ts (same import) —
// these values are persisted verbatim, see that file's comment.
const CANONICAL_SERVICE_TYPES = CONTACT_SERVICE_TYPES;
const budgetOptions = CONTACT_BUDGET_OPTIONS;

const CALCOM_LINK = import.meta.env.VITE_CALCOM_LINK as string | undefined;

export function ContactPage() {
  const { t } = useTranslation();
  const { cms } = useLandingCms();
  const location = useLocation();
  const [showSuccess, setShowSuccess] = useState(false);

  // Initialise Cal.com embed namespace once
  useEffect(() => {
    if (!CALCOM_LINK) return;
    getCalApi({ namespace: "discovery" }).then((cal) => {
      cal("ui", { hideEventTypeDetails: false, layout: "month_view" });
    });
  }, []);

  const contactSchema = z.object({
    name: z.string().trim().min(2, t("contact.pleaseEnterName")),
    email: z.string().trim().email(t("contact.pleaseEnterEmail")),
    // Accepts "+216XXXXXXXX" or a bare 8-digit local number (2-9 leading
    // digit); "216XXXXXXXX" without the + is rejected as ambiguous with a
    // local number. See shared/src/constants/phone.ts.
    phone: z.string().trim().optional().refine(
      (value) => !value || isValidTunisianPhone(value),
      t("contact.invalidPhone")
    ),
    serviceType: z.enum(CANONICAL_SERVICE_TYPES, {
      required_error: t("contact.pleaseEnterServiceType")
    }),
    // The <select>'s empty placeholder option submits "" (not undefined),
    // which .optional() alone doesn't accept — normalize "" to undefined
    // before the enum check so leaving budget unselected passes validation.
    budget: z
      .union([z.enum(CONTACT_BUDGET_OPTIONS), z.literal("")])
      .optional()
      .transform((value) => (value === "" ? undefined : value)),
    company: z.string().trim().min(2, t("auth.companyNameMinLength")),
    message: z.string().trim().min(20, t("contact.pleaseEnterMessage")),
    // Honeypot: hidden field a human never fills in. Left unconstrained so a
    // bot filling it still passes client-side validation and reaches the
    // server, which silently no-ops instead of revealing the trap.
    website: z.string().optional(),
  });

  // Input = what the <select>/<input> elements actually submit (budget can be
  // ""); output = what onSubmit receives after zodResolver runs .transform().
  type ContactFormInput = z.input<typeof contactSchema>;
  type ContactFormOutput = z.output<typeof contactSchema>;

  const selectedService = location.state?.selectedService as ServiceType | undefined;

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<ContactFormInput, unknown, ContactFormOutput>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      serviceType: (selectedService as any) || "Business Performance",
      budget: undefined,
      company: "",
      message: "",
      website: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const response = await submitContactRequest(values);
      trackContactFormSubmitted({ company: values.company });
      setShowSuccess(true);
      reset();
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (error) {
      trackContactFormFailed({ error: error instanceof Error ? error.message : "Unknown error" });
      toast.error(t("contact.unableToSend"));
    }
  });

  return (
    <>
      <section className="bg-gradient-to-b from-surface-warm/70 to-background pt-20 pb-16 sm:pt-28">
        <div className="container-page max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t("nav.contact")}
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold text-ink sm:text-5xl lg:text-6xl">
            {cms("contact.title", t("contact.title"))}
          </h1>
          <p className="mt-5 text-base text-muted-foreground sm:text-lg">
            {cms("contact.subtitle", t("contact.subtitle"))}
          </p>
        </div>
      </section>

      <section className="bg-background pb-12">
        <div className="container-page grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <form
            onSubmit={onSubmit}
            className="rounded-3xl border border-border bg-card p-8 shadow-soft lg:p-10">
            <input
              type="text"
              {...register("website")}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px" }}
            />
            {showSuccess && (
              <div className="mb-6 flex items-center gap-3 rounded-2xl bg-green-50 p-4 text-green-700">
                <Check className="h-6 w-6 flex-shrink-0" />
                <p className="font-medium">{t("contact.successMessage")}</p>
              </div>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={t("contact.name")}
                registration={register("name")}
                error={errors.name?.message}
                required
              />
              <Field
                label={t("contact.email")}
                type="email"
                registration={register("email")}
                error={errors.email?.message}
                required
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2 mt-5">
              <Field
                label={t("contact.phone")}
                type="tel"
                registration={register("phone")}
                error={errors.phone?.message}
              />
              <div className="space-y-2">
                <label htmlFor="contact-serviceType" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("contact.serviceType")}
                  <span aria-hidden="true"> *</span>
                </label>
                <select
                  id="contact-serviceType"
                  {...register("serviceType")}
                  aria-invalid={Boolean(errors.serviceType)}
                  aria-describedby={errors.serviceType ? "contact-serviceType-error" : undefined}
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-ink outline-none transition-shadow focus:border-primary focus:shadow-soft"
                >
                  {CANONICAL_SERVICE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {errors.serviceType?.message && (
                  <p id="contact-serviceType-error" role="alert" className="text-xs font-medium text-destructive">
                    {errors.serviceType.message}
                  </p>
                )}
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 mt-5">
              <Field
                label={t("auth.companyName")}
                registration={register("company")}
                error={errors.company?.message}
                required
              />
              <div className="space-y-2">
                <label htmlFor="contact-budget" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("contact.budget")}
                </label>
                <select
                  id="contact-budget"
                  {...register("budget")}
                  aria-invalid={Boolean(errors.budget)}
                  aria-describedby={errors.budget ? "contact-budget-error" : undefined}
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-ink outline-none transition-shadow focus:border-primary focus:shadow-soft"
                >
                  <option value="">{t("contact.budgetPlaceholder")}</option>
                  {budgetOptions.map((budget) => (
                    <option key={budget} value={budget}>
                      {budget}
                    </option>
                  ))}
                </select>
                {errors.budget?.message && (
                  <p id="contact-budget-error" role="alert" className="text-xs font-medium text-destructive">
                    {errors.budget.message}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-5">
              <label htmlFor="contact-message" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("contact.message")}
                <span aria-hidden="true"> *</span>
              </label>
              <textarea
                id="contact-message"
                {...register("message")}
                aria-invalid={Boolean(errors.message)}
                aria-describedby={errors.message ? "contact-message-error" : undefined}
                rows={6}
                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-ink outline-none transition-shadow focus:border-primary focus:shadow-soft"
              />
              {errors.message?.message && (
                <p id="contact-message-error" role="alert" className="mt-2 text-xs font-medium text-destructive">
                  {errors.message.message}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {isSubmitting ? t("contact.sending") : t("contact.send")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <p className="mt-3 text-xs text-muted-foreground">
              {cms("contact.replyTime", t("contact.replyTime"))}
            </p>
          </form>

          <aside className="space-y-4">
            <InfoCard icon={Mail} title="Email">
              <span>{cms("contact.email", t("contact.emailInfo"))}</span>
            </InfoCard>
            {WHATSAPP_NUMBER && (
              <InfoCard icon={Phone} title={t("contact.whatsappLabel")}>
                <a
                  href={`tel:${WHATSAPP_NUMBER}`}
                  className="font-semibold text-ink hover:text-primary transition-colors"
                >
                  {WHATSAPP_NUMBER}
                </a>
                {" · "}
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, "")}?text=${encodeURIComponent(t("whatsapp.prefilledMessage"))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#25D366] hover:underline"
                >
                  WhatsApp
                </a>
              </InfoCard>
            )}
            <InfoCard icon={Calendar} title={t("contact.bookCallTitle")}>
              {t("contact.bookCall")}
            </InfoCard>
            <InfoCard icon={MapPin} title={t("contact.whereWeWorkTitle")}>
              {cms("contact.location", t("contact.whereWeWork"))}
            </InfoCard>
          </aside>
        </div>
      </section>

      {/* ── Cal.com Booking Section ─────────────────────────────────────── */}
      <CalBookingSection calLink={CALCOM_LINK} />
    </>
  );
}

function CalBookingSection({ calLink }: { calLink: string | undefined }) {
  const { t } = useTranslation();

  const whyReasons: string[] = t("contact.booking.reasons", { returnObjects: true }) as string[];

  return (
    <section className="bg-surface-warm/40 pb-24 pt-10">
      <div className="container-page">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {t("contact.booking.badge")}
        </p>
        <h2 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
          {t("contact.booking.heading")}
        </h2>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:items-start">
          {/* Why block */}
          <div className="space-y-5">
            <h3 className="font-display text-xl font-semibold text-ink">
              {t("contact.booking.whyTitle")}
            </h3>
            <ul className="space-y-3">
              {Array.isArray(whyReasons) && whyReasons.map((reason) => (
                <li key={reason} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {reason}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              {t("contact.booking.footer")}
            </p>
          </div>

          {/* Cal embed or fallback */}
          {calLink ? (
            <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
              <Cal
                namespace="discovery"
                calLink={calLink}
                style={{ width: "100%", height: "600px", overflow: "auto" }}
                config={{ layout: "month_view" }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-card p-12 text-center shadow-soft">
              <Calendar className="h-10 w-10 text-primary/40" />
              <p className="text-sm text-muted-foreground">
                {t("contact.booking.fallback")}{" "}
                <a
                  href="mailto:hello@secritou.com"
                  className="font-semibold text-primary underline underline-offset-2"
                >
                  hello@secritou.com
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  registration,
  error,
  type = "text",
  required,
}: {
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  type?: string;
  required?: boolean;
}) {
  const id = `contact-${registration.name}`;
  const errorId = `${id}-error`;
  return (
    <label htmlFor={id} className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      <input
        id={id}
        type={type}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...registration}
        className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-ink outline-none transition-shadow focus:border-primary focus:shadow-soft"
      />
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </label>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
