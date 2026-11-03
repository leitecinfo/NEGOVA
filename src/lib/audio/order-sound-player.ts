/**
 * Gestor de alertas sonoras para pedidos en NEGOVA (Nuevos pedidos y Pedidos listos).
 * 
 * Arquitectura de Doble Motor Acústico:
 * 1. Web Audio API (Sintetizador acústico de hardware puro):
 *    - Cero latencia, cero dependencias de red o archivos mp3 externos.
 *    - Inmune a bloqueos de CORS, fallos de red o problemas de buffering móvil.
 *    - Mantiene el AudioContext activo en segundo plano tras el primer toque/clic.
 * 2. Elemento HTMLAudioElement (/sonidos/notificacion.mp3):
 *    - Se ejecuta en paralelo para reproducir el archivo de sonido grabado si el navegador lo permite.
 * 
 * Cumple con las políticas de autoplay de navegadores móviles (iOS Safari, Android Chrome)
 * y garantiza que todos los paneles abiertos en cualquier dispositivo escuchen la alerta.
 */

const AUDIO_PATH = "/sonidos/notificacion.mp3";
const playedNewOrderIds = new Set<string>();
const playedReadyOrderIds = new Set<string>();

let sharedAudioContext: AudioContext | null = null;
let audioElement: HTMLAudioElement | null = null;
let isAudioUnlocked = false;
let unlockListenersRegistered = false;

/**
 * Obtiene o inicializa el AudioContext compartido (Web Audio API)
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!sharedAudioContext) {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtxClass) {
      try {
        sharedAudioContext = new AudioCtxClass();
      } catch {
        // Fallback si el contexto no puede ser creado
      }
    }
  }

  if (sharedAudioContext && sharedAudioContext.state === "suspended") {
    sharedAudioContext.resume().catch(() => {});
  }

  return sharedAudioContext;
}

/**
 * Obtiene o inicializa el elemento HTMLAudioElement para el archivo mp3
 */
function getAudioElement(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audioElement) {
    try {
      audioElement = new Audio(AUDIO_PATH);
      audioElement.preload = "auto";
    } catch {
      // Ignorar si el navegador bloquea la creación
    }
  }
  return audioElement;
}

/**
 * Sintetiza un timbre armónico mediante Web Audio API
 */
function synthesizeChime(
  frequencies: number[],
  noteDuration: number = 0.12,
  noteDecay: number = 0.5,
  peakGain: number = 0.3
): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const startTime = ctx.currentTime;

    frequencies.forEach((freq, idx) => {
      const noteStart = startTime + idx * noteDuration;
      const oscFundamental = ctx.createOscillator();
      const oscHarmonic = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscFundamental.type = "sine";
      oscFundamental.frequency.setValueAtTime(freq, noteStart);

      // Segundo armónico para un timbre cálido de campana
      oscHarmonic.type = "sine";
      oscHarmonic.frequency.setValueAtTime(freq * 2, noteStart);

      // Envolvente de volumen tipo campana
      gainNode.gain.setValueAtTime(0.0001, noteStart);
      gainNode.gain.exponentialRampToValueAtTime(peakGain, noteStart + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, noteStart + noteDecay);

      oscFundamental.connect(gainNode);
      oscHarmonic.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscFundamental.start(noteStart);
      oscHarmonic.start(noteStart);
      oscFundamental.stop(noteStart + noteDecay + 0.05);
      oscHarmonic.stop(noteStart + noteDecay + 0.05);
    });
  } catch (err) {
    console.warn("[OrderSoundPlayer] Error en síntesis de sonido:", err);
  }
}

/**
 * Tono para NUEVO PEDIDO:
 * Campana de 3 notas ascendentes (Do5 - Mi5 - Sol5) enérgica y clara.
 */
function playSynthesizedNewOrderChime(): void {
  // C5: 523.25Hz, E5: 659.25Hz, G5: 783.99Hz
  synthesizeChime([523.25, 659.25, 783.99], 0.12, 0.6, 0.35);
}

/**
 * Tono para PEDIDO LISTO PARA ENTREGAR:
 * Doble campana de servicio (Sol5 - Do6) brillante y distintiva.
 */
function playSynthesizedReadyChime(): void {
  // G5: 783.99Hz, C6: 1046.5Hz
  synthesizeChime([783.99, 1046.5], 0.15, 0.85, 0.4);
}

/**
 * Intenta desbloquear el audio en el navegador tras una interacción del usuario.
 */
export async function unlockAudioContextManually(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      await ctx.resume();
    }

    // Priming de AudioContext con buffer silencioso
    if (ctx) {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    }

    // Priming de elemento audio
    const audio = getAudioElement();
    if (audio) {
      audio.muted = true;
      const p = audio.play();
      if (p !== undefined) {
        await p.catch(() => {});
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      }
    }

    isAudioUnlocked = true;
    try {
      sessionStorage.setItem("negova_audio_unlocked", "1");
    } catch {}

    window.dispatchEvent(new CustomEvent("negova:audio_unlocked"));
    cleanupUnlockListeners();
    return true;
  } catch {
    return false;
  }
}

function handleUserInteractionUnlock() {
  if (isAudioUnlocked) return;
  unlockAudioContextManually().catch(() => {});
}

function cleanupUnlockListeners() {
  if (typeof window === "undefined") return;
  const events = ["click", "touchstart", "touchend", "keydown", "pointerdown"];
  events.forEach((evt) => {
    window.removeEventListener(evt, handleUserInteractionUnlock, true);
    document.removeEventListener(evt, handleUserInteractionUnlock, true);
  });
  unlockListenersRegistered = false;
}

/**
 * Inicializa el observador de interacción del usuario para desbloquear audio.
 */
export function initOrderAudioUnlock(): void {
  if (typeof window === "undefined") return;

  try {
    if (sessionStorage.getItem("negova_audio_unlocked") === "1") {
      isAudioUnlocked = true;
    }
  } catch {}

  const ctx = getAudioContext();
  if (ctx && ctx.state === "running") {
    isAudioUnlocked = true;
  }

  if (isAudioUnlocked || unlockListenersRegistered) return;

  const events = ["click", "touchstart", "touchend", "keydown", "pointerdown"];
  events.forEach((evt) => {
    window.addEventListener(evt, handleUserInteractionUnlock, { capture: true, passive: true });
    document.addEventListener(evt, handleUserInteractionUnlock, { capture: true, passive: true });
  });
  unlockListenersRegistered = true;
}

/**
 * Consulta si el audio ya está desbloqueado en el navegador.
 */
export function isAudioUnlockedState(): boolean {
  if (typeof window === "undefined") return false;
  if (isAudioUnlocked) return true;
  if (sharedAudioContext && sharedAudioContext.state === "running") {
    isAudioUnlocked = true;
    return true;
  }
  return false;
}

/**
 * Reproduce la alerta sonora de NUEVO PEDIDO garantizando idempotencia.
 */
export async function playOrderSoundAlert(orderId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // 1. Idempotencia: evitar reproducir dos veces para el mismo pedido
  if (!orderId || playedNewOrderIds.has(orderId)) {
    return false;
  }
  playedNewOrderIds.add(orderId);

  // 2. Ejecutar sonido mediante Web Audio API sintetizado (independiente de red)
  playSynthesizedNewOrderChime();

  // 3. Ejecutar archivo de audio MP3 si está disponible y desbloqueado
  const audio = getAudioElement();
  if (audio) {
    try {
      audio.currentTime = 0;
      audio.muted = false;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise;
        isAudioUnlocked = true;
      }
    } catch (err: any) {
      // Si el navegador bloquea la reproducción del archivo, el sintetizador ya sonó
      if (err?.name !== "NotAllowedError" && err?.name !== "AbortError") {
        console.warn("[OrderSoundPlayer] Fallback de archivo mp3:", err);
      }
    }
  }

  return true;
}

/**
 * Reproduce la alerta sonora de PEDIDO LISTO PARA ENTREGAR garantizando idempotencia.
 */
export async function playOrderReadySoundAlert(orderId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // 1. Idempotencia: evitar reproducir dos veces para el mismo pedido
  const readyKey = `ready:${orderId}`;
  if (!orderId || playedReadyOrderIds.has(readyKey)) {
    return false;
  }
  playedReadyOrderIds.add(readyKey);

  // 2. Ejecutar timbre de pedido listo con Web Audio API
  playSynthesizedReadyChime();

  return true;
}

/**
 * Comprueba si un pedido ya emitió alerta sonora en esta sesión.
 */
export function hasPlayedOrderSound(orderId: string): boolean {
  return playedNewOrderIds.has(orderId);
}

/**
 * Marca un ID de pedido como ya reproducido (útil para pedidos del historial inicial).
 */
export function markOrderSoundAsHandled(orderId: string): void {
  if (orderId) {
    playedNewOrderIds.add(orderId);
  }
}
