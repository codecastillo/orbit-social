"use client";

import { useEffect, useRef } from "react";
import { useSpring, useTransform, motion, useMotionValue } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  className?: string;
}

export function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const motionValue = useMotionValue(value);
  const springValue = useSpring(motionValue, {
    stiffness: 200,
    damping: 30,
    mass: 1,
  });
  const display = useTransform(springValue, (latest) =>
    Math.round(latest).toLocaleString()
  );

  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      motionValue.set(value);
      prevValueRef.current = value;
    }
  }, [value, motionValue]);

  return <motion.span className={className}>{display}</motion.span>;
}
