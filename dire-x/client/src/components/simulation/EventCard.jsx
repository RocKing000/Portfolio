import { motion } from 'framer-motion';
import { getTypeIcon, getTypeColor, getSeverityColor, formatDay } from '../../utils/format';

/**
 * Single event display component.
 * @param {{ event: import('../../types/index').Event, index?: number }} props
 */
export default function EventCard({ event, index = 0 }) {
  const typeColor = getTypeColor(event.type);
  const severityColor = getSeverityColor(event.severity);
  const isCritical = event.severity >= 4;

  return (
    <motion.div
      className={`bg-dire-card rounded-lg p-3 border ${
        isCritical
          ? 'border-l-4 border-l-dire-danger border-t-white/5 border-r-white/5 border-b-white/5'
          : 'border-white/5'
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 20,
        delay: index * 0.05,
      }}
      {...(isCritical && {
        animate: {
          opacity: 1,
          y: 0,
          x: [0, -3, 3, -2, 2, 0],
        },
        transition: {
          x: { duration: 0.4, delay: index * 0.05 + 0.2 },
          opacity: { duration: 0.3, delay: index * 0.05 },
          y: { type: 'spring', stiffness: 200, damping: 20, delay: index * 0.05 },
        },
      })}
    >
      <div className="flex items-start gap-2">
        {/* Icon */}
        <span className="text-base mt-0.5">{getTypeIcon(event.type)}</span>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="text-xs font-semibold text-white truncate">
              {event.title}
            </h4>
            <span className="text-[10px] text-dire-muted whitespace-nowrap font-mono">
              {formatDay(event.day)}
            </span>
          </div>

          {/* Description */}
          <p className="text-[11px] text-dire-muted leading-relaxed mb-2">
            {event.description}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between">
            {/* Severity dots */}
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${
                    i < event.severity
                      ? event.severity >= 4
                        ? 'bg-dire-danger'
                        : event.severity >= 3
                          ? 'bg-dire-warning'
                          : 'bg-dire-success'
                      : 'bg-dire-dark'
                  }`}
                />
              ))}
              <span className={`text-[10px] ml-1 ${severityColor}`}>
                Sev {event.severity}/5
              </span>
            </div>

            {/* Type badge */}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${typeColor.text} bg-white/5 capitalize`}
            >
              {event.type}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
