import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Scale chart height down on smaller viewports. */
export function useResponsiveChartHeight(baseHeight: number): number {
  const isLg = useMediaQuery('(min-width: 1024px)');
  const isMd = useMediaQuery('(min-width: 768px)');
  const isSm = useMediaQuery('(min-width: 640px)');

  if (isLg) return baseHeight;
  if (isMd) return Math.round(baseHeight * 0.85);
  if (isSm) return Math.round(baseHeight * 0.78);
  return Math.round(baseHeight * 0.68);
}
