// Capital Street's multiplayer server (Supabase). Fill in both values to switch multiplayer on (see README, Goal 11).
// Both are public by design: they only identify the server. What anyone may do there is decided by the database's
// own rules in server/schema.sql, so never put a "service_role" or secret key here.
window.CS_NET = {
  url: '', // e.g. https://abcdefghijklmnop.supabase.co
  key: '', // the project's publishable key (sb_publishable_...) or legacy anon key
};
