import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

/**
 * Animated number component that smoothly transitions between values.
 * @param {{ value: number, decimals?: number, className?: string, colorize?: boolean }} props
 */
export default function AnimatedNumber({
  value,
  decimals = 1,
  className = '',
  colorize = false,
}) {
  const spring = useSpring(value, { stiffness: 100, damping: 20 });
  const display = useTransform(spring, (v) => v.toFixed(decimals));
  const [direction, setDirection] = useState(0);
  const prevValue = useRef(value);

  useEffect(() => {
    const diff = value - prevValue.current;
    if (diff > 0) setDirection(1);
    else if (diff < 0) setDirection(-1);
    else setDirection(0);
    prevValue.current = value;
    spring.set(value);
  }, [value, spring]);

  const colorClass = colorize
    ? direction > 0
      ? 'text-dire-success'
      : direction < 0
        ? 'text-dire-danger'
        : 'text-white'
    : '';

  return (
    <motion.span className={`${className} ${colorClass} tabular-nums`}>
      {display}
    </motion.span>
  );
}
