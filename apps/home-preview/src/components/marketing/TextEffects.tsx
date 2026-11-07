import { type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/** Aceternity text-generate / cover interaction, composed for RMS's Korean headline. */
export function RevealLine({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      className="lp-reveal-line"
      initial={reduced ? false : { opacity: 0.55, filter: "blur(7px)", y: 8 }}
      whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      viewport={{ once: true, amount: 0.65 }}
      transition={{ duration: 0.75, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.span>
  );
}

/** The label always remains readable and selectable; only its underline responds. */
export function CoverText({ children }: { children: ReactNode }) {
  return (
    <span className="lp-cover-text">
      <span className="lp-cover-trails" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="lp-cover-label">{children}</span>
    </span>
  );
}
