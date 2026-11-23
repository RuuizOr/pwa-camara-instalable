// =====================================================================
// Inspección Visual PWA - app.js
// Autor: Orlando Ruiz Santos
// Reglas de la práctica: JavaScript Vanilla, SIN async/await.
// Toda la asincronía se maneja con .then() / .catch() / .finally()
// =====================================================================


// ---------------------------------------------------------------------
// 1) REFERENCIAS DEL DOM
// Guardamos en constantes los elementos del HTML que vamos a usar,
// así no tenemos que buscarlos con getElementById cada vez.
// ---------------------------------------------------------------------
const btnInstalar = document.getElementById('btn-instalar');                 // Botón "Instalar App" (oculto por defecto)
const btnPrepararCamara = document.getElementById('btn-preparar-camara');    // Paso 1 del pre-permiso
const btnConfirmarPermiso = document.getElementById('btn-confirmar-permiso');// Paso 2: aquí sí se pide permiso real
const btnCancelarPermiso = document.getElementById('btn-cancelar-permiso');  // "Ahora no": cierra el aviso sin pedir nada
const btnAlternarCamara = document.getElementById('btn-alternar-camara');    // Cambiar trasera <-> frontal
const btnApagarCamara = document.getElementById('btn-apagar-camara');        // Apagar la cámara
const avisoPermiso = document.getElementById('aviso-permiso');               // Tarjeta del aviso ético
const visorVideo = document.getElementById('visor-camara');                  // <video> donde se ve la cámara
const visorVacio = document.getElementById('visor-vacio');                   // Texto "Cámara apagada" sobre el visor
const mensajeEstado = document.getElementById('mensaje-estado');             // Línea de estado bajo el visor


// ---------------------------------------------------------------------
// 2) VARIABLES DE ESTADO
// Guardan "cómo está" la app en cada momento.
// ---------------------------------------------------------------------
let eventoInstalacionDiferido = null;  // Aquí guardamos el evento beforeinstallprompt para usarlo después
let streamActual = null;               // El MediaStream de la cámara encendida (null = cámara apagada)
let modoCamaraActual = 'environment';  // 'environment' = cámara trasera | 'user' = cámara frontal
let cambiandoCamara = false;           // Bandera para evitar dobles clics mientras se cambia de cámara


// ---------------------------------------------------------------------
// 3) FUNCIONES DE APOYO (UI)
// ---------------------------------------------------------------------

// Escribe un mensaje en la línea de estado (ej. "Cámara activa (Trasera)")
function actualizarMensajeEstado(texto){
  mensajeEstado.textContent = texto;
}

// Habilita o deshabilita botones según si la cámara está encendida o no
function actualizarControles(camaraEncendida){
  btnAlternarCamara.disabled = !camaraEncendida;  // Solo se puede cambiar si está encendida
  btnApagarCamara.disabled = !camaraEncendida;    // Solo se puede apagar si está encendida
  btnPrepararCamara.disabled = camaraEncendida;   // No pedir acceso otra vez si ya está encendida
  visorVacio.hidden = camaraEncendida;            // Oculta el texto "Cámara apagada" cuando hay video
}


// =====================================================================
// FASE 1: SERVICE WORKER E INSTALACIÓN
// =====================================================================

// ---------------------------------------------------------------------
// 4) REGISTRO DEL SERVICE WORKER
// Requisito obligatorio para que la PWA sea instalable.
// ---------------------------------------------------------------------
if ('serviceWorker' in navigator) {               // Verificamos que el navegador soporte Service Workers
  window.addEventListener('load', () => {         // Esperamos a que cargue la página para no frenar la carga inicial
    navigator.serviceWorker.register('./sw.js')   // register() devuelve una PROMESA
      .then((registro) => {
        // Si se registró bien, mostramos el scope (la carpeta que controla el SW)
        console.log('[App] Service Worker registrado. Scope:', registro.scope);
      })
      .catch((error) => {
        // Si falla (ej. no hay HTTPS o no existe sw.js), lo mostramos en consola
        console.error('[App] Error al registrar el Service Worker:', error);
      });
  });
}

// ---------------------------------------------------------------------
// 5) CAPTURAR EL EVENTO DE INSTALACIÓN (solo Chrome / Android / Edge)
// El navegador dispara 'beforeinstallprompt' cuando la app cumple:
// HTTPS + Service Worker activo + manifest.json válido.
// ---------------------------------------------------------------------
window.addEventListener('beforeinstallprompt', (event) => {
  // Evita que el navegador muestre su mini-banner automático antes de tiempo
  event.preventDefault();

  // Guardamos el evento para lanzarlo cuando el usuario pulse NUESTRO botón
  eventoInstalacionDiferido = event;

  // Ahora sí mostramos el botón "Instalar App"
  btnInstalar.hidden = false;
});

// ---------------------------------------------------------------------
// 6) CLICK EN "INSTALAR APP"
// ---------------------------------------------------------------------
btnInstalar.addEventListener('click', () => {
  if (!eventoInstalacionDiferido) return;   // Si no hay evento guardado, no hacemos nada

  eventoInstalacionDiferido.prompt();       // Abre el cuadro NATIVO de instalación del navegador

  // userChoice es una PROMESA que se resuelve cuando el usuario elige
  eventoInstalacionDiferido.userChoice
    .then((resultado) => {
      // resultado.outcome puede ser 'accepted' o 'dismissed'
      if (resultado.outcome === 'accepted') {
        console.log('[App] El usuario aceptó la instalación');
        btnInstalar.hidden = true;           // Ya está instalada: ocultamos el botón
      } else {
        console.log('[App] El usuario rechazó la instalación');
      }
    })
    .catch((error) => {
      console.error('[App] Error en la instalación:', error);
    })
    .finally(() => {
      // .finally() se ejecuta SIEMPRE (haya aceptado, rechazado o fallado).
      // El evento solo se puede usar UNA vez, por eso lo limpiamos.
      eventoInstalacionDiferido = null;
    });
});

// ---------------------------------------------------------------------
// 7) EVENTO 'appinstalled'
// Se dispara cuando la app quedó instalada (por nuestro botón o por el menú del navegador)
// ---------------------------------------------------------------------
window.addEventListener('appinstalled', () => {
  btnInstalar.hidden = true;
  eventoInstalacionDiferido = null;
  actualizarMensajeEstado('Aplicación instalada correctamente.');
});

// ---------------------------------------------------------------------
// 8) DETECCIÓN DE iOS
// En iPhone/iPad NO existe 'beforeinstallprompt': Apple no deja que JS
// abra el cuadro de instalación. Por eso mostramos instrucciones manuales.
// ---------------------------------------------------------------------
function verificarEntornoIOS(){
  // Expresión regular: ¿el userAgent contiene iPad, iPhone o iPod?
  // !window.MSStream descarta navegadores viejos de Windows que fingían ser iOS
  const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  // ¿Ya está abierta como app instalada?
  // - navigator.standalone: propiedad propia de Safari en iOS
  // - display-mode: standalone: media query estándar (la usa el manifest)
  const estaInstalada = window.navigator.standalone === true ||
                        window.matchMedia('(display-mode: standalone)').matches;

  // Solo si es iPhone Y todavía la ve desde el navegador, mostramos la guía
  if (esIOS && !estaInstalada) {
    const guiaIOS = document.getElementById('instrucciones-ios');
    if (guiaIOS) guiaIOS.hidden = false;
  }
}

// La ejecutamos en cuanto carga el script
verificarEntornoIOS();


// =====================================================================
// FASE 2: CÁMARA CON PRE-PERMISO
// =====================================================================

// ---------------------------------------------------------------------
// 9) LIBERAR EL HARDWARE DE LA CÁMARA
// En el celular NO se pueden tener las 2 cámaras abiertas a la vez:
// comparten el procesador de imagen (ISP) y el sistema da acceso exclusivo.
// Por eso SIEMPRE apagamos la cámara actual antes de abrir otra.
// ---------------------------------------------------------------------
function detenerCamaraActiva(){
  if (streamActual) {                          // Solo si hay una cámara encendida
    // Un stream tiene "pistas" (tracks). Aquí solo hay de video.
    streamActual.getTracks().forEach((track) => {
      track.stop();                            // stop() libera el sensor físico (se apaga la lucecita)
    });
    streamActual = null;                       // Marcamos que ya no hay cámara encendida
  }
}

// ---------------------------------------------------------------------
// 10) ENCENDER LA CÁMARA (función principal)
// Recibe el modo: 'environment' (trasera) o 'user' (frontal)
// Devuelve una PROMESA para poder encadenar .finally() desde afuera.
// ---------------------------------------------------------------------
function iniciarCamara(modo){
  // Paso 1: liberar la cámara anterior (evita NotReadableError)
  detenerCamaraActiva();

  // Paso 2: verificar que exista la API.
  // getUserMedia SOLO existe en contextos seguros (HTTPS o localhost)
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    actualizarMensajeEstado('Tu navegador no soporta acceso a cámara o no estás en HTTPS.');
    return Promise.resolve();                  // Devolvemos una promesa vacía para no romper el .finally()
  }

  // Paso 3: definir qué queremos pedir al hardware
  const restricciones = {
    video: { facingMode: modo },               // facingMode elige qué cámara: trasera o frontal
    audio: false                               // No pedimos micrófono
  };

  actualizarMensajeEstado('Encendiendo cámara...');

  // Paso 4: pedir la cámara. La PRIMERA vez aquí aparece el diálogo nativo de permiso.
  return navigator.mediaDevices.getUserMedia(restricciones)
    .then((stream) => {
      // ÉXITO: el usuario dio permiso y la cámara encendió
      streamActual = stream;                   // Guardamos el stream para poder apagarlo después
      visorVideo.srcObject = stream;           // Conectamos el stream al <video> para verlo en pantalla

      // La cámara frontal se ve en espejo (como en las apps de selfie)
      visorVideo.classList.toggle('espejo', modo === 'user');

      actualizarControles(true);               // Habilitamos "Cambiar" y "Apagar"

      // Operador ternario: si es 'environment' dice Trasera, si no, Frontal
      actualizarMensajeEstado(`Cámara activa (${modo === 'environment' ? 'Trasera' : 'Frontal'})`);
    })
    .catch((error) => {
      // ERROR: limpiamos el visor y los botones
      visorVideo.srcObject = null;
      actualizarControles(false);

      // Diagnóstico según el tipo de error (error.name)
      if (error.name === 'NotAllowedError') {
        // El usuario pulsó "Bloquear" (o ya estaba bloqueado). JS ya no puede volver a preguntar.
        actualizarMensajeEstado('Permiso denegado. Habilita el acceso a la cámara en los ajustes de tu navegador.');
      } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
        // El dispositivo no tiene esa cámara (ej. una laptop sin cámara trasera)
        actualizarMensajeEstado('No se detectó el sensor de cámara solicitado en este dispositivo.');
      } else if (error.name === 'NotReadableError') {
        // La cámara sigue ocupada (otra app la usa o no se liberó a tiempo). Común en iPhone.
        actualizarMensajeEstado('La cámara está ocupada por otra aplicación o no se liberó a tiempo. Intenta de nuevo.');
      } else {
        // Cualquier otro error
        actualizarMensajeEstado(`Error al acceder al hardware: ${error.message}`);
      }
    });
}

// ---------------------------------------------------------------------
// 11) FLUJO DE PRE-PERMISO (UX ÉTICA) EN 2 PASOS
// Si el diálogo nativo sale de sorpresa y el usuario pulsa "Bloquear",
// el navegador guarda esa decisión y JS ya NO puede volver a pedir permiso.
// Por eso primero explicamos y después pedimos.
// ---------------------------------------------------------------------

// PASO 1: "Solicitar Acceso a Cámara" -> SOLO muestra el aviso. NO pide permiso todavía.
btnPrepararCamara.addEventListener('click', () => {
  avisoPermiso.hidden = false;                                      // Mostramos la tarjeta explicativa
  avisoPermiso.scrollIntoView({ behavior: 'smooth', block: 'center' }); // Hacemos scroll hasta ella
});

// PASO 2: "Aceptar y Encender Cámara" -> el usuario ya leyó el motivo. AHORA sí pedimos permiso.
btnConfirmarPermiso.addEventListener('click', () => {
  avisoPermiso.hidden = true;                  // Ocultamos el aviso
  iniciarCamara(modoCamaraActual);             // Aquí aparece el diálogo nativo del navegador
});

// "Ahora no" -> cerramos el aviso sin llamar al hardware (el permiso sigue sin decidirse)
btnCancelarPermiso.addEventListener('click', () => {
  avisoPermiso.hidden = true;
  actualizarMensajeEstado('No se solicitó el permiso. Puedes intentarlo cuando quieras.');
});

// ---------------------------------------------------------------------
// 12) CAMBIAR ENTRE CÁMARA TRASERA Y FRONTAL
// ---------------------------------------------------------------------
btnAlternarCamara.addEventListener('click', () => {
  if (cambiandoCamara) return;                 // Si ya se está cambiando, ignoramos el clic
  cambiandoCamara = true;                      // Levantamos la bandera
  btnAlternarCamara.disabled = true;           // Bloqueamos el botón mientras cambia

  // Invertimos el modo con un ternario: trasera -> frontal | frontal -> trasera
  modoCamaraActual = modoCamaraActual === 'environment' ? 'user' : 'environment';

  // iniciarCamara() ya apaga la anterior antes de abrir la nueva
  iniciarCamara(modoCamaraActual)
    .finally(() => {
      // Se ejecuta salga bien o mal: liberamos la bandera
      cambiandoCamara = false;
      // Solo reactivamos el botón si la cámara quedó encendida
      if (streamActual) btnAlternarCamara.disabled = false;
    });
});

// ---------------------------------------------------------------------
// 13) APAGAR LA CÁMARA
// ---------------------------------------------------------------------
btnApagarCamara.addEventListener('click', () => {
  detenerCamaraActiva();                       // Detiene los tracks (libera el sensor)
  visorVideo.srcObject = null;                 // Limpia el <video>
  actualizarControles(false);                  // Deshabilita "Cambiar" y "Apagar"
  actualizarMensajeEstado('Cámara apagada.');
});

// ---------------------------------------------------------------------
// 14) LIBERAR LA CÁMARA AL SALIR
// 'pagehide' se dispara al cerrar la pestaña o salir de la app.
// Así la cámara no se queda encendida en segundo plano.
// ---------------------------------------------------------------------
window.addEventListener('pagehide', () => {
  detenerCamaraActiva();
});
