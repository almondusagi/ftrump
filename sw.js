
const CACHE_NAME = 'ftrump-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './BGM/bensound-summer.mp3',
  './picture/bg.png',
  './picture/card.png',
  './picture/icon-192x192.png',
  './picture/icon-512x512.png',
  './SE/card.mp3',
  './SE/cheers.mp3',
  './SE/war.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
