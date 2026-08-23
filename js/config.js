// Supabase project (Project Settings → API). Leave empty to run in local-only mode (no accounts).
export const SUPABASE = {
  url: localStorage.getItem('mq.devurl') || '',
  key: localStorage.getItem('mq.devkey') || '',
};
