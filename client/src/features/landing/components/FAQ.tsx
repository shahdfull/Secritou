import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTranslation } from "react-i18next";

export function FAQ() {
  const { t } = useTranslation();
  
  const faqs = [
    {
      q: t("home.faq.questions.0.q"),
      a: t("home.faq.questions.0.a"),
    },
    {
      q: t("home.faq.questions.1.q"),
      a: t("home.faq.questions.1.a"),
    },
    {
      q: t("home.faq.questions.2.q"),
      a: t("home.faq.questions.2.a"),
    },
    {
      q: t("home.faq.questions.3.q"),
      a: t("home.faq.questions.3.a"),
    },
    {
      q: t("home.faq.questions.4.q"),
      a: t("home.faq.questions.4.a"),
    },
  ];

  return (
    <section className="bg-surface-warm/40 py-20 sm:py-28">
      <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t("home.faq.subtitle")}
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">
            {t("home.faq.title")}
          </h2>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("home.faq.description")}
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-b border-border">
              <AccordionTrigger className="text-left font-display text-base font-semibold text-ink">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
