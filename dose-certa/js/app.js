/* ==========================================================================
   app.js — arranque, navegação entre ecrãs e alarme em ecrã inteiro
   ========================================================================== */

import { estado, carregar, guardar, marcarToma, hojeISO, dataCurta, paraISO, sincronizarComServidor } from './dados.js';
import { el, icone, limpar, avisar, abrirModal } from './ui.js';
import * as vistas from './vistas.js';
import * as avisosMod from './avisos.js';
import { abrirFormulario } from './formulario.js';
import * as auth from './auth.js';
import * as push from './push-cliente.js';

const ABAS = [
  { id: 'hoje', rotulo: 'Hoje', icone: 'hoje' },
  { id: 'medicamentos', rotulo: 'Medicamentos', icone: 'comprimido' },
  { id: 'caixa', rotulo: 'Caixa', icone: 'caixa' },
  { id: 'historico', rotulo: 'Histórico', icone: 'historico' },
  { id: 'ajustes', rotulo: 'Ajustes', icone: 'ajustes' },
];

let abaActual = 'hoje';

/* -------------------------------------------------------------------------
   Aspecto (tamanho de letra e contraste)
   ------------------------------------------------------------------------- */

function aplicarAspecto() {
  document.documentElement.dataset.tamanho = estado.config.tamanhoLetra || 'grande';
  document.documentElement.dataset.contraste = estado.config.contraste || 'normal';
}

/* -------------------------------------------------------------------------
   Desenho
   ------------------------------------------------------------------------- */

function desenharTopo() {
  const topo = document.getElementById('topo');
  limpar(topo);
  const agora = new Date();
  const emailAtual = auth.emailAutenticado();
  const backendVivo = auth.backendDisponivel();
  const chip = emailAtual
    ? el('button', {
        classe: 'topo__conta topo__conta--dentro',
        type: 'button',
        title: `Sessão iniciada com ${emailAtual}. Clique para ir a Ajustes → Conta.`,
        'aria-label': `Sessão iniciada com ${emailAtual}`,
        ao: { click: () => { abaActual = 'ajustes'; desenhar(); } },
      }, [
        el('span', { classe: 'topo__conta-pastilha', texto: '●' }),
        el('span', { classe: 'topo__conta-texto', texto: emailAtual }),
      ])
    : (backendVivo === true
        ? el('button', {
            classe: 'topo__conta topo__conta--fora',
            type: 'button',
            title: 'Sem sessão iniciada — clique para entrar',
            ao: { click: () => abrirPortaoLogin(true) },
          }, [
            el('span', { classe: 'topo__conta-pastilha', texto: '○' }),
            el('span', { classe: 'topo__conta-texto', texto: 'Entrar' }),
          ])
        : null);

  topo.append(el('div', { classe: 'topo__interior' }, [
    icone('marca', '1.7rem'),
    el('div', { classe: 'topo__marca', texto: 'Dose Certa' }),
    ...(chip ? [chip] : []),
    el('div', { classe: 'topo__data' }, [
      el('strong', { texto: agora.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) }),
      el('span', { texto: dataCurta(hojeISO()) }),
    ]),
  ]));
}

function desenharNavegacao() {
  const navegacao = document.getElementById('navegacao');
  limpar(navegacao);
  const interior = el('div', { classe: 'navegacao__interior', role: 'tablist' });
  ABAS.forEach((aba) => {
    interior.append(el('button', {
      classe: 'aba', type: 'button', role: 'tab',
      id: `aba-${aba.id}`,
      'aria-selected': String(abaActual === aba.id),
      'aria-controls': 'principal',
      ao: { click: () => { abaActual = aba.id; if (aba.id === 'hoje') vistas.reporDia(); desenhar(); } },
    }, [icone(aba.icone), el('span', { texto: aba.rotulo })]));
  });
  navegacao.append(interior);
}

export function desenhar() {
  desenharTopo();
  desenharNavegacao();
  const principal = document.getElementById('principal');
  limpar(principal);
  principal.setAttribute('aria-labelledby', `aba-${abaActual}`);

  switch (abaActual) {
    case 'medicamentos': vistas.vistaMedicamentos(principal, desenhar); break;
    case 'caixa': vistas.vistaCaixa(principal, desenhar); break;
    case 'historico': vistas.vistaHistorico(principal, desenhar); break;
    case 'ajustes': vistas.vistaAjustes(principal, desenhar, aplicarAspecto); break;
    default: vistas.vistaHoje(principal, desenhar);
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/* -------------------------------------------------------------------------
   Alarme em ecrã inteiro — impossível de não ver
   ------------------------------------------------------------------------- */

function mostrarAlarme(bloco) {
  document.querySelector('.alarme')?.remove();
  const dataISO = hojeISO();

  const ecra = el('div', { classe: 'alarme', role: 'alertdialog', 'aria-live': 'assertive',
    'aria-label': `Hora da medicação: ${bloco.titulo}` });

  const fechar = () => { ecra.remove(); desenhar(); };

  ecra.append(
    el('div', { classe: 'alarme__hora', texto: bloco.hora }),
    el('div', { classe: 'alarme__titulo', texto: bloco.titulo }),
    el('ul', { classe: 'alarme__lista' }, bloco.pendentes.map((toma) => el('li', {
      texto: `${toma.med.quantidadePorToma}× ${toma.med.nome}${toma.med.dosagem ? ' ' + toma.med.dosagem : ''}`
           + (toma.med.naCaixaSemanal ? ' (na caixa)' : ''),
    }))),
    el('div', { classe: 'alarme__accoes' }, [
      el('button', { classe: 'btn btn--tomei', type: 'button',
        ao: { click: () => {
          bloco.pendentes.forEach((t) => marcarToma(dataISO, t.med.id, t.hora, 'tomada'));
          avisosMod.esquecerAviso(dataISO, bloco.hora);
          avisar('Muito bem. Registado.');
          fechar();
        } } }, [icone('visto', '1.4rem'), 'Já tomei']),
      el('button', { classe: 'btn btn--neutro', type: 'button', texto: 'Lembrar daqui a 15 min',
        ao: { click: () => { avisosMod.reagendar(dataISO, bloco.hora, 15); fechar(); } } }),
      el('button', { classe: 'btn btn--neutro', type: 'button', texto: 'Ver no ecrã principal',
        ao: { click: fechar } }),
    ]),
  );

  document.body.append(ecra);
}

/* -------------------------------------------------------------------------
   Primeira utilização
   ------------------------------------------------------------------------- */

function abrirBoasVindas() {
  const nome = el('input', { type: 'text', id: 'b-nome', placeholder: 'Ex.: Margarida' });
  const corpo = el('div', {}, [
    el('p', { style: 'font-size:1.05rem',
      texto: 'A Dose Certa organiza os medicamentos do dia em poucos momentos claros e avisa a horas.' }),
    el('ol', { style: 'padding-left:1.2rem;line-height:1.7' }, [
      el('li', { texto: 'Junte cada medicamento com a caixa à frente.' }),
      el('li', { texto: 'Diga quando se toma — em linguagem corrente, sem contas.' }),
      el('li', { texto: 'Confirme cada momento com um toque.' }),
    ]),
    el('div', { classe: 'campo' }, [el('label', { for: 'b-nome', texto: 'Como se chama?' }), nome]),
    el('div', { classe: 'cartao cartao--aviso', style: 'margin:0' }, [
      el('strong', { texto: 'Atenção: ' }),
      'esta aplicação ajuda a organizar, não dá conselhos médicos. '
      + 'Nunca altere doses sem falar com o seu médico ou farmacêutico.',
    ]),
  ]);

  abrirModal({
    titulo: 'Bem-vindo(a) à Dose Certa',
    corpo,
    accoes: [
      { rotulo: 'Começar', classe: 'btn--principal', largo: true, aoClicar: async (fechar) => {
        estado.config.nome = nome.value.trim();
        guardar();
        fechar();
        await avisosMod.pedirPermissao();
        desenhar();
        setTimeout(() => abrirFormulario(null, desenhar), 400);
      } },
    ],
  });
}

/* -------------------------------------------------------------------------
   Arranque
   ------------------------------------------------------------------------- */

function registarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  // updateViaCache:'none' impede que Safari sirva sw.js do HTTP cache
  // (senão pode ficar preso numa versão antiga durante 24h).
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      // Quando um SW novo assume o controle (via clients.claim), recarrega
      // uma vez para garantir que o JS/CSS vem todo da mesma versão.
      let jaRecarregou = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (jaRecarregou) return;
        jaRecarregou = true;
        location.reload();
      });
      return reg;
    })
    .then((reg) => {
      // Força o SW a verificar se há versão nova em cada boot. Sem isto,
      // Safari iOS pode ficar dias com uma versão antiga que serve
      // ficheiros incompatíveis e a página fica em branco.
      try { reg.update(); } catch { /* */ }
      // Se aparecer um SW novo à espera de activação, recarrega para
      // apanhar código consistente em vez de misturar velho e novo.
      reg.addEventListener?.('updatefound', () => {
        const novo = reg.installing;
        if (!novo) return;
        novo.addEventListener('statechange', () => {
          if (novo.state === 'activated' && navigator.serviceWorker.controller) {
            // Só recarrega uma vez por sessão
            if (!sessionStorage.getItem('sw-reload-feito')) {
              sessionStorage.setItem('sw-reload-feito', '1');
              location.reload();
            }
          }
        });
      });
    })
    .catch((erro) => console.warn('Service worker não registado', erro));
}

/**
 * "Kill switch" — abra dose-certa/?reset=1 para apagar o service worker
 * e as caches, forçando a app a recarregar do zero. Útil quando o iPhone
 * fica preso numa versão antiga que não deixa a página abrir.
 */
async function processarReset() {
  const p = new URLSearchParams(location.search);
  if (!p.has('reset')) return false;
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const chaves = await caches.keys();
      await Promise.all(chaves.map((k) => caches.delete(k)));
    }
  } catch (e) { console.warn('reset falhou parcialmente', e); }
  // Redirecciona para a versão sem query — fresh start
  location.replace(location.pathname);
  return true;
}

/** Ecrã de socorro se o arranque rebentar — deixa o utilizador reparar sem consola. */
function mostrarEcraSocorro(erro) {
  try {
    document.body.innerHTML = '';
    const caixa = document.createElement('div');
    caixa.style.cssText = 'max-width:460px;margin:60px auto;padding:24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#fff;border:1px solid #e5e9ef;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.08);color:#1a2f4a';
    caixa.innerHTML =
        '<h1 style="margin:0 0 10px;font-size:22px">😕 A Dose Certa não arrancou</h1>'
      + '<p style="color:#4a5468;line-height:1.55">Costuma acontecer quando o navegador guarda uma versão antiga da app após uma actualização. Toque no botão abaixo para limpar e recarregar — os seus medicamentos ficam guardados.</p>'
      + '<button id="botao-socorro" style="margin-top:14px;background:#2b9ec9;color:#fff;border:none;padding:14px 22px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;width:100%">Reparar e recarregar</button>'
      + '<details style="margin-top:16px;color:#7a8497;font-size:12px"><summary style="cursor:pointer">Detalhes técnicos</summary><pre style="white-space:pre-wrap;overflow:auto">' + (erro?.stack || erro?.message || String(erro)) + '</pre></details>';
    document.body.append(caixa);
    document.getElementById('botao-socorro').addEventListener('click', () => {
      location.href = location.pathname + '?reset=1';
    });
  } catch { /* último recurso: redirecciona */ location.href = location.pathname + '?reset=1'; }
}

function manterHoraActualizada() {
  let ultimoDia = hojeISO();
  setInterval(() => {
    desenharTopo();
    const agora = paraISO(new Date());
    if (agora !== ultimoDia) { ultimoDia = agora; vistas.reporDia(); desenhar(); }
  }, 30000);
}

function mostrarBannerIphone() {
  const noIphone = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const emPWA = window.matchMedia?.('(display-mode: standalone)').matches
             || window.navigator.standalone === true;
  const jaFechado = sessionStorage.getItem('banner-ios-fechado') === '1';
  if (!noIphone || emPWA || jaFechado) return;
  if (document.getElementById('banner-ios')) return;

  const banner = document.createElement('div');
  banner.id = 'banner-ios';
  banner.style.cssText = 'position:sticky;top:0;z-index:80;background:linear-gradient(180deg,#0e7a94,#0a5f74);color:#fff;padding:calc(.75rem + env(safe-area-inset-top,0)) max(1rem,env(safe-area-inset-right,0)) .75rem max(1rem,env(safe-area-inset-left,0));font-size:.88rem;line-height:1.4;text-align:left;box-shadow:0 2px 6px rgba(0,0,0,.15);display:flex;gap:.6rem;align-items:flex-start';
  banner.innerHTML = `
    <span style="font-size:1.4rem;line-height:1;flex:0 0 auto">📲</span>
    <div style="flex:1">
      <strong>Para receber lembretes das tomas neste iPhone</strong>
      <div style="opacity:.94;margin-top:.15rem">
        Toque no <strong>botão Partilhar</strong> (□ com ↑) na barra do Safari
        → <strong>«Adicionar ao ecrã principal»</strong> → abra a Dose Certa pelo
        ícone que ficar no ecrã. Sem este passo o iPhone não deixa qualquer
        aplicação web enviar notificações.
      </div>
    </div>
    <button type="button" aria-label="Fechar aviso" style="background:rgba(255,255,255,.18);border:none;color:#fff;width:1.9rem;height:1.9rem;border-radius:999px;font-size:1.1rem;line-height:1;cursor:pointer;flex:0 0 auto">×</button>
  `;
  banner.querySelector('button').addEventListener('click', () => {
    sessionStorage.setItem('banner-ios-fechado', '1');
    banner.remove();
  });
  document.body.insertBefore(banner, document.body.firstChild);
}

async function arrancar() {
  const tinhaDadosLocais = carregar();
  aplicarAspecto();
  desenhar();
  registarServiceWorker();
  manterHoraActualizada();
  mostrarBannerIphone();

  avisosMod.definirCallbackAlarme((bloco) => {
    if (document.hidden) return;                 // a notificação do sistema chega na mesma
    if (document.querySelector('dialog.modal[open]')) return;
    mostrarAlarme(bloco);
  });
  avisosMod.iniciarVigia();

  // Verifica sessão em segundo plano. Se houver backend disponível, mostra
  // o portão de entrada por conta; senão continua em modo local (como antes).
  auth.verificarSessao().then(async (email) => {
    if (!auth.backendDisponivel()) return;             // sem backend, modo local

    if (email) {
      await sincronizarComServidor();                  // puxa/empurra dados
      mostrarMensagemBoasVindasEntrada();
      // Se este device já tem subscrição push, activa a sinc automática do
      // calendário — assim qualquer alteração aos medicamentos é replicada
      // ao servidor para o cron poder disparar pushes correctos.
      try {
        if (await push.estadoPush() === 'subscrito') {
          push.activarSincroniaAutomatica();
          push.sincronizarCalendario();  // envia já as próximas 48h
        }
      } catch (e) { console.warn('sinc calendário falhou', e); }
      desenhar();
    } else {
      // Sem sessão — mostra portão. Não bloqueia a app se o utilizador quiser
      // continuar em modo local (pode ignorar o portão).
      abrirPortaoLogin(tinhaDadosLocais);
    }
  }).catch((e) => console.warn('verificar sessão falhou', e));

  if (!tinhaDadosLocais && !new URLSearchParams(location.search).has('entrou')) {
    abrirBoasVindas();
  }

  window.speechSynthesis?.addEventListener?.('voiceschanged', () => {});
}

function mostrarMensagemBoasVindasEntrada() {
  if (!new URLSearchParams(location.search).has('entrou')) return;
  // limpa query string
  history.replaceState(null, '', location.pathname);
  avisar('Sessão iniciada. Os seus dados agora sincronizam entre dispositivos.', 'sucesso');
}

function abrirPortaoLogin(tinhaDadosLocais) {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Inputs partilhados entre os dois modos
  const emailInput = el('input', {
    type: 'email', id: 'portao-email',
    autocomplete: 'email', inputmode: 'email',
    placeholder: 'o.seu@email.pt', classe: 'campo campo--grande',
  });
  const passwordInput = el('input', {
    type: 'password', id: 'portao-pw',
    autocomplete: 'current-password',
    placeholder: 'Mínimo 6 caracteres', classe: 'campo campo--grande',
  });
  const codigoInput = el('input', {
    type: 'text', id: 'portao-codigo',
    autocomplete: 'one-time-code', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '7',
    placeholder: '000 000', classe: 'campo campo--grande',
    style: 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:1.4rem;letter-spacing:.2em;text-align:center',
  });
  const estadoMsg = el('p', { classe: 'aviso-info', style: 'display:none;margin:12px 0 0;padding:.5rem .7rem;border-radius:6px;background:var(--bg-2,#f5f7fa)' });

  const corpo = el('div');

  // ── Modo 1: Password (default) ──────────────────────────────────────────
  const zonaPassword = el('div');
  zonaPassword.appendChild(el('p', { style: 'margin:0 0 12px;font-size:14px;color:var(--texto-suave)' }, [
    'Introduza email e password para entrar. Se ainda não tem conta, é criada automaticamente com estes dados.',
  ]));
  zonaPassword.appendChild(el('label', { for: 'portao-email', classe: 'rotulo', style: 'display:block;font-weight:600;margin-top:6px' }, ['Email']));
  zonaPassword.appendChild(emailInput);
  zonaPassword.appendChild(el('label', { for: 'portao-pw', classe: 'rotulo', style: 'display:block;font-weight:600;margin-top:12px' }, ['Password']));
  zonaPassword.appendChild(passwordInput);
  const btnEntrarPW = el('button', {
    type: 'button', classe: 'btn btn--principal btn--largo',
    style: 'margin-top:14px',
    ao: { click: async () => {
      const email = (emailInput.value || '').trim().toLowerCase();
      const pw = passwordInput.value || '';
      if (!EMAIL_RE.test(email)) return mostrarErro('Introduza um email válido.');
      if (pw.length < 6) return mostrarErro('A password precisa de pelo menos 6 caracteres.');
      mostrarInfo('A entrar…');
      const r = await auth.entrarComPassword(email, pw);
      if (r.ok) {
        mostrarSucesso(r.modo === 'registo' ? '✓ Conta criada. A sincronizar…' : '✓ Sessão iniciada. Um momento…');
        setTimeout(() => location.replace(location.pathname + '?entrou=1'), 600);
      } else if (r.needsPasswordReset) {
        mostrarErro(r.msg);
        setTimeout(() => trocarModo('magic'), 1200);
      } else {
        mostrarErro(r.msg || 'Erro ao entrar.');
      }
    } },
  }, ['Entrar / criar conta']);
  zonaPassword.appendChild(btnEntrarPW);

  const linkEsqueci = el('button', {
    type: 'button',
    style: 'margin-top:12px;background:transparent;border:none;color:var(--marca);text-decoration:underline;padding:.3rem 0;cursor:pointer;font-family:inherit;font-size:.9rem',
    ao: { click: () => trocarModo('magic') },
  }, ['Esqueci-me da password / usar link por email →']);
  zonaPassword.appendChild(linkEsqueci);

  // ── Modo 2: Magic link + código ─────────────────────────────────────────
  const zonaMagic = el('div', { style: 'display:none' });
  zonaMagic.appendChild(el('p', { style: 'margin:0 0 12px;font-size:14px;color:var(--texto-suave)' }, [
    'Enviamos-lhe um email com um link e um código de 6 dígitos. Válidos 10 min, uso único.',
  ]));
  zonaMagic.appendChild(el('label', { for: 'portao-email', classe: 'rotulo', style: 'display:block;font-weight:600' }, ['Email']));
  // Reusa o mesmo emailInput — mas precisa estar aqui também. Vamos mover dinamicamente.
  const emailHolderMagic = el('div');
  zonaMagic.appendChild(emailHolderMagic);
  const btnEnviarLink = el('button', {
    type: 'button', classe: 'btn btn--principal btn--largo',
    style: 'margin-top:14px',
    ao: { click: async () => {
      const email = (emailInput.value || '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return mostrarErro('Introduza um email válido.');
      mostrarInfo('A enviar email…');
      try {
        const r = await auth.pedirLink(email);
        if (r.ok) {
          mostrarSucesso('✓ Verifique o email. Chega em segundos com link + código.');
          zonaCodigoWrapper.style.display = 'block';
          codigoInput.focus();
        } else mostrarErro(r.msg || 'Erro');
      } catch { mostrarErro('Não foi possível enviar. Tente daqui a instantes.'); }
    } },
  }, ['Enviar link e código para o email']);
  zonaMagic.appendChild(btnEnviarLink);

  const zonaCodigoWrapper = el('div', { style: 'display:none;margin-top:16px;padding-top:14px;border-top:1px dashed var(--linha)' }, [
    el('label', { for: 'portao-codigo', classe: 'rotulo', style: 'display:block;font-weight:600' }, ['Código de 6 dígitos']),
    el('p', { style: 'font-size:.8rem;color:var(--texto-suave);margin:.2rem 0 .5rem' }, ['Cole aqui o código que recebeu no email.']),
    codigoInput,
    el('button', {
      type: 'button', classe: 'btn btn--principal btn--largo',
      style: 'margin-top:.6rem',
      ao: { click: async () => {
        const email = (emailInput.value || '').trim().toLowerCase();
        const codigo = (codigoInput.value || '').replace(/\D/g, '');
        if (!EMAIL_RE.test(email)) return mostrarErro('Introduza o mesmo email a que pediu o código.');
        if (codigo.length !== 6) return mostrarErro('O código tem 6 dígitos.');
        mostrarInfo('A validar…');
        const r = await auth.validarCodigo(email, codigo);
        if (r.ok) {
          mostrarSucesso('✓ Sessão iniciada. Um momento…');
          setTimeout(() => location.replace(location.pathname + '?entrou=1'), 600);
        } else mostrarErro(r.msg || 'Código incorrecto.');
      } },
    }, ['Entrar com este código']),
  ]);
  zonaMagic.appendChild(zonaCodigoWrapper);

  const linkVoltarPW = el('button', {
    type: 'button',
    style: 'margin-top:12px;background:transparent;border:none;color:var(--marca);text-decoration:underline;padding:.3rem 0;cursor:pointer;font-family:inherit;font-size:.9rem',
    ao: { click: () => trocarModo('password') },
  }, ['← Voltar a entrar com password']);
  zonaMagic.appendChild(linkVoltarPW);

  corpo.appendChild(zonaPassword);
  corpo.appendChild(zonaMagic);
  corpo.appendChild(estadoMsg);
  if (tinhaDadosLocais) {
    corpo.appendChild(el('p', { classe: 'nota', style: 'margin-top:16px;font-size:13px;color:var(--texto-suave)' }, [
      '💡 Já tem dados neste dispositivo — ao entrar pela primeira vez com uma conta nova, esses dados são copiados automaticamente para a sua conta.',
    ]));
  }

  function trocarModo(qual) {
    // O email input é sempre o mesmo — reposiciona conforme o modo activo
    if (qual === 'password') {
      zonaPassword.insertBefore(emailInput, zonaPassword.children[2]); // depois do label
      zonaPassword.style.display = '';
      zonaMagic.style.display = 'none';
      estadoMsg.style.display = 'none';
      passwordInput.focus();
    } else {
      emailHolderMagic.appendChild(emailInput);
      zonaPassword.style.display = 'none';
      zonaMagic.style.display = '';
      estadoMsg.style.display = 'none';
      emailInput.focus();
    }
  }
  function mostrarErro(msg) { estadoMsg.style.display = 'block'; estadoMsg.style.background = '#fee2e2'; estadoMsg.style.color = '#991b1b'; estadoMsg.textContent = msg; }
  function mostrarInfo(msg) { estadoMsg.style.display = 'block'; estadoMsg.style.background = 'var(--bg-2,#f5f7fa)'; estadoMsg.style.color = 'var(--texto-suave)'; estadoMsg.textContent = msg; }
  function mostrarSucesso(msg) { estadoMsg.style.display = 'block'; estadoMsg.style.background = '#d1fae5'; estadoMsg.style.color = '#065f46'; estadoMsg.textContent = msg; }

  abrirModal({
    titulo: '🔒 Entrar / criar conta',
    corpo,
    accoes: [
      { rotulo: 'Continuar sem conta', classe: 'btn--neutro', aoClicar: (fechar) => fechar() },
    ],
  });
}

async function iniciar() {
  if (await processarReset()) return;   // ?reset=1 → limpa e recarrega antes de tudo
  try { await arrancar(); }
  catch (e) { console.error('arranque falhou', e); mostrarEcraSocorro(e); }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
else iniciar();
