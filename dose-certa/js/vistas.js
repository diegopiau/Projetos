/* ==========================================================================
   vistas.js — os cinco ecrãs da aplicação
   ========================================================================== */

import {
  estado, guardar, marcarToma, marcarPreparacao, obterRegisto,
  importar, exportar, apagarTudo,
  DIAS_CURTOS, DIAS_LONGOS, REFEICOES, MESES_CURTOS,
  hojeISO, somarDias, dataPorExtenso, deISO, paraISO, minutosAgora,
} from './dados.js';
import {
  blocosDoDia, tomasDoDia, situacaoDoBloco, avisosDoBloco, descreverRegime,
  rotuloForma, instrucaoCurta, horasDoMedicamento, diasDeStock, alertasDeStock,
  adesaoNoPeriodo, gerarICS, sugestoesDeSimplificacao, aplicarSimplificacao,
} from './horarios.js';
import * as auth from './auth.js';
import * as push from './push-cliente.js';
import { el, icone, avisar, abrirModal, confirmar, descarregar, imprimirApenas } from './ui.js';
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

  const foto = toma.med.foto
    ? el('img', {
        src: toma.med.foto, alt: '',
        classe: 'toma__foto',
        style: 'width:48px;height:48px;object-fit:contain;border:1px solid var(--linha);border-radius:8px;background:#fff;flex-shrink:0',
      })
    : null;

  return el('div', {
    classe: `toma${feita ? ' toma--feita' : ''}${saltada ? ' toma--saltada' : ''}`,
  }, [caixa, foto, info].filter(Boolean));
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

  // Preenchido depois do diagnóstico, para não oferecer «autorizar» onde isso
  // nunca poderia resultar — por exemplo com a aplicação aberta do disco.
  const zonaAvisos = el('div', { classe: 'sem-impressao' });
  cartoes.push(zonaAvisos);
  avisos.diagnostico().then((d) => {
    zonaAvisos.replaceChildren();
    if (d.podeAvisar) return;
    zonaAvisos.append(el('div', { classe: 'cartao cartao--aviso' }, [
      el('h3', { texto: `🔔 ${d.titulo}` }),
      el('p', { texto: d.explicacao }),
      d.accao === 'autorizar'
        ? el('button', { classe: 'btn btn--principal btn--largo', type: 'button',
            texto: 'Autorizar avisos',
            ao: { click: async () => { await avisos.pedirPermissao(); redesenhar(); } } })
        : el('p', { classe: 'campo__ajuda', style: 'margin:0',
            texto: 'Em Ajustes encontra a alternativa: pôr as tomas no calendário do telemóvel.' }),
    ]));
  });

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
          med.foto ? el('img', {
            src: med.foto, alt: `Foto de ${med.nome}`,
            style: 'width:56px;height:56px;object-fit:contain;border-radius:8px;border:1px solid var(--linha);background:#fff;flex-shrink:0',
          }) : null,
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
        MESES_CURTOS[deISO(dias[6]).getMonth()]}` }),
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
        ao: { click: () => descarregar(`dose-certa-tomas-${inicio}-a-${fim}.csv`, gerarCSV(inicio, fim), 'text/csv;charset=utf-8') } },
        [icone('descarregar', '1.2rem'), 'Descarregar CSV']),
    ]),
    el('div', { style: 'margin-top:1rem;padding-top:1rem;border-top:1px dashed var(--linha)' }, [
      el('h3', { style: 'margin:0 0 .3rem', texto: 'Tabela completa com fotos' }),
      el('p', { classe: 'campo__ajuda', style: 'margin:0 0 .6rem',
        texto: 'Lista de todos os medicamentos com foto, posologia e notas.' }),
      renderTabelaInlineComAcoes(),
    ]),
  ]));
}

/**
 * Devolve um bloco expansível com a tabela dos medicamentos renderizada
 * inline (sem modal, sem popup) + botões de imprimir e baixar HTML.
 * Abordagem "à prova de bala": zero dependência de window.open, dialog
 * ou service workers — só DOM directo.
 */
/** Padrão de frequência em 1-3 palavras, sem repetir as horas (que já vão
 *  na coluna Horas). Mostra "Diário", "SOS", "Cada 8h", "Às refeições", etc. */
function descreverFrequencia(med) {
  const r = med.regime || {};
  switch (r.tipo) {
    case 'intervalo': return `A cada ${r.intervaloHoras}h`;
    case 'refeicoes': return 'Às refeições';
    case 'semanal': {
      const dias = (r.diasSemana || []).length;
      return dias === 7 ? 'Diário' : `${dias} dia(s) por semana`;
    }
    case 'ciclo': return `De ${r.cadaNDias} em ${r.cadaNDias} dias`;
    case 'sos': return 'Só se necessário (SOS)';
    default: {
      const n = (r.horas || []).length;
      if (n === 0) return 'Diário';
      if (n === 1) return '1 vez/dia';
      return `${n} vezes/dia`;
    }
  }
}

function renderTabelaInlineComAcoes() {
  const meds = (estado.medicamentos || []).slice()
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));

  const zonaTabela = el('div', { id: 'zona-tabela-meds', style: 'display:none;margin-top:.8rem;padding:.8rem;background:#fff;border:1px solid var(--linha);border-radius:8px' });
  const btnMostrar = el('button', { classe: 'btn btn--principal btn--largo', type: 'button' },
    [icone('imprimir', '1.2rem'), 'Ver tabela aqui na página']);

  btnMostrar.addEventListener('click', () => {
    if (zonaTabela.style.display !== 'none') {
      zonaTabela.style.display = 'none';
      btnMostrar.innerHTML = ''; btnMostrar.append(icone('imprimir', '1.2rem'), document.createTextNode(' Ver tabela aqui na página'));
      return;
    }
    // Constrói a tabela na hora
    zonaTabela.innerHTML = '';
    const abrirEmNovaAba = () => {
      const blob = new Blob([gerarTabelaHTML()], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    };
    const barra = el('div', { classe: 'sem-impressao', style: 'display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.7rem' }, [
      el('button', { classe: 'btn btn--principal', type: 'button',
        ao: { click: () => imprimirApenas(zonaTabela) } },
        [icone('imprimir', '1.1rem'), 'Imprimir / PDF']),
      el('button', { classe: 'btn btn--neutro', type: 'button',
        ao: { click: abrirEmNovaAba } }, [icone('descarregar', '1.1rem'), 'Abrir em nova aba']),
      el('button', { classe: 'btn btn--neutro', type: 'button',
        ao: { click: () => { zonaTabela.style.display = 'none'; btnMostrar.innerHTML = ''; btnMostrar.append(icone('imprimir', '1.2rem'), document.createTextNode(' Ver tabela aqui na página')); } } },
        ['Fechar']),
    ]);
    zonaTabela.append(barra);

    if (meds.length === 0) {
      zonaTabela.append(el('p', { texto: 'Ainda não há medicamentos guardados.' }));
    } else {
      const wrapper = el('div', { style: 'overflow-x:auto;-webkit-overflow-scrolling:touch' });
      const tabela = el('table', { classe: 'tabela-meds-print', style: 'width:100%;border-collapse:collapse;font-size:.85rem;background:#fff' });
      const cols = ['Foto', 'Nome', 'Forma', 'Qt.', 'Frequência', 'Horas', 'Refeição', 'Para que serve', 'Notas'];
      tabela.append(el('thead', {}, [el('tr', {}, cols.map((t) =>
        el('th', { texto: t, style: 'text-align:left;border-bottom:2px solid var(--linha);padding:.4rem;background:#f0f4f8' })
      ))]));
      const tbody = el('tbody');
      meds.forEach((med) => {
        const horas = horasDoMedicamento(med, hojeISO());
        const horasStr = med.regime?.tipo === 'sos' ? 'SOS' : (horas.length ? horas.join(', ') : '—');
        const foto = med.foto
          ? el('img', { src: med.foto, alt: '', style: 'width:56px;height:56px;object-fit:contain;border:1px solid #ccc;border-radius:6px;background:#fff' })
          : el('span', { texto: '—', style: 'color:#888' });
        const nomeCell = el('td', { style: 'border-bottom:1px solid var(--linha);padding:.4rem;vertical-align:top' }, [
          el('strong', { texto: med.nome }),
          med.dosagem ? el('span', { style: 'color:#555', texto: ` (${med.dosagem})` }) : null,
        ]);
        tbody.append(el('tr', {}, [
          el('td', { style: 'text-align:center;border-bottom:1px solid var(--linha);padding:.4rem;vertical-align:top' }, [foto]),
          nomeCell,
          el('td', { texto: rotuloForma(med.forma), style: 'border-bottom:1px solid var(--linha);padding:.4rem;vertical-align:top' }),
          el('td', { texto: String(med.quantidadePorToma || 1), style: 'text-align:center;border-bottom:1px solid var(--linha);padding:.4rem;vertical-align:top' }),
          el('td', { texto: descreverFrequencia(med), style: 'border-bottom:1px solid var(--linha);padding:.4rem;vertical-align:top' }),
          el('td', { texto: horasStr, style: 'border-bottom:1px solid var(--linha);padding:.4rem;vertical-align:top' }),
          el('td', { texto: instrucaoCurta(med.instrucoes) || '—', style: 'border-bottom:1px solid var(--linha);padding:.4rem;vertical-align:top' }),
          el('td', { texto: med.motivo || '', style: 'border-bottom:1px solid var(--linha);padding:.4rem;vertical-align:top' }),
          el('td', { texto: med.notas || '', style: 'border-bottom:1px solid var(--linha);padding:.4rem;vertical-align:top;font-size:.8rem' }),
        ]));
      });
      tabela.append(tbody);
      wrapper.append(tabela);
      zonaTabela.append(wrapper);
    }

    zonaTabela.style.display = 'block';
    btnMostrar.innerHTML = ''; btnMostrar.append(icone('cruz', '1.2rem'), document.createTextNode(' Esconder tabela'));
    // Scroll para a tabela
    setTimeout(() => zonaTabela.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  });

  const bloco = el('div');
  bloco.append(btnMostrar, zonaTabela);
  return bloco;
}

/**
 * Mostra a tabela dos medicamentos numa janela modal (usa o mesmo padrão
 * de abrirRelatorio que é comprovado funcionar em todos os browsers).
 * A impressão usa o diálogo nativo do sistema — no diálogo é sempre
 * possível escolher "Guardar como PDF". A Baixar HTML gera um ficheiro
 * standalone com estilos completos.
 */
function abrirTabelaHTMLNovaJanela() {
  const meds = (estado.medicamentos || []).slice()
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));

  const corpo = el('div');
  corpo.append(
    el('h2', { texto: estado.config.nome ? `Medicamentos de ${estado.config.nome}` : 'Os meus medicamentos' }),
    el('p', { classe: 'campo__ajuda', texto: `${meds.length} medicamento(s) · Exportado em ${new Date().toLocaleString('pt-PT')}` }),
  );

  if (meds.length === 0) {
    corpo.append(el('p', { texto: 'Ainda não há medicamentos guardados.' }));
  } else {
    const tabela = el('table', { style: 'width:100%;border-collapse:collapse;font-size:.85rem;margin-top:.6rem' });
    const cols = ['Foto', 'Nome', 'Forma', 'Qt.', 'Posologia', 'Horas', 'Refeição', 'Para que serve', 'Notas'];
    tabela.append(el('thead', {}, [el('tr', {}, cols.map((t) =>
      el('th', { texto: t, style: 'text-align:left;border-bottom:2px solid var(--linha);padding:.4rem;background:#f0f4f8' })
    ))]));
    const tbody = el('tbody');
    meds.forEach((med) => {
      const horas = horasDoMedicamento(med);
      const horasStr = med.regime?.tipo === 'sos' ? 'SOS' : (horas.length ? horas.join(', ') : '—');
      const foto = med.foto
        ? el('img', { src: med.foto, alt: '', style: 'width:56px;height:56px;object-fit:contain;border:1px solid #ccc;border-radius:6px;background:#fff' })
        : el('span', { texto: '—', style: 'color:#888' });
      const nome = el('span', {}, [
        el('strong', { texto: med.nome }),
        med.dosagem ? el('span', { style: 'color:#555', texto: ` (${med.dosagem})` }) : null,
      ]);
      tbody.append(el('tr', {}, [
        el('td', { style: 'text-align:center;border-bottom:1px solid var(--linha);padding:.4rem;vertical-align:top' }, [foto]),
        el('td', { style: 'border-bottom:1px solid var(--linha);padding:.4rem;vertical-align:top' }, [nome]),
        el('td', { texto: rotuloForma(med.forma), style: 'border-bottom:1px solid var(--linha);padding:.4rem;vertical-align:top' }),
        el('td', { texto: String(med.quantidadePorToma || 1), style: 'text-align:center;border-bottom:1px solid var(--linha);padding:.4rem;vertical-align:top' }),
        el('td', { texto: descreverRegime(med.regime), style: 'border-bottom:1px solid var(--linha);padding:.4rem;vertical-align:top' }),
        el('td', { texto: horasStr, style: 'border-bottom:1px solid var(--linha);padding:.4rem;vertical-align:top' }),
        el('td', { texto: instrucaoCurta(med.instrucoes) || '—', style: 'border-bottom:1px solid var(--linha);padding:.4rem;vertical-align:top' }),
        el('td', { texto: med.motivo || '', style: 'border-bottom:1px solid var(--linha);padding:.4rem;vertical-align:top' }),
        el('td', { texto: med.notas || '', style: 'border-bottom:1px solid var(--linha);padding:.4rem;vertical-align:top;font-size:.8rem' }),
      ]));
    });
    tabela.append(tbody);
    // Wrapper com scroll horizontal quando a tabela não cabe no ecrã (mobile)
    corpo.append(el('div', { style: 'overflow-x:auto;-webkit-overflow-scrolling:touch' }, [tabela]));
  }

  abrirModal({
    titulo: 'Tabela de medicamentos',
    corpo,
    accoes: [
      { rotulo: 'Fechar', classe: 'btn--neutro', aoClicar: (fechar) => fechar() },
      { rotulo: '⬇ Baixar HTML', classe: 'btn--neutro', aoClicar: () =>
          descarregar(`dose-certa-medicamentos-${hojeISO()}.html`, gerarTabelaHTML(), 'text/html;charset=utf-8') },
      { rotulo: '🖨️ Imprimir / PDF', classe: 'btn--principal', aoClicar: () => window.print() },
    ],
  });
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
    texto: 'Folha gerada pela aplicação Dose Certa a partir dos registos do próprio utilizador. '
         + 'Não substitui o processo clínico.' }));

  abrirModal({
    titulo: 'Folha para a consulta',
    corpo,
    accoes: [
      { rotulo: 'Fechar', classe: 'btn--neutro', aoClicar: (fechar) => fechar() },
      { rotulo: 'Imprimir', classe: 'btn--principal', aoClicar: () => imprimirApenas(corpo) },
    ],
  });
}

/* -------------------------------------------------------------------------
   Guia do calendário — um ficheiro .ics não ajuda ninguém sem instruções
   ------------------------------------------------------------------------- */

const PASSOS_CALENDARIO = [
  { id: 'android', rotulo: '📱 Android', passos: [
    'O ficheiro fica em Transferências, com o nome dose-certa-medicacao.ics.',
    'Abra a aplicação Ficheiros (ou Transferências) e toque no ficheiro.',
    'Escolha abrir com o Google Calendar ou Calendário.',
    'Confirme em «Importar» e escolha o calendário onde quer guardar as tomas.',
    'Se o telemóvel não souber abrir o ficheiro: envie-o para si por e-mail e abra o anexo no telemóvel.',
  ] },
  { id: 'iphone', rotulo: '📱 iPhone ou iPad', passos: [
    'O ficheiro fica em Transferências, na aplicação Ficheiros.',
    'Toque no ficheiro dose-certa-medicacao.ics.',
    'Toque em «Adicionar tudo» quando o iPhone perguntar.',
    'Escolha o calendário onde quer guardar as tomas.',
  ] },
  { id: 'computador', rotulo: '💻 Computador', passos: [
    'Google Calendar: abra calendar.google.com, clique na roda dentada, '
      + '«Definições», depois «Importar e exportar», escolha o ficheiro e clique em «Importar».',
    'Outlook: menu «Ficheiro», «Abrir e Exportar», «Importar/Exportar», '
      + '«Importar um ficheiro iCalendar (.ics)».',
    'No Mac, basta fazer duplo clique no ficheiro e confirmar no Calendário.',
  ] },
];

function abrirGuiaCalendario() {
  const corpo = el('div');
  corpo.append(
    el('p', { style: 'font-size:1.02rem',
      texto: 'Acabou de descarregar um ficheiro com todas as suas tomas. Ao juntá-lo ao '
           + 'calendário do telemóvel, os alarmes passam a ser do próprio telemóvel: tocam '
           + 'mesmo com esta aplicação fechada.' }),
  );

  PASSOS_CALENDARIO.forEach((plataforma) => {
    corpo.append(el('section', { classe: 'cartao', style: 'margin-bottom:.8rem' }, [
      el('h3', { texto: plataforma.rotulo }),
      el('ol', { style: 'padding-left:1.2rem;margin:0;line-height:1.6' },
        plataforma.passos.map((passo) => el('li', { texto: passo, style: 'margin-bottom:.4rem' }))),
    ]));
  });

  corpo.append(el('div', { classe: 'cartao cartao--aviso', style: 'margin:0' }, [
    el('strong', { texto: 'Quando a medicação mudar: ' }),
    'apague estes eventos do calendário e volte a exportar. Caso contrário ficam a '
    + 'tocar horas que já não são as suas.',
  ]));

  abrirModal({
    titulo: 'Como pôr as tomas no calendário',
    corpo,
    accoes: [{ rotulo: 'Percebi', classe: 'btn--principal', largo: true, aoClicar: (fechar) => fechar() }],
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
  // O diagnóstico é assíncrono: o cartão aparece já e preenche-se a seguir.
  const zonaDiagnostico = el('div', { 'aria-live': 'polite' },
    [el('p', { classe: 'campo__ajuda', texto: 'A verificar os avisos…' })]);

  avisos.diagnostico().then((d) => {
    zonaDiagnostico.replaceChildren();
    zonaDiagnostico.append(
      el('div', { classe: `cartao ${d.podeAvisar ? 'cartao--ok' : 'cartao--aviso'}`, style: 'margin:0 0 .8rem' }, [
        el('h3', { texto: `${d.podeAvisar ? '✓' : '⚠'} ${d.titulo}` }),
        el('p', { style: 'margin:0', texto: d.explicacao }),
      ]),
    );
    if (d.accao === 'autorizar') {
      zonaDiagnostico.append(el('button', {
        classe: 'btn btn--principal btn--largo', type: 'button', texto: 'Autorizar avisos',
        ao: { click: async () => { await avisos.pedirPermissao(); redesenhar(); } },
      }));
    }
    if (d.accao === 'testar') {
      zonaDiagnostico.append(el('button', {
        classe: 'btn btn--neutro btn--largo', type: 'button',
        ao: { click: async () => {
          const r = await avisos.testarAviso();
          avisar(r.notificou
            ? 'Aviso enviado. Se não o viu, verifique as notificações nas definições do telemóvel.'
            : 'Não foi possível mostrar o aviso neste dispositivo. Use o calendário, aqui abaixo.');
        } },
      }, [icone('relogio', '1.2rem'), 'Experimentar um aviso']));
    }
  });

  raiz.append(el('section', { classe: 'cartao' }, [
    el('h2', { texto: 'Lembretes' }),
    zonaDiagnostico,
    el('div', { classe: 'opcoes', style: 'margin:.8rem 0' }, [
      interruptor({ id: 'a-som', rotulo: 'Tocar um som', ligado: estado.config.som,
        aoMudar: (v) => { estado.config.som = v; guardar(); } }),
      interruptor({ id: 'a-voz', rotulo: 'Dizer em voz alta',
        nota: 'Só funciona com a app aberta e visível. Quando a Dose Certa está fechada, as notificações push do sistema (silenciosas ou com o som do telemóvel) tomam o lugar.',
        ligado: estado.config.voz, aoMudar: (v) => {
          estado.config.voz = v; guardar();
          if (v) {
            // "Warm up" da voz — no iPhone/Android, speechSynthesis precisa
            // dum gesto do utilizador antes de conseguir falar pela 1ª vez.
            // Fazer isto aqui garante que quando chegar a hora da toma a voz
            // arranca sem falhar (enquanto a app estiver aberta).
            try { window.speechSynthesis?.speak(new SpeechSynthesisUtterance('Voz activada.')); } catch { /* */ }
          }
        } }),
    ]),
    campoTexto({ id: 'a-antecedencia', rotulo: 'Avisar quantos minutos antes', tipo: 'number',
      valor: String(estado.config.avisoAntecedenciaMin), atributos: { min: '0', max: '60', step: '5' },
      aoMudar: (v) => { estado.config.avisoAntecedenciaMin = Number(v) || 0; guardar(); } }),
    el('div', { classe: 'cartao', style: 'margin:1rem 0 0' }, [
      el('h3', { texto: '⏰ Alarmes com a app fechada' }),
      el('p', { classe: 'campo__ajuda', style: 'margin:.2rem 0 .6rem',
        texto: 'Envie as tomas para o calendário do telemóvel — os alarmes passam a ser do sistema.' }),
      el('button', { classe: 'btn btn--principal btn--largo', type: 'button',
        ao: { click: () => {
          if (!estado.medicamentos.length) { avisar('Junte primeiro os medicamentos.'); return; }
          descarregar('dose-certa-medicacao.ics', gerarICS({ dias: 180 }), 'text/calendar;charset=utf-8');
          abrirGuiaCalendario();
        } } }, [icone('descarregar', '1.2rem'), 'Enviar tomas para o calendário']),
    ]),
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
    el('p', { classe: 'campo__ajuda', style: 'margin-top:-.2rem',
      texto: 'Guarde antes de mudar de dispositivo.' }),
    el('div', { style: 'display:flex;gap:.6rem;flex-wrap:wrap' }, [
      el('button', { classe: 'btn btn--principal', type: 'button',
        ao: { click: () => {
          descarregar(`dose-certa-copia-${hojeISO()}.json`, JSON.stringify(exportar(), null, 2), 'application/json');
        } } }, [icone('descarregar', '1.2rem'), 'Guardar cópia (JSON)']),
      el('button', { classe: 'btn btn--neutro', type: 'button', texto: 'Repor de uma cópia',
        ao: { click: () => ficheiro.click() } }),
    ]),
    ficheiro,
  ]));

  /* --- push notifications (só se autenticado) ------------------------------- */
  if (auth.emailAutenticado()) {
    const cartaoPush = el('section', { classe: 'cartao' }, [
      el('h2', { texto: 'Notificações push' }),
      el('p', { classe: 'campo__ajuda', style: 'margin-top:-.2rem',
        texto: 'Alertas do sistema mesmo com a app fechada. Activar em cada dispositivo.' }),
    ]);
    const zonaPlataforma = el('div');
    const rodape = el('div', { style: 'display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.6rem' });
    const estadoLinha = el('p', { style: 'margin:.5rem 0;font-size:.9rem;font-weight:600' });
    cartaoPush.append(zonaPlataforma, estadoLinha, rodape);

    // Instruções por plataforma (colapsáveis, sempre disponíveis) ----------
    const detalhes = el('details', { style: 'margin-top:.8rem;font-size:.85rem;color:var(--texto-suave)' }, [
      el('summary', { style: 'cursor:pointer;font-weight:600;color:var(--texto)' }, ['Como activar em cada dispositivo →']),
      el('div', { style: 'margin-top:.7rem;display:grid;gap:.9rem' }, [
        el('div', {}, [
          el('strong', { texto: '🍏 iPhone / iPad (Safari)' }),
          el('ol', { style: 'margin:.3rem 0 0 1.2rem;padding:0;line-height:1.55' }, [
            el('li', { texto: 'Toque no botão Partilhar (o quadrado com a seta a subir) na barra do Safari.' }),
            el('li', { texto: 'Escolha "Adicionar ao ecrã principal".' }),
            el('li', { texto: 'Feche o Safari. Abra a Dose Certa pelo ícone que ficou no ecrã principal.' }),
            el('li', { texto: 'Entre com a sua conta (magic link no email) e volte a esta página.' }),
            el('li', { texto: 'Toque em "Activar notificações neste dispositivo".' }),
          ]),
          el('p', { style: 'margin:.35rem 0 0;font-size:.8rem' }, ['Requer iOS 16.4 ou superior. Antes disso, o iPhone não suporta push em nenhuma app web — nenhuma. Não é limitação nossa.']),
        ]),
        el('div', {}, [
          el('strong', { texto: '🤖 Android (Chrome, Edge, Firefox, Samsung Internet)' }),
          el('ol', { style: 'margin:.3rem 0 0 1.2rem;padding:0;line-height:1.55' }, [
            el('li', { texto: 'Funciona logo — sem instalação obrigatória. Toque em "Activar notificações neste dispositivo".' }),
            el('li', { texto: 'Toque "Permitir" quando o Android pedir autorização.' }),
            el('li', { texto: 'Recomendado: menu (⋮) → "Adicionar ao ecrã principal" ou "Instalar app". Assim a Dose Certa comporta-se como app nativa e as notificações passam a aparecer no centro de notificações do sistema como uma app instalada.' }),
          ]),
        ]),
        el('div', {}, [
          el('strong', { texto: '💻 Computador (Chrome, Edge, Firefox, Opera)' }),
          el('ol', { style: 'margin:.3rem 0 0 1.2rem;padding:0;line-height:1.55' }, [
            el('li', { texto: 'Toque em "Activar notificações neste dispositivo".' }),
            el('li', { texto: 'Autorize quando o browser pedir.' }),
            el('li', { texto: 'As notificações aparecem no canto do ecrã (Windows: canto inferior direito, Mac: canto superior direito).' }),
          ]),
          el('p', { style: 'margin:.35rem 0 0;font-size:.8rem' }, ['Safari no Mac também funciona (versão 16+), sem precisar instalar.']),
        ]),
      ]),
    ]);
    cartaoPush.append(detalhes);

    async function refrescarPush() {
      const plat = push.detectarPlataforma();
      const st = await push.estadoPush();
      zonaPlataforma.innerHTML = '';
      rodape.innerHTML = '';

      // Estados de bloqueio — instruções específicas -----------------------
      if (st === 'ios-precisa-pwa') {
        estadoLinha.textContent = '📲 Passo em falta: instalar a Dose Certa no ecrã principal.';
        estadoLinha.style.color = 'var(--marca)';
        zonaPlataforma.append(el('div', { style: 'background:var(--marca-clara,#e6f4fa);border-radius:8px;padding:.7rem .9rem;font-size:.9rem;line-height:1.5;margin-top:.4rem' }, [
          el('strong', { texto: 'iPhone / iPad — para receber notificações precisa de:' }),
          el('ol', { style: 'margin:.4rem 0 0 1.2rem;padding:0' }, [
            el('li', {}, ['Tocar no botão ', el('strong', { texto: 'Partilhar' }), ' na barra do Safari (quadrado com seta a subir).']),
            el('li', {}, ['Escolher ', el('strong', { texto: '"Adicionar ao ecrã principal"' }), '.']),
            el('li', {}, ['Abrir a Dose Certa pelo ícone que ficou no ecrã (', el('em', { texto: 'não' }), ' pelo Safari).']),
            el('li', { texto: 'Voltar a esta página e activar as notificações.' }),
          ]),
        ]));
        return;
      }
      if (st === 'nao-suportado') {
        estadoLinha.textContent = '⚠ Este navegador não suporta notificações push.';
        estadoLinha.style.color = 'var(--erro,#b91c1c)';
        return;
      }
      if (st === 'sem-sw') {
        estadoLinha.textContent = '⚠ A aplicação ainda não está totalmente carregada. Recarregue a página.';
        estadoLinha.style.color = 'var(--erro,#b91c1c)';
        return;
      }
      if (st === 'sem-permissao') {
        estadoLinha.textContent = '🚫 Notificações bloqueadas para este site.';
        estadoLinha.style.color = 'var(--erro,#b91c1c)';
        zonaPlataforma.append(el('div', { style: 'background:#fef3c7;border-radius:8px;padding:.7rem .9rem;font-size:.85rem;line-height:1.5;margin-top:.4rem;color:#7c2d12' }, [
          el('strong', { texto: 'Como desbloquear:' }),
          el('p', { style: 'margin:.3rem 0 0' }, [
            plat.iOS
              ? 'iPhone: Definições → Notificações → Dose Certa → Permitir notificações.'
              : (plat.android
                ? 'Android: toque no cadeado ao lado do endereço → Permissões → Notificações → Permitir.'
                : 'Desktop: cadeado ao lado do endereço → Notificações → Permitir. Recarregue depois.'),
          ]),
        ]));
        return;
      }

      // Subscrito -----------------------------------------------------------
      if (st === 'subscrito') {
        estadoLinha.textContent = '✓ Notificações activas neste dispositivo.';
        estadoLinha.style.color = 'var(--sucesso,#047857)';
        rodape.append(
          el('button', { classe: 'btn btn--neutro', type: 'button', ao: { click: async () => {
            const r = await push.pushTeste();
            avisar(r?.enviados ? 'Push de teste enviado. Deve chegar em segundos.' : 'Falhou: ' + (r?.erro || r?.error || 'erro'));
          } } }, ['Enviar push de teste']),
          el('button', { classe: 'btn btn--neutro', type: 'button', ao: { click: async () => {
            const c = await confirmar({ titulo: 'Desactivar notificações', mensagem: 'Este dispositivo deixa de receber pushes. Os outros dispositivos continuam.' });
            if (!c) return;
            await push.cancelar();
            avisar('Notificações desactivadas neste dispositivo.');
            refrescarPush();
          } } }, ['Desactivar aqui']),
        );
        return;
      }

      // nao-subscrito -------------------------------------------------------
      estadoLinha.textContent = 'Sem notificações activas neste dispositivo.';
      estadoLinha.style.color = 'var(--texto-suave)';
      if (plat.android && !plat.instalada) {
        zonaPlataforma.append(el('p', { style: 'font-size:.85rem;color:var(--texto-suave);margin:.3rem 0 .5rem' }, [
          '💡 Dica: para melhor experiência, no menu do Chrome/Edge escolha ',
          el('strong', { texto: '"Adicionar ao ecrã principal"' }),
          ' antes de activar.',
        ]));
      }
      rodape.append(
        el('button', { classe: 'btn btn--principal', type: 'button', ao: { click: async () => {
          const r = await push.subscrever();
          if (r.estado === 'subscrito') {
            push.activarSincroniaAutomatica();
            avisar('✓ Notificações activadas. Enviamos um push de teste em segundos.');
            try { await push.pushTeste(); } catch { /* */ }
            refrescarPush();
          } else {
            avisar(r.motivo || 'Não foi possível activar.');
            refrescarPush();
          }
        } } }, ['Activar notificações neste dispositivo']),
      );
    }
    refrescarPush();
    raiz.append(cartaoPush);
  }

  /* --- conta ---------------------------------------------------------------- */
  if (auth.backendDisponivel()) {
    const emailAtual = auth.emailAutenticado();
    const cartaoConta = el('section', { classe: 'cartao' }, [
      el('h2', { texto: 'Conta' }),
    ]);
    if (emailAtual) {
      cartaoConta.append(
        el('p', { classe: 'campo__ajuda', texto: `Sessão iniciada com ${emailAtual}. Os dados sincronizam automaticamente.` }),
        el('button', { classe: 'btn btn--neutro', type: 'button',
          ao: { click: async () => {
            const certeza = await confirmar({
              titulo: 'Terminar sessão',
              mensagem: 'Os dados guardados no servidor mantêm-se. Este dispositivo passa a modo local até voltar a iniciar sessão.',
              rotuloConfirmar: 'Terminar sessão',
            });
            if (!certeza) return;
            await auth.sair();
            avisar('Sessão terminada.');
            redesenhar();
          } } }, ['Terminar sessão']),
      );
      // Mudança de password
      const pwArea = el('div', { style: 'margin-top:14px;padding-top:12px;border-top:1px dashed var(--linha);display:flex;flex-direction:column;gap:.5rem' });
      const pwAtual = el('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Password actual (deixe vazio se ainda não tem)', classe: 'campo' });
      const pwNova = el('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Nova password (mínimo 6)', classe: 'campo' });
      pwArea.append(
        el('h3', { style: 'margin:0;font-size:1rem', texto: 'Alterar password' }),
        pwAtual, pwNova,
        el('button', { classe: 'btn btn--neutro', type: 'button', ao: { click: async () => {
          const nova = pwNova.value || '';
          if (nova.length < 6) { avisar('A nova password precisa de pelo menos 6 caracteres.'); return; }
          const r = await auth.mudarPassword(nova, pwAtual.value || undefined);
          if (r.ok) { avisar('✓ Password actualizada.'); pwAtual.value = ''; pwNova.value = ''; }
          else avisar(r.msg || 'Erro a mudar password.');
        } } }, ['Guardar nova password']),
      );
      cartaoConta.append(pwArea);
    } else {
      cartaoConta.append(
        el('p', { classe: 'campo__ajuda', texto: 'Sem sessão iniciada. Os dados ficam só neste dispositivo.' }),
        el('button', { classe: 'btn btn--principal', type: 'button',
          ao: { click: () => { location.reload(); } } }, ['Iniciar sessão']),
      );
    }
    raiz.append(cartaoConta);
  }

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

  /* --- socorro + sobre (juntos, mais compactos) ------------------------- */
  raiz.append(el('section', { classe: 'cartao' }, [
    el('h2', { texto: 'Sobre e suporte' }),
    el('p', { classe: 'campo__ajuda', style: 'margin-top:-.2rem',
      texto: 'Auxiliar de organização — não substitui médico nem farmacêutico. '
           + 'Nunca altere doses só por causa do que a app mostra.' }),
    el('button', { classe: 'btn btn--neutro', type: 'button', style: 'margin-top:.6rem',
      ao: { click: async () => {
        const c = await confirmar({
          titulo: 'Reparar aplicação',
          mensagem: 'Se a app ficou em branco ou estranha depois de uma actualização, este botão apaga a versão em cache e recarrega fresh. Os dados não se perdem.',
          rotuloConfirmar: 'Reparar',
        });
        if (!c) return;
        location.href = location.pathname + '?reset=1';
      } } }, [icone('descarregar', '1.1rem'), 'Reparar (se a app não abrir bem)']),
  ]));
}

/* --------------------------------------------------------------------------
   Exportação em tabela HTML — para imprimir, guardar como PDF ou copiar
   para o Excel. Inclui foto de cada medicamento embutida em base64.
   -------------------------------------------------------------------------- */

function escaparHTML(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function gerarTabelaHTML() {
  const meds = (estado.medicamentos || []).slice()
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
  const dataStr = new Date().toLocaleString('pt-PT');
  const paraQuem = estado.config?.nome ? ' — ' + escaparHTML(estado.config.nome) : '';

  const linhas = meds.map((m, i) => {
    const foto = m.foto
      ? '<img src="' + m.foto + '" alt="" style="width:70px;height:70px;object-fit:contain;border:1px solid #ccc;border-radius:6px;background:#fff">'
      : '<span style="color:#888;font-size:.8rem">—</span>';
    const horas = horasDoMedicamento(m, hojeISO());
    const horasStr = m.regime?.tipo === 'sos' ? 'SOS (só se necessário)'
      : (horas.length ? horas.join(', ') : '—');
    const dosagemHtml = m.dosagem ? ' <span style="color:#555">(' + escaparHTML(m.dosagem) + ')</span>' : '';
    return '<tr>'
      + '<td style="text-align:center">' + (i + 1) + '</td>'
      + '<td style="text-align:center">' + foto + '</td>'
      + '<td><strong>' + escaparHTML(m.nome) + '</strong>' + dosagemHtml + '</td>'
      + '<td>' + escaparHTML(rotuloForma(m.forma)) + '</td>'
      + '<td style="text-align:center">' + escaparHTML(String(m.quantidadePorToma || 1)) + '</td>'
      + '<td>' + escaparHTML(descreverFrequencia(m)) + '</td>'
      + '<td>' + escaparHTML(horasStr) + '</td>'
      + '<td>' + escaparHTML(instrucaoCurta(m.instrucoes) || '—') + '</td>'
      + '<td>' + escaparHTML(m.motivo || '') + '</td>'
      + '<td>' + escaparHTML(m.medico || '') + '</td>'
      + '<td>' + escaparHTML(m.notas || '') + '</td>'
      + '</tr>';
  }).join('\n');

  return '<!doctype html>\n'
    + '<html lang="pt"><head><meta charset="utf-8">\n'
    + '<title>Dose Certa — Tabela de medicamentos</title>\n'
    + '<style>'
    + 'body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;padding:20px;background:#fafafa}'
    + 'h1{margin:0 0 4px;font-size:22px}.meta{color:#666;margin-bottom:18px;font-size:13px}'
    + 'table{width:100%;border-collapse:collapse;background:#fff;font-size:13px}'
    + 'th,td{border:1px solid #d0d5db;padding:8px 10px;vertical-align:top}'
    + 'th{background:#f0f4f8;text-align:left;font-weight:600}'
    + 'tbody tr:nth-child(even){background:#fafbfd}'
    + '.acoes{margin-bottom:14px}'
    + '.acoes button{padding:8px 14px;margin-right:6px;border:1px solid #999;background:#fff;border-radius:6px;cursor:pointer;font-size:13px}'
    + '@media print{.acoes{display:none}body{padding:0;background:#fff}}'
    + '</style></head><body>'
    + '<h1>Dose Certa — Tabela de medicamentos' + paraQuem + '</h1>'
    + '<div class="meta">Exportado em ' + escaparHTML(dataStr) + ' · ' + meds.length + ' medicamento(s)</div>'
    + '<div class="acoes"><button type="button" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>'
    + ' <span style="color:#666;font-size:12px">(ou use Ctrl+P / ⌘+P)</span></div>'
    + '<table><thead><tr>'
    + '<th>#</th><th>Foto</th><th>Nome</th><th>Forma</th><th>Qt.</th>'
    + '<th>Frequência</th><th>Horas</th><th>Refeição</th><th>Para que serve</th><th>Receitado por</th><th>Notas</th>'
    + '</tr></thead><tbody>\n' + linhas + '\n</tbody></table></body></html>';
}
