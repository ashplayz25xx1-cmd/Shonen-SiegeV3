// Shonen Siege V3.4 Supabase frontend connection.
// The publishable key is intended for browser use. Never place a service_role or sb_secret key here.
export const SUPABASE_URL = 'https://eiroktpujykenknfutzj.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_OcK8Cy01U-V91USDPc1p7A_4Q-kBEju';
export const isBackendConfigured = () => Boolean(SUPABASE_URL.trim() && SUPABASE_ANON_KEY.trim());
