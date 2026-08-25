import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { FileText } from "@phosphor-icons/react/FileText";
import { FolderOpen } from "@phosphor-icons/react/FolderOpen";
import { Sparkle } from "@phosphor-icons/react/Sparkle";
import { Stack } from "@phosphor-icons/react/Stack";
import { motion, useReducedMotion } from "motion/react";
import { APP_LOGIN_URL } from "../productHandoff";
import { ButtonLink } from "./SiteChrome";

export function HeroScene({ content }) {
  const reduceMotion = useReducedMotion();
  const rise = (delay = 0) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 34 },
    animate: { opacity: 1, y: 0 },
    transition: {
      type: "spring",
      stiffness: 110,
      damping: 20,
      mass: 0.85,
      delay: reduceMotion ? 0 : delay,
    },
  });

  return (
    <section className="hero" id="hero">
      <div className="hero-dots" aria-hidden="true" />
      <div className="container hero-copy">
        <motion.div className="hero-eyebrow" {...rise(0)}>
          <span>
            <Sparkle size={15} weight="fill" aria-hidden="true" />
          </span>
          {content.eyebrow}
        </motion.div>
        <motion.h1 {...rise(0.04)}>
          {content.titleLine1}
          <br />
          {content.titleLine2}
        </motion.h1>
        <motion.p className="hero-description" {...rise(0.1)}>
          {content.description}
        </motion.p>
        <motion.div className="hero-actions" {...rise(0.14)}>
          <ButtonLink href={APP_LOGIN_URL}>{content.primaryAction}</ButtonLink>
          <ButtonLink href="/#how-it-works" variant="secondary">
            {content.secondaryAction}
          </ButtonLink>
        </motion.div>
        <motion.ul className="hero-trust-list" {...rise(0.18)}>
          {content.trustItems.map((item) => (
            <li key={item}>
              <CheckCircle size={16} weight="fill" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </motion.ul>
      </div>

      <div className="container hero-stage">
        <motion.div
          className="hero-proof-shell"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 28 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 90,
            damping: 22,
            mass: 0.9,
            delay: reduceMotion ? 0 : 0.12,
          }}
        >
          <div className="hero-proof-main">
            <div className="hero-proof-windowbar">
              <span className="hero-proof-window-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <strong>
                <FileText size={17} weight="duotone" aria-hidden="true" />
                {content.scene.mainLabel}
              </strong>
            </div>
            <div className="hero-proof-main-image">
              {/* Placeholder capture: replace with the final citation-to-source interaction. */}
              <img
                src="/images/musuw-query-citation.jpg"
                width="3024"
                height="1898"
                alt={content.scene.mainAlt}
                draggable={false}
              />
            </div>
            <div className="hero-proof-main-note">
              <FileText size={18} weight="fill" aria-hidden="true" />
              <span>{content.scene.mainMeta}</span>
            </div>
          </div>

          <motion.article
            className="hero-proof-card hero-proof-card-sources"
            initial={reduceMotion ? false : { opacity: 0, x: -42, rotate: -4 }}
            animate={{ opacity: 1, x: 0, rotate: -2 }}
            transition={{ type: "spring", stiffness: 92, damping: 19, delay: reduceMotion ? 0 : 0.32 }}
          >
            <header>
              <span>
                <FolderOpen size={17} weight="duotone" aria-hidden="true" />
              </span>
              <div>
                <strong>{content.scene.sourcesLabel}</strong>
                <small>{content.scene.sourcesMeta}</small>
              </div>
            </header>
            <div className="hero-proof-card-image">
              {/* Placeholder capture: replace with the final selected-source scope scene. */}
              <img
                src="/images/musuw-knowledge-base.jpg"
                width="3024"
                height="1898"
                alt={content.scene.sourcesAlt}
                draggable={false}
              />
            </div>
          </motion.article>

          <motion.article
            className="hero-proof-card hero-proof-card-wiki"
            initial={reduceMotion ? false : { opacity: 0, x: 42, rotate: 4 }}
            animate={{ opacity: 1, x: 0, rotate: 2 }}
            transition={{ type: "spring", stiffness: 92, damping: 19, delay: reduceMotion ? 0 : 0.38 }}
          >
            <header>
              <span>
                <Stack size={17} weight="duotone" aria-hidden="true" />
              </span>
              <div>
                <strong>{content.scene.wikiLabel}</strong>
                <small>{content.scene.wikiMeta}</small>
              </div>
            </header>
            <div className="hero-proof-card-image">
              {/* Placeholder capture: replace with the final saved-to-Wiki state. */}
              <img
                src="/images/musuw-wiki-page.jpg"
                width="3024"
                height="1898"
                alt={content.scene.wikiAlt}
                draggable={false}
              />
            </div>
          </motion.article>
        </motion.div>
      </div>
    </section>
  );
}
