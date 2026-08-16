import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check,
  CheckCircle,
  ClipboardText,
  Fire,
  Minus,
  Plus,
  Question,
  SealCheck,
  SquaresFour,
  Star,
  Wallet
} from "@phosphor-icons/react";
import {
  articles,
  benefits,
  comparisonGroups,
  customerMarks,
  faqs,
  features,
  priceBooks,
  plans,
  testimonials,
  workflows
} from "../data/homeContent";
import { Reveal, StaggerGroup, StaggerItem } from "./MotionPrimitives";
import { ButtonLink, SectionIntro } from "./SiteChrome";
import { APP_LOGIN_URL, createProductLoginUrl } from "../productHandoff";

function formatPlanAmount(symbol, amount) {
  return `${symbol}${amount.toLocaleString("en-US")}`;
}

export function CustomerStrip({ copy }) {
  return (
    <section className="customer-strip" aria-label={copy.customerStrip.label}>
      <div className="container">
        <p>{copy.customerStrip.label}</p>
        <div className="customer-ticker">
          <div className="customer-track">
            {[...customerMarks, ...customerMarks, ...customerMarks].map(({ name, icon: Icon }, idx) => (
              <div className="customer-logo" key={`${name}-${idx}`}>
                <Icon size={20} weight="duotone" aria-hidden="true" />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureStory({ feature, index, learnMore }) {
  const Icon = feature.icon;
  const reverse = index % 2 === 1;
  const reduceMotion = useReducedMotion();

  return (
    <Reveal className={`feature-story ${reverse ? "feature-story-reverse" : ""}`} amount={0.16}>
      <div className="feature-copy">
        <p className="feature-label">
          <span className="feature-icon">
            <Icon size={15} weight="bold" />
          </span>
          {feature.label}
        </p>
        <h3>{feature.title}</h3>
        <p>{feature.description}</p>
        <ButtonLink href="/#pricing">
          {learnMore}
        </ButtonLink>
        <ul className="feature-bullets">
          {feature.bullets.map((bullet) => (
            <li key={bullet}>
              <CheckCircle size={18} weight="fill" aria-hidden="true" />
              {bullet}
            </li>
          ))}
        </ul>
      </div>
      <motion.div
        className="feature-visual"
        initial={
          reduceMotion
            ? false
            : {
                opacity: 0,
                x: reverse ? -86 : 86,
                rotate: reverse ? -1.4 : 1.4
              }
        }
        whileInView={{ opacity: 1, x: 0, rotate: 0 }}
        whileHover={reduceMotion ? undefined : { y: -6, rotate: reverse ? -0.6 : 0.6 }}
        viewport={{ once: true, amount: 0.24 }}
        transition={{
          type: "spring",
          stiffness: 92,
          damping: 18,
          mass: 0.82
        }}
      >
        <img
          src={feature.image}
          alt={feature.imageAlt}
          width="830"
          height="864"
          draggable={false}
          loading="lazy"
        />
      </motion.div>
    </Reveal>
  );
}

export function FeaturesSection({ copy }) {
  const localizedFeatures = features.map((feature, index) => ({
    ...feature,
    ...copy.features.items[index]
  }));
  return (
    <section className="section features-section" id="feature">
      <div className="container">
        <Reveal>
          <SectionIntro
            label={copy.features.intro.label}
            icon={SealCheck}
            title={copy.features.intro.title}
            body={copy.features.intro.body}
          />
        </Reveal>
        <div className="feature-stack">
          {localizedFeatures.map((feature, index) => (
            <FeatureStory
              feature={feature}
              index={index}
              learnMore={copy.features.learnMore}
              key={feature.title}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function WorkflowSection({ copy }) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="section workflow-section" id="use-cases">
      <div className="container">
        <Reveal>
          <SectionIntro
            label={copy.workflow.intro.label}
            icon={SquaresFour}
            title={copy.workflow.intro.title}
            body={copy.workflow.intro.body}
          />
        </Reveal>
        <StaggerGroup className="workflow-grid" amount={0.12} stagger={0.11}>
          {workflows.map(({ icon: Icon }, index) => {
            const { title, body } = copy.workflow.items[index];
            return (
            <StaggerItem
              className={`workflow-card ${index < 2 ? "workflow-card-large" : "workflow-card-small"}`}
              direction={index === 0 ? "left" : index === 1 ? "right" : "up"}
              distance={index < 2 ? 64 : 52}
              key={title}
            >
              {index >= 2 && (
                <span className="workflow-icon">
                  <Icon size={21} weight="regular" aria-hidden="true" />
                </span>
              )}
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
              {index < 2 ? (
                <motion.div
                  className={`workflow-image workflow-image-${index + 1}`}
                  initial={
                    reduceMotion
                      ? false
                      : { y: 24, opacity: 0.85 }
                  }
                  whileInView={{
                    y: 0,
                    opacity: 1
                  }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{
                    type: "spring",
                    stiffness: 90,
                    damping: 20,
                    mass: 0.8,
                    delay: reduceMotion ? 0 : 0.1
                  }}
                >
                  <img
                    src={index === 0 ? "/images/musnow-wiki-page.jpg" : "/images/musnow-wiki-graph.jpg"}
                    alt={copy.workflow.imageAlts[index]}
                    width="1024"
                    height={index === 0 ? "673" : "601"}
                    draggable={false}
                    loading="lazy"
                  />
                </motion.div>
              ) : null}
            </StaggerItem>
            );
          })}
        </StaggerGroup>
      </div>
    </section>
  );
}

export function BenefitsSection({ copy }) {
  return (
    <section className="section benefits-section">
      <div className="container">
        <Reveal>
          <SectionIntro
            label={copy.benefits.intro.label}
            icon={CheckCircle}
            title={copy.benefits.intro.title}
            body={copy.benefits.intro.body}
          />
        </Reveal>
        <StaggerGroup className="benefit-grid" amount={0.2} stagger={0.085}>
          {benefits.map(({ icon: Icon }, index) => {
            const { title, body } = copy.benefits.items[index];
            return (
            <StaggerItem
              className={`benefit-item benefit-item-${(index % 3) + 1}`}
              direction={index % 3 === 0 ? "left" : index % 3 === 2 ? "right" : "up"}
              distance={48}
              key={title}
            >
              <span>
                <Icon size={23} weight="duotone" aria-hidden="true" />
              </span>
              <h3>{title}</h3>
              <p>{body}</p>
            </StaggerItem>
            );
          })}
        </StaggerGroup>
      </div>
    </section>
  );
}

export function PricingSection({ copy }) {
  const [yearly, setYearly] = useState(false);
  const reduceMotion = useReducedMotion();
  const priceBook = priceBooks[copy.pricing.currencyCode] ?? priceBooks.USD;
  const localizedPlans = plans.map((plan, index) => ({
    ...plan,
    ...copy.pricing.plans[index],
    ...priceBook[index]
  }));

  return (
    <section className="section pricing-section" id="pricing">
      <div className="container">
        <Reveal>
          <SectionIntro
            label={copy.pricing.intro.label}
            icon={Wallet}
            title={copy.pricing.intro.title}
            body={copy.pricing.intro.body}
          />
        </Reveal>
        <div className="pricing-controls">
          <div className="billing-toggle" role="group" aria-label={copy.pricing.billingAria}>
            <button
              type="button"
              className={!yearly ? "active" : ""}
              aria-pressed={!yearly}
              onClick={() => setYearly(false)}
            >
              {copy.pricing.monthly}
            </button>
            <button
              type="button"
              className={yearly ? "active" : ""}
              aria-pressed={yearly}
              onClick={() => setYearly(true)}
            >
              {copy.pricing.yearly}
              <span>{copy.pricing.save}</span>
            </button>
          </div>
        </div>
        <p className="purchase-mode-note" id="purchase-mode-note" aria-live="polite">
          <span>{copy.pricing.checkout.note}</span>
          <small>{copy.pricing.checkout.providerNote}</small>
        </p>
        <motion.div
          className="pricing-grid"
          initial={reduceMotion ? false : "hidden"}
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: reduceMotion ? 0 : 0.11
              }
            }
          }}
        >
          {localizedPlans.map((plan) => (
            <motion.article
              className={`pricing-card ${plan.featured ? "pricing-card-featured" : ""}`}
              data-plan={plan.key}
              key={plan.name}
              layout={!reduceMotion}
              variants={{
                hidden: reduceMotion
                  ? {}
                  : {
                      opacity: 0,
                      y: 72,
                      scale: 0.975
                    },
                visible: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: reduceMotion
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        stiffness: 96,
                        damping: 19,
                        mass: 0.82
                      }
                }
              }}
              transition={{
                layout: {
                  type: "spring",
                  stiffness: 200,
                  damping: 24
                }
              }}
            >
              <p className="plan-label">
                {plan.featured ? <Fire size={19} weight="regular" aria-hidden="true" /> : null}
                {plan.label}
              </p>
              <div className="pricing-card-content">
                <div className="plan-summary">
                  <div className="plan-heading">
                    <h3>{plan.name}</h3>
                    <p className="plan-description">{plan.description}</p>
                  </div>
                  <div className="plan-price">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.strong
                        key={yearly ? plan.yearlyTotal : plan.monthly}
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                        transition={{ duration: reduceMotion ? 0 : 0.18 }}
                      >
                        {formatPlanAmount(
                          copy.pricing.currencySymbol,
                          yearly ? plan.yearlyTotal : plan.monthly
                        )}
                      </motion.strong>
                    </AnimatePresence>
                    <span>{yearly ? copy.pricing.perYear : copy.pricing.perUserMonth}</span>
                  </div>
                </div>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check size={18} weight="bold" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.key === "free" ? (
                  <ButtonLink
                    className="pricing-button"
                    href={APP_LOGIN_URL}
                    variant="secondary"
                  >
                    {copy.pricing.freeAction}
                  </ButtonLink>
                ) : plan.available === false ? (
                  <ButtonLink
                    className="pricing-button"
                    href="/contact"
                    variant={plan.featured ? "primary" : "secondary"}
                  >
                    {copy.pricing.unavailableAction}
                  </ButtonLink>
                ) : (
                  <ButtonLink
                    className="pricing-button"
                    href={createProductLoginUrl({
                      plan: plan.key,
                      billingPeriod: yearly ? "yearly" : "monthly"
                    })}
                    variant={plan.featured ? "primary" : "secondary"}
                  >
                    {copy.pricing.checkout.action}
                  </ButtonLink>
                )}
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

export function ComparisonSection({ copy }) {
  return (
    <section className="comparison-section">
      <div className="container">
        <ComparisonTable copy={copy} />
      </div>
    </section>
  );
}

function ComparisonTable({ copy }) {
  return (
    <Reveal className="comparison-wrap">
      <h2>{copy.comparison.title}</h2>
      <div className="comparison-table" role="table" aria-label={copy.comparison.tableAria}>
        <div className="comparison-head" role="row">
          <span role="columnheader">{copy.comparison.firstColumn}</span>
          {copy.comparison.plans.map((plan) => <span role="columnheader" key={plan}>{plan}</span>)}
        </div>
        {comparisonGroups.map((group, groupIndex) => (
          <div className="comparison-group" key={group.title}>
            {groupIndex > 0 ? (
              <div className="comparison-group-head" role="row">
                <h4>{copy.comparison.groups[groupIndex].title}</h4>
                {copy.comparison.plans.map((plan) => <span key={plan}>{plan}</span>)}
              </div>
            ) : null}
            {group.rows.map(([_name, ...availability], rowIndex) => {
              const name = copy.comparison.groups[groupIndex].rows[rowIndex];
              return (
              <div className="comparison-row" role="row" key={name}>
                <span role="cell">{name}</span>
                {availability.map((enabled, index) => (
                  <span role="cell" key={`${name}-${index}`}>
                    {enabled ? (
                      <CheckCircle size={19} weight="fill" aria-label={copy.comparison.included} />
                    ) : (
                      <Minus size={17} aria-label={copy.comparison.notIncluded} />
                    )}
                  </span>
                ))}
              </div>
              );
            })}
          </div>
        ))}
      </div>
    </Reveal>
  );
}

export function TestimonialsSection({ copy }) {
  const localizedTestimonials = testimonials.map((testimonial, index) => ({
    ...testimonial,
    ...copy.testimonials.items[index]
  }));
  const col1 = localizedTestimonials.filter((_, i) => i % 3 === 0);
  const col2 = localizedTestimonials.filter((_, i) => i % 3 === 1);
  const col3 = localizedTestimonials.filter((_, i) => i % 3 === 2);

  return (
    <section className="section testimonials-section">
      <div className="container testimonial-frame">
        <Reveal>
          <SectionIntro
            label={copy.testimonials.intro.label}
            icon={ClipboardText}
            title={copy.testimonials.intro.title}
            body={copy.testimonials.intro.body}
          />
          <div className="testimonial-rating">
            <Star size={16} weight="fill" aria-hidden="true" />
            <span>{copy.testimonials.rating}</span>
          </div>
        </Reveal>

        <div className="testimonial-shell">
          <div className="testimonial-col col-down">
            <div className="testimonial-track">
              {[...col1, ...col1].map((testimonial, idx) => (
                <div className="testimonial-card" key={`c1-${idx}`}>
                  <p>{testimonial.quote}</p>
                  <div className="testimonial-person">
                    <img
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      width="42"
                      height="42"
                      draggable={false}
                      loading="lazy"
                    />
                    <div>
                      <strong>{testimonial.name}</strong>
                      <span>{testimonial.role}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="testimonial-col col-up">
            <div className="testimonial-track">
              {[...col2, ...col2].map((testimonial, idx) => (
                <div className="testimonial-card" key={`c2-${idx}`}>
                  <p>{testimonial.quote}</p>
                  <div className="testimonial-person">
                    <img
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      width="42"
                      height="42"
                      draggable={false}
                      loading="lazy"
                    />
                    <div>
                      <strong>{testimonial.name}</strong>
                      <span>{testimonial.role}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="testimonial-col col-down">
            <div className="testimonial-track">
              {[...col3, ...col3].map((testimonial, idx) => (
                <div className="testimonial-card" key={`c3-${idx}`}>
                  <p>{testimonial.quote}</p>
                  <div className="testimonial-person">
                    <img
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      width="42"
                      height="42"
                      draggable={false}
                      loading="lazy"
                    />
                    <div>
                      <strong>{testimonial.name}</strong>
                      <span>{testimonial.role}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function BlogPreviewSection({ copy }) {
  const localizedArticles = articles.map((article, index) => ({
    ...article,
    ...copy.blog.items[index]
  }));
  return (
    <section className="section blog-section" id="blog">
      <div className="container">
        <div className="blog-heading">
          <div>
            <h2>{copy.blog.title}</h2>
          </div>
          <ButtonLink href="/#feature" variant="text" icon>
            {copy.blog.allPosts}
          </ButtonLink>
        </div>
        <StaggerGroup className="article-grid" amount={0.2} stagger={0.12}>
          {localizedArticles.map((article) => (
            <StaggerItem className="article-card" distance={58} key={article.title}>
              <a href={article.href}>
                <div className="article-image">
                  <img
                    src={article.image}
                    alt={article.alt}
                    width="1024"
                    height="823"
                    draggable={false}
                    loading="lazy"
                  />
                </div>
                <h3>{article.title}</h3>
                <div>
                  <span>{article.author}</span>
                  <time>{article.date}</time>
                </div>
              </a>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}

export function FAQSection({ copy }) {
  const [openIndex, setOpenIndex] = useState(-1);
  const reduceMotion = useReducedMotion();

  return (
    <section className="section faq-section" id="faq">
      <div className="container faq-layout">
        <Reveal className="faq-intro">
          <p className="section-label">
            <span className="section-label-icon" aria-hidden="true">
              <Question size={20} weight="regular" />
            </span>
            {copy.faq.label}
          </p>
          <h2>{copy.faq.title}</h2>
          <p>{copy.faq.body}</p>
        </Reveal>
        <div className="faq-list">
          {copy.faq.items.map((faq, index) => {
            const open = openIndex === index;
            return (
              <div className={`faq-item ${open ? "open" : ""}`} key={faq.question}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`faq-answer-${index}`}
                  onClick={() => setOpenIndex(open ? -1 : index)}
                >
                  <span>{faq.question}</span>
                  {open ? <Minus size={20} /> : <Plus size={20} />}
                </button>
                <AnimatePresence initial={false}>
                  {open ? (
                    <motion.div
                      id={`faq-answer-${index}`}
                      className="faq-answer"
                      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: reduceMotion ? 0 : 0.28 }}
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

export function FinalCTA({ copy }) {
  return (
    <section className="final-cta">
      <div className="container">
        <Reveal className="final-cta-card">
          <img
            src="/images/dot-background.png"
            className="final-cta-bg"
            alt=""
            draggable={false}
            aria-hidden="true"
          />
          <div className="final-cta-copy">
            <h2>{copy.finalCta.title}</h2>
            <p>{copy.finalCta.body}</p>
            <ButtonLink href={APP_LOGIN_URL}>{copy.finalCta.action}</ButtonLink>
          </div>
          <div className="final-cta-visual" aria-hidden="true">
            <div className="final-cta-dashboard-frame">
              <img
                src="/images/musnow-query-citation.jpg"
                alt=""
                width="1800"
                height="1200"
                draggable={false}
                loading="lazy"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
