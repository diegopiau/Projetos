/* ==========================================================================
   horarios.js — transforma posologias em horas concretas e agrupa-as em blocos
   ========================================================================== */

import {
  estado, guardar, obterRegisto, REFEICOES, INSTRUCOES, FORMAS,
  minutosDeHora, horaDeMinutos, deISO, diferencaDias, minutosAgora, paraISO,
} from './dados.js';

/* -------------------------------------------------------------------------
   Que horas tem este medicamento neste dia?
   ------------------------------------------------------------------------- */

function activoNoDia(med, dataISO) {
  if (!med.activo) return false;
  if (med.inicio && dataISO < med.inicio) return false;
  if (med.fim && dataISO > med.fim) return false;

  const r = med.regime || {};
  if (r.tipo === 'sos') return false;              // só a pedido, não entra na rotina

  const diaSemana = deISO(dataISO).getDay();
  if (r.tipo === 'semanal') {
    return Array.isArray(r.diasSemana) && r.diasSemana.includes(diaSemana);
  }
  if (r.tipo === 'ciclo') {
    const n = Math.max(1, Number(r.cadaNDias) || 1);
    const base = med.inicio || dataISO;
    return ((diferencaDias(base, dataISO) % n) + n) % n === 0;
  }
  if (Array.isArray(r.diasSemana) && r.diasSemana.length && r.diasSemana.length < 7) {
    return r.diasSemana.includes(diaSemana);
  }
  return true;
}

/** Devolve as horas ('HH:MM') deste medicamento no dia indicado, ordenadas. */
export function horasDoMedicamento(med, dataISO) {
  if (!activoNoDia(med, dataISO)) return [];
  const r = med.regime || {};
  const refeicoesConfig = estado.config.refeicoes;
  let horas = [];

  switch (r.tipo) {
    case 'intervalo': {
      const passo = Math.max(1, Number(r.intervaloHoras) || 8);
      const inicio = minutosDeHora(r.horaInicio || '08:00');
      for (let m = inicio; m < inicio + 1440; m += passo * 60) horas.push(horaDeMinutos(m));
      break;
    }
    case 'refeicoes': {
      const desvio = Number(r.desvioMin) || 0;
      (r.refeicoes || []).forEach((idRefeicao) => {
        const base = refeicoesConfig[idRefeicao];
        if (base) horas.push(horaDeMinutos(minutosDeHora(base) + desvio));
      });
      break;
    }
    case 'semanal':
    case 'ciclo':
    case 'horas':
    default:
      horas = [...(r.horas || [])];
      break;
  }

  return [...new Set(horas)].sort((a, b) => minutosDeHora(a) - minutosDeHora(b));
}

/** Descrição legível da posologia, para listagens e impressões. */
export function descreverRegime(med) {
  const r = med.regime || {};
  switch (r.tipo) {
    case 'intervalo':
      return `De ${r.intervaloHoras} em ${r.intervaloHoras} horas, a começar às ${r.horaInicio}`;
    case 'refeicoes': {
      const nomes = (r.refeicoes || [])
        .map((id) => REFEICOES.find((x) => x.id === id)?.rotulo.toLowerCase())
        .filter(Boolean);
      const d = Number(r.desvioMin) || 0;
      const quando = d === 0 ? 'À hora d' : d < 0 ? `${Math.abs(d)} min antes d` : `${d} min depois d`;
      const lista = nomes.length > 1
        ? nomes.slice(0, -1).join(', ') + ' e ' + nomes.slice(-1)
        : (nomes[0] || '—');
      return `${quando}o ${lista}`;
    }
    case 'semanal': {
      const dias = (r.diasSemana || []).map((d) => ['domingo', 'segunda', 'terça', 'quarta',
        'quinta', 'sexta', 'sábado'][d]);
      return `${(r.horas || []).join(', ')} — ${dias.join(', ') || 'sem dias definidos'}`;
    }
    case 'ciclo':
      return `${(r.horas || []).join(', ')} — de ${r.cadaNDias} em ${r.cadaNDias} dias`;
    case 'sos':
      return 'Apenas em caso de necessidade (SOS)';
    default:
      return (r.horas || []).join(', ') || '—';
  }
}

export function rotuloForma(id) {
  return FORMAS.find((f) => f.id === id)?.rotulo || 'Comprimido';
}

export function instrucaoCurta(id) {
  return INSTRUCOES.find((i) => i.id === id)?.curta || '';
}

/* -------------------------------------------------------------------------
   Tomas do dia e agrupamento em blocos
   ------------------------------------------------------------------------- */

/** Lista plana de tomas do dia: uma entrada por medicamento e hora. */
export function tomasDoDia(dataISO) {
  const tomas = [];
  estado.medicamentos.forEach((med) => {
    horasDoMedicamento(med, dataISO).forEach((hora) => {
      const registo = obterRegisto(dataISO, med.id, hora);
      tomas.push({
        med,
        hora,
        minutos: minutosDeHora(hora),
        estado: registo?.estado || 'pendente',
        confirmadoEm: registo?.hora || null,
      });
    });
  });
  return tomas.sort((a, b) => a.minutos - b.minutos || a.med.nome.localeCompare(b.med.nome, 'pt'));
}

function periodoDe(minutos) {
  if (minutos < 11 * 60) return 'manha';
  if (minutos < 15 * 60) return 'meio';
  if (minutos < 19 * 60) return 'tarde';
  return 'noite';
}

/** Nome amigável para um bloco, ancorado nas refeições configuradas. */
function nomearBloco(minutos) {
  const refeicoes = estado.config.refeicoes;
  let melhor = null;
  REFEICOES.forEach(({ id, rotulo }) => {
    const base = refeicoes[id];
    if (!base) return;
    const distancia = minutos - minutosDeHora(base);
    if (Math.abs(distancia) <= 40 && (!melhor || Math.abs(distancia) < Math.abs(melhor.distancia))) {
      melhor = { rotulo, distancia, id };
    }
  });
  if (!melhor) {
    const p = periodoDe(minutos);
    return { titulo: p === 'manha' ? 'De manhã' : p === 'meio' ? 'A meio do dia'
                     : p === 'tarde' ? 'Da parte da tarde' : 'À noite', ancora: null };
  }
  if (melhor.id === 'deitar') return { titulo: 'Ao deitar', ancora: 'deitar' };
  const d = Math.round(melhor.distancia);
  if (d <= -10) return { titulo: `${Math.abs(d)} min antes do ${melhor.rotulo.toLowerCase()}`, ancora: melhor.id };
  if (d >= 10) return { titulo: `${d} min depois do ${melhor.rotulo.toLowerCase()}`, ancora: melhor.id };
  return { titulo: `Ao ${melhor.rotulo.toLowerCase()}`, ancora: melhor.id };
}

/**
 * Agrupa as tomas em blocos: tomas com horas próximas (dentro da janela
 * configurada) passam a ser um único momento. É isto que reduz vinte avisos
 * soltos a cinco ou seis momentos claros no dia.
 */
export function blocosDoDia(dataISO) {
  const tomas = tomasDoDia(dataISO);
  const janela = Math.max(0, Number(estado.config.janelaAgrupamentoMin) || 0);
  const blocos = [];

  tomas.forEach((toma) => {
    const ultimo = blocos[blocos.length - 1];
    if (ultimo && toma.minutos - ultimo.minutos <= janela) {
      ultimo.tomas.push(toma);
    } else {
      blocos.push({ minutos: toma.minutos, hora: toma.hora, tomas: [toma] });
    }
  });

  return blocos.map((bloco) => {
    const nome = nomearBloco(bloco.minutos);
    const pendentes = bloco.tomas.filter((t) => t.estado === 'pendente');
    const tomadas = bloco.tomas.filter((t) => t.estado === 'tomada');
    const saltadas = bloco.tomas.filter((t) => t.estado === 'saltada');
    return {
      ...bloco,
      id: `${dataISO}#${bloco.hora}`,
      periodo: periodoDe(bloco.minutos),
      titulo: nome.titulo,
      ancora: nome.ancora,
      pendentes, tomadas, saltadas,
      concluido: pendentes.length === 0,
    };
  });
}

/* -------------------------------------------------------------------------
   Situação de cada bloco face à hora actual
   ------------------------------------------------------------------------- */

export function situacaoDoBloco(bloco, dataISO) {
  const hojeISO = paraISO(new Date());
  if (bloco.concluido) return 'concluido';
  if (dataISO > hojeISO) return 'futuro';
  if (dataISO < hojeISO) return 'atrasado';
  const agora = minutosAgora();
  const tolerancia = Number(estado.config.toleranciaAtrasoMin) || 60;
  if (agora < bloco.minutos - 30) return 'futuro';
  if (agora <= bloco.minutos + tolerancia) return 'agora';
  return 'atrasado';
}

/* -------------------------------------------------------------------------
   Conflitos e avisos de segurança (organização, não aconselhamento clínico)
   ------------------------------------------------------------------------- */

export function avisosDoBloco(bloco) {
  const avisos = [];
  const jejum = bloco.tomas.filter((t) => t.med.instrucoes === 'jejum');
  const comComida = bloco.tomas.filter((t) => t.med.instrucoes === 'durante' || t.med.instrucoes === 'depois');
  if (jejum.length && comComida.length) {
    avisos.push('Este momento junta medicamentos em jejum com outros que pedem comida. '
      + 'Confirme com o médico ou farmacêutico se podem ficar à mesma hora.');
  }
  return avisos;
}

/* -------------------------------------------------------------------------
   Stock
   ------------------------------------------------------------------------- */

/** Unidades consumidas por dia, em média (usa os próximos 28 dias). */
export function consumoDiario(med) {
  const hoje = new Date();
  let total = 0;
  for (let i = 0; i < 28; i += 1) {
    const d = new Date(hoje); d.setDate(d.getDate() + i);
    total += horasDoMedicamento(med, paraISO(d)).length * (Number(med.quantidadePorToma) || 0);
  }
  return total / 28;
}

export function diasDeStock(med) {
  const unidades = med.stock?.unidades;
  if (typeof unidades !== 'number' || Number.isNaN(unidades)) return null;
  const consumo = consumoDiario(med);
  if (consumo <= 0) return null;
  return Math.floor(unidades / consumo);
}

export function alertasDeStock() {
  const limite = Number(estado.config.avisoStockDias) || 7;
  return estado.medicamentos
    .filter((m) => m.activo)
    .map((m) => ({ med: m, dias: diasDeStock(m) }))
    .filter((x) => x.dias !== null && x.dias <= limite)
    .sort((a, b) => a.dias - b.dias);
}

/* -------------------------------------------------------------------------
   Adesão
   ------------------------------------------------------------------------- */

export function adesaoNoPeriodo(dataInicioISO, dataFimISO) {
  let previstas = 0; let tomadas = 0; let saltadas = 0;
  let iso = dataInicioISO;
  const hoje = paraISO(new Date());
  while (iso <= dataFimISO) {
    tomasDoDia(iso).forEach((t) => {
      // No dia de hoje só contam as tomas cuja hora já passou.
      if (iso === hoje && t.minutos > minutosAgora()) return;
      previstas += 1;
      if (t.estado === 'tomada') tomadas += 1;
      if (t.estado === 'saltada') saltadas += 1;
    });
    const d = deISO(iso); d.setDate(d.getDate() + 1);
    iso = paraISO(d);
  }
  const falhadas = previstas - tomadas - saltadas;
  return {
    previstas, tomadas, saltadas, falhadas,
    percentagem: previstas ? Math.round((tomadas / previstas) * 100) : null,
  };
}

/* -------------------------------------------------------------------------
   Exportação para o calendário do telemóvel (.ics)
   Dá alarmes ao nível do sistema operativo, mesmo com a aplicação fechada.
   ------------------------------------------------------------------------- */

function escaparICS(texto) {
  return String(texto).replace(/\\/g, '\\\\').replace(/;/g, '\\;')
    .replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function carimboUTC(data) {
  return data.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function dataLocalICS(iso, hhmm) {
  return `${iso.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
}

export function gerarICS({ dias = 90 } = {}) {
  const agora = new Date();
  const hoje = paraISO(agora);
  const antecedencia = Math.max(0, Number(estado.config.avisoAntecedenciaMin) || 0);
  const linhas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//A Horas//PT', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', 'X-WR-CALNAME:A Horas — medicação',
  ];

  estado.medicamentos.filter((m) => m.activo && m.regime?.tipo !== 'sos').forEach((med) => {
    // Uma série por hora distinta, repetida diariamente (ou nos dias aplicáveis).
    const horasBase = new Set();
    for (let i = 0; i < 14; i += 1) {
      const d = new Date(agora); d.setDate(d.getDate() + i);
      horasDoMedicamento(med, paraISO(d)).forEach((h) => horasBase.add(h));
    }
    const fim = new Date(agora); fim.setDate(fim.getDate() + dias);
    const ate = carimboUTC(fim);

    [...horasBase].sort().forEach((hora, indice) => {
      const r = med.regime || {};
      let regra = `FREQ=DAILY;UNTIL=${ate}`;
      if (r.tipo === 'semanal' && Array.isArray(r.diasSemana) && r.diasSemana.length) {
        const cod = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        regra = `FREQ=WEEKLY;BYDAY=${r.diasSemana.map((d) => cod[d]).join(',')};UNTIL=${ate}`;
      } else if (r.tipo === 'ciclo') {
        regra = `FREQ=DAILY;INTERVAL=${Math.max(1, Number(r.cadaNDias) || 1)};UNTIL=${ate}`;
      }
      const inicio = med.inicio && med.inicio > hoje ? med.inicio : hoje;
      const titulo = `${med.nome}${med.dosagem ? ' ' + med.dosagem : ''} — ${med.quantidadePorToma} ${rotuloForma(med.forma).toLowerCase()}`;
      const nota = [instrucaoCurta(med.instrucoes), med.naCaixaSemanal ? 'Está na caixa semanal' : 'Retirar da embalagem', med.notas]
        .filter(Boolean).join(' · ');

      linhas.push(
        'BEGIN:VEVENT',
        `UID:${med.id}-${indice}@a-horas`,
        `DTSTAMP:${carimboUTC(agora)}`,
        `DTSTART:${dataLocalICS(inicio, hora)}`,
        `DURATION:PT10M`,
        `RRULE:${regra}`,
        `SUMMARY:${escaparICS(titulo)}`,
        `DESCRIPTION:${escaparICS(nota)}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY',
        `TRIGGER:-PT${antecedencia}M`,
        `DESCRIPTION:${escaparICS(titulo)}`,
        'END:VALARM',
        'END:VEVENT',
      );
    });
  });

  linhas.push('END:VCALENDAR');
  return linhas.join('\r\n');
}

/* -------------------------------------------------------------------------
   Simplificação do dia
   --------------------------------------------------------------------------
   O problema de origem não é a lista de medicamentos: é o número de momentos
   em que é preciso parar tudo e tomar qualquer coisa. Alguns desses momentos
   são inevitáveis (intervalos rígidos, tomas presas às refeições); outros são
   arbitrários — uma hora escrita à pressa que podia coincidir com um momento
   que já existe.

   Só propomos mover tomas de hora livre e sem restrição alimentar. Nunca
   mexemos em intervalos (8/8h), em tomas ligadas a refeições, nem em nada que
   precise de jejum ou de comida: essas têm razão clínica para estar onde estão.
   ------------------------------------------------------------------------- */

const DISTANCIA_MAXIMA_MIN = 90;

export function sugestoesDeSimplificacao(dataISO) {
  const horasFixas = new Set();
  estado.medicamentos.forEach((med) => {
    if (!med.activo) return;
    const tipo = med.regime?.tipo;
    const presoAoHorario = tipo === 'intervalo' || tipo === 'refeicoes';
    const presoAComida = med.instrucoes && med.instrucoes !== 'indiferente';
    if (presoAoHorario || presoAComida) {
      horasDoMedicamento(med, dataISO).forEach((h) => horasFixas.add(h));
    }
  });
  if (!horasFixas.size) return [];

  const ancoras = [...horasFixas].map(minutosDeHora).sort((a, b) => a - b);
  const sugestoes = [];

  estado.medicamentos.forEach((med) => {
    if (!med.activo) return;
    if (med.regime?.tipo !== 'horas') return;              // hora livre
    if (med.instrucoes && med.instrucoes !== 'indiferente') return;  // sem restrição alimentar

    (med.regime.horas || []).forEach((hora, indice) => {
      if (horasFixas.has(hora)) return;                    // já coincide
      const minutos = minutosDeHora(hora);
      let melhor = null;
      ancoras.forEach((ancora) => {
        const distancia = Math.abs(ancora - minutos);
        if (distancia === 0 || distancia > DISTANCIA_MAXIMA_MIN) return;
        if (melhor === null || distancia < Math.abs(melhor - minutos)) melhor = ancora;
      });
      if (melhor === null) return;
      sugestoes.push({ med, indice, de: hora, para: horaDeMinutos(melhor) });
    });
  });

  return sugestoes;
}

export function aplicarSimplificacao(sugestoes) {
  sugestoes.forEach(({ med, indice, para }) => { med.regime.horas[indice] = para; });
  // Duas horas do mesmo medicamento podem ter caído no mesmo momento.
  new Set(sugestoes.map((s) => s.med)).forEach((med) => {
    med.regime.horas = [...new Set(med.regime.horas)].sort((a, b) => minutosDeHora(a) - minutosDeHora(b));
  });
  guardar();
}
