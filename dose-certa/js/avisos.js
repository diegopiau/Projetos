/* ==========================================================================
   avisos.js — lembretes: notificação do sistema, voz, som e alarme no ecrã
   --------------------------------------------------------------------------
   Limitação honesta: sem servidor, um site só consegue avisar enquanto está
   aberto (mesmo que em segundo plano). Para alarmes garantidos com a app
   fechada, exportamos as tomas para o calendário do telemóvel (ver .ics).
   ========================================================================== */

import { estado, paraISO } from './dados.js';
import { blocosDoDia } from './horarios.js';

let temporizador = null;
let ultimoAvisado = null;      // 'AAAA-MM-DD#HH:MM' do último bloco anunciado
const jaAvisados = new Set();
let aoTocar = () => {};

export function definirCallbackAlarme(fn) { aoTocar = fn; }

/* -------------------------------------------------------------------------
   Permissão
   ------------------------------------------------------------------------- */

export function estadoPermissao() {
  if (!('Notification' in window)) return 'indisponivel';
  return Notification.permission;    // 'default' | 'granted' | 'denied'
}

export async function pedirPermissao() {
  if (!('Notification' in window)) return 'indisponivel';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/* -------------------------------------------------------------------------
   Canais de aviso
   ------------------------------------------------------------------------- */

async function mostrarNotificacao(titulo, corpo, etiqueta) {
  if (estadoPermissao() !== 'granted') return;
  const opcoes = {
    body: corpo,
    tag: etiqueta,
    renotify: true,
    requireInteraction: true,
    icon: 'assets/icone.svg',
    badge: 'assets/icone.svg',
    lang: 'pt-PT',
  };
  try {
    const registo = await navigator.serviceWorker?.getRegistration();
    if (registo) { await registo.showNotification(titulo, opcoes); return; }
  } catch { /* segue para o caminho simples */ }
  try { new Notification(titulo, opcoes); } catch { /* ignorado */ }
}

let contexto = null;

export function tocarSom() {
  if (!estado.config.som) return;
  try {
    contexto = contexto || new (window.AudioContext || window.webkitAudioContext)();
    if (contexto.state === 'suspended') contexto.resume();
    const agora = contexto.currentTime;
    [0, 0.42, 0.84].forEach((atraso) => {
      const osc = contexto.createOscillator();
      const ganho = contexto.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(784, agora + atraso);
      osc.frequency.setValueAtTime(1046, agora + atraso + 0.16);
      ganho.gain.setValueAtTime(0.0001, agora + atraso);
      ganho.gain.exponentialRampToValueAtTime(0.28, agora + atraso + 0.03);
      ganho.gain.exponentialRampToValueAtTime(0.0001, agora + atraso + 0.34);
      osc.connect(ganho); ganho.connect(contexto.destination);
      osc.start(agora + atraso); osc.stop(agora + atraso + 0.36);
    });
  } catch { /* som é acessório */ }
}

export function falar(texto) {
  if (!estado.config.voz || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = 'pt-PT';
    fala.rate = 0.92;
    fala.pitch = 1;
    const voz = speechSynthesis.getVoices().find((v) => v.lang === 'pt-PT')
             || speechSynthesis.getVoices().find((v) => v.lang?.startsWith('pt'));
    if (voz) fala.voice = voz;
    speechSynthesis.speak(fala);
  } catch { /* voz é acessória */ }
}

// Os navegadores recusam vibrar antes de a pessoa tocar no ecrã, e queixam-se
// na consola. Só tentamos depois da primeira interação.
let houveInteracao = false;
['pointerdown', 'keydown'].forEach((evento) => {
  window.addEventListener(evento, () => { houveInteracao = true; }, { once: true, passive: true });
});

export function vibrar() {
  if (!houveInteracao) return;
  try { navigator.vibrate?.([300, 150, 300, 150, 500]); } catch { /* ignorado */ }
}

/* -------------------------------------------------------------------------
   Vigia — corre de minuto a minuto enquanto a app está aberta
   ------------------------------------------------------------------------- */

function resumoDoBloco(bloco) {
  return bloco.pendentes
    .map((t) => `${t.med.nome}${t.med.dosagem ? ' ' + t.med.dosagem : ''}`)
    .join(', ');
}

function verificar() {
  const hoje = paraISO(new Date());
  const agora = new Date();
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
  const antecedencia = Number(estado.config.avisoAntecedenciaMin) || 0;
  const tolerancia = Number(estado.config.toleranciaAtrasoMin) || 60;

  blocosDoDia(hoje).forEach((bloco) => {
    if (bloco.concluido) return;
    const chave = `${hoje}#${bloco.hora}`;
    if (jaAvisados.has(chave)) return;
    const inicioAviso = bloco.minutos - antecedencia;
    if (minutosAgora < inicioAviso) return;
    if (minutosAgora > bloco.minutos + tolerancia) return;   // já passou a janela

    jaAvisados.add(chave);
    ultimoAvisado = chave;

    const quantos = bloco.pendentes.length;
    const titulo = `${bloco.hora} — ${bloco.titulo}`;
    const corpo = `${quantos} ${quantos === 1 ? 'medicamento' : 'medicamentos'}: ${resumoDoBloco(bloco)}`;

    mostrarNotificacao(titulo, corpo, chave);
    tocarSom();
    vibrar();
    falar(`São ${bloco.hora.replace(':', ' e ')}. Hora de tomar ${quantos} ${quantos === 1 ? 'medicamento' : 'medicamentos'}.`);
    aoTocar(bloco);
  });
}

export function iniciarVigia() {
  pararVigia();
  verificar();
  temporizador = setInterval(verificar, 30000);
  document.addEventListener('visibilitychange', aoVoltar);
}

function aoVoltar() { if (!document.hidden) verificar(); }

export function pararVigia() {
  if (temporizador) clearInterval(temporizador);
  temporizador = null;
  document.removeEventListener('visibilitychange', aoVoltar);
}

/** Permite reanunciar um bloco (por exemplo, depois de "adiar"). */
export function reagendar(dataISO, hora, minutosDepois) {
  const chave = `${dataISO}#${hora}`;
  jaAvisados.add(chave);                    // silencia até ao fim do adiamento
  setTimeout(() => { jaAvisados.delete(chave); verificar(); }, minutosDepois * 60000);
}

export function esquecerAviso(dataISO, hora) {
  jaAvisados.add(`${dataISO}#${hora}`);
}

export function ultimoBlocoAvisado() { return ultimoAvisado; }

/* -------------------------------------------------------------------------
   Teste do aviso — deixa a pessoa confirmar que ouve e vê o lembrete
   ------------------------------------------------------------------------- */

export async function testarAviso() {
  if (estadoPermissao() === 'default') await pedirPermissao();
  await mostrarNotificacao('Dose Certa — teste', 'É assim que vai receber os lembretes.', 'teste');
  tocarSom();
  vibrar();
  falar('Este é um aviso de teste da Dose Certa.');
}
