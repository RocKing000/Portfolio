import { motion } from 'framer-motion';
import useStore from '../../store/useStore';

export default function BranchTree() {
  const branches = useStore((s) => s.branches);
  const currentBranch = useStore((s) => s.currentBranch);
  const setBranch = useStore((s) => s.setBranch);

  if (branches.length === 0) return null;

  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-0 h-full w-px"
        style={{ overflow: 'visible' }}
      >
        <line
          x1="0"
          y1="0"
          x2="0"
          y2="100%"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="2"
        />
      </svg>

      <div className="space-y-2 pl-2">
        {branches.map((branch, i) => {
          const isActive = currentBranch === branch.id;
          return (
            <motion.button
              key={branch.id}
              onClick={() => setBranch(branch.id)}
              className={`relative flex items-center gap-2.5 w-full text-left px-2 py-1.5 rounded-md transition-colors ${
                isActive
                  ? 'bg-dire-accent/10'
                  : 'hover:bg-white/5'
              }`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ x: 2 }}
            >
              {/* Node dot */}
              <div
                className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 ${
                  isActive
                    ? 'border-dire-accent bg-dire-accent'
                    : 'border-dire-muted bg-transparent'
                }`}
              />

              {/* Label */}
              <div className="min-w-0">
                <p
                  className={`text-[10px] font-medium truncate ${
                    isActive ? 'text-dire-accent' : 'text-dire-muted'
                  }`}
                >
                  {branch.label}
                </p>
                <p className="text-[9px] text-dire-muted/50">
                  Day {branch.fromDay} &middot; {branch.entries.length} entries
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
