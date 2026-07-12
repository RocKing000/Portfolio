import { motion } from 'framer-motion';

/**
 * Loading spinner with cyan color and pulse animation.
 * @param {{ size?: number, className?: string }} props
 */
export default function LoadingSpinner({ size = 32, className = '' }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <motion.div
        className="rounded-full border-2 border-dire-accent/30 border-t-dire-accent"
        style={{ width: size, height: size }}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </div>
  );
}
