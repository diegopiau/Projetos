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

// A partir de file:// o Chrome devolve 'denied' sem sequer mostrar a caixa de
// autorização, e deixa Notification.permission em 'default'. Sem isto, a app
// ficava a dizer «ainda não autorizou» e o botão parecia não fazer nada.
let recusadoPelaOrigem = false;

export async function pedirPermissao() {
  if (!('Notification' in window)) return 'indisponivel';
  try {
    const resposta = await Notification.requestPermission();
    if (resposta === 'denied' && Notification.permission === 'default') {
      recusadoPelaOrigem = true;     // recusa do navegador, não da pessoa
    }
    return resposta;
  } catch {
    recusadoPelaOrigem = true;
    return Notification.permission;
  }
}

/* -------------------------------------------------------------------------
   Diagnóstico — porque é que os avisos não aparecem?
   --------------------------------------------------------------------------
   Falhar em silêncio é o pior que esta aplicação pode fazer: quem conta com
   ela para tomar a medicação não tem como perceber que não vai ser avisado.
   Esta função diz sempre o que se passa e o que fazer a seguir.
   ------------------------------------------------------------------------- */

export async function diagnostico() {
  // Detecção robusta de iOS/iPadOS: iPad em "Pedir site para computador" devolve
  // userAgent "Macintosh", por isso combinamos UA com maxTouchPoints > 1 (só
  // Apple touch tem isto num "Mac"). Sem esta heurística, no iPad Safari
  // caíamos no ramo "sem suporte" com uma mensagem contraditória.
  const uaApple = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const iPadDisfarcado = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
  const noIOS = uaApple || iPadDisfarcado;
  const ehSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(navigator.userAgent);
  const instaladaComoApp = window.matchMedia?.('(display-mode: standalone)').matches
                         || window.navigator.standalone === true;
  if (noIOS && !instaladaComoApp) {
    return { podeAvisar: false, motivo: 'ios-precisa-pwa',
      titulo: 'No iPhone/iPad: adicione ao ecrã principal',
      explicacao: 'A Apple só deixa os avisos funcionar depois de a Dose Certa ficar '
        + 'instalada como aplicação. Toque no botão Partilhar (quadrado com seta a subir) '
        + 'na barra do Safari, escolha «Adicionar ao ecrã principal» e depois abra a '
        + 'Dose Certa pelo ícone que ficou lá. Requer iOS 16.4 ou superior.',
      accao: 'calendario' };
  }
  if (!('Notification' in window)) {
    // Mensagem adaptativa: não sugerir Safari se já estamos no Safari, nem
    // Chrome se estamos no Chrome — evita a contradição «o seu navegador não
    // suporta, use o Safari» quando quem lê está no Safari.
    let sugestao;
    if (noIOS) {
      sugestao = 'Neste dispositivo, adicione a Dose Certa ao ecrã principal (botão Partilhar do Safari) e abra-a pelo ícone — só assim os avisos ficam disponíveis.';
    } else if (ehSafari) {
      sugestao = 'Actualize o Safari para uma versão mais recente, ou experimente o Chrome, o Edge ou o Firefox.';
    } else {
      sugestao = 'Actualize o navegador para uma versão mais recente, ou experimente o Chrome, o Edge ou o Firefox.';
    }
    return { podeAvisar: false, motivo: 'sem-suporte',
      titulo: 'Este navegador não sabe mostrar avisos',
      explicacao: sugestao,
      accao: null };
  }

  if (location.protocol === 'file:') {
    return { podeAvisar: false, motivo: 'ficheiro',
      titulo: 'Os avisos não funcionam a partir do ficheiro',
      explicacao: 'Está a abrir a aplicação directamente do computador. Nesta situação o '
        + 'navegador recusa os avisos sem sequer perguntar — não é nada que tenha feito mal. '
        + 'Para ter lembretes, coloque a aplicação num endereço que comece por https:// '
        + 'e abra-a por aí.',
      accao: 'calendario' };
  }

  if (!window.isSecureContext) {
    return { podeAvisar: false, motivo: 'inseguro',
      titulo: 'Este endereço não permite avisos',
      explicacao: `Está a abrir a aplicação por ${location.protocol}//. Os navegadores só `
        + 'deixam avisar em endereços seguros, começados por https:// (ou em localhost, '
        + 'durante testes).',
      accao: 'calendario' };
  }

  if (recusadoPelaOrigem) {
    return { podeAvisar: false, motivo: 'recusado-pelo-navegador',
      titulo: 'O navegador recusou os avisos',
      explicacao: 'O pedido de autorização foi recusado sem chegar a aparecer. Costuma '
        + 'acontecer quando a página não está num endereço https:// ou quando os avisos '
        + 'estão desligados nas definições do navegador.',
      accao: 'calendario' };
  }

  if (Notification.permission === 'denied') {
    return { podeAvisar: false, motivo: 'bloqueado',
      titulo: 'Os avisos estão bloqueados para este site',
      explicacao: 'Toque no cadeado ao lado do endereço, procure «Notificações» e escolha '
        + '«Permitir». Depois volte aqui e faça o teste.',
      accao: 'calendario' };
  }

  if (Notification.permission === 'default') {
    return { podeAvisar: false, motivo: 'por-autorizar',
      titulo: 'Ainda não autorizou os avisos',
      explicacao: 'Sem essa autorização a aplicação não o pode chamar à hora certa.',
      accao: 'autorizar' };
  }

  // Autorizado. No telemóvel, mostrar avisos exige um service worker registado.
  let registo = null;
  try { registo = (await navigator.serviceWorker?.getRegistration()) || null; } catch { /* */ }
  const noTelemovel = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!registo && noTelemovel) {
    return { podeAvisar: false, motivo: 'sem-service-worker',
      titulo: 'Falta um pedaço da aplicação para avisar no telemóvel',
      explicacao: 'Os avisos em telemóvel precisam da aplicação instalada a partir de um '
        + 'endereço https://. Recarregue a página; se continuar assim, adicione a aplicação '
        + 'ao ecrã principal e volte a abrir por aí.',
      accao: 'calendario' };
  }

  return { podeAvisar: true, motivo: 'ok',
    titulo: 'Os avisos estão a funcionar neste dispositivo',
    explicacao: 'Faça o teste abaixo para confirmar que ouve e vê o lembrete.',
    accao: 'testar' };
}

/* -------------------------------------------------------------------------
   Canais de aviso
   ------------------------------------------------------------------------- */

/**
 * Mostra uma notificação do sistema. Devolve `true` se alguma via resultou.
 * Nunca engole a falha em silêncio: quem depende disto para tomar medicação
 * precisa de saber quando o aviso não chegou.
 */
async function mostrarNotificacao(titulo, corpo, etiqueta) {
  if (estadoPermissao() !== 'granted') return false;
  const opcoes = {
    body: corpo,
    tag: etiqueta,
    renotify: true,
    requireInteraction: true,
    icon: 'assets/icone.svg',
    badge: 'assets/icone.svg',
    lang: 'pt-PT',
  };

  // No telemóvel só a via do service worker resulta: o construtor Notification
  // lança «Illegal constructor» no Chrome para Android.
  try {
    const registo = await navigator.serviceWorker?.getRegistration();
    if (registo) { await registo.showNotification(titulo, opcoes); return true; }
  } catch (erro) {
    console.warn('Aviso pelo service worker falhou', erro);
  }

  try { new Notification(titulo, opcoes); return true; }
  catch (erro) {
    console.warn('Aviso pelo construtor falhou', erro);
    return false;
  }
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

/**
 * Experimenta todos os canais e diz o que resultou, para a pessoa poder
 * confirmar que vai mesmo ser avisada.
 */
export async function testarAviso() {
  if (estadoPermissao() === 'default') await pedirPermissao();
  const notificou = await mostrarNotificacao(
    'Dose Certa — teste', 'É assim que vai receber os lembretes.', 'teste');
  tocarSom();
  vibrar();
  falar('Este é um aviso de teste da Dose Certa.');
  return { notificou, som: !!estado.config.som, voz: !!estado.config.voz };
}
