// Supabase project (Project Settings → API). Leave empty to run in local-only mode (no accounts).
// The anon key is public by design; row-level security (supabase-schema.sql) protects the data.
export const SUPABASE = {
  url: localStorage.getItem('mq.devurl') || 'https://lnoylahecexsexfrvleg.supabase.co',
  key: localStorage.getItem('mq.devkey') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxub3lsYWhlY2V4c2V4ZnJ2bGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTI5MTMsImV4cCI6MjEwMzA4ODkxM30.5X6w8Sj8oIVMBQRzteTI6FWhwyA6X3MILI4HOscqZZw',
};
