// =====================================================================
// Service Worker - Estrategia CACHE FIRST
// Autor: Orlando Ruiz Santos
//
// El Service Worker es un script que corre en SEGUNDO PLANO, separado
// de la página. Funciona como un "proxy" entre la app y la red:
// intercepta cada petición y decide si responde desde caché o desde internet.
// Es uno de los 3 requisitos para que la PWA sea instalable.
//
// Nota: dentro del SW no existe "window" ni el DOM; se usa "self".
// =====================================================================


// ---------------------------------------------------------------------
// 1) NOMBRE / VERSIÓN DEL CACHÉ
// Cada vez que cambias un archivo de la app, debes subir la versión
// (v4 -> v5...). Así el navegador detecta un SW nuevo, descarga los
// archivos actualizados y borra el caché viejo.
// ---------------------------------------------------------------------
const NOMBRE_CACHE = 'inspeccion-pwa-v4';


// ---------------------------------------------------------------------
// 2) ARCHIVOS A PRE-CACHEAR
// Son los archivos mínimos para que la app abra aunque no haya internet.
// Rutas relativas (./) porque GitHub Pages sirve en /pwa-camara-instalable/
// ---------------------------------------------------------------------
const ARCHIVOS_PRECACHE = [
  './',                       // La raíz (cuando se abre la URL sin index.html)
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];


// ---------------------------------------------------------------------
// 3) EVENTO INSTALL
// Se ejecuta UNA vez cuando el navegador instala este SW (o una versión nueva).
// Aquí guardamos los archivos base en el caché.
// ---------------------------------------------------------------------
self.addEventListener('install', (event) => {
  // waitUntil: le dice al navegador "no termines la instalación
  // hasta que esta promesa se resuelva"
  event.waitUntil(
    caches.open(NOMBRE_CACHE)                            // Abre (o crea) el caché con ese nombre
      .then((cache) => cache.addAll(ARCHIVOS_PRECACHE))  // Descarga y guarda todos los archivos
      .then(() => self.skipWaiting())                    // Activa el SW nuevo sin esperar a cerrar pestañas
      .catch((error) => console.error('[SW] Error al precachear:', error))
  );
});


// ---------------------------------------------------------------------
// 4) EVENTO ACTIVATE
// Se ejecuta cuando el SW toma el mando. Momento ideal para limpiar
// los cachés de versiones anteriores (v1, v2, v3...).
// ---------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()                                        // Obtiene los nombres de TODOS los cachés guardados
      .then((nombres) => Promise.all(                    // Promise.all espera a que se borren todos
        nombres
          .filter((nombre) => nombre !== NOMBRE_CACHE)   // Nos quedamos solo con los que NO son la versión actual
          .map((nombre) => caches.delete(nombre))        // Y los borramos
      ))
      .then(() => self.clients.claim())                  // Toma el control de las pestañas abiertas de inmediato
  );
});


// ---------------------------------------------------------------------
// 5) EVENTO FETCH - CACHE FIRST
// Se ejecuta en CADA petición que hace la página (html, css, js, imágenes...).
// Cache First = primero busca en caché; si no está, va a la red.
// Ventaja: carga rapidísimo y funciona offline.
// ---------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  // Solo manejamos peticiones GET (las POST/PUT no se deben cachear)
  if (event.request.method !== 'GET') return;

  // respondWith: "yo (el SW) voy a dar la respuesta a esta petición"
  event.respondWith(
    caches.match(event.request)                          // 1. ¿Está en el caché?
      .then((respuestaCache) => {
        if (respuestaCache) return respuestaCache;       // 2. SÍ -> la devolvemos sin usar internet

        // 3. NO -> la pedimos a la red
        return fetch(event.request)
          .then((respuestaRed) => {
            // Guardamos una copia solo si la respuesta es válida:
            // status 200 = OK | type 'basic' = viene de nuestro mismo dominio
            if (respuestaRed && respuestaRed.status === 200 && respuestaRed.type === 'basic') {
              // clone(): una respuesta solo se puede leer UNA vez,
              // así que hacemos una copia para el caché y la original va a la página
              const copia = respuestaRed.clone();
              caches.open(NOMBRE_CACHE).then((cache) => cache.put(event.request, copia));
            }
            return respuestaRed;                         // Entregamos la respuesta a la página
          });
      })
      // 4. Si no hay caché NI internet -> mostramos index.html como respaldo offline
      .catch(() => caches.match('./index.html'))
  );
});
