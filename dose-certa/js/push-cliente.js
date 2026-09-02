/* ==========================================================================
   push-cliente.js — lado do browser: subscrição, cancelamento, cálculo do
   plano das próximas 48h para o servidor calendarizar as pushes.
   Depende de auth.js para as chamadas ao backend.
   ========================================================================== */

import * as auth from './auth.js';
import { estado, hojeISO, somarDias, paraISO, aoMudar } from './dados.js';
import { blocosDoDia } from './horarios.js';

let debounceCalendario = null;
let unsubMudanca = null;

/**
 * Após subscrever, chame para que qualquer mudança nos medicamentos
 * (adicionar/editar/remover) re-envie o calendário ao servidor em 2s.
 */
export function activarSincroniaAutomatica() {
  if (unsubMudanca) return; // já activa
  unsubMudanca = aoMudar(() => {
    clearTimeout(debounceCalendario);
    debounceCalendario = setTimeout(sincronizarCalendario, 2000);
  });
}
export function desactivarSincroniaAutomatica() {
  if (unsubMudanca) unsubMudanca();
  unsubMudanca = null;
  clearTimeout(debounceCalendario);
  debounceCalendario = null;
}

function b64urlParaUint8(b64) {
  const t = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4);
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Devolve o estado actual da subscrição neste device.
 * Estados possíveis:
 *   'ios-precisa-pwa'  → iOS sem estar em modo PWA (Safari não deixa push no browser)
 *   'nao-suportado'    → outro browser sem suporte
 *   'sem-sw'           → SW ainda não registado (recarregar)
 *   'sem-permissao'    → bloqueado nas definições
 *   'nao-subscrito'    → pode activar
 *   'subscrito'        → activo
 */
export async function estadoPush() {
  const plat = detectarPlataforma();
  // iOS Safari só permite Push API quando a app está instalada como PWA
  // (standalone). Fora disso, "PushManager" simplesmente não existe no window.
  if (plat.iOS && !plat.instalada) return 'ios-precisa-pwa';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'nao-suportado';
  const registo = await navigator.serviceWorker.getRegistration();
  if (!registo) return 'sem-sw';
  if (Notification.permission === 'denied') return 'sem-permissao';
  const sub = await registo.pushManager.getSubscription();
  return sub ? 'subscrito' : 'nao-subscrito';
}

/** Detecta plataforma e se a app está a correr como PWA (standalone). */
export function detectarPlataforma() {
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const android = /Android/.test(ua);
  const instalada = window.matchMedia?.('(display-mode: standalone)').matches
                 || window.navigator.standalone === true;
  const tipo = iOS ? 'ios' : (android ? 'android' : 'desktop');
  return { iOS, android, instalada, tipo };
}

/**
 * Subscreve este device. Se a permissão ainda for 'default', pede-a.
 * Devolve { estado: 'subscrito' } ou { estado: 'erro', motivo }.
 * IMPORTANTE: só chamar em resposta a um click do utilizador (user gesture).
 */
export async function subscrever() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { estado: 'erro', motivo: 'Este navegador não suporta push notifications.' };
    }
    const registo = await navigator.serviceWorker.getRegistration();
    if (!registo) return { estado: 'erro', motivo: 'Service worker ainda não registado — recarregue a página.' };

    if (Notification.permission === 'denied') {
      return { estado: 'erro', motivo: 'As notificações estão bloqueadas. Abra as definições do site e permita.' };
    }
    if (Notification.permission === 'default') {
      const resp = await Notification.requestPermission();
      if (resp !== 'granted') return { estado: 'erro', motivo: 'Autorização não concedida.' };
    }

    const chave = await auth.pushConfig();
    let sub = await registo.pushManager.getSubscription();
    if (!sub) {
      sub = await registo.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64urlParaUint8(chave),
      });
    }
    await auth.subscreverPushNoServidor(sub.toJSON());
    // Envia já o plano das próximas 48h — assim o cron começa a disparar.
    await sincronizarCalendario();
    return { estado: 'subscrito' };
  } catch (e) {
    console.error('subscrever push falhou', e);
    return { estado: 'erro', motivo: e?.message || 'Erro desconhecido' };
  }
}

/** Cancela a subscrição neste device (browser + servidor). */
export async function cancelar() {
  try {
    const registo = await navigator.serviceWorker.getRegistration();
    if (!registo) return { estado: 'nao-subscrito' };
    const sub = await registo.pushManager.getSubscription();
    if (!sub) return { estado: 'nao-subscrito' };
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    try { await auth.unsubscreverPushNoServidor(endpoint); } catch { /* ok, servidor limpa via 410 */ }
    return { estado: 'cancelado' };
  } catch (e) {
    return { estado: 'erro', motivo: e?.message || String(e) };
  }
}

/**
 * Dispara um push imediato via servidor (bypass do cron) — utilizado no
 * botão de teste. Só resulta se já houver subscrição.
 */
export async function pushTeste() {
  try { return await auth.pushTeste(); }
  catch (e) { return { erro: e?.message || String(e) }; }
}

/**
 * Calcula as próximas tomas (48h a contar de agora) e envia ao servidor.
 * O servidor faz cron por minuto e dispara push para cada toma na janela.
 */
export async function sincronizarCalendario() {
  if (!auth.emailAutenticado()) return { estado: 'sem-sessao' };
  const tomas = calcularProximasTomas(48);
  try {
    await auth.subirCalendario(tomas);
    return { estado: 'ok', enviadas: tomas.length };
  } catch (e) {
    return { estado: 'erro', motivo: e?.message || String(e) };
  }
}

function calcularProximasTomas(horasAdiante = 48) {
  const agora = new Date();
  const limite = agora.getTime() + horasAdiante * 3600 * 1000;
  const tomas = [];
  // Percorre dia a dia
  for (let d = 0; d < Math.ceil(horasAdiante / 24) + 1; d++) {
    const data = somarDias(agora, d);
    const iso = paraISO(data);
    const blocos = blocosDoDia(iso);
    for (const bloco of blocos) {
      const [hh, mm] = bloco.hora.split(':').map(Number);
      const ts = new Date(data);
      ts.setHours(hh, mm, 0, 0);
      const t = ts.getTime();
      if (t < agora.getTime() + 60 * 1000) continue; // já passou (ou menos de 1 min)
      if (t > limite) continue;
      const nomes = (bloco.pendentes || bloco.tomas || [])
        .map((toma) => `${toma.med?.nome || toma.nome || 'medicamento'}${toma.med?.dosagem ? ' ' + toma.med.dosagem : ''}`)
        .join(', ');
      const quantos = (bloco.pendentes || bloco.tomas || []).length;
      tomas.push({
        ts: t,
        titulo: `${bloco.hora} — ${bloco.titulo || 'Hora da medicação'}`,
        corpo: `${quantos} ${quantos === 1 ? 'medicamento' : 'medicamentos'}${nomes ? ': ' + nomes : ''}`,
        tag: `${iso}#${bloco.hora}`,
      });
    }
  }
  return tomas;
}
