/* ==========================================================================
   sw.js — service worker: guarda a app para funcionar sem internet
   Estratégia: cache primeiro para os ficheiros da app (são estáticos e poucos).
   Ao publicar uma versão nova, mude VERSAO.
   ========================================================================== */

const VERSAO = 'dose-certa-v29';
const FICHEIROS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/auth.js',
  './js/push-cliente.js',
  './js/dados.js',
  './js/horarios.js',
  './js/avisos.js',
  './js/ui.js',
  './js/vistas.js',
  './js/formulario.js',
  './assets/icone.svg',
  './assets/icone-mascara.svg',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(VERSAO);
    // IMPORTANTE: usar cache:'reload' força o navegador a ir buscar cada
    // ficheiro à rede em vez de reaproveitar cópias do HTTP cache. Sem isto,
    // se um utilizador tinha vistas.js v18 em disco cache com max-age de 4h
    // (imposto por regras do CF), o SW instalava-se com esse ficheiro velho
    // e a v19 nunca chegava a correr.
    await Promise.all(FICHEIROS.map(async (f) => {
      try {
        const resposta = await fetch(f, { cache: 'reload' });
        if (resposta.ok) await cache.put(f, resposta);
      } catch (e) { console.warn('sw install: falhou', f, e); }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== VERSAO).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;
  // Chamadas ao backend (login, sync de dados) NÃO passam por cache — dependem
  // sempre do estado actual da sessão e do KV.
  if (url.pathname.startsWith('/dose-certa-api/')) return;

  evento.respondWith(
    caches.match(pedido).then((guardado) => {
      if (guardado) {
        // Actualiza em segundo plano bypassing HTTP cache (cache:'reload'),
        // senão o CDN pode reservir a versão antiga se as suas regras de
        // cache não respeitarem os headers de origem.
        fetch(pedido, { cache: 'reload' })
          .then((resposta) => {
            if (resposta.ok) caches.open(VERSAO).then((cache) => cache.put(pedido, resposta));
          })
          .catch(() => {});
        return guardado;
      }
      return fetch(pedido, { cache: 'reload' })
        .then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone();
            caches.open(VERSAO).then((cache) => cache.put(pedido, copia));
          }
          return resposta;
        })
        .catch(() => caches.match('./index.html'));
    }),
  );
});

/* Toque na notificação: traz a aplicação para a frente. */
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const alvo = evento.notification?.data?.url || './index.html';
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((j) => j.url.includes(self.location.origin));
      if (aberta) return aberta.focus();
      return self.clients.openWindow(alvo);
    }),
  );
});

/* Web Push: o servidor envia um payload JSON com {titulo, corpo, tag, url}. */
self.addEventListener('push', (evento) => {
  let payload = { titulo: 'Dose Certa', corpo: 'Hora da medicação.', tag: 'dose', url: './index.html' };
  if (evento.data) {
    try { payload = { ...payload, ...evento.data.json() }; }
    catch { payload.corpo = evento.data.text() || payload.corpo; }
  }
  evento.waitUntil(
    self.registration.showNotification(payload.titulo, {
      body: payload.corpo,
      tag: payload.tag,
      renotify: true,
      requireInteraction: true,
      icon: './assets/icone.svg',
      badge: './assets/icone.svg',
      lang: 'pt-PT',
      data: { url: payload.url },
    }),
  );
});

/* Se o navegador rodar a subscrição (raro), pedimos ao cliente para
   voltar a subscrever na próxima abertura. */
self.addEventListener('pushsubscriptionchange', (evento) => {
  evento.waitUntil(
    self.clients.matchAll().then((janelas) => {
      janelas.forEach((j) => j.postMessage({ tipo: 'pushsubscriptionchange' }));
    }),
  );
});
