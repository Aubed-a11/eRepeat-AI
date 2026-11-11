/* Petits caches partagés : travaux publiés et élèves liés. Un seul chargement par écran, rechargeable. */
import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

function makeStore(path, key) {
  let data = null, loading = null;
  const subs = new Set();
  const emit = () => subs.forEach(f => f(data));
  const load = force => {
    if (loading) return loading;
    if (data !== null && !force) return Promise.resolve(data);
    loading = api('GET', path).then(r => { data = r[key]; }, () => { if (data === null) data = []; }).then(() => { loading = null; emit(); return data; });
    return loading;
  };
  const reset = () => { data = null; };
  const use = () => {
    const [v, setV] = useState(data);
    useEffect(() => { subs.add(setV); setV(data); load(true); return () => { subs.delete(setV); }; }, []);
    const reload = useCallback(() => load(true), []);
    return [v, reload];
  };
  return { use, load, reset };
}

export const worksStore = makeStore('/works', 'works');
export const kidsStore = makeStore('/children', 'children');
export const useWorks = worksStore.use;
export const useKids = kidsStore.use;
export const resetData = () => { worksStore.reset(); kidsStore.reset(); };
