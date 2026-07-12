import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import useStore from '../../store/useStore';
import { getResourcesByCompany, getAllResources } from '../../utils/api';

// Category colour map
const CATEGORY_COLORS = {
  critical_minerals:    { bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', text: 'text-yellow-400' },
  energy_resources:     { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400' },
  industrial_metals:    { bg: 'bg-blue-500/15',   border: 'border-blue-500/30',   text: 'text-blue-400'   },
  technology_materials: { bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-400' },
  strategic_environmental: { bg: 'bg-green-500/15', border: 'border-green-500/30', text: 'text-green-400' },
};

const CATEGORY_ICONS = {
  critical_minerals:    '💎',
  energy_resources:     '⚡',
  industrial_metals:    '⚙️',
  technology_materials: '💻',
  strategic_environmental: '🌊',
};

const VIEW_MODES = [
  { id: 'risk',         label: 'Risk'        },
  { id: 'availability', label: 'Availability' },
  { id: 'combined',     label: 'Combined'    },
];

export default function ResourceFilter() {
  const selectedResource  = useStore((s) => s.selectedResource);
  const setSelectedResource = useStore((s) => s.setSelectedResource);
  const globeViewMode     = useStore((s) => s.globeViewMode);
  const setGlobeViewMode  = useStore((s) => s.setGlobeViewMode);
  const selectedCompany   = useStore((s) => s.selectedCompany);

  const [resources, setResources]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchResources() {
      setLoading(true);
      setError(null);
      try {
        let result;
        if (selectedCompany?.id) {
          console.log('[ResourceFilter] Fetching resources for company:', selectedCompany.id);
          result = await getResourcesByCompany(selectedCompany.id);
        } else {
          console.log('[ResourceFilter] Fetching all strategic resources');
          result = await getAllResources();
        }

        if (!cancelled) {
          const list = result?.data || result || [];
          if (list.length === 0) {
            console.warn('[ResourceFilter] API returned empty resources list');
          }
          setResources(list);
        }
      } catch (err) {
        console.error('[ResourceFilter] Failed to load resources:', err.message);
        if (!cancelled) setError('Could not load resources');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchResources();
    return () => { cancelled = true; };
  }, [selectedCompany?.id]);

  // Group resources by category
  const grouped = resources.reduce((acc, r) => {
    const cat = r.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {/* View Mode Toggle */}
      <div className="flex gap-1 bg-dire-dark rounded-lg p-0.5">
        {VIEW_MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setGlobeViewMode(m.id)}
            className={`flex-1 py-1 text-[10px] font-medium rounded-md transition-colors ${
              globeViewMode === m.id
                ? 'bg-dire-accent/20 text-dire-accent'
                : 'text-dire-muted hover:text-white/70'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-[10px] text-dire-muted text-center py-2 animate-pulse">
          Loading resources...
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="text-[10px] text-red-400/80 text-center py-1 bg-red-500/10 rounded-lg border border-red-500/20 px-2">
          {error}
        </div>
      )}

      {/* Resources by category */}
      {!loading && resources.length > 0 && (
        <div className="space-y-2">
          {Object.entries(grouped).map(([cat, items]) => {
            const colors = CATEGORY_COLORS[cat] || { bg: 'bg-white/5', border: 'border-white/10', text: 'text-white/60' };
            const icon   = CATEGORY_ICONS[cat] || '📦';

            return (
              <div key={cat}>
                <div className={`text-[9px] font-semibold uppercase tracking-wider px-1 mb-1 ${colors.text}`}>
                  {icon} {cat.replace(/_/g, ' ')}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {items.map((r) => (
                    <motion.button
                      key={r.id || r.name}
                      onClick={() => setSelectedResource(selectedResource === r.name ? null : r.name)}
                      className={`text-left px-2 py-1.5 rounded-lg text-[10px] transition-all border ${
                        selectedResource === r.name
                          ? `${colors.bg} ${colors.border} ${colors.text}`
                          : 'bg-dire-dark border-white/5 text-dire-muted hover:border-white/10 hover:text-white'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      title={r.description || r.name}
                    >
                      <span className="truncate block">{r.name}</span>
                      {r.dependency_score != null && (
                        <span className="text-[8px] text-dire-muted mt-0.5 block">
                          dep {Math.round(r.dependency_score * 100)}%
                        </span>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && resources.length === 0 && !error && (
        <div className="text-[10px] text-dire-muted text-center py-2">
          No resources found
        </div>
      )}

      {/* Clear selection */}
      {selectedResource && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setSelectedResource(null)}
          className="w-full py-1.5 text-[10px] text-dire-muted hover:text-white bg-dire-dark rounded-lg border border-white/5"
        >
          Clear Filter
        </motion.button>
      )}
    </div>
  );
}
