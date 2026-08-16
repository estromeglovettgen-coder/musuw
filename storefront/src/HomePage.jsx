import { HeroScene } from "./components/HeroScene";
import {
  BenefitsSection,
  BlogPreviewSection,
  ComparisonSection,
  CustomerStrip,
  FAQSection,
  FeaturesSection,
  FinalCTA,
  PricingSection,
  TestimonialsSection,
  WorkflowSection
} from "./components/HomeSections";
import { SiteFooter, SiteHeader } from "./components/SiteChrome";

export function HomePage({ copy }) {
  return (
    <>
      <SiteHeader copy={copy} />
      <main>
        <HeroScene copy={copy} />
        <CustomerStrip copy={copy} />
        <FeaturesSection copy={copy} />
        <WorkflowSection copy={copy} />
        <BenefitsSection copy={copy} />
        <PricingSection copy={copy} />
        <ComparisonSection copy={copy} />
        <TestimonialsSection copy={copy} />
        <BlogPreviewSection copy={copy} />
        <FAQSection copy={copy} />
        <FinalCTA copy={copy} />
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}
