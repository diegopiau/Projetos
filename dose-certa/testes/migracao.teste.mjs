// A aplicação chamou-se «A Horas» antes de «Dose Certa». Quem testou a versão
// anterior tem dados sob a chave antiga: não os pode perder na mudança de nome.
//   node testes/migracao.teste.mjs   (com o servidor local a correr)
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:8099';
const nav = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const pag = await (await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-PT' })).newPage();

const erros = [];
pag.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
const passo = async (nome, fn) => {
  try { await fn(); console.log('  ✓', nome); }
  catch (e) { console.log('  ✗', nome, '→', e.message.split('\n')[0]); erros.push(nome); }
};

const DADOS_ANTIGOS = {
  versao: 1,
  config: { nome: 'Margarida', tamanhoLetra: 'enorme', contraste: 'alto',
            refeicoes: { pequenoAlmoco: '07:45', almoco: '12:15', lanche: '16:30',
                         jantar: '19:30', deitar: '22:30' } },
  medicamentos: [{
    id: 'antigo1', nome: 'Synjardy', dosagem: '5 mg/1000 mg', forma: 'comprimido',
    quantidadePorToma: 1, instrucoes: 'durante', naCaixaSemanal: true, activo: true,
    inicio: '2020-01-01', fim: '', motivo: 'diabetes', medico: '', notas: '',
    stock: { unidades: 42, alertaUnidades: 10 },
    regime: { tipo: 'horas', horas: ['08:00', '20:00'] },
  }],
  registos: { '2020-01-02': { 'antigo1@08:00': { estado: 'tomada', hora: '2020-01-02T08:03:00.000Z' } } },
  preparacoes: {},
};

// Semeia a chave antiga na origem certa, antes de a aplicação arrancar.
await pag.goto(`${BASE}/index.html`);
await pag.evaluate((d) => {
  localStorage.clear();
  localStorage.setItem('a-horas.v1', JSON.stringify(d));
}, DADOS_ANTIGOS);
await pag.reload();
await pag.waitForTimeout(800);

console.log('\n— Migração de «A Horas» para «Dose Certa» —');
await passo('não trata a pessoa como nova', async () => {
  if (await pag.locator('dialog.modal').count()) throw new Error('mostrou as boas-vindas');
});
await passo('os medicamentos sobreviveram', async () => {
  await pag.click('#aba-medicamentos');
  await pag.waitForTimeout(200);
  if (!await pag.locator('article.cartao:has-text("Synjardy")').count()) throw new Error('Synjardy desapareceu');
});
await passo('o stock sobreviveu', async () => {
  if (!await pag.locator('.etiqueta:has-text("42 un.")').count()) throw new Error('stock perdido');
});
await passo('as preferências sobreviveram', async () => {
  const r = await pag.evaluate(() => ({
    tamanho: document.documentElement.dataset.tamanho,
    contraste: document.documentElement.dataset.contraste,
  }));
  if (r.tamanho !== 'enorme' || r.contraste !== 'alto') throw new Error(JSON.stringify(r));
});
await passo('as horas das refeições sobreviveram', async () => {
  await pag.click('#aba-ajustes');
  await pag.waitForSelector('#a-ref-almoco');
  const v = await pag.inputValue('#a-ref-almoco');
  if (v !== '12:15') throw new Error('almoço = ' + v);
  if (await pag.inputValue('#a-nome') !== 'Margarida') throw new Error('nome perdido');
});
await passo('o histórico sobreviveu', async () => {
  const registos = await pag.evaluate(() =>
    JSON.parse(localStorage.getItem('dose-certa.v1')).registos['2020-01-02']);
  if (!registos || registos['antigo1@08:00']?.estado !== 'tomada') throw new Error('registo perdido');
});
await passo('a chave antiga foi removida', async () => {
  const antiga = await pag.evaluate(() => localStorage.getItem('a-horas.v1'));
  if (antiga !== null) throw new Error('a chave antiga ficou para trás');
});
await passo('a migração não repõe dados por cima dos actuais', async () => {
  await pag.evaluate(() => {
    localStorage.setItem('a-horas.v1', JSON.stringify({ versao: 1, medicamentos: [], registos: {} }));
  });
  await pag.reload();
  await pag.waitForTimeout(700);
  await pag.click('#aba-medicamentos');
  await pag.waitForTimeout(200);
  if (!await pag.locator('article.cartao:has-text("Synjardy")').count()) {
    throw new Error('a chave antiga apagou os dados actuais');
  }
});

console.log('\n— Erros de consola —');
if (erros.length) erros.forEach((e) => console.log('  !', e));
else console.log('  nenhum');
await nav.close();
process.exit(erros.length ? 1 : 0);
