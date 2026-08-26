import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform
} from "motion/react";
import { useRef } from "react";
import { Sparkle } from "@phosphor-icons/react/Sparkle";
import { ButtonLink } from "./SiteChrome";
import { APP_LOGIN_URL } from "../productHandoff";
import {
  sampleCursorScroll,
  sampleHeroVisibility
} from "./heroMotion";

export function HeroScene({ copy }) {
  const reduceMotion = useReducedMotion();
  const sceneRef = useRef(null);
  const { scrollY } = useScroll();
  const { scrollYProgress: sceneVisibilityProgress } = useScroll({
    target: sceneRef,
    offset: ["start end", "end end"]
  });
  const smoothSceneProgress = useSpring(sceneVisibilityProgress, {
    stiffness: 500,
    damping: 60,
    mass: 1
  });
  const smoothScrollY = useSpring(scrollY, {
    stiffness: 500,
    damping: 60,
    mass: 1
  });

  const sceneX = useTransform(smoothSceneProgress, (value) =>
    reduceMotion ? 0 : sampleHeroVisibility(value).translateX
  );
  const sceneY = useTransform(smoothSceneProgress, (value) =>
    reduceMotion ? 0 : sampleHeroVisibility(value).translateY
  );
  const sceneScale = useTransform(smoothSceneProgress, (value) =>
    reduceMotion ? 1 : sampleHeroVisibility(value).scale
  );
  const sceneRotateZ = useTransform(smoothSceneProgress, (value) =>
    reduceMotion ? 0 : sampleHeroVisibility(value).rotateZ
  );
  const sceneRotateX = useTransform(smoothSceneProgress, (value) =>
    reduceMotion ? 0 : sampleHeroVisibility(value).rotateX
  );
  const sceneRotateY = useTransform(smoothSceneProgress, (value) =>
    reduceMotion ? 0 : sampleHeroVisibility(value).rotateY
  );
  const sceneSkewX = useTransform(smoothSceneProgress, (value) =>
    reduceMotion ? 0 : sampleHeroVisibility(value).skewX
  );
  const cursorX = useTransform(smoothScrollY, (value) =>
    reduceMotion ? 0 : sampleCursorScroll(value).translateX
  );
  const cursorY = useTransform(smoothScrollY, (value) =>
    reduceMotion ? 0 : sampleCursorScroll(value).translateY
  );
  const cursorScale = useTransform(smoothScrollY, (value) =>
    reduceMotion ? 1 : sampleCursorScroll(value).scale
  );
  const cursorRotateZ = useTransform(smoothScrollY, (value) =>
    reduceMotion ? 0 : sampleCursorScroll(value).rotateZ
  );
  const cursorRotateX = useTransform(smoothScrollY, (value) =>
    reduceMotion ? 0 : sampleCursorScroll(value).rotateX
  );
  const cursorRotateY = useTransform(smoothScrollY, (value) =>
    reduceMotion ? 0 : sampleCursorScroll(value).rotateY
  );
  const cursorSkewX = useTransform(smoothScrollY, (value) =>
    reduceMotion ? 0 : sampleCursorScroll(value).skewX
  );
  const sceneTransform = useMotionTemplate`perspective(1200px) translateX(${sceneX}px) translateY(${sceneY}px) scale(${sceneScale}) rotate(${sceneRotateZ}deg) rotateX(${sceneRotateX}deg) rotateY(${sceneRotateY}deg) skewX(${sceneSkewX}deg)`;
  const cursorTransform = useMotionTemplate`perspective(1200px) translateX(${cursorX}px) translateY(${cursorY}px) scale(${cursorScale}) rotate(${cursorRotateZ}deg) rotateX(${cursorRotateX}deg) rotateY(${cursorRotateY}deg) skewX(${cursorSkewX}deg)`;

  const bkpwddTransition = {
    type: "spring",
    bounce: 0.1,
    duration: reduceMotion ? 0 : 0.8,
    delay: 0
  };

  const subtitleTransition = {
    type: "spring",
    bounce: 0.2,
    duration: reduceMotion ? 0 : 0.8,
    delay: reduceMotion ? 0 : 0.2
  };

  const springScaleTransition = {
    type: "spring",
    bounce: 0,
    duration: reduceMotion ? 0 : 1,
    delay: 0
  };

  return (
    <section className="hero" id="hero">
      <div className="hero-dots" aria-hidden="true" />
      <div className="container hero-copy">
        <motion.div
          className="hero-eyebrow"
          initial={reduceMotion ? false : { opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={bkpwddTransition}
        >
          <span>
            <Sparkle size={15} weight="fill" />
          </span>
          {copy.hero.eyebrow}
        </motion.div>
        <motion.h1
          initial={reduceMotion ? false : { opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={bkpwddTransition}
        >
          {copy.hero.titleLine1}
          <br />
          {copy.hero.titleLine2}
        </motion.h1>
        <motion.p
          className="hero-description"
          initial={reduceMotion ? false : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={subtitleTransition}
        >
          {copy.hero.descriptionLine1}
          <br className="hero-description-break" />
          {copy.hero.descriptionLine2}
        </motion.p>
        <motion.div
          className="hero-actions"
          initial={reduceMotion ? false : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={subtitleTransition}
        >
          <ButtonLink href={APP_LOGIN_URL}>{copy.hero.getStarted}</ButtonLink>
          <ButtonLink href="/#blog" variant="secondary">
            {copy.hero.talkToSales}
          </ButtonLink>
        </motion.div>
      </div>

      <div className="container hero-stage">
        <motion.div
          className="dashboard-entry"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={springScaleTransition}
        >
          <motion.div
            ref={sceneRef}
            className="dashboard-scene"
            style={{ transform: sceneTransform }}
          >
            <div className="dashboard-frame">
              {/* Replace these placeholder sources with the final product walkthrough. */}
              <video
                autoPlay={!reduceMotion}
                muted
                loop
                playsInline
                preload="metadata"
                poster="/images/musuw-query-citation.jpg"
                aria-label={copy.hero.dashboardAlt}
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                  objectFit: "cover"
                }}
              >
                <source src="/media/musuw-overview.webm" type="video/webm" />
                <source src="/media/musuw-overview.mp4" type="video/mp4" />
              </video>
            </div>
          </motion.div>

          <div className="hero-cursor-viewport" aria-hidden="true">
            <motion.img
              className="hero-cursor"
              src="/images/hero-cursor.png"
              width="137"
              height="88"
              draggable={false}
              alt=""
              style={{ transform: cursorTransform }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
