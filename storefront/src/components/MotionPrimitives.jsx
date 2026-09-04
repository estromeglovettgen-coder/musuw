import { motion, useReducedMotion } from "motion/react";

const directionOffsets = {
  left: (distance) => ({ x: -distance, y: 0 }),
  right: (distance) => ({ x: distance, y: 0 }),
  up: (distance) => ({ x: 0, y: distance })
};

export function Reveal({ children, className = "", delay = 0, amount = 0.2 }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{
        duration: reduceMotion ? 0 : 0.65,
        delay: reduceMotion ? 0 : delay,
        ease: [0.16, 1, 0.3, 1]
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerGroup({
  children,
  className = "",
  amount = 0.18,
  stagger = 0.09
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={false}
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: reduceMotion ? 0 : stagger
          }
        }
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = "",
  direction = "up",
  distance = 48,
  ...rootProps
}) {
  const reduceMotion = useReducedMotion();
  const offset = directionOffsets[direction]?.(distance) ?? directionOffsets.up(distance);

  return (
    <motion.div
      {...rootProps}
      className={className}
      variants={{
        hidden: reduceMotion
          ? {}
          : {
              opacity: 0,
              scale: 0.985,
              ...offset
            },
        visible: {
          opacity: 1,
          scale: 1,
          x: 0,
          y: 0,
          transition: reduceMotion
            ? { duration: 0 }
            : {
                type: "spring",
                stiffness: 105,
                damping: 19,
                mass: 0.74
              }
        }
      }}
    >
      {children}
    </motion.div>
  );
}
