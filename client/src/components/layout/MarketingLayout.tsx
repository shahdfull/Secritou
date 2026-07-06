import { memo } from "react";
import { Outlet } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { useTranslation } from "react-i18next";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { LandingCmsProvider } from "@/providers/LandingCmsProvider";
import { WhatsAppButton } from "@/components/WhatsAppButton";

// Lazy-loaded from AppRoutes: keeps Header/Footer/CMS provider (and the motion
// runtime pulled in by MotionConfig) out of the entry chunk so /app users never
// download the marketing shell.
export const MarketingLayout = memo(function MarketingLayout() {
  const { t } = useTranslation();
  return (
    <LandingCmsProvider>
      {/* reducedMotion="user" disables motion animations across the whole
          marketing site for users with prefers-reduced-motion. */}
      <MotionConfig reducedMotion="user">
        <div className="flex min-h-screen-safe flex-col bg-background">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
          >
            {t("a11y.skipToContent")}
          </a>
          <Header />
          <main id="main" className="flex-1">
            <Outlet />
          </main>
          <Footer />
          <WhatsAppButton />
        </div>
      </MotionConfig>
    </LandingCmsProvider>
  );
});
