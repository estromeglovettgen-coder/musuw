import { HeroScene } from "./components/HeroScene";
import {
  FAQSection,
  FeaturesSection,
  FinalCTA,
} from "./components/HomeSections";
import {
  MarketingComparisonSection,
  MarketingPricingSection,
  PlatformSection,
} from "./components/HomeRefreshSections";
import { SiteFooter, SiteHeader } from "./components/SiteChrome";
import { applyHomepagePlanPresentation } from "./planPresentation";
import {
  applyHomepageMarketingRefresh,
  MARKETING_FOOTER_GROUPS,
  MARKETING_NAVIGATION,
} from "./homepageMarketingRefresh";

export function HomePage({ copy }) {
  const homepageCopy = applyHomepageMarketingRefresh(applyHomepagePlanPresentation(copy));

  return (
    <>
      <SiteHeader copy={homepageCopy} navigation={MARKETING_NAVIGATION} />
      <main>
        <HeroScene copy={homepageCopy} />
        <FeaturesSection copy={homepageCopy} />
        <PlatformSection copy={homepageCopy} />
        <MarketingPricingSection copy={homepageCopy} />
        <MarketingComparisonSection copy={homepageCopy} />
        <FAQSection copy={homepageCopy} />
        <FinalCTA copy={homepageCopy} />
      </main>
      <SiteFooter copy={homepageCopy} groups={MARKETING_FOOTER_GROUPS} />
    </>
  );
}
