// ===============================
// Inspección Visual PWA - app.js
// JavaScript Vanilla, solo .then() / .catch() / .finally()
// ===============================

// ---------- Referencias del DOM ----------
const btnInstalar = document.getElementById('btn-instalar');
const btnPrepararCamara = document.getElementById('btn-preparar-camara');
const btnConfirmarPermiso = document.getElementById('btn-confirmar-permiso');
const btnCancelarPermiso = document.getElementById('btn-cancelar-permiso');
const btnAlternarCamara = document.getElementById('btn-alternar-camara');
const btnApagarCamara = document.getElementById('btn-apagar-camara');
const avisoPermiso = document.getElementById('aviso-permiso');
const visorVideo = document.getElementById('visor-camara');
const visorVacio = document.getElementById('visor-vacio');
const mensajeEstado = document.getElementById('mensaje-estado');

// ---------- Estado ----------
let eventoInstalacionDiferido = null;
let streamActual = null;
let modoCamaraActual = 'environment'; // 'environment' = trasera | 'user' = frontal
let cambiandoCamara = false;

// ---------- Utilidades ----------
function actualizarMensajeEstado(texto){
  mensajeEstado.textContent = texto;
}

function actualizarControles(camaraEncendida){
  btnAlternarCamara.disabled = !camaraEncendida;
  btnApagarCamara.disabled = !camaraEncendida;
  btnPrepararCamara.disabled = camaraEncendida;
  visorVacio.hidden = camaraEncendida;
}

// =====================================================
// FASE 1: Service Worker e instalación
// =====================================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registro) => {
        console.log('[App] Service Worker registrado. Scope:', registro.scope);
      })
      .catch((error) => {
        console.error('[App] Error al registrar el Service Worker:', error);
      });
  });
}

window.addEventListener('beforeinstallprompt', (event) => {
  // Evita que el mini-banner automático aparezca antes de tiempo
  event.preventDefault();
  eventoInstalacionDiferido = event;

  // Muestra el botón personalizado de instalación
  btnInstalar.hidden = false;
});

btnInstalar.addEventListener('click', () => {
  if (!eventoInstalacionDiferido) return;

  eventoInstalacionDiferido.prompt();

  eventoInstalacionDiferido.userChoice
    .then((resultado) => {
      if (resultado.outcome === 'accepted') {
        console.log('[App] El usuario aceptó la instalación');
        btnInstalar.hidden = true;
      } else {
        console.log('[App] El usuario rechazó la instalación');
      }
    })
    .catch((error) => {
      console.error('[App] Error en la instalación:', error);
    })
    .finally(() => {
      // El evento solo puede usarse una vez
      eventoInstalacionDiferido = null;
    });
});

window.addEventListener('appinstalled', () => {
  btnInstalar.hidden = true;
  eventoInstalacionDiferido = null;
  actualizarMensajeEstado('Aplicación instalada correctamente.');
});

// ---------- Detección de iOS (no existe beforeinstallprompt) ----------
function verificarEntornoIOS(){
  const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const estaInstalada = window.navigator.standalone === true ||
                        window.matchMedia('(display-mode: standalone)').matches;

  // Si está en iPhone y aún la ve desde el navegador, mostrar instrucciones manuales
  if (esIOS && !estaInstalada) {
    const guiaIOS = document.getElementById('instrucciones-ios');
    if (guiaIOS) guiaIOS.hidden = false;
  }
}

verificarEntornoIOS();

// =====================================================
// FASE 2: Cámara con pre-permiso
// =====================================================

function detenerCamaraActiva(){
  if (streamActual) {
    streamActual.getTracks().forEach((track) => {
      track.stop();
    });
    streamActual = null;
  }
}

function iniciarCamara(modo){
  detenerCamaraActiva();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    actualizarMensajeEstado('Tu navegador no soporta acceso a cámara o no estás en HTTPS.');
    return Promise.resolve();
  }

  const restricciones = {
    video: { facingMode: modo },
    audio: false
  };

  actualizarMensajeEstado('Encendiendo cámara...');

  return navigator.mediaDevices.getUserMedia(restricciones)
    .then((stream) => {
      streamActual = stream;
      visorVideo.srcObject = stream;
      // La cámara frontal se muestra en espejo (más natural para el usuario)
      visorVideo.classList.toggle('espejo', modo === 'user');
      actualizarControles(true);
      actualizarMensajeEstado(`Cámara activa (${modo === 'environment' ? 'Trasera' : 'Frontal'})`);
    })
    .catch((error) => {
      visorVideo.srcObject = null;
      actualizarControles(false);

      if (error.name === 'NotAllowedError') {
        actualizarMensajeEstado('Permiso denegado. Habilita el acceso a la cámara en los ajustes de tu navegador.');
      } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
        actualizarMensajeEstado('No se detectó el sensor de cámara solicitado en este dispositivo.');
      } else if (error.name === 'NotReadableError') {
        actualizarMensajeEstado('La cámara está ocupada por otra aplicación o no se liberó a tiempo. Intenta de nuevo.');
      } else {
        actualizarMensajeEstado(`Error al acceder al hardware: ${error.message}`);
      }
    });
}

// Paso 1: El usuario pulsa "Solicitar Acceso a Cámara" -> Mostramos aviso explicativo
btnPrepararCamara.addEventListener('click', () => {
  avisoPermiso.hidden = false;
  avisoPermiso.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// Paso 2: El usuario lee el motivo y pulsa "Aceptar y Encender Cámara"
btnConfirmarPermiso.addEventListener('click', () => {
  avisoPermiso.hidden = true;
  iniciarCamara(modoCamaraActual);
});

// Cancelar el aviso sin pedir permiso al navegador
btnCancelarPermiso.addEventListener('click', () => {
  avisoPermiso.hidden = true;
  actualizarMensajeEstado('No se solicitó el permiso. Puedes intentarlo cuando quieras.');
});

// Alternar entre cámara trasera y frontal
btnAlternarCamara.addEventListener('click', () => {
  if (cambiandoCamara) return;
  cambiandoCamara = true;
  btnAlternarCamara.disabled = true;

  modoCamaraActual = modoCamaraActual === 'environment' ? 'user' : 'environment';

  iniciarCamara(modoCamaraActual)
    .finally(() => {
      cambiandoCamara = false;
      if (streamActual) btnAlternarCamara.disabled = false;
    });
});

// Apagar la cámara
btnApagarCamara.addEventListener('click', () => {
  detenerCamaraActiva();
  visorVideo.srcObject = null;
  actualizarControles(false);
  actualizarMensajeEstado('Cámara apagada.');
});

// Liberar el hardware si el usuario cierra o abandona la página
window.addEventListener('pagehide', () => {
  detenerCamaraActiva();
});
