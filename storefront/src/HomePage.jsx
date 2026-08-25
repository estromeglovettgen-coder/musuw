import { HeroScene } from "./components/HeroScene";
import {
  BenefitsSection,
  FAQSection,
  FeaturesSection,
  FinalCTA,
  IncludedInEveryPlanSection,
  JourneyStrip,
  PricingSection,
  UseCasesSection,
  WorkflowSection,
} from "./components/HomeSections";
import { SiteFooter, SiteHeader } from "./components/SiteChrome";
import { getHomeJourney } from "./data/homeJourney";

export function HomePage({ copy, locale }) {
  const content = getHomeJourney(locale);

  return (
    <>
      <SiteHeader copy={copy} />
      <main className="home-journey">
        <HeroScene content={content.hero} />
        <JourneyStrip content={content.journey} />
        <FeaturesSection content={content.features} />
        <WorkflowSection content={content.workflow} />
        <UseCasesSection content={content.useCases} />
        <BenefitsSection content={content.trust} />
        <PricingSection content={content.pricing} locale={locale} />
        <IncludedInEveryPlanSection content={content.included} />
        <FAQSection content={content.faq} />
        <FinalCTA content={content.finalCta} />
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}
