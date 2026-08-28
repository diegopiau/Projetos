/* ==========================================================================
   vistas.js — os cinco ecrãs da aplicação
   ========================================================================== */

import {
  estado, guardar, marcarToma, marcarPreparacao, obterRegisto,
  importar, exportar, apagarTudo,
  DIAS_CURTOS, DIAS_LONGOS, REFEICOES,
  hojeISO, somarDias, dataPorExtenso, deISO, paraISO, minutosAgora,
} from './dados.js';
import {
  blocosDoDia, tomasDoDia, situacaoDoBloco, avisosDoBloco, descreverRegime,
  rotuloForma, instrucaoCurta, horasDoMedicamento, diasDeStock, alertasDeStock,
  adesaoNoPeriodo, gerarICS, sugestoesDeSimplificacao, aplicarSimplificacao,
} from './horarios.js';
import { el, icone, avisar, abrirModal, confirmar, descarregar } from './ui.js';
import { abrirFormulario } from './formulario.js';
import * as avisos from './avisos.js';

/* =========================================================================
   ECRÃ 1 — HOJE
   ========================================================================= */

let diaVisivel = hojeISO();

export function reporDia() { diaVisivel = hojeISO(); }

function navegacaoDeDia(redesenhar) {
  const ehHoje = diaVisivel === hojeISO();
  const anterior = el('button', { classe: 'btn btn--neutro btn--pequeno', type: 'button',
    texto: '‹ Dia anterior', ao: { click: () => { diaVisivel = somarDias(diaVisivel, -1); redesenhar(); } } });
  const seguinte = el('button', { classe: 'btn btn--neutro btn--pequeno', type: 'button',
    texto: 'Dia seguinte ›', ao: { click: () => { diaVisivel = somarDias(diaVisivel, 1); redesenhar(); } } });
  const centro = ehHoje
    ? el('strong', { texto: 'Hoje', style: 'align-self:center' })
    : el('button', { classe: 'btn btn--principal btn--pequeno', type: 'button', texto: 'Voltar a hoje',
        ao: { click: () => { diaVisivel = hojeISO(); redesenhar(); } } });
  return el('div', { classe: 'sem-impressao',
    style: 'display:flex;justify-content:space-between;gap:.5rem;margin-bottom:1rem;align-items:center' },
    [anterior, centro, seguinte]);
}

function etiquetasDaToma(med) {
  const etiquetas = [];
  etiquetas.push(el('span', { classe: `etiqueta ${med.naCaixaSemanal ? 'etiqueta--caixa' : 'etiqueta--embalagem'}`,
    texto: med.naCaixaSemanal ? '📅 Na caixa semanal' : '📦 Na embalagem' }));
  const instrucao = instrucaoCurta(med.instrucoes);
  if (instrucao) {
    etiquetas.push(el('span', {
      classe: `etiqueta ${med.instrucoes === 'jejum' ? 'etiqueta--jejum' : ''}`, texto: instrucao }));
  }
  return etiquetas;
}

function linhaDeToma(toma, dataISO, redesenhar) {
  const feita = toma.estado === 'tomada';
  const saltada = toma.estado === 'saltada';

  const caixa = el('button', {
    classe: 'toma__caixa', type: 'button',
    'aria-pressed': String(feita),
    'aria-label': `${feita ? 'Desmarcar' : 'Marcar como tomado'}: ${toma.med.nome} das ${toma.hora}`,
    ao: { click: () => {
      marcarToma(dataISO, toma.med.id, toma.hora, feita ? null : 'tomada');
      redesenhar();
    } },
  }, feita ? [icone('visto', '1.4rem')] : []);

  const nome = `${toma.med.nome}${toma.med.dosagem ? ' ' + toma.med.dosagem : ''}`;
  const dose = `${toma.med.quantidadePorToma} ${rotuloForma(toma.med.forma).toLowerCase()}`
    + (toma.med.quantidadePorToma > 1 ? 's' : '');

  const info = el('div', { classe: 'toma__info' }, [
    el('div', { classe: 'toma__nome', texto: nome }),
    el('div', { classe: 'toma__dose', texto: dose + (saltada ? ' — saltado' : '') }),
    el('div', {}, etiquetasDaToma(toma.med)),
    toma.med.notas ? el('div', { classe: 'toma__dose', style: 'margin-top:.3rem', texto: `“${toma.med.notas}”` }) : null,
  ]);

  return el('div', {
    classe: `toma${feita ? ' toma--feita' : ''}${saltada ? ' toma--saltada' : ''}`,
  }, [caixa, info]);
}

function cartaoDeBloco(bloco, dataISO, redesenhar) {
  const situacao = situacaoDoBloco(bloco, dataISO);
  const nodo = el('section', {
    classe: `bloco${bloco.concluido ? ' bloco--concluido' : ''}${situacao === 'agora' ? ' bloco--agora' : ''}`,
    dados: { periodo: bloco.periodo },
    'aria-label': `${bloco.hora}, ${bloco.titulo}`,
  });

  const estadoTexto = bloco.concluido ? '✓ Concluído'
    : situacao === 'atrasado' ? '⚠ Em atraso'
    : situacao === 'agora' ? '● É agora'
    : `Faltam ${bloco.pendentes.length}`;

  nodo.append(el('header', { classe: 'bloco__cabeca' }, [
    el('div', { classe: 'bloco__hora', texto: bloco.hora }),
    el('div', { classe: 'bloco__identidade' }, [
      el('div', { classe: 'bloco__titulo', texto: bloco.titulo }),
      el('div', { classe: 'bloco__sub',
        texto: `${bloco.tomas.length} ${bloco.tomas.length === 1 ? 'medicamento' : 'medicamentos'}` }),
    ]),
    el('div', { classe: 'bloco__estado', texto: estadoTexto }),
  ]));

  const corpo = el('div', { classe: 'bloco__corpo' });
  bloco.tomas.forEach((toma) => corpo.append(linhaDeToma(toma, dataISO, redesenhar)));

  avisosDoBloco(bloco).forEach((texto) => {
    corpo.append(el('div', { classe: 'cartao cartao--aviso', style: 'margin:.8rem 0 0' },
      [el('strong', { texto: '⚠ Atenção ' }), texto]));
  });
  nodo.append(corpo);

  if (!bloco.concluido) {
    const accoes = el('div', { classe: 'bloco__accoes sem-impressao' }, [
      el('button', { classe: 'btn btn--tomei', type: 'button',
        ao: { click: () => {
          bloco.pendentes.forEach((t) => marcarToma(dataISO, t.med.id, t.hora, 'tomada'));
          avisos.esquecerAviso(dataISO, bloco.hora);
          avisar(`Registado: ${bloco.titulo.toLowerCase()}, ${bloco.pendentes.length} medicamentos.`);
          redesenhar();
        } } }, [icone('visto', '1.3rem'), 'Já tomei tudo']),
      el('button', { classe: 'btn btn--neutro btn--pequeno', type: 'button', texto: 'Adiar 15 min',
        ao: { click: () => {
          avisos.reagendar(dataISO, bloco.hora, 15);
          avisar('Volto a avisar dentro de 15 minutos.');
        } } }),
      el('button', { classe: 'btn btn--neutro btn--pequeno', type: 'button', texto: 'Saltar',
        ao: { click: async () => {
          const certeza = await confirmar({
            titulo: 'Saltar este momento',
            mensagem: 'Vai ficar registado que estes medicamentos não foram tomados. '
                    + 'Se for por indicação médica, tudo bem; caso contrário, fale com o seu médico.',
            rotuloConfirmar: 'Sim, saltar',
          });
          if (!certeza) return;
          bloco.pendentes.forEach((t) => marcarToma(dataISO, t.med.id, t.hora, 'saltada'));
          avisos.esquecerAviso(dataISO, bloco.hora);
          redesenhar();
        } } }),
    ]);
    nodo.append(accoes);
  }

  return nodo;
}

let simplificacaoAdiada = false;

function cartaoDeSimplificacao(dataISO, totalBlocos, redesenhar) {
  if (simplificacaoAdiada || totalBlocos <= 6) return null;
  const sugestoes = sugestoesDeSimplificacao(dataISO);
  if (!sugestoes.length) return null;

  const momentosPoupados = new Set(sugestoes.map((s) => s.de)).size
    - new Set(sugestoes.map((s) => s.para)).size;

  return el('div', { classe: 'cartao cartao--ok sem-impressao' }, [
    el('h3', { texto: `✨ O seu dia tem ${totalBlocos} momentos — dá para juntar alguns` }),
    el('p', { texto: 'Estes medicamentos não dependem das refeições nem de intervalos certos, '
      + 'por isso podem passar para uma hora em que já toma outra coisa:' }),
    el('ul', { style: 'padding-left:1.2rem;margin:0 0 .8rem' }, sugestoes.map((s) => el('li', {
      texto: `${s.med.nome}: ${s.de} passa para ${s.para}`,
    }))),
    el('p', { classe: 'campo__ajuda',
      texto: 'Tomas de 8 em 8 horas, ligadas às refeições, em jejum ou com comida ficam onde estão. '
           + 'Confirme a mudança com o seu médico ou farmacêutico.' }),
    el('div', { style: 'display:flex;gap:.6rem;flex-wrap:wrap' }, [
      el('button', { classe: 'btn btn--principal', type: 'button',
        ao: { click: async () => {
          const certeza = await confirmar({
            titulo: 'Juntar estas tomas',
            mensagem: `Vai passar ${sugestoes.length} ${sugestoes.length === 1 ? 'toma' : 'tomas'} para horas que já usa. `
                    + 'Pode desfazer a qualquer momento editando cada medicamento.',
            rotuloConfirmar: 'Juntar',
          });
          if (!certeza) return;
          aplicarSimplificacao(sugestoes);
          avisar(momentosPoupados > 0
            ? `Feito. O dia ficou com menos ${momentosPoupados} ${momentosPoupados === 1 ? 'momento' : 'momentos'}.`
            : 'Horários ajustados.');
          redesenhar();
        } } }, [icone('visto', '1.2rem'), 'Juntar tomas']),
      el('button', { classe: 'btn btn--neutro', type: 'button', texto: 'Agora não',
        ao: { click: () => { simplificacaoAdiada = true; redesenhar(); } } }),
    ]),
  ]);
}

function cartoesDeAlerta(redesenhar) {
  const cartoes = [];

  const permissao = avisos.estadoPermissao();
  if (permissao === 'default') {
    cartoes.push(el('div', { classe: 'cartao cartao--aviso sem-impressao' }, [
      el('h3', { texto: '🔔 Ainda não pode receber lembretes' }),
      el('p', { texto: 'Autorize os avisos para a app o poder chamar à hora certa.' }),
      el('button', { classe: 'btn btn--principal btn--largo', type: 'button', texto: 'Autorizar avisos',
        ao: { click: async () => { await avisos.pedirPermissao(); redesenhar(); } } }),
    ]));
  }

  alertasDeStock().forEach(({ med, dias }) => {
    cartoes.push(el('div', { classe: `cartao ${dias <= 2 ? 'cartao--erro' : 'cartao--aviso'} sem-impressao` }, [
      el('h3', { texto: `💊 ${med.nome} está a acabar` }),
      el('p', { texto: dias <= 0
        ? 'Já não há unidades registadas. Aviar receita com urgência.'
        : `Chega para cerca de ${dias} ${dias === 1 ? 'dia' : 'dias'}. Trate da receita.` }),
    ]));
  });

  return cartoes;
}

export function vistaHoje(raiz, redesenhar) {
  const blocos = blocosDoDia(diaVisivel);
  const tomas = tomasDoDia(diaVisivel);
  const feitas = tomas.filter((t) => t.estado === 'tomada').length;

  raiz.append(
    el('h1', { texto: diaVisivel === hojeISO() ? 'Hoje' : dataPorExtenso(diaVisivel) }),
    el('p', { classe: 'campo__ajuda', style: 'margin-top:-.4rem',
      texto: dataPorExtenso(diaVisivel) }),
    navegacaoDeDia(redesenhar),
  );

  if (tomas.length) {
    const percentagem = Math.round((feitas / tomas.length) * 100);
    raiz.append(el('div', { classe: 'cartao' }, [
      el('div', { style: 'display:flex;justify-content:space-between;font-weight:700;margin-bottom:.4rem' }, [
        el('span', { texto: `${feitas} de ${tomas.length} tomas` }),
        el('span', { texto: `${percentagem}%` }),
      ]),
      el('div', { classe: 'barra', role: 'progressbar', 'aria-valuenow': String(percentagem),
        'aria-valuemin': '0', 'aria-valuemax': '100',
        'aria-label': 'Tomas concluídas hoje' },
        [el('div', { classe: 'barra__parte', style: `width:${percentagem}%` })]),
    ]));
  }

  cartoesDeAlerta(redesenhar).forEach((c) => raiz.append(c));

  const simplificacao = cartaoDeSimplificacao(diaVisivel, blocos.length, redesenhar);
  if (simplificacao) raiz.append(simplificacao);

  if (!blocos.length) {
    raiz.append(el('div', { classe: 'vazio' }, [
      icone('comprimido'),
      el('h2', { texto: estado.medicamentos.length ? 'Nada marcado para este dia' : 'Ainda não há medicamentos' }),
      el('p', { texto: estado.medicamentos.length
        ? 'Não há tomas previstas nesta data.'
        : 'Comece por juntar os medicamentos que toma.' }),
      el('button', { classe: 'btn btn--principal', type: 'button',
        ao: { click: () => abrirFormulario(null, redesenhar) } }, [icone('mais', '1.2rem'), 'Juntar medicamento']),
    ]));
    return;
  }

  blocos.forEach((bloco) => raiz.append(cartaoDeBloco(bloco, diaVisivel, redesenhar)));

  const sos = estado.medicamentos.filter((m) => m.activo && m.regime?.tipo === 'sos');
  if (sos.length) {
    raiz.append(el('section', { classe: 'cartao sem-impressao' }, [
      el('h3', { texto: 'Em caso de necessidade (SOS)' }),
      ...sos.map((med) => el('div', { classe: 'toma' }, [
        el('button', { classe: 'toma__caixa', type: 'button', 'aria-label': `Registar toma de ${med.nome}`,
          ao: { click: () => {
            const agora = new Date();
            const hora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
            marcarToma(diaVisivel, med.id, hora, 'tomada');
            avisar(`${med.nome} registado às ${hora}.`);
            redesenhar();
          } } }, [icone('mais', '1.3rem')]),
        el('div', { classe: 'toma__info' }, [
          el('div', { classe: 'toma__nome', texto: med.nome }),
          el('div', { classe: 'toma__dose', texto: med.notas || 'Toque em + para registar quando tomar.' }),
        ]),
      ])),
    ]));
  }
}

/* =========================================================================
   ECRÃ 2 — MEDICAMENTOS
   ========================================================================= */

export function vistaMedicamentos(raiz, redesenhar) {
  raiz.append(
    el('h1', { texto: 'Os meus medicamentos' }),
    el('button', { classe: 'btn btn--principal btn--largo sem-impressao', type: 'button',
      style: 'margin-bottom:1rem',
      ao: { click: () => abrirFormulario(null, redesenhar) } },
      [icone('mais', '1.2rem'), 'Juntar medicamento']),
  );

  const activos = estado.medicamentos.filter((m) => m.activo);
  const parados = estado.medicamentos.filter((m) => !m.activo);

  if (!estado.medicamentos.length) {
    raiz.append(el('div', { classe: 'vazio' }, [
      icone('frasco'),
      el('h2', { texto: 'Lista vazia' }),
      el('p', { texto: 'Junte os medicamentos um a um, com a caixa à frente.' }),
    ]));
    return;
  }

  const desenharLista = (lista, titulo) => {
    if (!lista.length) return;
    raiz.append(el('h2', { texto: titulo, style: 'margin-top:1.4rem' }));
    lista.forEach((med) => {
      const dias = diasDeStock(med);
      raiz.append(el('article', { classe: 'cartao' }, [
        el('div', { style: 'display:flex;gap:.8rem;align-items:flex-start' }, [
          el('div', { style: 'flex:1;min-width:0' }, [
            el('h3', { texto: `${med.nome}${med.dosagem ? ' ' + med.dosagem : ''}`, style: 'margin-bottom:.2rem' }),
            el('p', { classe: 'campo__ajuda', style: 'margin:0',
              texto: `${med.quantidadePorToma} ${rotuloForma(med.forma).toLowerCase()} · ${descreverRegime(med)}` }),
            med.motivo ? el('p', { classe: 'campo__ajuda', style: 'margin:.2rem 0 0', texto: `Para: ${med.motivo}` }) : null,
            el('div', {}, [
              ...etiquetasDaToma(med),
              typeof dias === 'number'
                ? el('span', { classe: `etiqueta ${dias <= 7 ? 'etiqueta--aviso' : ''}`,
                    texto: `${med.stock.unidades} un. · ~${dias} dias` })
                : null,
            ]),
          ]),
          el('button', { classe: 'btn btn--neutro btn--pequeno sem-impressao', type: 'button',
            'aria-label': `Editar ${med.nome}`,
            ao: { click: () => abrirFormulario(med.id, redesenhar) } }, [icone('lapis', '1.1rem'), 'Editar']),
        ]),
        el('div', { classe: 'sem-impressao', style: 'margin-top:.8rem;display:flex;gap:.5rem;flex-wrap:wrap' }, [
          el('button', { classe: 'btn btn--neutro btn--pequeno', type: 'button',
            texto: med.activo ? 'Parar temporariamente' : 'Voltar a tomar',
            ao: { click: () => { med.activo = !med.activo; guardar(); redesenhar(); } } }),
          typeof med.stock?.unidades === 'number'
            ? el('button', { classe: 'btn btn--neutro btn--pequeno', type: 'button', texto: 'Repor caixa nova',
                ao: { click: () => abrirReposicao(med, redesenhar) } })
            : null,
        ]),
      ]));
    });
  };

  desenharLista(activos, 'A tomar');
  desenharLista(parados, 'Parados');
}

function abrirReposicao(med, redesenhar) {
  const campo = el('input', { type: 'number', min: '0', step: '1', id: 'r-un',
    value: String(med.stock?.unidades ?? 0) });
  abrirModal({
    titulo: `Stock de ${med.nome}`,
    corpo: el('div', {}, [
      el('div', { classe: 'campo' }, [
        el('label', { for: 'r-un', texto: 'Unidades que tem agora em casa' }), campo]),
      el('p', { classe: 'campo__ajuda',
        texto: 'Some as embalagens novas às unidades que ainda restam.' }),
    ]),
    accoes: [
      { rotulo: 'Cancelar', classe: 'btn--neutro', aoClicar: (fechar) => fechar() },
      { rotulo: 'Guardar', classe: 'btn--principal', aoClicar: (fechar) => {
        med.stock = { ...(med.stock || {}), unidades: Number(campo.value) || 0 };
        guardar(); fechar(); avisar('Stock actualizado.'); redesenhar();
      } },
    ],
  });
}

/* =========================================================================
   ECRÃ 3 — CAIXA SEMANAL
   ========================================================================= */

function inicioDaSemana(iso) {
  const data = deISO(iso);
  const desvio = (data.getDay() + 6) % 7;          // semana começa à segunda
  data.setDate(data.getDate() - desvio);
  return paraISO(data);
}

let semanaVisivel = inicioDaSemana(hojeISO());

export function vistaCaixa(raiz, redesenhar) {
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(semanaVisivel, i));
  const naCaixa = estado.medicamentos.filter((m) => m.activo && m.naCaixaSemanal);

  raiz.append(
    el('h1', { texto: 'Caixa semanal' }),
    el('p', { texto: 'Prepare a caixa de uma só vez e vá riscando. '
      + 'Quem confere ao domingo tem a semana descansada.' }),
  );

  raiz.append(el('div', { classe: 'sem-impressao',
    style: 'display:flex;justify-content:space-between;gap:.5rem;margin-bottom:1rem;align-items:center' }, [
    el('button', { classe: 'btn btn--neutro btn--pequeno', type: 'button', texto: '‹ Semana anterior',
      ao: { click: () => { semanaVisivel = somarDias(semanaVisivel, -7); redesenhar(); } } }),
    el('strong', { style: 'align-self:center;text-align:center;font-size:.9rem',
      texto: `${deISO(dias[0]).getDate()} a ${deISO(dias[6]).getDate()} de ${
        ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'][deISO(dias[6]).getMonth()]}` }),
    el('button', { classe: 'btn btn--neutro btn--pequeno', type: 'button', texto: 'Semana seguinte ›',
      ao: { click: () => { semanaVisivel = somarDias(semanaVisivel, 7); redesenhar(); } } }),
  ]));

  if (!naCaixa.length) {
    raiz.append(el('div', { classe: 'vazio' }, [
      icone('caixa'),
      el('h2', { texto: 'Nenhum medicamento marcado para a caixa' }),
      el('p', { texto: 'Ao juntar ou editar um medicamento, ligue a opção '
        + '“Este fica preparado na caixa semanal”.' }),
    ]));
    return;
  }

  /* Telemóvel: um cartão por dia, como os compartimentos reais da caixa. */
  const porDias = el('div', { classe: 'caixa-dias' });
  dias.forEach((iso) => {
    const data = deISO(iso);
    const doDia = naCaixa
      .map((med) => ({ med, unidades: horasDoMedicamento(med, iso).length * (Number(med.quantidadePorToma) || 0) }))
      .filter((x) => x.unidades > 0);
    if (!doDia.length) return;

    const todosPostos = doDia.every((x) => estado.preparacoes[iso]?.[x.med.id]);
    const cartao = el('section', {
      classe: `bloco${todosPostos ? ' bloco--concluido' : ''}`,
      dados: { periodo: iso === hojeISO() ? 'meio' : 'tarde' },
    });
    cartao.append(el('header', { classe: 'bloco__cabeca' }, [
      el('div', { classe: 'bloco__hora', style: 'font-size:1.1rem', texto: String(data.getDate()) }),
      el('div', { classe: 'bloco__identidade' }, [
        el('div', { classe: 'bloco__titulo', texto: DIAS_LONGOS[data.getDay()] }),
        el('div', { classe: 'bloco__sub', texto: iso === hojeISO() ? 'hoje' : '' }),
      ]),
      el('div', { classe: 'bloco__estado', texto: todosPostos ? '✓ Preparado' : `${doDia.length} por pôr` }),
    ]));

    const corpo = el('div', { classe: 'bloco__corpo' });
    doDia.forEach(({ med, unidades }) => {
      const posto = !!estado.preparacoes[iso]?.[med.id];
      corpo.append(el('div', { classe: `toma${posto ? ' toma--posta' : ''}` }, [
        el('button', {
          classe: 'toma__caixa', type: 'button', 'aria-pressed': String(posto),
          'aria-label': `${med.nome}, ${DIAS_LONGOS[data.getDay()]}: ${unidades} unidades`,
          ao: { click: () => { marcarPreparacao(iso, med.id, !posto); redesenhar(); } },
        }, posto ? [icone('visto', '1.4rem')] : []),
        el('div', { classe: 'toma__info' }, [
          el('div', { classe: 'toma__nome', texto: `${med.nome}${med.dosagem ? ' ' + med.dosagem : ''}` }),
          el('div', { classe: 'toma__dose',
            texto: `${unidades} ${rotuloForma(med.forma).toLowerCase()}${unidades > 1 ? 's' : ''} — ${descreverRegime(med)}` }),
        ]),
      ]));
    });
    cartao.append(corpo);
    porDias.append(cartao);
  });
  raiz.append(porDias);

  const tabela = el('table');
  const cabeca = el('tr', {}, [el('th', { texto: 'Medicamento' })]);
  dias.forEach((iso) => {
    const data = deISO(iso);
    cabeca.append(el('th', { scope: 'col' }, [
      el('div', { texto: DIAS_CURTOS[data.getDay()] }),
      el('div', { style: 'font-weight:400;font-size:.8em', texto: String(data.getDate()) }),
    ]));
  });
  tabela.append(el('thead', {}, [cabeca]));

  const corpo = el('tbody');
  naCaixa.forEach((med) => {
    const linha = el('tr', {}, [
      el('th', { scope: 'row' }, [
        el('div', { texto: `${med.nome}${med.dosagem ? ' ' + med.dosagem : ''}` }),
        el('div', { style: 'font-weight:400;font-size:.8em', texto: descreverRegime(med) }),
      ]),
    ]);
    dias.forEach((iso) => {
      const horas = horasDoMedicamento(med, iso);
      const total = horas.length * (Number(med.quantidadePorToma) || 0);
      if (!total) { linha.append(el('td', { texto: '—' })); return; }
      const preparado = !!estado.preparacoes[iso]?.[med.id];
      const botao = el('button', {
        type: 'button', classe: 'dia', style: 'width:100%;min-width:2.6rem',
        'aria-pressed': String(preparado),
        'aria-label': `${med.nome}, ${DIAS_LONGOS[deISO(iso).getDay()]}: ${total} unidades, ${preparado ? 'já na caixa' : 'por pôr'}`,
        ao: { click: () => { marcarPreparacao(iso, med.id, !preparado); redesenhar(); } },
      }, [preparado ? '✓' : String(total)]);
      linha.append(el('td', {}, [botao]));
    });
    corpo.append(linha);
  });
  tabela.append(corpo);
  raiz.append(el('div', { classe: 'grelha-caixa' }, [tabela]));

  raiz.append(el('p', { classe: 'campo__ajuda',
    texto: 'Toque em cada medicamento para o marcar como já colocado (✓).' }));

  raiz.append(el('div', { classe: 'sem-impressao', style: 'display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1rem' }, [
    el('button', { classe: 'btn btn--principal', type: 'button',
      ao: { click: () => window.print() } }, [icone('imprimir', '1.2rem'), 'Imprimir mapa']),
    el('button', { classe: 'btn btn--neutro', type: 'button',
      ao: { click: () => {
        dias.forEach((iso) => naCaixa.forEach((med) => {
          if (horasDoMedicamento(med, iso).length) marcarPreparacao(iso, med.id, true);
        }));
        avisar('Semana marcada como preparada.');
        redesenhar();
      } } }, [icone('visto', '1.2rem'), 'Marcar semana inteira']),
  ]));
}

/* =========================================================================
   ECRÃ 4 — HISTÓRICO
   ========================================================================= */

let periodoHistorico = 7;

export function vistaHistorico(raiz, redesenhar) {
  const fim = hojeISO();
  const inicio = somarDias(fim, -(periodoHistorico - 1));
  const resumo = adesaoNoPeriodo(inicio, fim);

  raiz.append(el('h1', { texto: 'Histórico' }));

  const selector = el('div', { classe: 'sem-impressao', style: 'display:flex;gap:.5rem;margin-bottom:1rem' },
    [7, 30, 90].map((dias) => el('button', {
      classe: `btn btn--pequeno ${periodoHistorico === dias ? 'btn--principal' : 'btn--neutro'}`,
      type: 'button', texto: `${dias} dias`,
      ao: { click: () => { periodoHistorico = dias; redesenhar(); } },
    })));
  raiz.append(selector);

  raiz.append(el('div', { classe: 'estatisticas', style: 'margin-bottom:1rem' }, [
    el('div', { classe: 'estatistica' }, [
      el('div', { classe: 'estatistica__valor', style: 'color:var(--ok)',
        texto: resumo.percentagem === null ? '—' : `${resumo.percentagem}%` }),
      el('div', { classe: 'estatistica__rotulo', texto: 'Tomadas a horas' }),
    ]),
    el('div', { classe: 'estatistica' }, [
      el('div', { classe: 'estatistica__valor', texto: String(resumo.tomadas) }),
      el('div', { classe: 'estatistica__rotulo', texto: 'Tomas feitas' }),
    ]),
    el('div', { classe: 'estatistica' }, [
      el('div', { classe: 'estatistica__valor', style: 'color:var(--erro)',
        texto: String(resumo.falhadas + resumo.saltadas) }),
      el('div', { classe: 'estatistica__rotulo', texto: 'Em falta' }),
    ]),
  ]));

  /* --- por medicamento -------------------------------------------------- */

  const porMedicamento = new Map();
  let iso = inicio;
  while (iso <= fim) {
    tomasDoDia(iso).forEach((toma) => {
      if (iso === fim && toma.minutos > minutosAgora()) return;
      const registo = porMedicamento.get(toma.med.id)
        || { med: toma.med, previstas: 0, tomadas: 0 };
      registo.previstas += 1;
      if (toma.estado === 'tomada') registo.tomadas += 1;
      porMedicamento.set(toma.med.id, registo);
    });
    iso = somarDias(iso, 1);
  }

  if (porMedicamento.size) {
    raiz.append(el('h2', { texto: 'Por medicamento' }));
    [...porMedicamento.values()]
      .sort((a, b) => (a.tomadas / a.previstas) - (b.tomadas / b.previstas))
      .forEach(({ med, previstas, tomadas }) => {
        const pct = previstas ? Math.round((tomadas / previstas) * 100) : 0;
        raiz.append(el('div', { classe: 'cartao' }, [
          el('div', { style: 'display:flex;justify-content:space-between;gap:.5rem;font-weight:700' }, [
            el('span', { texto: med.nome }),
            el('span', { texto: `${pct}%` }),
          ]),
          el('div', { classe: 'barra', style: 'margin:.4rem 0', role: 'img',
            'aria-label': `${med.nome}: ${tomadas} de ${previstas} tomas` },
            [el('div', { classe: 'barra__parte',
              style: `width:${pct}%;background:${pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--aviso)' : 'var(--erro)'}` })]),
          el('p', { classe: 'campo__ajuda', style: 'margin:0',
            texto: `${tomadas} de ${previstas} tomas registadas` }),
        ]));
      });
  } else {
    raiz.append(el('div', { classe: 'vazio' }, [icone('historico'),
      el('p', { texto: 'Ainda não há tomas registadas neste período.' })]));
  }

  /* --- partilhar com o médico -------------------------------------------- */

  raiz.append(el('div', { classe: 'cartao sem-impressao', style: 'margin-top:1.4rem' }, [
    el('h3', { texto: 'Levar à consulta' }),
    el('p', { texto: 'Uma folha com a lista de medicamentos e a adesão do período. '
      + 'Poupa tempo ao médico e evita esquecimentos.' }),
    el('div', { style: 'display:flex;gap:.6rem;flex-wrap:wrap' }, [
      el('button', { classe: 'btn btn--principal', type: 'button',
        ao: { click: () => abrirRelatorio(inicio, fim, resumo) } },
        [icone('imprimir', '1.2rem'), 'Ver folha para imprimir']),
      el('button', { classe: 'btn btn--neutro', type: 'button',
        ao: { click: () => descarregar(`a-horas-tomas-${inicio}-a-${fim}.csv`, gerarCSV(inicio, fim), 'text/csv;charset=utf-8') } },
        [icone('descarregar', '1.2rem'), 'Descarregar CSV']),
    ]),
  ]));
}

function gerarCSV(inicioISO, fimISO) {
  const linhas = [['Data', 'Hora prevista', 'Medicamento', 'Dosagem', 'Quantidade', 'Estado', 'Confirmado em']];
  let iso = inicioISO;
  while (iso <= fimISO) {
    tomasDoDia(iso).forEach((t) => {
      const registo = obterRegisto(iso, t.med.id, t.hora);
      linhas.push([iso, t.hora, t.med.nome, t.med.dosagem || '', t.med.quantidadePorToma,
        t.estado === 'pendente' ? 'não registada' : t.estado,
        registo?.hora ? new Date(registo.hora).toLocaleString('pt-PT') : '']);
    });
    iso = somarDias(iso, 1);
  }
  return '﻿' + linhas
    .map((linha) => linha.map((campo) => `"${String(campo).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
}

function abrirRelatorio(inicioISO, fimISO, resumo) {
  const corpo = el('div');
  corpo.append(
    el('h2', { texto: estado.config.nome ? `Medicação de ${estado.config.nome}` : 'A minha medicação' }),
    el('p', { texto: `Período: ${dataPorExtenso(inicioISO)} a ${dataPorExtenso(fimISO)}. `
      + `Adesão registada: ${resumo.percentagem === null ? '—' : resumo.percentagem + '%'} `
      + `(${resumo.tomadas} de ${resumo.previstas} tomas).` }),
  );

  const tabela = el('table', { style: 'width:100%;border-collapse:collapse;font-size:.85rem' });
  tabela.append(el('thead', {}, [el('tr', {}, ['Medicamento', 'Dose', 'Quando', 'Notas']
    .map((t) => el('th', { texto: t, style: 'text-align:left;border-bottom:2px solid var(--linha);padding:.4rem' })))]));
  const linhas = el('tbody');
  estado.medicamentos.filter((m) => m.activo).forEach((med) => {
    linhas.append(el('tr', {}, [
      `${med.nome}${med.dosagem ? ' ' + med.dosagem : ''}`,
      `${med.quantidadePorToma} ${rotuloForma(med.forma).toLowerCase()}`,
      descreverRegime(med),
      [instrucaoCurta(med.instrucoes), med.motivo].filter(Boolean).join(' · '),
    ].map((t) => el('td', { texto: t, style: 'border-bottom:1px solid var(--linha);padding:.4rem;vertical-align:top' }))));
  });
  tabela.append(linhas);
  corpo.append(tabela);
  corpo.append(el('p', { classe: 'campo__ajuda', style: 'margin-top:1rem',
    texto: 'Folha gerada pela aplicação A Horas a partir dos registos do próprio utilizador. '
         + 'Não substitui o processo clínico.' }));

  abrirModal({
    titulo: 'Folha para a consulta',
    corpo,
    accoes: [
      { rotulo: 'Fechar', classe: 'btn--neutro', aoClicar: (fechar) => fechar() },
      { rotulo: 'Imprimir', classe: 'btn--principal', aoClicar: () => window.print() },
    ],
  });
}

/* =========================================================================
   ECRÃ 5 — AJUSTES
   ========================================================================= */

function campoTexto({ id, rotulo, valor, ajuda, tipo = 'text', aoMudar, atributos = {} }) {
  const campo = el('input', { type: tipo, id, value: valor ?? '', ...atributos });
  campo.addEventListener('change', () => aoMudar(campo.value));
  return el('div', { classe: 'campo' }, [
    el('label', { for: id, texto: rotulo }), campo,
    ajuda ? el('p', { classe: 'campo__ajuda', texto: ajuda }) : null,
  ]);
}

function interruptor({ id, rotulo, nota, ligado, aoMudar }) {
  const caixa = el('input', { type: 'checkbox', id, checked: ligado });
  caixa.addEventListener('change', () => aoMudar(caixa.checked));
  return el('label', { classe: 'opcao' }, [caixa,
    el('span', { classe: 'opcao__texto' }, [rotulo, nota ? el('span', { classe: 'opcao__nota', texto: nota }) : null])]);
}

export function vistaAjustes(raiz, redesenhar, aplicarAspecto) {
  raiz.append(el('h1', { texto: 'Ajustes' }));

  /* --- pessoa ------------------------------------------------------------ */
  raiz.append(el('section', { classe: 'cartao' }, [
    el('h2', { texto: 'Quem toma os medicamentos' }),
    campoTexto({ id: 'a-nome', rotulo: 'Nome', valor: estado.config.nome,
      ajuda: 'Aparece na folha para a consulta.',
      aoMudar: (v) => { estado.config.nome = v.trim(); guardar(); } }),
  ]));

  /* --- horas das refeições ------------------------------------------------ */
  raiz.append(el('section', { classe: 'cartao' }, [
    el('h2', { texto: 'Horas das refeições' }),
    el('p', { classe: 'campo__ajuda',
      texto: 'Muitos medicamentos dependem das refeições. Acerte estas horas e todas as tomas '
           + 'ligadas a refeições ajustam-se sozinhas.' }),
    ...REFEICOES.map((refeicao) => campoTexto({
      id: `a-ref-${refeicao.id}`, rotulo: refeicao.rotulo, tipo: 'time',
      valor: estado.config.refeicoes[refeicao.id],
      aoMudar: (v) => { if (v) { estado.config.refeicoes[refeicao.id] = v; guardar(); redesenhar(); } },
    })),
  ]));

  /* --- lembretes ---------------------------------------------------------- */
  const permissao = avisos.estadoPermissao();
  const textoPermissao = {
    granted: '✓ Os avisos estão autorizados neste dispositivo.',
    denied: '✗ Os avisos foram bloqueados. Autorize nas definições do navegador para este site.',
    default: 'Ainda não autorizou os avisos.',
    indisponivel: 'Este navegador não suporta avisos do sistema.',
  }[permissao];

  raiz.append(el('section', { classe: 'cartao' }, [
    el('h2', { texto: 'Lembretes' }),
    el('p', { texto: textoPermissao }),
    permissao === 'default'
      ? el('button', { classe: 'btn btn--principal btn--largo', type: 'button', texto: 'Autorizar avisos',
          ao: { click: async () => { await avisos.pedirPermissao(); redesenhar(); } } })
      : null,
    el('div', { classe: 'opcoes', style: 'margin:.8rem 0' }, [
      interruptor({ id: 'a-som', rotulo: 'Tocar um som', ligado: estado.config.som,
        aoMudar: (v) => { estado.config.som = v; guardar(); } }),
      interruptor({ id: 'a-voz', rotulo: 'Dizer em voz alta', nota: 'Útil para quem vê mal.',
        ligado: estado.config.voz, aoMudar: (v) => { estado.config.voz = v; guardar(); } }),
    ]),
    campoTexto({ id: 'a-antecedencia', rotulo: 'Avisar quantos minutos antes', tipo: 'number',
      valor: String(estado.config.avisoAntecedenciaMin), atributos: { min: '0', max: '60', step: '5' },
      aoMudar: (v) => { estado.config.avisoAntecedenciaMin = Number(v) || 0; guardar(); } }),
    el('button', { classe: 'btn btn--neutro btn--largo', type: 'button',
      ao: { click: () => avisos.testarAviso() } }, [icone('relogio', '1.2rem'), 'Experimentar um aviso']),
    el('div', { classe: 'cartao cartao--aviso', style: 'margin:1rem 0 0' }, [
      el('strong', { texto: 'Importante: ' }),
      'com a aplicação fechada, um site não consegue tocar sozinho. '
      + 'Para alarmes garantidos, envie as tomas para o calendário do telemóvel — o botão está aqui abaixo.',
    ]),
    el('button', { classe: 'btn btn--principal btn--largo', type: 'button', style: 'margin-top:.8rem',
      ao: { click: () => {
        if (!estado.medicamentos.length) { avisar('Junte primeiro os medicamentos.'); return; }
        descarregar('a-horas-medicacao.ics', gerarICS({ dias: 180 }), 'text/calendar;charset=utf-8');
        avisar('Ficheiro criado. Abra-o para o juntar ao calendário.');
      } } }, [icone('descarregar', '1.2rem'), 'Enviar tomas para o calendário']),
  ]));

  /* --- organização --------------------------------------------------------- */
  raiz.append(el('section', { classe: 'cartao' }, [
    el('h2', { texto: 'Organização das tomas' }),
    campoTexto({ id: 'a-janela', rotulo: 'Juntar num só momento as tomas até (minutos)', tipo: 'number',
      valor: String(estado.config.janelaAgrupamentoMin), atributos: { min: '0', max: '60', step: '5' },
      ajuda: 'Com 20 minutos, tomas das 8:00 e das 8:15 aparecem como um único momento. '
           + 'É isto que transforma vinte avisos em cinco ou seis.',
      aoMudar: (v) => { estado.config.janelaAgrupamentoMin = Number(v) || 0; guardar(); redesenhar(); } }),
    campoTexto({ id: 'a-tolerancia', rotulo: 'Considerar em atraso depois de (minutos)', tipo: 'number',
      valor: String(estado.config.toleranciaAtrasoMin), atributos: { min: '15', max: '240', step: '15' },
      aoMudar: (v) => { estado.config.toleranciaAtrasoMin = Number(v) || 60; guardar(); redesenhar(); } }),
    campoTexto({ id: 'a-stock', rotulo: 'Avisar que o medicamento acaba dentro de (dias)', tipo: 'number',
      valor: String(estado.config.avisoStockDias), atributos: { min: '1', max: '60', step: '1' },
      aoMudar: (v) => { estado.config.avisoStockDias = Number(v) || 7; guardar(); redesenhar(); } }),
  ]));

  /* --- ver e ouvir --------------------------------------------------------- */
  const escolhaTamanho = el('select', { id: 'a-tamanho' }, [
    { v: 'normal', t: 'Normal' }, { v: 'grande', t: 'Grande (recomendado)' }, { v: 'enorme', t: 'Muito grande' },
  ].map((o) => el('option', { value: o.v, texto: o.t, selected: estado.config.tamanhoLetra === o.v })));
  escolhaTamanho.addEventListener('change', () => {
    estado.config.tamanhoLetra = escolhaTamanho.value; guardar(); aplicarAspecto();
  });

  raiz.append(el('section', { classe: 'cartao' }, [
    el('h2', { texto: 'Ver melhor' }),
    el('div', { classe: 'campo' }, [el('label', { for: 'a-tamanho', texto: 'Tamanho da letra' }), escolhaTamanho]),
    el('div', { classe: 'opcoes' }, [
      interruptor({ id: 'a-contraste', rotulo: 'Contraste alto',
        nota: 'Fundo preto com letras amarelas, para quem vê mal.',
        ligado: estado.config.contraste === 'alto',
        aoMudar: (v) => { estado.config.contraste = v ? 'alto' : 'normal'; guardar(); aplicarAspecto(); } }),
    ]),
  ]));

  /* --- cuidador ------------------------------------------------------------ */
  raiz.append(el('section', { classe: 'cartao' }, [
    el('h2', { texto: 'Quem ajuda' }),
    el('p', { classe: 'campo__ajuda',
      texto: 'Guardado só neste dispositivo, para estar à mão numa emergência.' }),
    campoTexto({ id: 'a-cuid-nome', rotulo: 'Nome', valor: estado.config.cuidador.nome,
      aoMudar: (v) => { estado.config.cuidador.nome = v.trim(); guardar(); redesenhar(); } }),
    campoTexto({ id: 'a-cuid-tel', rotulo: 'Telefone', tipo: 'tel', valor: estado.config.cuidador.telefone,
      aoMudar: (v) => { estado.config.cuidador.telefone = v.trim(); guardar(); redesenhar(); } }),
    estado.config.cuidador.telefone
      ? el('a', { classe: 'btn btn--principal btn--largo',
          href: `tel:${estado.config.cuidador.telefone.replace(/\s/g, '')}`,
          texto: `Telefonar a ${estado.config.cuidador.nome || 'quem ajuda'}` })
      : null,
  ]));

  /* --- cópia de segurança --------------------------------------------------- */
  const ficheiro = el('input', { type: 'file', accept: '.json,application/json', classe: 'oculto', id: 'a-ficheiro' });
  ficheiro.addEventListener('change', async () => {
    const escolhido = ficheiro.files?.[0];
    if (!escolhido) return;
    try {
      importar(JSON.parse(await escolhido.text()));
      avisar('Dados repostos com sucesso.');
      aplicarAspecto();
      redesenhar();
    } catch (erro) {
      avisar(erro.message || 'Não foi possível ler o ficheiro.');
    } finally { ficheiro.value = ''; }
  });

  raiz.append(el('section', { classe: 'cartao' }, [
    el('h2', { texto: 'Cópia de segurança' }),
    el('p', { classe: 'campo__ajuda',
      texto: 'Os dados ficam só neste dispositivo. Guarde uma cópia de vez em quando — '
           + 'e antes de mudar de telemóvel.' }),
    el('div', { style: 'display:flex;gap:.6rem;flex-wrap:wrap' }, [
      el('button', { classe: 'btn btn--principal', type: 'button',
        ao: { click: () => {
          descarregar(`a-horas-copia-${hojeISO()}.json`, JSON.stringify(exportar(), null, 2), 'application/json');
        } } }, [icone('descarregar', '1.2rem'), 'Guardar cópia']),
      el('button', { classe: 'btn btn--neutro', type: 'button', texto: 'Repor de uma cópia',
        ao: { click: () => ficheiro.click() } }),
    ]),
    ficheiro,
  ]));

  /* --- apagar --------------------------------------------------------------- */
  raiz.append(el('section', { classe: 'cartao' }, [
    el('h2', { texto: 'Apagar tudo' }),
    el('p', { classe: 'campo__ajuda', texto: 'Remove medicamentos, registos e definições deste dispositivo.' }),
    el('button', { classe: 'btn btn--perigo btn--largo', type: 'button',
      ao: { click: async () => {
        const certeza = await confirmar({
          titulo: 'Apagar todos os dados',
          mensagem: 'Esta operação não tem volta. Guardou uma cópia de segurança?',
          rotuloConfirmar: 'Apagar tudo', perigo: true,
        });
        if (!certeza) return;
        apagarTudo();
        aplicarAspecto();
        redesenhar();
        avisar('Dados apagados.');
      } } }, [icone('caixote', '1.2rem'), 'Apagar todos os dados']),
  ]));

  /* --- sobre ---------------------------------------------------------------- */
  raiz.append(el('section', { classe: 'cartao' }, [
    el('h2', { texto: 'Sobre A Horas' }),
    el('p', { texto: 'A Horas é um auxiliar de organização. Não dá conselhos médicos, '
      + 'não altera doses e não substitui o médico nem o farmacêutico.' }),
    el('p', { texto: 'Nunca mude, junte ou pare um medicamento por causa do que a aplicação mostra. '
      + 'Em caso de dúvida, fale com quem o segue.' }),
    el('p', { classe: 'campo__ajuda',
      texto: 'Os dados nunca saem deste dispositivo: não há contas, servidores nem seguimento.' }),
  ]));
}
