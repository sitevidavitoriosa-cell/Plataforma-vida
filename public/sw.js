/* Service worker do Vida Vitoriosa: deixa o app abrir sem internet.
   - Guarda as páginas e arquivos do próprio site (nunca respostas do banco).
   - Os dados (saúde, quartos) são guardados pela própria página, só se a pessoa permitir. */
const VERSAO = "vv-v1";
const ESTATICO = `${VERSAO}-static`;
const PAGINAS = `${VERSAO}-paginas`;
const PRE = ["/", "/entrar", "/setores", "/estoque", "/organizacional", "/offline.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGINAS).then((c) => Promise.all(PRE.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => !k.startsWith(VERSAO)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// a página manda os arquivos que ela já carregou, para valerem offline desde a primeira visita
self.addEventListener("message", (e) => {
  if (!e.data || e.data.tipo !== "cachear") return;
  const urls = (e.data.urls || []).filter((u) => { try { const x = new URL(u, self.location.origin); return x.origin === self.location.origin && x.pathname.startsWith("/_next/static/"); } catch { return false; } });
  e.waitUntil(caches.open(ESTATICO).then((c) => Promise.all(urls.map((u) => c.match(u).then((h) => h || c.add(u).catch(() => {}))))));
});

const comTempo = (req, ms) => new Promise((ok, erro) => {
  const t = setTimeout(() => erro(new Error("tempo")), ms);
  fetch(req).then((r) => { clearTimeout(t); ok(r); }, (er) => { clearTimeout(t); erro(er); });
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // banco, fontes etc.: direto na rede

  // arquivos com nome único (hash): primeiro o guardado
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(caches.open(ESTATICO).then(async (c) => {
      const h = await c.match(req); if (h) return h;
      const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r;
    }));
    return;
  }

  // páginas: rede primeiro (sempre a versão nova); se a internet estiver ruim ou cair, a guardada
  if (req.mode === "navigate") {
    if (url.pathname.startsWith("/r/")) return; // link público de decisões: nunca guardar
    e.respondWith((async () => {
      const c = await caches.open(PAGINAS);
      try {
        const r = await comTempo(req, 4500);
        if (r.ok && !url.pathname.startsWith("/api")) c.put(req, r.clone());
        return r;
      } catch {
        return (await c.match(req, { ignoreSearch: true })) || (await c.match("/", { ignoreSearch: true })) || (await caches.match("/offline.html")) || new Response("Sem internet.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
  }
});
