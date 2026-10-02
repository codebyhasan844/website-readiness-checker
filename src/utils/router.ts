import { useState, useEffect, useCallback } from 'react';

export interface RouteState {
  path: string;
  scanId?: string;
}

function parseLocation(): RouteState {
  if (typeof window === 'undefined') {
    return { path: '/' };
  }

  // Support path, hash (#/report/xyz), or query (?route=/report/xyz)
  let currentPath = window.location.pathname;

  if (window.location.hash.startsWith('#/')) {
    currentPath = window.location.hash.slice(1);
  } else if (window.location.search.includes('route=')) {
    const params = new URLSearchParams(window.location.search);
    const route = params.get('route');
    if (route) currentPath = route;
  }

  if (currentPath.startsWith('/report/')) {
    const scanId = currentPath.replace('/report/', '').split('/')[0] || 'scan-demo-7492';
    return { path: '/report', scanId };
  }

  return { path: '/' };
}

export function useRouter() {
  const [route, setRoute] = useState<RouteState>(parseLocation);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseLocation());
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const navigate = useCallback((targetPath: string) => {
    try {
      window.history.pushState({}, '', targetPath);
    } catch {
      // In restricted iframe environments, fall back to hash
      window.location.hash = targetPath;
    }
    setRoute(parseLocation());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return {
    path: route.path,
    scanId: route.scanId,
    navigate,
  };
}
