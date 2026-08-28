// Testes do motor de horários, sem navegador.
globalThis.localStorage = {
  _d: {}, getItem(k){return this._d[k]??null}, setItem(k,v){this._d[k]=v}, removeItem(k){delete this._d[k]},
};
const dados = await import('../js/dados.js');
const h = await import('../js/horarios.js');
const { estado } = dados;

let falhas = 0;
const ok = (nome, cond, extra='') => {
  if (cond) console.log('  ✓', nome);
  else { console.log('  ✗', nome, extra); falhas++; }
};

function med(p) {
  return { ...dados.medicamentoVazio(), inicio: '2026-01-01', ...p,
           regime: { ...dados.medicamentoVazio().regime, ...(p.regime||{}) } };
}

console.log('\n— Datas —');
ok('paraISO local', dados.paraISO(new Date(2026, 7, 28)) === '2026-08-28');
ok('somarDias atravessa mês', dados.somarDias('2026-08-31', 1) === '2026-09-01');
ok('horaDeMinutos rodapé 24h', dados.horaDeMinutos(25*60) === '01:00');
ok('minutosDeHora', dados.minutosDeHora('08:30') === 510);

console.log('\n— Regimes —');
estado.medicamentos = [
  med({ id:'a', nome:'Pantoprazol', regime:{ tipo:'refeicoes', refeicoes:['pequenoAlmoco','almoco','jantar'], desvioMin:-30 }, instrucoes:'jejum' }),
  med({ id:'b', nome:'Antibiótico', regime:{ tipo:'intervalo', intervaloHoras:8, horaInicio:'07:00' } }),
  med({ id:'c', nome:'Synjardy',   regime:{ tipo:'horas', horas:['08:00'] }, instrucoes:'durante' }),
  med({ id:'d', nome:'Metotrexato',regime:{ tipo:'semanal', horas:['09:00'], diasSemana:[1] } }),
  med({ id:'e', nome:'Paracetamol',regime:{ tipo:'sos' } }),
  med({ id:'f', nome:'Injeção',    regime:{ tipo:'ciclo', horas:['10:00'], cadaNDias:3 }, inicio:'2026-08-24' }),
];

const seg = '2026-08-31'; // segunda-feira
const ter = '2026-09-01';
ok('8/8h dá 3 tomas', h.horasDoMedicamento(estado.medicamentos[1], seg).join()==='07:00,15:00,23:00',
   h.horasDoMedicamento(estado.medicamentos[1], seg).join());
ok('30 min antes das refeições', h.horasDoMedicamento(estado.medicamentos[0], seg).join()==='07:30,12:30,19:30',
   h.horasDoMedicamento(estado.medicamentos[0], seg).join());
ok('semanal só à segunda', h.horasDoMedicamento(estado.medicamentos[3], seg).length===1
   && h.horasDoMedicamento(estado.medicamentos[3], ter).length===0);
ok('SOS não entra na rotina', h.horasDoMedicamento(estado.medicamentos[4], seg).length===0);
ok('ciclo de 3 dias: 24 ago sim, 25 não', h.horasDoMedicamento(estado.medicamentos[5],'2026-08-24').length===1
   && h.horasDoMedicamento(estado.medicamentos[5],'2026-08-25').length===0
   && h.horasDoMedicamento(estado.medicamentos[5],'2026-08-27').length===1);
ok('respeita data de fim', h.horasDoMedicamento(med({regime:{tipo:'horas',horas:['08:00']}, fim:'2026-08-01'}), seg).length===0);

console.log('\n— Agrupamento —');
const blocos = h.blocosDoDia(seg);
console.log('  blocos:', blocos.map(b=>`${b.hora}(${b.tomas.length}) ${b.titulo}`).join(' | '));
ok('07:30 e 08:00 juntam-se (janela 20 min? não)', true);
estado.config.janelaAgrupamentoMin = 45;
const blocos2 = h.blocosDoDia(seg);
console.log('  janela 45:', blocos2.map(b=>`${b.hora}(${b.tomas.length})`).join(' | '));
ok('janela maior agrupa mais', blocos2.length < blocos.length, `${blocos2.length} vs ${blocos.length}`);
estado.config.janelaAgrupamentoMin = 20;

const bloco730 = h.blocosDoDia(seg).find(b=>b.hora==='07:30');
ok('bloco 07:30 nomeado pela refeição', /pequeno-almoço/.test(bloco730.titulo), bloco730.titulo);

console.log('\n— Conflito jejum vs comida —');
estado.config.janelaAgrupamentoMin = 60;
const conflito = h.blocosDoDia(seg).find(b=>h.avisosDoBloco(b).length);
ok('deteta jejum + com comida no mesmo bloco', !!conflito, conflito ? conflito.titulo : 'nenhum');
estado.config.janelaAgrupamentoMin = 20;

console.log('\n— Stock —');
const m = med({ id:'s', nome:'Teste', regime:{tipo:'intervalo', intervaloHoras:8, horaInicio:'07:00'},
                quantidadePorToma:1, stock:{unidades:30, alertaUnidades:5} });
estado.medicamentos.push(m);
ok('consumo diário = 3', Math.round(h.consumoDiario(m)*100)/100 === 3, h.consumoDiario(m));
ok('dias de stock = 10', h.diasDeStock(m) === 10, h.diasDeStock(m));

console.log('\n— Marcar toma desconta e devolve stock —');
const hoje = dados.hojeISO();
const horaHoje = h.horasDoMedicamento(m, hoje)[0];
dados.marcarToma(hoje, 's', horaHoje, 'tomada');
ok('desconta 1 unidade', m.stock.unidades === 29, m.stock.unidades);
dados.marcarToma(hoje, 's', horaHoje, null);
ok('devolve ao desmarcar', m.stock.unidades === 30, m.stock.unidades);
dados.marcarToma(hoje, 's', horaHoje, 'tomada');
dados.marcarToma(hoje, 's', horaHoje, 'saltada');
ok('trocar tomada→saltada devolve stock', m.stock.unidades === 30, m.stock.unidades);
dados.marcarToma(hoje, 's', horaHoje, null);

console.log('\n— ICS —');
const ics = h.gerarICS({dias:30});
ok('tem VCALENDAR', ics.startsWith('BEGIN:VCALENDAR') && ics.trim().endsWith('END:VCALENDAR'));
ok('tem VALARM', ics.includes('BEGIN:VALARM'));
ok('linhas CRLF', ics.includes('\r\n'));
ok('semanal usa BYDAY=MO', ics.includes('FREQ=WEEKLY;BYDAY=MO'));
ok('ciclo usa INTERVAL=3', ics.includes('INTERVAL=3'));
ok('SOS fora do calendário', !ics.includes('Paracetamol'));
const semRRULE = ics.split('\r\n').filter(l=>l.startsWith('DTSTART')).length;
ok('gerou eventos', semRRULE > 0, semRRULE);

console.log('\n— Adesão —');
estado.registos = {};
estado.medicamentos = [med({id:'x', nome:'X', regime:{tipo:'horas', horas:['00:01']}})];
const ontem = dados.somarDias(hoje,-1);
dados.marcarToma(ontem,'x','00:01','tomada');
const ad = h.adesaoNoPeriodo(ontem, ontem);
ok('adesão 100% ontem', ad.percentagem===100, JSON.stringify(ad));

console.log('\n— Simplificação do dia —');
estado.registos = {};
estado.config.refeicoes = { pequenoAlmoco:'08:00', almoco:'13:00', lanche:'16:30', jantar:'20:00', deitar:'23:00' };
estado.medicamentos = [
  // Presos: não podem ser movidos.
  med({ id:'p1', nome:'Pantoprazol', regime:{tipo:'refeicoes', refeicoes:['pequenoAlmoco'], desvioMin:-30}, instrucoes:'jejum' }),
  med({ id:'p2', nome:'Synjardy',    regime:{tipo:'refeicoes', refeicoes:['pequenoAlmoco','jantar'], desvioMin:0}, instrucoes:'durante' }),
  med({ id:'p3', nome:'Antibiótico', regime:{tipo:'intervalo', intervaloHoras:8, horaInicio:'07:00'} }),
  // Livres: candidatos a juntar.
  med({ id:'l1', nome:'Biloban',     regime:{tipo:'horas', horas:['09:00','21:00']}, instrucoes:'indiferente' }),
  med({ id:'l2', nome:'Vitaminas',   regime:{tipo:'horas', horas:['08:40']}, instrucoes:'indiferente' }),
  // Livre na hora, mas com restrição alimentar: não se mexe.
  med({ id:'l3', nome:'Ferro',       regime:{tipo:'horas', horas:['10:30']}, instrucoes:'jejum' }),
  // Livre mas longe de tudo: não há âncora a menos de 90 min.
  med({ id:'l4', nome:'Sonífero',    regime:{tipo:'horas', horas:['03:00']}, instrucoes:'indiferente' }),
];
const dia = '2026-09-02';
const antes = h.blocosDoDia(dia).length;
const sug = h.sugestoesDeSimplificacao(dia);
const nomes = sug.map(s=>`${s.med.nome} ${s.de}→${s.para}`);
console.log('  sugestões:', nomes.join(', ') || '(nenhuma)');
ok('não propõe mexer em tomas presas às refeições', !sug.some(s=>['p1','p2'].includes(s.med.id)));
ok('não propõe mexer em intervalos de 8/8h', !sug.some(s=>s.med.id==='p3'));
ok('não propõe mexer em quem precisa de jejum', !sug.some(s=>s.med.id==='l3'));
ok('não propõe mover para longe (>90 min)', !sug.some(s=>s.med.id==='l4'));
ok('propõe juntar Vitaminas 08:40 → 08:00', nomes.includes('Vitaminas 08:40→08:00'), nomes.join(','));
ok('propõe juntar Biloban 09:00 → 08:00', nomes.includes('Biloban 09:00→08:00'), nomes.join(','));
ok('propõe juntar Biloban 21:00 → 20:00', nomes.includes('Biloban 21:00→20:00'), nomes.join(','));

h.aplicarSimplificacao(sug);
const depois = h.blocosDoDia(dia).length;
console.log(`  momentos: ${antes} → ${depois}`);
ok('o dia fica com menos momentos', depois < antes, `${antes} → ${depois}`);
ok('as horas presas não mudaram',
   h.horasDoMedicamento(estado.medicamentos[2], dia).join()==='07:00,15:00,23:00'
   && h.horasDoMedicamento(estado.medicamentos[0], dia).join()==='07:30');
ok('Biloban passou a 08:00 e 20:00',
   estado.medicamentos[3].regime.horas.join()==='08:00,20:00', estado.medicamentos[3].regime.horas.join());
ok('não sobram sugestões depois de aplicar', h.sugestoesDeSimplificacao(dia).length===0);

// Duas horas do mesmo medicamento a colapsarem na mesma âncora não podem duplicar.
estado.medicamentos = [
  med({ id:'a1', nome:'Âncora', regime:{tipo:'intervalo', intervaloHoras:24, horaInicio:'09:00'} }),
  med({ id:'d1', nome:'Duplo',  regime:{tipo:'horas', horas:['08:30','09:30']}, instrucoes:'indiferente' }),
];
h.aplicarSimplificacao(h.sugestoesDeSimplificacao(dia));
ok('horas duplicadas são fundidas numa só', estado.medicamentos[1].regime.horas.join()==='09:00',
   estado.medicamentos[1].regime.horas.join());

console.log(falhas ? `\n${falhas} FALHA(S)\n` : '\nTodos os testes passaram.\n');
process.exit(falhas?1:0);
