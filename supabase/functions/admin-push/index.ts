import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

type WebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, unknown> | null;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function buildMessage(payload: WebhookPayload) {
  const table = payload.table || "";
  const row = payload.record || {};
  if (table === "orders") {
    const nr = row.order_number != null ? `#${row.order_number}` : "pasūtījums";
    const who = typeof row.name === "string" && row.name ? row.name : "Jauns klients";
    return {
      title: "Jauns pasūtījums",
      body: `${nr} · ${who}`,
      tag: `order-${row.id || Date.now()}`,
      url: "/admin.html",
    };
  }
  if (table === "messages") {
    const who =
      typeof row.name === "string" && row.name ? row.name : "Jauna ziņa";
    return {
      title: "Jauna ziņa",
      body: who,
      tag: `message-${row.id || Date.now()}`,
      url: "/admin.html",
    };
  }
  return {
    title: "AA3DLab",
    body: "Jauns notikums adminā",
    tag: `aa3dlab-${Date.now()}`,
    url: "/admin.html",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject =
      Deno.env.get("VAPID_SUBJECT") || "mailto:armands@pd.lv";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!publicKey || !privateKey || !supabaseUrl || !serviceKey) {
      return json({ error: "Missing VAPID or Supabase env" }, 500);
    }

    const payload = (await req.json()) as WebhookPayload;
    if (payload.type && payload.type !== "INSERT") {
      return json({ ok: true, skipped: true, reason: "not insert" });
    }

    const message = buildMessage(payload);
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");

    if (error) {
      return json({ error: error.message }, 500);
    }
    if (!subs?.length) {
      return json({ ok: true, sent: 0 });
    }

    const appServer = await webpush.ApplicationServer.new({
      contactInformation: subject,
      vapidKeys: { publicKey, privateKey },
    });

    let sent = 0;
    const stale: string[] = [];

    await Promise.all(
      subs.map(async (row) => {
        try {
          const subscriber = appServer.subscribe({
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          });
          await subscriber.pushTextMessage(JSON.stringify(message), {});
          sent += 1;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("push fail", row.id, msg);
          if (/410|404|Gone|Not Found/i.test(msg)) stale.push(row.id);
        }
      })
    );

    if (stale.length) {
      await admin.from("push_subscriptions").delete().in("id", stale);
    }

    return json({ ok: true, sent, stale: stale.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    return json({ error: msg }, 500);
  }
});
