import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Calendar, Mail, MapPin, Check } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { submitContactRequest, type ServiceType, type BudgetOption } from "@/services/contact.service";
import { trackContactFormSubmitted, trackContactFormFailed } from "@/services/analytics.service";

const serviceTypes: ServiceType[] = [
  "Business Performance",
  "Digital Growth",
  "Technology Solutions",
  "AI & Automation",
  "Other"
];

const budgetOptions: BudgetOption[] = [
  "< 1 000 DT",
  "1 000–5 000 DT",
  "5 000–15 000 DT",
  "+15 000 DT"
];

export function ContactPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const [showSuccess, setShowSuccess] = useState(false);

  const contactSchema = z.object({
    name: z.string().trim().min(2, t("contact.pleaseEnterName")),
    email: z.string().trim().email(t("contact.pleaseEnterEmail")),
    phone: z.string().optional(),
    serviceType: z.enum(["Business Performance", "Digital Growth", "Technology Solutions", "AI & Automation", "Other"] as const, {
      required_error: t("contact.pleaseEnterServiceType")
    }),
    budget: z.enum(["< 1 000 DT", "1 000–5 000 DT", "5 000–15 000 DT", "+15 000 DT"] as const).optional(),
    company: z.string().trim().min(2, t("auth.companyNameMinLength")),
    message: z.string().trim().min(20, t("contact.pleaseEnterMessage")),
  });

  type ContactFormValues = z.infer<typeof contactSchema>;

  const selectedService = location.state?.selectedService as ServiceType | undefined;

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      serviceType: selectedService || "Business Performance",
      budget: undefined,
      company: "",
      message: "",
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
            {t("contact.title")}
          </h1>
          <p className="mt-5 text-base text-muted-foreground sm:text-lg">
            {t("contact.subtitle")}
          </p>
        </div>
      </section>

      <section className="bg-background pb-24">
        <div className="container-page grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <form
            onSubmit={onSubmit}
            className="rounded-3xl border border-border bg-card p-8 shadow-soft lg:p-10">
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
                registration={register("phone")}
                error={errors.phone?.message}
              />
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("contact.serviceType")}
                </label>
                <select
                  {...register("serviceType")}
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-ink outline-none transition-shadow focus:border-primary focus:shadow-soft"
                >
                  {serviceTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {errors.serviceType?.message && (
                  <p className="text-xs font-medium text-destructive">
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
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("contact.budget")}
                </label>
                <select
                  {...register("budget")}
                  className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-ink outline-none transition-shadow focus:border-primary focus:shadow-soft"
                >
                  <option value="">Select budget</option>
                  {budgetOptions.map((budget) => (
                    <option key={budget} value={budget}>
                      {budget}
                    </option>
                  ))}
                </select>
                {errors.budget?.message && (
                  <p className="text-xs font-medium text-destructive">
                    {errors.budget.message}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("contact.message")}
              </label>
              <textarea
                {...register("message")}
                aria-invalid={Boolean(errors.message)}
                rows={6}
                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-ink outline-none transition-shadow focus:border-primary focus:shadow-soft"
              />
              {errors.message?.message && (
                <p className="mt-2 text-xs font-medium text-destructive">
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
              {t("contact.replyTime")}
            </p>
          </form>

          <aside className="space-y-4">
            <InfoCard icon={Mail} title="Email">
              <span>{t("contact.emailInfo")}</span>
            </InfoCard>
            <InfoCard icon={Calendar} title="Book a call">
              {t("contact.bookCall")}
            </InfoCard>
            <InfoCard icon={MapPin} title="Where we work">
              {t("contact.whereWeWork")}
            </InfoCard>
          </aside>
        </div>
      </section>
    </>
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
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {required && " *"}
      </span>
      <input
        type={type}
        required={required}
        aria-invalid={Boolean(error)}
        {...registration}
        className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-ink outline-none transition-shadow focus:border-primary focus:shadow-soft"
      />
      {error && <p className="mt-2 text-xs font-medium text-destructive">{error}</p>}
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
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="mt-4 font-display text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
