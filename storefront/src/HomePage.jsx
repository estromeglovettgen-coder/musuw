import { HeroScene } from "./components/HeroScene";
import {
  BenefitsSection,
  BlogPreviewSection,
  ComparisonSection,
  FAQSection,
  FeaturesSection,
  FinalCTA,
  PricingSection,
  WorkflowSection
} from "./components/HomeSections";
import { SiteFooter, SiteHeader } from "./components/SiteChrome";
import { applyHomepagePlanPresentation } from "./planPresentation";

export function HomePage({ copy }) {
  const homepageCopy = applyHomepagePlanPresentation(copy);

  return (
    <>
      <SiteHeader copy={homepageCopy} />
      <main>
        <HeroScene copy={homepageCopy} />
        <FeaturesSection copy={homepageCopy} />
        <WorkflowSection copy={homepageCopy} />
        <BenefitsSection copy={homepageCopy} />
        <PricingSection copy={homepageCopy} />
        <ComparisonSection copy={homepageCopy} />
        <BlogPreviewSection copy={homepageCopy} />
        <FAQSection copy={homepageCopy} />
        <FinalCTA copy={homepageCopy} />
      </main>
      <SiteFooter copy={homepageCopy} />
    </>
  );
}
