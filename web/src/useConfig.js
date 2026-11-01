import { useEffect, useState } from 'react';
import { api } from './api.js';

let cache = null;
export function useConfig() {
  const [cfg, setCfg] = useState(cache);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (cache) return;
    api('/config').then((c) => { cache = c; setCfg(c); }).catch((e) => setError(e.message));
  }, []);
  return { cfg, error };
}
