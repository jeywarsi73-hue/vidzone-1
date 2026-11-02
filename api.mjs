import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";
const h = s => createHash("sha256").update(String(s)).digest("hex");
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async (req) => {
  const store = getStore("vidzone");
  const list = (await store.get("videos", { type: "json" })) || [];
  const p = new URL(req.url).pathname.replace(/^\/api\//, "");
  const admin = !!process.env.ADMIN_PASSWORD && req.headers.get("x-admin") === process.env.ADMIN_PASSWORD;
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  if (req.method === "GET" && p === "videos")
    return J(list.map(v => { const { pinHash, ...r } = v; if (v.locked) delete r.url; return r; }));

  if (p === "unlock") {
    const v = list.find(x => x.id === body.id);
    if (v && v.locked && v.pinHash === h(body.pin)) return J({ url: v.url });
    return J({ error: "wrong pin" }, 403);
  }

  if (p === "check") return J({ ok: admin });
  if (!admin) return J({ error: "অনুমতি নেই" }, 401);

  if (p === "config") return J({ cloud: process.env.CLOUDINARY_CLOUD || "", preset: process.env.CLOUDINARY_PRESET || "" });

  if (p === "save") {
    const v = body.video || {};
    if (!v.id || !v.title) return J({ error: "টাইটেল দিন" }, 400);
    const old = list.find(x => x.id === v.id) || {};
    const m = { ...old, ...v };
    if (!v.url) m.url = old.url || "";
    if (!m.url) return J({ error: "ভিডিও লিংক দিন" }, 400);
    if (body.pin) m.pinHash = h(body.pin);
    if (m.locked && !m.pinHash) return J({ error: "Locked ভিডিওর জন্য PIN দিন" }, 400);
    await store.setJSON("videos", [...list.filter(x => x.id !== m.id), m]);
    return J({ ok: true });
  }

  if (p === "delete") {
    await store.setJSON("videos", list.filter(x => x.id !== body.id));
    return J({ ok: true });
  }
  return J({ error: "not found" }, 404);
};
export const config = { path: "/api/*" };
