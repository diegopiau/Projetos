/* ==========================================================================
   formulario.js — criar e editar um medicamento
   A posologia é escolhida em linguagem corrente; as horas são calculadas.
   ========================================================================== */

import {
  estado, FORMAS, INSTRUCOES, REFEICOES, DIAS_CURTOS,
  medicamentoVazio, gravarMedicamento, removerMedicamento, obterMedicamento,
  minutosDeHora, horaDeMinutos, hojeISO,
} from './dados.js';
import { el, icone, abrirModal, confirmar, avisar } from './ui.js';

const MODELOS = [
  { id: 'x1', rotulo: '1 vez por dia', nota: 'Uma hora fixa',
    aplicar: (r) => { r.tipo = 'horas'; r.horas = ['09:00']; } },
  { id: 'x2', rotulo: '2 vezes por dia', nota: 'Manhã e noite',
    aplicar: (r) => { r.tipo = 'horas'; r.horas = ['09:00', '21:00']; } },
  { id: 'x3', rotulo: '3 vezes por dia', nota: 'Às refeições principais',
    aplicar: (r) => { r.tipo = 'refeicoes'; r.refeicoes = ['pequenoAlmoco', 'almoco', 'jantar']; r.desvioMin = 0; } },
  { id: 'i8', rotulo: 'De 8 em 8 horas', nota: 'Intervalo certo, dia e noite',
    aplicar: (r) => { r.tipo = 'intervalo'; r.intervaloHoras = 8; r.horaInicio = '07:00'; } },
  { id: 'i12', rotulo: 'De 12 em 12 horas', nota: 'Duas tomas espaçadas',
    aplicar: (r) => { r.tipo = 'intervalo'; r.intervaloHoras = 12; r.horaInicio = '09:00'; } },
  { id: 'a30', rotulo: '30 min antes das refeições', nota: 'Antes das 3 principais',
    aplicar: (r) => { r.tipo = 'refeicoes'; r.refeicoes = ['pequenoAlmoco', 'almoco', 'jantar']; r.desvioMin = -30; } },
  { id: 'deitar', rotulo: 'Ao deitar', nota: 'Uma toma à noite',
    aplicar: (r) => { r.tipo = 'refeicoes'; r.refeicoes = ['deitar']; r.desvioMin = 0; } },
  { id: 'semanal', rotulo: 'Só em certos dias', nota: 'Ex.: às segundas e quintas',
    aplicar: (r) => { r.tipo = 'semanal'; r.horas = ['09:00']; r.diasSemana = [1, 4]; } },
  { id: 'sos', rotulo: 'Só em caso de necessidade', nota: 'SOS, sem hora marcada',
    aplicar: (r) => { r.tipo = 'sos'; r.horas = []; } },
];

function modeloActual(regime) {
  const r = regime || {};
  if (r.tipo === 'sos') return 'sos';
  if (r.tipo === 'semanal') return 'semanal';
  if (r.tipo === 'intervalo') return r.intervaloHoras === 12 ? 'i12' : 'i8';
  if (r.tipo === 'refeicoes') {
    if ((r.refeicoes || []).length === 1 && r.refeicoes[0] === 'deitar') return 'deitar';
    return Number(r.desvioMin) === -30 ? 'a30' : 'x3';
  }
  return (r.horas || []).length >= 2 ? 'x2' : 'x1';
}

/** Pré-visualização: as horas concretas que este regime vai gerar. */
function calcularPrevia(regime) {
  const refeicoes = estado.config.refeicoes;
  let horas = [];
  if (regime.tipo === 'intervalo') {
    const passo = Math.max(1, Number(regime.intervaloHoras) || 8);
    const inicio = minutosDeHora(regime.horaInicio || '08:00');
    for (let m = inicio; m < inicio + 1440; m += passo * 60) horas.push(horaDeMinutos(m));
  } else if (regime.tipo === 'refeicoes') {
    (regime.refeicoes || []).forEach((id) => {
      if (refeicoes[id]) horas.push(horaDeMinutos(minutosDeHora(refeicoes[id]) + (Number(regime.desvioMin) || 0)));
    });
  } else if (regime.tipo !== 'sos') {
    horas = [...(regime.horas || [])];
  }
  return [...new Set(horas)].sort((a, b) => minutosDeHora(a) - minutosDeHora(b));
}

/* -------------------------------------------------------------------------
   Formulário
   ------------------------------------------------------------------------- */

export function abrirFormulario(id, aoGravar) {
  const original = id ? obterMedicamento(id) : null;
  const med = original ? JSON.parse(JSON.stringify(original)) : medicamentoVazio();
  med.regime = { ...medicamentoVazio().regime, ...(med.regime || {}) };

  const corpo = el('form', { id: 'form-med', novalidate: true });
  const previa = el('p', { classe: 'campo__ajuda', 'aria-live': 'polite' });
  const zonaDetalhe = el('div');

  /* --- identificação --------------------------------------------------- */

  const campoNome = el('input', { type: 'text', id: 'f-nome', value: med.nome,
    required: true, autocomplete: 'off', placeholder: 'Ex.: Synjardy' });
  const campoDosagem = el('input', { type: 'text', id: 'f-dosagem', value: med.dosagem,
    placeholder: 'Ex.: 5 mg/1000 mg' });
  const campoForma = el('select', { id: 'f-forma' },
    FORMAS.map((f) => el('option', { value: f.id, texto: f.rotulo, selected: f.id === med.forma })));
  const campoQuantidade = el('input', { type: 'number', id: 'f-qtd', min: '0.25', step: '0.25',
    value: String(med.quantidadePorToma) });

  corpo.append(
    el('div', { classe: 'campo' }, [
      el('label', { for: 'f-nome', texto: 'Nome do medicamento' }), campoNome,
      el('p', { classe: 'campo__ajuda', texto: 'Escreva como está escrito na caixa.' }),
    ]),
    el('div', { classe: 'linha-2' }, [
      el('div', { classe: 'campo' }, [el('label', { for: 'f-dosagem', texto: 'Dosagem' }), campoDosagem]),
      el('div', { classe: 'campo' }, [el('label', { for: 'f-forma', texto: 'Forma' }), campoForma]),
    ]),
    el('div', { classe: 'campo' }, [
      el('label', { for: 'f-qtd', texto: 'Quantidade em cada toma' }), campoQuantidade,
      el('p', { classe: 'campo__ajuda', texto: 'Ex.: 1 comprimido, 0.5 se for meio comprimido.' }),
    ]),
  );

  /* --- posologia -------------------------------------------------------- */

  const opcoesModelo = el('div', { classe: 'opcoes' });
  MODELOS.forEach((modelo) => {
    const radio = el('input', { type: 'radio', name: 'modelo', value: modelo.id,
      checked: modeloActual(med.regime) === modelo.id,
      ao: { change: () => { modelo.aplicar(med.regime); desenharDetalhe(); } } });
    opcoesModelo.append(el('label', { classe: 'opcao' }, [
      radio,
      el('span', { classe: 'opcao__texto' }, [modelo.rotulo, el('span', { classe: 'opcao__nota', texto: modelo.nota })]),
    ]));
  });

  corpo.append(el('fieldset', {}, [
    el('legend', { texto: 'Quando é que se toma?' }), opcoesModelo, zonaDetalhe, previa,
  ]));

  function desenharDetalhe() {
    zonaDetalhe.replaceChildren();
    const r = med.regime;

    if (r.tipo === 'intervalo') {
      const intervalo = el('select', { id: 'f-intervalo' },
        [4, 6, 8, 12, 24].map((h) => el('option', { value: String(h), texto: `De ${h} em ${h} horas`,
          selected: Number(r.intervaloHoras) === h })));
      intervalo.addEventListener('change', () => { r.intervaloHoras = Number(intervalo.value); actualizarPrevia(); });
      const inicio = el('input', { type: 'time', id: 'f-inicio-hora', value: r.horaInicio || '08:00' });
      inicio.addEventListener('change', () => { r.horaInicio = inicio.value; actualizarPrevia(); });
      zonaDetalhe.append(el('div', { classe: 'linha-2', style: 'margin-top:.8rem' }, [
        el('div', { classe: 'campo' }, [el('label', { for: 'f-intervalo', texto: 'Intervalo' }), intervalo]),
        el('div', { classe: 'campo' }, [el('label', { for: 'f-inicio-hora', texto: 'Primeira toma do dia' }), inicio]),
      ]));
    }

    if (r.tipo === 'refeicoes') {
      const escolhas = el('div', { classe: 'opcoes' });
      REFEICOES.forEach((refeicao) => {
        const caixa = el('input', { type: 'checkbox', checked: (r.refeicoes || []).includes(refeicao.id) });
        caixa.addEventListener('change', () => {
          const conjunto = new Set(r.refeicoes || []);
          if (caixa.checked) conjunto.add(refeicao.id); else conjunto.delete(refeicao.id);
          r.refeicoes = [...conjunto];
          actualizarPrevia();
        });
        escolhas.append(el('label', { classe: 'opcao' }, [
          caixa,
          el('span', { classe: 'opcao__texto' }, [refeicao.rotulo,
            el('span', { classe: 'opcao__nota', texto: `às ${estado.config.refeicoes[refeicao.id]}` })]),
        ]));
      });
      const desvio = el('select', { id: 'f-desvio' }, [
        { v: -60, t: '1 hora antes' }, { v: -30, t: '30 minutos antes' },
        { v: -15, t: '15 minutos antes' }, { v: 0, t: 'À hora da refeição' },
        { v: 15, t: '15 minutos depois' }, { v: 30, t: '30 minutos depois' },
      ].map((o) => el('option', { value: String(o.v), texto: o.t, selected: Number(r.desvioMin) === o.v })));
      desvio.addEventListener('change', () => { r.desvioMin = Number(desvio.value); actualizarPrevia(); });
      zonaDetalhe.append(
        el('div', { classe: 'campo', style: 'margin-top:.8rem' }, [
          el('span', { classe: 'grupo__legenda', texto: 'Em que refeições?' }), escolhas]),
        el('div', { classe: 'campo' }, [el('label', { for: 'f-desvio', texto: 'A que distância da refeição?' }), desvio]),
      );
    }

    if (r.tipo === 'horas' || r.tipo === 'semanal') {
      const lista = el('div', { classe: 'horas-lista' });
      const redesenharHoras = () => {
        lista.replaceChildren();
        (r.horas || []).forEach((hora, indice) => {
          const campo = el('input', { type: 'time', value: hora, 'aria-label': `Hora ${indice + 1}` });
          campo.addEventListener('change', () => { r.horas[indice] = campo.value; actualizarPrevia(); });
          const apagar = el('button', { type: 'button', classe: 'btn btn--neutro btn--pequeno',
            'aria-label': `Remover a hora ${hora}`, ao: { click: () => {
              r.horas.splice(indice, 1); redesenharHoras(); actualizarPrevia();
            } } }, [icone('cruz', '1rem')]);
          lista.append(el('span', { style: 'display:inline-flex;gap:.3rem;align-items:center' }, [campo, apagar]));
        });
        lista.append(el('button', { type: 'button', classe: 'btn btn--neutro btn--pequeno',
          ao: { click: () => { r.horas = [...(r.horas || []), '12:00']; redesenharHoras(); actualizarPrevia(); } } },
          [icone('mais', '1rem'), 'Juntar hora']));
      };
      redesenharHoras();
      zonaDetalhe.append(el('div', { classe: 'campo', style: 'margin-top:.8rem' }, [
        el('span', { classe: 'grupo__legenda', texto: 'A que horas?' }), lista]));
    }

    if (r.tipo === 'semanal') {
      const dias = el('div', { classe: 'dias' });
      DIAS_CURTOS.forEach((rotulo, indice) => {
        const botao = el('button', { type: 'button', classe: 'dia', texto: rotulo,
          'aria-pressed': String((r.diasSemana || []).includes(indice)),
          'aria-label': rotulo });
        botao.addEventListener('click', () => {
          const conjunto = new Set(r.diasSemana || []);
          if (conjunto.has(indice)) conjunto.delete(indice); else conjunto.add(indice);
          r.diasSemana = [...conjunto].sort();
          botao.setAttribute('aria-pressed', String(conjunto.has(indice)));
        });
        dias.append(botao);
      });
      zonaDetalhe.append(el('div', { classe: 'campo' }, [
        el('span', { classe: 'grupo__legenda', texto: 'Em que dias da semana?' }), dias]));
    }

    actualizarPrevia();
  }

  function actualizarPrevia() {
    const horas = calcularPrevia(med.regime);
    previa.textContent = med.regime.tipo === 'sos'
      ? 'Não entra na rotina diária. Fica disponível para registar quando for preciso.'
      : horas.length
        ? `Vai aparecer às: ${horas.join(', ')} (${horas.length} ${horas.length === 1 ? 'toma' : 'tomas'} por dia)`
        : 'Ainda não escolheu horas.';
  }

  /* --- instruções e organização ---------------------------------------- */

  const campoInstrucoes = el('select', { id: 'f-instrucoes' },
    INSTRUCOES.map((i) => el('option', { value: i.id, texto: i.rotulo, selected: i.id === med.instrucoes })));

  const campoCaixa = el('input', { type: 'checkbox', id: 'f-caixa', checked: med.naCaixaSemanal });

  corpo.append(
    el('div', { classe: 'campo' }, [
      el('label', { for: 'f-instrucoes', texto: 'Relação com as refeições' }), campoInstrucoes]),
    el('div', { classe: 'campo' }, [
      el('label', { classe: 'opcao' }, [campoCaixa,
        el('span', { classe: 'opcao__texto' }, ['Este fica preparado na caixa semanal',
          el('span', { classe: 'opcao__nota',
            texto: 'A app avisa que já está no compartimento do dia, em vez de mandar ir à embalagem.' })])]),
    ]),
  );

  /* --- stock ------------------------------------------------------------ */

  const campoStock = el('input', { type: 'number', id: 'f-stock', min: '0', step: '1',
    value: med.stock?.unidades ?? '', placeholder: 'Ex.: 60' });
  const campoAlerta = el('input', { type: 'number', id: 'f-alerta', min: '0', step: '1',
    value: med.stock?.alertaUnidades ?? '', placeholder: 'Ex.: 10' });

  corpo.append(el('fieldset', {}, [
    el('legend', { texto: 'Quantas unidades tem em casa? (opcional)' }),
    el('div', { classe: 'linha-2' }, [
      el('div', { classe: 'campo' }, [el('label', { for: 'f-stock', texto: 'Unidades disponíveis' }), campoStock]),
      el('div', { classe: 'campo' }, [el('label', { for: 'f-alerta', texto: 'Avisar quando restarem' }), campoAlerta]),
    ]),
    el('p', { classe: 'campo__ajuda',
      texto: 'A app desconta a cada toma confirmada e avisa a tempo de aviar a receita.' }),
  ]));

  /* --- período e notas --------------------------------------------------- */

  const campoInicio = el('input', { type: 'date', id: 'f-inicio', value: med.inicio || hojeISO() });
  const campoFim = el('input', { type: 'date', id: 'f-fim', value: med.fim || '' });
  const campoMotivo = el('input', { type: 'text', id: 'f-motivo', value: med.motivo,
    placeholder: 'Ex.: diabetes, tensão arterial' });
  const campoMedico = el('input', { type: 'text', id: 'f-medico', value: med.medico,
    placeholder: 'Ex.: Dr.ª Helena Sousa' });
  const campoNotas = el('textarea', { id: 'f-notas', value: med.notas,
    placeholder: 'Ex.: engolir inteiro, com um copo de água cheio' });

  corpo.append(el('fieldset', {}, [
    el('legend', { texto: 'Mais informação (opcional)' }),
    el('div', { classe: 'linha-2' }, [
      el('div', { classe: 'campo' }, [el('label', { for: 'f-inicio', texto: 'Começou em' }), campoInicio]),
      el('div', { classe: 'campo' }, [el('label', { for: 'f-fim', texto: 'Termina em' }), campoFim]),
    ]),
    el('div', { classe: 'campo' }, [el('label', { for: 'f-motivo', texto: 'Para que serve' }), campoMotivo]),
    el('div', { classe: 'campo' }, [el('label', { for: 'f-medico', texto: 'Receitado por' }), campoMedico]),
    el('div', { classe: 'campo' }, [el('label', { for: 'f-notas', texto: 'Notas' }), campoNotas]),
  ]));

  desenharDetalhe();

  /* --- gravar ------------------------------------------------------------ */

  function recolher() {
    med.nome = campoNome.value.trim();
    med.dosagem = campoDosagem.value.trim();
    med.forma = campoForma.value;
    med.quantidadePorToma = Number(campoQuantidade.value) || 1;
    med.instrucoes = campoInstrucoes.value;
    med.naCaixaSemanal = campoCaixa.checked;
    med.stock = {
      unidades: campoStock.value === '' ? null : Number(campoStock.value),
      alertaUnidades: campoAlerta.value === '' ? null : Number(campoAlerta.value),
    };
    med.inicio = campoInicio.value || hojeISO();
    med.fim = campoFim.value || '';
    med.motivo = campoMotivo.value.trim();
    med.medico = campoMedico.value.trim();
    med.notas = campoNotas.value.trim();
    med.activo = med.activo !== false;
  }

  const accoes = [];
  if (original) {
    accoes.push({ rotulo: 'Apagar', classe: 'btn--perigo', aoClicar: async (fechar) => {
      const certeza = await confirmar({
        titulo: 'Apagar medicamento',
        mensagem: `Quer mesmo apagar “${original.nome}”? O histórico de tomas já registado mantém-se.`,
        rotuloConfirmar: 'Apagar', perigo: true,
      });
      if (certeza) { removerMedicamento(original.id); fechar(); avisar('Medicamento apagado.'); aoGravar?.(); }
    } });
  }
  accoes.push({ rotulo: 'Cancelar', classe: 'btn--neutro', aoClicar: (fechar) => fechar() });
  accoes.push({ rotulo: 'Guardar', classe: 'btn--principal', aoClicar: (fechar) => {
    recolher();
    if (!med.nome) { avisar('Falta o nome do medicamento.'); campoNome.focus(); return; }
    if (med.regime.tipo !== 'sos' && calcularPrevia(med.regime).length === 0) {
      avisar('Escolha pelo menos uma hora de toma.'); return;
    }
    gravarMedicamento(med);
    fechar();
    avisar(original ? 'Alterações guardadas.' : `“${med.nome}” foi adicionado.`);
    aoGravar?.();
  } });

  abrirModal({ titulo: original ? 'Editar medicamento' : 'Novo medicamento', corpo, accoes });
  setTimeout(() => campoNome.focus(), 60);
}
