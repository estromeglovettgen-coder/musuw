import { HeroScene } from "./components/HeroScene";
import {
  BenefitsSection,
  BlogPreviewSection,
  ComparisonSection,
  FAQSection,
  FeaturesSection,
  FinalCTA,
  PricingSection
} from "./components/HomeSections";
import { SiteFooter, SiteHeader } from "./components/SiteChrome";
import {
  applyHomepagePlanPresentation,
  HOMEPAGE_FOOTER_GROUPS,
  HOMEPAGE_NAVIGATION
} from "./planPresentation";

export function HomePage({ copy }) {
  const homepageCopy = applyHomepagePlanPresentation(copy);

  return (
    <>
      <SiteHeader copy={homepageCopy} navigation={HOMEPAGE_NAVIGATION} />
      <main>
        <HeroScene copy={homepageCopy} />
        <FeaturesSection copy={homepageCopy} />
        <BenefitsSection copy={homepageCopy} />
        <PricingSection copy={homepageCopy} />
        <ComparisonSection copy={homepageCopy} />
        <BlogPreviewSection copy={homepageCopy} />
        <FAQSection copy={homepageCopy} />
        <FinalCTA copy={homepageCopy} />
      </main>
      <SiteFooter copy={homepageCopy} groups={HOMEPAGE_FOOTER_GROUPS} />
    </>
  );
}
