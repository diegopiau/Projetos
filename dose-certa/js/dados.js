/* ==========================================================================
   dados.js — modelo, persistência local e utilitários de data
   Tudo fica no dispositivo (localStorage). Não há servidor nem contas.
   ========================================================================== */

export const CHAVE = 'dose-certa.v1';

// A aplicação chamou-se «A Horas» antes de passar a «Dose Certa». Quem já tinha
// dados sob a chave antiga não os deve perder na mudança de nome.
const CHAVE_ANTERIOR = 'a-horas.v1';

export const DIAS_CURTOS = ['Dom', '2ª', '3ª', '4ª', '5ª', '6ª', 'Sáb'];
export const DIAS_LONGOS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
                            'quinta-feira', 'sexta-feira', 'sábado'];
export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
                      'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const MESES_CURTOS = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.',
                             'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];

export const FORMAS = [
  { id: 'comprimido', rotulo: 'Comprimido' },
  { id: 'capsula', rotulo: 'Cápsula' },
  { id: 'saqueta', rotulo: 'Saqueta / pó' },
  { id: 'gotas', rotulo: 'Gotas' },
  { id: 'xarope', rotulo: 'Xarope' },
  { id: 'injeccao', rotulo: 'Injeção' },
  { id: 'inalador', rotulo: 'Inalador' },
  { id: 'adesivo', rotulo: 'Adesivo / penso' },
  { id: 'pomada', rotulo: 'Pomada / creme' },
  { id: 'outro', rotulo: 'Outro' },
];

export const INSTRUCOES = [
  { id: 'indiferente', rotulo: 'Indiferente às refeições', curta: '' },
  { id: 'jejum', rotulo: 'Em jejum (estômago vazio)', curta: 'Em jejum' },
  { id: 'antes', rotulo: 'Antes de comer', curta: 'Antes de comer' },
  { id: 'durante', rotulo: 'Durante ou logo após a refeição', curta: 'Com comida' },
  { id: 'depois', rotulo: 'Depois de comer', curta: 'Depois de comer' },
];

export const REFEICOES = [
  { id: 'pequenoAlmoco', rotulo: 'Pequeno-almoço' },
  { id: 'almoco', rotulo: 'Almoço' },
  { id: 'lanche', rotulo: 'Lanche' },
  { id: 'jantar', rotulo: 'Jantar' },
  { id: 'deitar', rotulo: 'Ao deitar' },
];

/* -------------------------------------------------------------------------
   Configuração inicial
   ------------------------------------------------------------------------- */

function configPorOmissao() {
  return {
    nome: '',
    refeicoes: {
      pequenoAlmoco: '08:00',
      almoco: '13:00',
      lanche: '16:30',
      jantar: '20:00',
      deitar: '23:00',
    },
    janelaAgrupamentoMin: 20,   // tomas até 20 min de distância juntam-se num bloco
    toleranciaAtrasoMin: 60,    // depois disto a toma conta como falhada
    avisoAntecedenciaMin: 0,    // avisar N minutos antes da hora
    tamanhoLetra: 'grande',
    contraste: 'normal',
    voz: true,
    som: true,
    avisoStockDias: 7,
    cuidador: { nome: '', telefone: '' },
    ultimaVersaoVista: 1,
  };
}

/* -------------------------------------------------------------------------
   Estado em memória
   ------------------------------------------------------------------------- */

export const estado = {
  config: configPorOmissao(),
  medicamentos: [],
  registos: {},      // { 'AAAA-MM-DD': { 'idMed@HH:MM': { estado, hora, unidades } } }
  preparacoes: {},   // { 'AAAA-MM-DD': { idMed: true } }  — caixa semanal já enchida
};

const ouvintes = new Set();

export function aoMudar(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }

function notificar() { ouvintes.forEach((fn) => fn()); }

export function guardar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({
      versao: 1,
      config: estado.config,
      medicamentos: estado.medicamentos,
      registos: estado.registos,
      preparacoes: estado.preparacoes,
    }));
  } catch (erro) {
    console.error('Não foi possível guardar os dados', erro);
    alert('Não foi possível guardar os dados neste dispositivo. '
        + 'Verifique se o armazenamento do navegador está disponível.');
  }
  notificar();
}

/** Move os dados da chave antiga para a actual, uma única vez. */
function migrarChaveAnterior() {
  try {
    if (localStorage.getItem(CHAVE) !== null) return;
    const antigo = localStorage.getItem(CHAVE_ANTERIOR);
    if (antigo === null) return;
    localStorage.setItem(CHAVE, antigo);
    localStorage.removeItem(CHAVE_ANTERIOR);
  } catch { /* sem armazenamento não há nada a migrar */ }
}

export function carregar() {
  try {
    migrarChaveAnterior();
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return false;
    const dados = JSON.parse(bruto);
    estado.config = { ...configPorOmissao(), ...(dados.config || {}) };
    estado.config.refeicoes = { ...configPorOmissao().refeicoes, ...(dados.config?.refeicoes || {}) };
    estado.config.cuidador = { ...configPorOmissao().cuidador, ...(dados.config?.cuidador || {}) };
    estado.medicamentos = Array.isArray(dados.medicamentos) ? dados.medicamentos : [];
    estado.registos = dados.registos || {};
    estado.preparacoes = dados.preparacoes || {};
    return true;
  } catch (erro) {
    console.error('Dados guardados ilegíveis', erro);
    return false;
  }
}

export function importar(dados) {
  if (!dados || typeof dados !== 'object' || !Array.isArray(dados.medicamentos)) {
    throw new Error('Ficheiro inválido: não parece uma cópia de segurança da Dose Certa.');
  }
  estado.config = { ...configPorOmissao(), ...(dados.config || {}) };
  estado.config.refeicoes = { ...configPorOmissao().refeicoes, ...(dados.config?.refeicoes || {}) };
  estado.config.cuidador = { ...configPorOmissao().cuidador, ...(dados.config?.cuidador || {}) };
  estado.medicamentos = dados.medicamentos;
  estado.registos = dados.registos || {};
  estado.preparacoes = dados.preparacoes || {};
  guardar();
}

export function exportar() {
  return {
    aplicacao: 'Dose Certa',
    versao: 1,
    exportadoEm: new Date().toISOString(),
    config: estado.config,
    medicamentos: estado.medicamentos,
    registos: estado.registos,
    preparacoes: estado.preparacoes,
  };
}

export function apagarTudo() {
  localStorage.removeItem(CHAVE);
  localStorage.removeItem(CHAVE_ANTERIOR);
  estado.config = configPorOmissao();
  estado.medicamentos = [];
  estado.registos = {};
  estado.preparacoes = {};
  notificar();
}

/* -------------------------------------------------------------------------
   Medicamentos
   ------------------------------------------------------------------------- */

export function novoId() {
  return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function medicamentoVazio() {
  return {
    id: novoId(),
    nome: '',
    dosagem: '',
    forma: 'comprimido',
    quantidadePorToma: 1,
    regime: { tipo: 'horas', horas: ['08:00'], intervaloHoras: 8, horaInicio: '08:00',
              refeicoes: [], desvioMin: -30, diasSemana: [0, 1, 2, 3, 4, 5, 6], cadaNDias: 1 },
    instrucoes: 'indiferente',
    naCaixaSemanal: false,
    stock: { unidades: null, alertaUnidades: null },
    inicio: hojeISO(),
    fim: '',
    activo: true,
    motivo: '',
    medico: '',
    notas: '',
    criadoEm: new Date().toISOString(),
  };
}

export function obterMedicamento(id) {
  return estado.medicamentos.find((m) => m.id === id) || null;
}

export function gravarMedicamento(med) {
  const indice = estado.medicamentos.findIndex((m) => m.id === med.id);
  if (indice >= 0) estado.medicamentos[indice] = med;
  else estado.medicamentos.push(med);
  guardar();
}

export function removerMedicamento(id) {
  estado.medicamentos = estado.medicamentos.filter((m) => m.id !== id);
  guardar();
}

/* -------------------------------------------------------------------------
   Registos de tomas
   ------------------------------------------------------------------------- */

export function chaveToma(idMed, hora) { return `${idMed}@${hora}`; }

export function obterRegisto(dataISO, idMed, hora) {
  return estado.registos[dataISO]?.[chaveToma(idMed, hora)] || null;
}

/**
 * Marca uma toma. `situacao` é 'tomada', 'saltada' ou null (repõe por marcar).
 * Ao confirmar uma toma, desconta o stock; ao desmarcar, devolve-o.
 */
export function marcarToma(dataISO, idMed, hora, situacao) {
  const med = obterMedicamento(idMed);
  if (!med) return;
  if (!estado.registos[dataISO]) estado.registos[dataISO] = {};
  const dia = estado.registos[dataISO];
  const chave = chaveToma(idMed, hora);
  const anterior = dia[chave];

  // Devolve stock se a toma anterior o tinha descontado.
  if (anterior?.estado === 'tomada' && typeof anterior.unidades === 'number'
      && typeof med.stock?.unidades === 'number') {
    med.stock.unidades = Math.round((med.stock.unidades + anterior.unidades) * 100) / 100;
  }

  if (!situacao) {
    delete dia[chave];
  } else {
    const registo = { estado: situacao, hora: new Date().toISOString() };
    if (situacao === 'tomada' && typeof med.stock?.unidades === 'number') {
      const gasto = Number(med.quantidadePorToma) || 0;
      med.stock.unidades = Math.round(Math.max(0, med.stock.unidades - gasto) * 100) / 100;
      registo.unidades = gasto;
    }
    dia[chave] = registo;
  }
  if (Object.keys(dia).length === 0) delete estado.registos[dataISO];
  guardar();
}

export function marcarPreparacao(dataISO, idMed, preparado) {
  if (!estado.preparacoes[dataISO]) estado.preparacoes[dataISO] = {};
  if (preparado) estado.preparacoes[dataISO][idMed] = true;
  else delete estado.preparacoes[dataISO][idMed];
  if (Object.keys(estado.preparacoes[dataISO]).length === 0) delete estado.preparacoes[dataISO];
  guardar();
}

/* -------------------------------------------------------------------------
   Datas — sempre em hora local, nunca UTC (evita saltos de dia)
   ------------------------------------------------------------------------- */

export function paraISO(data) {
  const a = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const d = String(data.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

export function deISO(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function hojeISO() { return paraISO(new Date()); }

export function somarDias(iso, n) {
  const data = deISO(iso);
  data.setDate(data.getDate() + n);
  return paraISO(data);
}

export function diferencaDias(isoA, isoB) {
  return Math.round((deISO(isoB) - deISO(isoA)) / 86400000);
}

/** Forma curta, para o cabeçalho: «6ª, 28 ago.». A longa fica no corpo do ecrã. */
export function dataCurta(iso) {
  const d = deISO(iso);
  return `${DIAS_CURTOS[d.getDay()]}, ${d.getDate()} ${MESES_CURTOS[d.getMonth()]}`;
}

export function dataPorExtenso(iso) {
  const d = deISO(iso);
  return `${DIAS_LONGOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export function minutosDeHora(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function horaDeMinutos(minutos) {
  const total = ((Math.round(minutos) % 1440) + 1440) % 1440;
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export function minutosAgora() {
  const agora = new Date();
  return agora.getHours() * 60 + agora.getMinutes();
}
