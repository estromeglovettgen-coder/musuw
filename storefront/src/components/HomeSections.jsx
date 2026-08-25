import { ArrowsClockwise } from "@phosphor-icons/react/ArrowsClockwise";
import { Check } from "@phosphor-icons/react/Check";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { Clock } from "@phosphor-icons/react/Clock";
import { FileText } from "@phosphor-icons/react/FileText";
import { FolderOpen } from "@phosphor-icons/react/FolderOpen";
import { LockKey } from "@phosphor-icons/react/LockKey";
import { Minus } from "@phosphor-icons/react/Minus";
import { PaperPlaneTilt } from "@phosphor-icons/react/PaperPlaneTilt";
import { Path } from "@phosphor-icons/react/Path";
import { Plus } from "@phosphor-icons/react/Plus";
import { Question } from "@phosphor-icons/react/Question";
import { ShareNetwork } from "@phosphor-icons/react/ShareNetwork";
import { Sparkle } from "@phosphor-icons/react/Sparkle";
import { Stack } from "@phosphor-icons/react/Stack";
import { UsersThree } from "@phosphor-icons/react/UsersThree";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { priceBooks, plans } from "../data/homeContent";
import { APP_LOGIN_URL, createProductLoginUrl } from "../productHandoff";
import { Reveal, StaggerGroup, StaggerItem } from "./MotionPrimitives";
import { ButtonLink, SectionIntro } from "./SiteChrome";

const journeyIcons = [FolderOpen, Sparkle, FileText, Stack];
const featureIcons = [Sparkle, FolderOpen, Stack];
const workflowSmallIcons = [FileText, Stack, ArrowsClockwise];
const trustIcons = [FileText, LockKey, Clock, Path, UsersThree, ArrowsClockwise];
const includedIcons = [Sparkle, FileText, FolderOpen, Stack, ShareNetwork, Path];

function formatPlanAmount(locale, symbol, amount) {
  const numberLocale = locale === "zh-CN" ? "zh-CN" : "en-US";
  return `${symbol}${amount.toLocaleString(numberLocale)}`;
}

export function JourneyStrip({ content }) {
  return (
    <section className="journey-strip" aria-label={content.ariaLabel}>
      <div className="container journey-strip-grid">
        {content.items.map((item, index) => {
          const Icon = journeyIcons[index];
          return (
            <div className="journey-strip-item" key={item.step}>
              <span className="journey-strip-icon" aria-hidden="true">
                <Icon size={20} weight="duotone" />
              </span>
              <div>
                <span className="journey-strip-step">{item.step}</span>
                <strong>{item.title}</strong>
                <small>{item.body}</small>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FeatureStory({ feature, index }) {
  const Icon = featureIcons[index];
  const reverse = index % 2 === 1;
  const reduceMotion = useReducedMotion();

  return (
    <Reveal
      className={`journey-feature-card ${reverse ? "journey-feature-card-reverse" : ""}`}
      amount={0.14}
    >
      <div className="journey-feature-copy">
        <p className="journey-feature-label">
          <span aria-hidden="true">
            <Icon size={17} weight="duotone" />
          </span>
          {feature.label}
        </p>
        <h3>{feature.title}</h3>
        <p className="journey-feature-body">{feature.body}</p>
        <ul className="journey-feature-bullets">
          {feature.bullets.map((bullet) => (
            <li key={bullet}>
              <CheckCircle size={17} weight="fill" aria-hidden="true" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      <motion.div
        className="journey-feature-visual"
        initial={
          reduceMotion
            ? false
            : { opacity: 0, x: reverse ? -54 : 54, rotate: reverse ? -1.2 : 1.2 }
        }
        whileInView={{ opacity: 1, x: 0, rotate: 0 }}
        viewport={{ once: true, amount: 0.22 }}
        transition={{ type: "spring", stiffness: 90, damping: 20, mass: 0.82 }}
      >
        <div className="journey-feature-scene-label">{feature.sceneLabel}</div>
        {/* Placeholder capture: replace the image without changing the scene frame. */}
        <img
          className="journey-feature-primary-image"
          src={feature.image}
          alt={feature.imageAlt}
          width="3024"
          height="1898"
          draggable={false}
          loading="lazy"
        />
        {feature.insetImage ? (
          <div className="journey-feature-inset">
            <img
              src={feature.insetImage}
              alt={feature.insetAlt}
              width="3024"
              height="1898"
              draggable={false}
              loading="lazy"
            />
          </div>
        ) : null}
      </motion.div>
    </Reveal>
  );
}

export function FeaturesSection({ content }) {
  return (
    <section className="section journey-features-section" id="feature">
      <div className="container">
        <Reveal>
          <SectionIntro
            label={content.intro.label}
            icon={CheckCircle}
            title={content.intro.title}
            body={content.intro.body}
          />
        </Reveal>
        <div className="journey-feature-stack">
          {content.items.map((feature, index) => (
            <FeatureStory feature={feature} index={index} key={feature.title} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function WorkflowSection({ content }) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="section journey-workflow-section" id="how-it-works">
      <div className="container">
        <Reveal>
          <SectionIntro
            label={content.intro.label}
            icon={ShareNetwork}
            title={content.intro.title}
            body={content.intro.body}
          />
        </Reveal>

        <StaggerGroup className="journey-workflow-grid" amount={0.1} stagger={0.1}>
          {content.largeItems.map((item, index) => (
            <StaggerItem
              className="journey-workflow-card journey-workflow-card-large"
              direction={index === 0 ? "left" : "right"}
              distance={52}
              key={item.title}
            >
              <div className="journey-workflow-card-copy">
                <span>{item.badge}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
              <motion.div
                className="journey-workflow-media"
                initial={reduceMotion ? false : { opacity: 0.86, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.18 }}
                transition={{ type: "spring", stiffness: 88, damping: 20, delay: reduceMotion ? 0 : 0.08 }}
              >
                {/* Placeholder capture: replace with the final source or scope scene. */}
                <img
                  src={item.image}
                  alt={item.imageAlt}
                  width="3024"
                  height="1898"
                  draggable={false}
                  loading="lazy"
                />
              </motion.div>
            </StaggerItem>
          ))}

          {content.smallItems.map((item, index) => {
            const Icon = workflowSmallIcons[index];
            return (
              <StaggerItem
                className="journey-workflow-card journey-workflow-card-small"
                direction="up"
                distance={42}
                key={item.title}
              >
                <span className="journey-workflow-small-icon" aria-hidden="true">
                  <Icon size={22} weight="duotone" />
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      </div>
    </section>
  );
}

export function UseCasesSection({ content }) {
  return (
    <section className="section journey-use-cases-section" id="use-cases">
      <div className="container">
        <Reveal>
          <SectionIntro
            label={content.intro.label}
            icon={PaperPlaneTilt}
            title={content.intro.title}
            body={content.intro.body}
          />
        </Reveal>

        <StaggerGroup className="journey-use-case-grid" amount={0.14} stagger={0.12}>
          {content.items.map((item) => (
            <StaggerItem className="journey-use-case-card" distance={48} key={item.title}>
              <div className="journey-use-case-image">
                {/* Placeholder capture: replace with the final task-specific screenshot. */}
                <img
                  src={item.image}
                  alt={item.imageAlt}
                  width="3024"
                  height="1898"
                  draggable={false}
                  loading="lazy"
                />
              </div>
              <div className="journey-use-case-copy">
                <span>{item.category}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <strong>
                  <CheckCircle size={18} weight="fill" aria-hidden="true" />
                  {item.outcome}
                </strong>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}

export function BenefitsSection({ content }) {
  return (
    <section className="section journey-trust-section">
      <div className="container">
        <Reveal>
          <SectionIntro
            label={content.intro.label}
            icon={LockKey}
            title={content.intro.title}
            body={content.intro.body}
          />
        </Reveal>

        <StaggerGroup className="journey-trust-grid" amount={0.16} stagger={0.075}>
          {content.items.map((item, index) => {
            const Icon = trustIcons[index];
            return (
              <StaggerItem className="journey-trust-item" distance={36} key={item.title}>
                <span aria-hidden="true">
                  <Icon size={23} weight="duotone" />
                </span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      </div>
    </section>
  );
}

export function PricingSection({ content, locale }) {
  const [yearly, setYearly] = useState(false);
  const priceBook = locale === "zh-CN" ? priceBooks.CNY : priceBooks.USD;
  const localizedPlans = content.plans.map((plan, index) => ({
    ...plans[index],
    ...plan,
    ...priceBook[index],
  }));

  return (
    <section className="section journey-pricing-section" id="pricing">
      <div className="container">
        <Reveal className="journey-pricing-heading">
          <p className="journey-pricing-label">{content.intro.label}</p>
          <h2>{content.intro.title}</h2>
          <p>{content.intro.body}</p>
        </Reveal>

        <div className="journey-pricing-controls">
          <div className="journey-billing-toggle" role="group" aria-label={content.intro.label}>
            <button
              type="button"
              className={!yearly ? "active" : ""}
              aria-pressed={!yearly}
              onClick={() => setYearly(false)}
            >
              {content.monthly}
            </button>
            <button
              type="button"
              className={yearly ? "active" : ""}
              aria-pressed={yearly}
              onClick={() => setYearly(true)}
            >
              {content.yearly}
              <span>{content.save}</span>
            </button>
          </div>
        </div>
        <p className="journey-pricing-note">{content.note}</p>

        <div className="journey-pricing-grid">
          {localizedPlans.map((plan) => (
            <article
              className={`journey-pricing-card ${plan.featured ? "journey-pricing-card-featured" : ""}`}
              data-plan={plan.key}
              key={plan.key}
            >
              <div className="journey-pricing-card-top">
                <div className="journey-pricing-title-row">
                  <h3>{plan.name}</h3>
                  {plan.featured ? <span>{content.recommended}</span> : null}
                </div>
                <p>{plan.description}</p>
                <strong className="journey-plan-fit">{plan.fit}</strong>
              </div>

              <div className="journey-plan-price">
                <strong>
                  {formatPlanAmount(
                    locale,
                    content.currencySymbol,
                    yearly ? plan.yearlyTotal : plan.monthly,
                  )}
                </strong>
                <span>{yearly ? content.perYear : content.perMonth}</span>
              </div>

              {plan.key === "free" ? (
                <ButtonLink className="journey-pricing-button" href={APP_LOGIN_URL} variant="secondary">
                  {plan.action}
                </ButtonLink>
              ) : (
                <ButtonLink
                  className="journey-pricing-button"
                  href={createProductLoginUrl({
                    plan: plan.key,
                    billingPeriod: yearly ? "yearly" : "monthly",
                  })}
                >
                  {plan.action}
                </ButtonLink>
              )}

              <div className="journey-plan-details">
                <strong>{content.includes}</strong>
                <ul>
                  {plan.details.map((detail) => (
                    <li key={detail}>
                      <Check size={17} weight="bold" aria-hidden="true" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function IncludedInEveryPlanSection({ content }) {
  return (
    <section className="section journey-included-section">
      <div className="container">
        <Reveal className="journey-included-card">
          <SectionIntro
            label={content.intro.label}
            icon={CheckCircle}
            title={content.intro.title}
            body={content.intro.body}
          />

          <div className="journey-included-grid">
            {content.items.map((item, index) => {
              const Icon = includedIcons[index];
              return (
                <div className="journey-included-item" key={item.title}>
                  <span aria-hidden="true">
                    <Icon size={21} weight="duotone" />
                  </span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="journey-plan-differences">
            <strong>{content.differencesLabel}</strong>
            <div>
              {content.differences.map((difference) => (
                <span key={difference}>{difference}</span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function FAQSection({ content }) {
  const [openIndex, setOpenIndex] = useState(-1);
  const reduceMotion = useReducedMotion();

  return (
    <section className="section journey-faq-section" id="faq">
      <div className="container journey-faq-layout">
        <Reveal className="journey-faq-intro">
          <p className="section-label">
            <span className="section-label-icon" aria-hidden="true">
              <Question size={20} weight="regular" />
            </span>
            {content.label}
          </p>
          <h2>{content.title}</h2>
          <p>{content.body}</p>
        </Reveal>

        <div className="journey-faq-list">
          {content.items.map((faq, index) => {
            const open = openIndex === index;
            return (
              <div className={`journey-faq-item ${open ? "open" : ""}`} key={faq.question}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`journey-faq-answer-${index}`}
                  onClick={() => setOpenIndex(open ? -1 : index)}
                >
                  <span>{faq.question}</span>
                  {open ? <Minus size={20} /> : <Plus size={20} />}
                </button>
                <AnimatePresence initial={false}>
                  {open ? (
                    <motion.div
                      id={`journey-faq-answer-${index}`}
                      className="journey-faq-answer"
                      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: reduceMotion ? 0 : 0.26 }}
                    >
                      <p>{faq.answer}</p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FinalCTA({ content }) {
  return (
    <section className="journey-final-cta">
      <div className="container">
        <Reveal className="journey-final-cta-card">
          <div className="journey-final-cta-copy">
            <h2>{content.title}</h2>
            <p>{content.body}</p>
            <div className="journey-final-cta-actions">
              <ButtonLink href={APP_LOGIN_URL}>{content.action}</ButtonLink>
              <ButtonLink href="/#how-it-works" variant="secondary">
                {content.secondaryAction}
              </ButtonLink>
            </div>
          </div>

          <div className="journey-final-cta-visual">
            <div className="journey-final-cta-frame">
              {/* Placeholder capture: replace with the final first-upload state. */}
              <img
                src="/images/musuw-knowledge-base.jpg"
                alt={content.imageAlt}
                width="3024"
                height="1898"
                draggable={false}
                loading="lazy"
              />
            </div>
            <div className="journey-final-upload-card">
              <span aria-hidden="true">
                <FolderOpen size={20} weight="duotone" />
              </span>
              <div>
                <strong>{content.fileName}</strong>
                <small>{content.fileStatus}</small>
              </div>
              <span className="journey-final-upload-check" aria-hidden="true">
                <CheckCircle size={20} weight="fill" />
              </span>
            </div>
            <div className="journey-final-prompt">
              <Sparkle size={17} weight="fill" aria-hidden="true" />
              <span>{content.prompt}</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
