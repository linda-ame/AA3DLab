/**
 * Izveido vai atjaunina admin lietotāju.
 *
 *   SUPABASE_SECRET_KEY='sb_secret_...' ADMIN_EMAIL='...' ADMIN_PASSWORD='...' node scripts/ensure-admin.mjs
 */
const url = "https://yepcjzlffitwgwdujtxz.supabase.co";
const secret = process.env.SUPABASE_SECRET_KEY;
const email = process.env.ADMIN_EMAIL || "armands@pd.lv";
const password = process.env.ADMIN_PASSWORD;

if (!secret || !password) {
  console.error("Vajag SUPABASE_SECRET_KEY un ADMIN_PASSWORD");
  process.exit(1);
}

const headers = {
  apikey: secret,
  Authorization: `Bearer ${secret}`,
  "Content-Type": "application/json",
};

const listRes = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=200`, {
  headers,
});
const list = await listRes.json();
if (!listRes.ok) {
  console.error("Neizdevās nolasīt lietotājus:", list);
  process.exit(1);
}

const existing = (list.users || []).find(
  (u) => (u.email || "").toLowerCase() === email.toLowerCase()
);

if (existing) {
  const updRes = await fetch(`${url}/auth/v1/admin/users/${existing.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "admin", ...(existing.user_metadata || {}) },
    }),
  });
  const body = await updRes.json();
  if (!updRes.ok) {
    console.error("Neizdevās atjaunināt admin:", body);
    process.exit(1);
  }
  console.log("Admin atjaunināts:", email, existing.id);
  process.exit(0);
}

const createRes = await fetch(`${url}/auth/v1/admin/users`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "admin" },
  }),
});
const body = await createRes.json();
if (!createRes.ok) {
  console.error("Neizdevās izveidot admin:", body);
  process.exit(1);
}
console.log("Admin izveidots:", email, body.id);
