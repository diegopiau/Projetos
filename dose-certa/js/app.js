/* ==========================================================================
   app.js — arranque, navegação entre ecrãs e alarme em ecrã inteiro
   ========================================================================== */

import { estado, carregar, guardar, marcarToma, hojeISO, dataCurta, paraISO } from './dados.js';
import { el, icone, limpar, avisar, abrirModal } from './ui.js';
import * as vistas from './vistas.js';
import * as avisosMod from './avisos.js';
import { abrirFormulario } from './formulario.js';

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
  topo.append(el('div', { classe: 'topo__interior' }, [
    icone('marca', '1.7rem'),
    el('div', { classe: 'topo__marca', texto: 'Dose Certa' }),
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
  navigator.serviceWorker.register('sw.js').catch((erro) => console.warn('Service worker não registado', erro));
}

function manterHoraActualizada() {
  let ultimoDia = hojeISO();
  setInterval(() => {
    desenharTopo();
    const agora = paraISO(new Date());
    if (agora !== ultimoDia) { ultimoDia = agora; vistas.reporDia(); desenhar(); }
  }, 30000);
}

function arrancar() {
  const tinhaDados = carregar();
  aplicarAspecto();
  desenhar();
  registarServiceWorker();
  manterHoraActualizada();

  avisosMod.definirCallbackAlarme((bloco) => {
    if (document.hidden) return;                 // a notificação do sistema chega na mesma
    if (document.querySelector('dialog.modal[open]')) return;
    mostrarAlarme(bloco);
  });
  avisosMod.iniciarVigia();

  if (!tinhaDados) abrirBoasVindas();

  // A voz do navegador só fica disponível depois de carregar as vozes.
  window.speechSynthesis?.addEventListener?.('voiceschanged', () => {});
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
else arrancar();
