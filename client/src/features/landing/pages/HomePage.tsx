import { Hero } from "@/features/landing/components/Hero";
import { Problems } from "@/features/landing/components/Problems";
import { Services } from "@/features/landing/components/Services";
import { HowItWorks } from "@/features/landing/components/HowItWorks";
import { SolutionsTeaser } from "@/features/landing/components/SolutionsTeaser";
import { FutureProduct } from "@/features/landing/components/FutureProduct";
import { CaseStudiesSection } from "@/features/landing/components/CaseStudies";
import { Differentiators } from "@/features/landing/components/Differentiators";
import { FAQ } from "@/features/landing/components/FAQ";
import { FinalCTA } from "@/features/landing/components/FinalCTA";
import { BusinessImpact } from "@/features/landing/components/BusinessImpact";



export function HomePage() {
  return (
    <>
      <Hero />
      <Problems />
      <Services />
      <HowItWorks />
      <SolutionsTeaser />
      <FutureProduct />
      <BusinessImpact />
      <CaseStudiesSection />
      <Differentiators />
      <FAQ />
      <FinalCTA />
    </>
  );
}
