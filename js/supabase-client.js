(() => {
  const cfg = window.AA3DSupabaseConfig;
  if (!cfg || !cfg.url || !cfg.anonKey) {
    window.AA3DSupabase = null;
    return;
  }
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("Supabase JS SDK nav ielādēts");
    window.AA3DSupabase = null;
    return;
  }
  window.AA3DSupabase = window.supabase.createClient(cfg.url, cfg.anonKey);
})();
