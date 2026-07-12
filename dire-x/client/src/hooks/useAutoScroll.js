import { useEffect } from 'react';

/**
 * Custom hook for auto-scrolling a container to the bottom
 * when dependencies change.
 * @param {React.RefObject} ref - Ref to the scrollable container
 * @param {any[]} deps - Dependencies that trigger scroll
 */
export default function useAutoScroll(ref, deps = []) {
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTo({
        top: ref.current.scrollHeight,
        behavior: 'smooth',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
