import type { Variants, Transition } from "framer-motion";

// ---------------------------------------------------------------------------
// Spring Configs
// ---------------------------------------------------------------------------

export const springGentle: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

export const springBouncy: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 25,
  mass: 0.6,
};

export const springStiff: Transition = {
  type: "spring",
  stiffness: 600,
  damping: 35,
  mass: 0.5,
};

export const springMolasses: Transition = {
  type: "spring",
  stiffness: 150,
  damping: 20,
  mass: 1.2,
};

// ---------------------------------------------------------------------------
// Utility Factories
// ---------------------------------------------------------------------------

export function createSpring(
  stiffness: number,
  damping: number,
  mass: number = 1,
): Transition {
  return { type: "spring", stiffness, damping, mass };
}

export function createStaggerVariants(staggerDelay: number): Variants {
  return {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: staggerDelay,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Animation Variants
// ---------------------------------------------------------------------------

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springGentle,
  },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springGentle,
  },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: springGentle,
  },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: springGentle,
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springStiff,
  },
};

export const scaleInBounce: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springBouncy,
  },
};

// ---------------------------------------------------------------------------
// Container / Stagger Variants
// ---------------------------------------------------------------------------

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerFast: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.03,
    },
  },
};

export const staggerSlow: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

// ---------------------------------------------------------------------------
// Page Transition Variants
// ---------------------------------------------------------------------------

export const pageEnter: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springGentle,
  },
};

export const pageExit: Variants = {
  visible: { opacity: 1, y: 0, scale: 1 },
  hidden: {
    opacity: 0,
    y: -8,
    scale: 0.98,
    transition: { type: "spring", stiffness: 500, damping: 40, mass: 0.5 },
  },
};

// ---------------------------------------------------------------------------
// Interactive Variants
// ---------------------------------------------------------------------------

export const hoverScale: Variants = {
  initial: { scale: 1 },
  hover: {
    scale: 1.03,
    transition: springStiff,
  },
  tap: {
    scale: 0.97,
    transition: springStiff,
  },
};

export const hoverGlow: Variants = {
  initial: {
    scale: 1,
    boxShadow: "0 0 0px rgba(16, 185, 129, 0)",
  },
  hover: {
    scale: 1.02,
    boxShadow: "0 0 20px rgba(16, 185, 129, 0.35)",
    transition: springGentle,
  },
  tap: {
    scale: 0.98,
    boxShadow: "0 0 8px rgba(16, 185, 129, 0.2)",
    transition: springStiff,
  },
};

export const pressDown: Variants = {
  initial: { scale: 1, y: 0 },
  hover: {
    scale: 1.01,
    transition: springStiff,
  },
  tap: {
    scale: 0.95,
    y: 2,
    transition: springStiff,
  },
};
