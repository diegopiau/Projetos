/* ==========================================================================
   sw.js — service worker: guarda a app para funcionar sem internet
   Estratégia: cache primeiro para os ficheiros da app (são estáticos e poucos).
   Ao publicar uma versão nova, mude VERSAO.
   ========================================================================== */

const VERSAO = 'a-horas-v1';
const FICHEIROS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
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
  evento.waitUntil(
    caches.open(VERSAO)
      .then((cache) => cache.addAll(FICHEIROS))
      .then(() => self.skipWaiting()),
  );
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
  if (new URL(pedido.url).origin !== self.location.origin) return;

  evento.respondWith(
    caches.match(pedido).then((guardado) => {
      if (guardado) {
        // Actualiza em segundo plano, sem atrasar a resposta.
        fetch(pedido)
          .then((resposta) => {
            if (resposta.ok) caches.open(VERSAO).then((cache) => cache.put(pedido, resposta));
          })
          .catch(() => {});
        return guardado;
      }
      return fetch(pedido)
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
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((j) => j.url.includes(self.location.origin));
      if (aberta) return aberta.focus();
      return self.clients.openWindow('./index.html');
    }),
  );
});
