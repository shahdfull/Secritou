import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth.store";
import { useLandingCms } from "@/providers/LandingCmsProvider";
import { AskQuestionDialog } from "./AskQuestionDialog";

type FaqItem = { question: string; answer: string };

const DEFAULT_ITEMS: FaqItem[] = [
  { question: "", answer: "" },
  { question: "", answer: "" },
  { question: "", answer: "" },
  { question: "", answer: "" },
  { question: "", answer: "" },
];

export function FAQ() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.status === "authenticated");
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const { cms, cmsJson } = useLandingCms();

  const subtitle = cms("faq.subtitle", t("home.faq.subtitle"));
  const title = cms("faq.title", t("home.faq.title"));
  const description = cms("faq.description", t("home.faq.description"));
  const customQuestionCta = cms("faq.customQuestionCta", t("home.faq.customQuestion.cta"));
  const faqs = cmsJson("faq.items", DEFAULT_ITEMS);

  return (
    <section className="bg-surface-warm/40 py-14 sm:py-20">
      <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{subtitle}</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">{title}</h2>
          <p className="mt-4 text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="w-full">
          {faqs.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-b border-border">
                  <AccordionTrigger className="text-left font-display text-base font-semibold text-ink">
                    {f.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {f.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}

          <Button
            className="mt-6 bg-ink text-white hover:bg-ink/90"
            onClick={() => {
              if (isAuthenticated) {
                setShowQuestionDialog(true);
              } else {
                navigate("/login?redirect=/");
              }
            }}
          >
            {customQuestionCta}
          </Button>
        </div>
      </div>

      <AskQuestionDialog open={showQuestionDialog} onOpenChange={setShowQuestionDialog} />
    </section>
  );
}
