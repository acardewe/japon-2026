const CACHE = "japon-2026-8cc4c9cfb543";
const BASE = location.pathname.replace(/\/[^/]*$/, "/");
const RECURSOS = [BASE, BASE + "index.html", BASE + "manifest.json",
                  BASE + "icono-192.png", BASE + "icono-512.png",
                  BASE + "icono-maskable-512.png"];
const ESPERA_RED = 2500;   // con señal mala, no esperar más que esto

self.addEventListener("install", (e) => {
  // uno por uno y tolerante a fallos: con addAll, si un solo archivo falla
  // (wifi de aeropuerto) no quedaría NINGUNA copia guardada
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(RECURSOS.map(
        (u) => c.add(new Request(u, { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;   // mapas y clima van directo a la red

  const guardada = () => caches.match(e.request, { ignoreSearch: true })
    .then((r) => r || caches.match(BASE, { ignoreSearch: true }));

  const red = fetch(e.request).then((r) => {
    if (!r.ok) throw new Error("http " + r.status);   // 404 durante una publicación
    const copia = r.clone();
    e.waitUntil(caches.open(CACHE).then((c) => c.put(e.request, copia)));
    return r;
  });

  e.respondWith((async () => {
    const reloj = new Promise((ok) => setTimeout(() => ok("LENTO"), ESPERA_RED));
    try {
      const primera = await Promise.race([red, reloj]);
      if (primera !== "LENTO") return primera;
      const copia = await guardada();          // la red se demoró demasiado
      if (copia) { red.catch(() => {}); return copia; }
      return await red;                        // no hay copia: esperar igual
    } catch (err) {
      const copia = await guardada();
      if (copia) return copia;
      throw err;
    }
  })());
});
