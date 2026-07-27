import { Hero } from "@/features/landing/components/Hero";
import { SocialProof } from "@/features/landing/components/SocialProof";
import { Problems } from "@/features/landing/components/Problems";
import { Services } from "@/features/landing/components/Services";
import { PacksSection } from "@/features/landing/components/PacksSection";
import { HowItWorks } from "@/features/landing/components/HowItWorks";
import { SolutionsTeaser } from "@/features/landing/components/SolutionsTeaser";
import { Differentiators } from "@/features/landing/components/Differentiators";
import { FAQ } from "@/features/landing/components/FAQ";
import { FinalCTA } from "@/features/landing/components/FinalCTA";
import { OnThisPageNav } from "@/features/landing/components/OnThisPageNav";
import { useSeoMeta } from "@/hooks/useSeoMeta";


export function HomePage() {
  useSeoMeta({
    title: "Secritou : Croissance & Transformation Digitale | PME Tunisie",
    description: "Agence tunisienne B2B: stratégie, technologie, marketing. Aidons PME, startups & créateurs à s'organiser, se digitaliser et croître.",
    image: "https://secritou.com/og-image.jpg",
    url: "https://secritou.com"
  });
  return (
    <>
      <div className="pointer-events-none fixed left-6 top-1/2 z-30 hidden -translate-y-1/2 2xl:block">
        <div className="pointer-events-auto">
          <OnThisPageNav />
        </div>
      </div>
      <Hero />
      <SocialProof />
      <Problems />
      <Services />
      <PacksSection />
      <SolutionsTeaser />
      <HowItWorks />
      <Differentiators />
      <FAQ />
      <FinalCTA />
    </>
  );
}
