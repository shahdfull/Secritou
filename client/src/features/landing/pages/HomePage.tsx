import { Hero } from "@/features/landing/components/Hero";
import { SocialProof } from "@/features/landing/components/SocialProof";
import { Problems } from "@/features/landing/components/Problems";
import { Services } from "@/features/landing/components/Services";
import { HowItWorks } from "@/features/landing/components/HowItWorks";
import { SolutionsTeaser } from "@/features/landing/components/SolutionsTeaser";
import { Differentiators } from "@/features/landing/components/Differentiators";
import { FAQ } from "@/features/landing/components/FAQ";
import { FinalCTA } from "@/features/landing/components/FinalCTA";
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
      <Hero />
      <SocialProof />
      <Problems />
      <Services />
      <SolutionsTeaser />
      <HowItWorks />
      <Differentiators />
      <FAQ />
      <FinalCTA />
    </>
  );
}
