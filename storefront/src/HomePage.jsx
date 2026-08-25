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

const homepageNavigation = Object.freeze({
  en: Object.freeze([
    { label: "Product", href: "/#feature" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "Use cases", href: "/#use-cases" },
    { label: "Security", href: "/security" },
    { label: "Pricing", href: "/#pricing" },
  ]),
  "zh-CN": Object.freeze([
    { label: "产品", href: "/#feature" },
    { label: "如何工作", href: "/#how-it-works" },
    { label: "使用场景", href: "/#use-cases" },
    { label: "安全", href: "/security" },
    { label: "价格", href: "/#pricing" },
  ]),
});

export function HomePage({ copy, locale }) {
  const content = getHomeJourney(locale);
  const primaryItems = homepageNavigation[locale] ?? homepageNavigation.en;

  return (
    <>
      <SiteHeader copy={copy} primaryItems={primaryItems} />
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
