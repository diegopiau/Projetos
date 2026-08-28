// Testes de interface ponta a ponta.
// Requer: python3 -m http.server 8099 (na pasta a-horas) e `npm i playwright`.
import { chromium } from 'playwright';

// PW_CHROME permite apontar para um Chromium já instalado no sistema.
const nav = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-PT' });
const pag = await ctx.newPage();
const erros = [];
pag.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
pag.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });

const BASE = process.env.BASE_URL || 'http://localhost:8099';
await pag.goto(`${BASE}/index.html`);
await pag.waitForTimeout(700);

const passo = async (nome, fn) => {
  try { await fn(); console.log('  ✓', nome); }
  catch (e) { console.log('  ✗', nome, '→', e.message.split('\n')[0]); erros.push(nome); }
};

console.log('\n— Primeira utilização —');
await passo('mostra boas-vindas', async () => {
  await pag.waitForSelector('dialog.modal', { timeout: 3000 });
  const t = await pag.textContent('.modal__cabeca h2');
  if (!/Bem-vindo/.test(t)) throw new Error('título: ' + t);
});
await passo('aceita nome e abre formulário', async () => {
  await pag.fill('#b-nome', 'Margarida');
  await pag.click('.modal__rodape .btn--principal');
  await pag.waitForSelector('#f-nome', { timeout: 3000 });
});

console.log('\n— Criar medicamento 3×/dia às refeições —');
await passo('preenche e grava', async () => {
  await pag.fill('#f-nome', 'Synjardy');
  await pag.fill('#f-dosagem', '5 mg/1000 mg');
  await pag.check('input[name="modelo"][value="x3"]');
  await pag.fill('#f-stock', '60');
  await pag.click('.modal__rodape .btn--principal');
  await pag.waitForSelector('dialog.modal', { state: 'detached', timeout: 3000 });
});
await passo('aparecem 3 blocos em Hoje', async () => {
  const n = await pag.locator('.bloco').count();
  if (n !== 3) throw new Error('blocos = ' + n);
});

console.log('\n— Criar medicamento de 8 em 8 horas —');
await passo('cria via aba Medicamentos', async () => {
  await pag.click('#aba-medicamentos');
  await pag.click('.btn--principal.btn--largo');
  await pag.waitForSelector('#f-nome');
  await pag.fill('#f-nome', 'Pantoprazol');
  await pag.check('input[name="modelo"][value="i8"]');
  await pag.waitForSelector('#f-intervalo');
  await pag.click('.modal__rodape .btn--principal');
  await pag.waitForSelector('dialog.modal', { state: 'detached' });
});
await passo('lista mostra 2 medicamentos', async () => {
  const n = await pag.locator('article.cartao').count();
  if (n !== 2) throw new Error('cartões = ' + n);
});

console.log('\n— Registar tomas —');
await passo('“Já tomei tudo” marca o bloco', async () => {
  await pag.click('#aba-hoje');
  await pag.waitForSelector('.bloco');
  await pag.locator('.btn--tomei').first().click();
  await pag.waitForTimeout(300);
  const n = await pag.locator('.bloco--concluido').count();
  if (n < 1) throw new Error('nenhum bloco concluído');
});
await passo('toque individual alterna a caixa', async () => {
  const caixa = pag.locator('.bloco:not(.bloco--concluido) .toma__caixa').first();
  await caixa.click();
  await pag.waitForTimeout(250);
  const marcadas = await pag.locator('.toma--feita').count();
  if (marcadas < 1) throw new Error('nada marcado');
});
await passo('barra de progresso avança', async () => {
  const t = await pag.textContent('.cartao .barra');
  void t;
  const pct = await pag.getAttribute('.barra', 'aria-valuenow');
  if (!pct || Number(pct) === 0) throw new Error('percentagem = ' + pct);
});

console.log('\n— Caixa semanal —');
await passo('marca medicamento para a caixa', async () => {
  await pag.click('#aba-medicamentos');
  await pag.locator('.btn--pequeno:has-text("Editar")').first().click();
  await pag.waitForSelector('#f-caixa');
  await pag.check('#f-caixa');
  await pag.click('.modal__rodape .btn--principal');
  await pag.waitForSelector('dialog.modal', { state: 'detached' });
});
await passo('grelha existe para ecrã largo e impressão', async () => {
  await pag.click('#aba-caixa');
  await pag.waitForSelector('.grelha-caixa table', { state: 'attached' });
  const n = await pag.locator('.grelha-caixa thead th').count();
  if (n !== 8) throw new Error('colunas = ' + n);
  const visivel = await pag.locator('.grelha-caixa').isVisible();
  if (visivel) throw new Error('grelha não devia aparecer a 390 px');
});
await passo('telemóvel mostra um cartão por dia', async () => {
  const n = await pag.locator('.caixa-dias .bloco').count();
  if (n === 0) throw new Error('sem cartões por dia');
  if (!await pag.locator('.caixa-dias').isVisible()) throw new Error('cartões escondidos');
});
await passo('marcar semana inteira marca todos os cartões', async () => {
  const total = await pag.locator('.caixa-dias .toma__caixa').count();
  await pag.locator('button:has-text("Marcar semana inteira")').click();
  await pag.waitForTimeout(300);
  const n = await pag.locator('.caixa-dias .toma__caixa[aria-pressed="true"]').count();
  if (n !== total || n === 0) throw new Error(`marcados ${n} de ${total}`);
  const preparados = await pag.locator('.caixa-dias .bloco__estado:text-is("✓ Preparado")').count();
  if (preparados === 0) throw new Error('nenhum dia marcado como preparado');
});
await passo('desmarcar um medicamento funciona', async () => {
  await pag.locator('.caixa-dias .toma__caixa[aria-pressed="true"]').first().click();
  await pag.waitForTimeout(250);
  const n = await pag.locator('.caixa-dias .toma__caixa[aria-pressed="false"]').count();
  if (n === 0) throw new Error('continua tudo marcado');
});
await passo('dias antes do início não aparecem', async () => {
  const cartoes = await pag.locator('.caixa-dias .bloco').count();
  if (cartoes >= 7) throw new Error('esperava menos de 7 dias, veio ' + cartoes);
});

console.log('\n— Histórico —');
await passo('mostra estatísticas', async () => {
  await pag.click('#aba-historico');
  await pag.waitForSelector('.estatisticas');
  const v = await pag.locator('.estatistica__valor').first().textContent();
  if (!v.trim()) throw new Error('vazio');
});
await passo('folha para consulta abre', async () => {
  await pag.locator('button:has-text("Ver folha para imprimir")').click();
  await pag.waitForSelector('dialog.modal');
  await pag.locator('.modal__fechar').click();
  await pag.waitForSelector('dialog.modal', { state: 'detached' });
});

console.log('\n— Ajustes —');
await passo('mudar hora do almoço reagenda', async () => {
  await pag.click('#aba-ajustes');
  await pag.waitForSelector('#a-ref-almoco');
  await pag.fill('#a-ref-almoco', '14:30');
  await pag.dispatchEvent('#a-ref-almoco', 'change');
  await pag.waitForTimeout(300);
  await pag.click('#aba-hoje');
  await pag.waitForSelector('.bloco');
  const horas = await pag.locator('.bloco__hora').allTextContents();
  if (!horas.includes('14:30')) throw new Error('horas: ' + horas.join(','));
});
await passo('contraste alto aplica-se', async () => {
  await pag.click('#aba-ajustes');
  await pag.check('#a-contraste');
  await pag.waitForTimeout(200);
  const v = await pag.getAttribute('html', 'data-contraste');
  if (v !== 'alto') throw new Error('data-contraste = ' + v);
  await pag.uncheck('#a-contraste');
});
await passo('letra muito grande aplica-se', async () => {
  await pag.selectOption('#a-tamanho', 'enorme');
  await pag.waitForTimeout(200);
  const v = await pag.getAttribute('html', 'data-tamanho');
  if (v !== 'enorme') throw new Error(v);
  await pag.selectOption('#a-tamanho', 'grande');
});

console.log('\n— Persistência —');
await passo('dados sobrevivem a recarregar', async () => {
  await pag.reload();
  await pag.waitForTimeout(600);
  const modal = await pag.locator('dialog.modal').count();
  if (modal) throw new Error('boas-vindas reapareceram');
  await pag.click('#aba-medicamentos');
  const n = await pag.locator('article.cartao').count();
  if (n !== 2) throw new Error('cartões após reload = ' + n);
});

console.log('\n— Título visível ao trocar de aba —');
await passo('h1 não fica sob o cabeçalho fixo', async () => {
  await pag.click('#aba-caixa');
  await pag.waitForTimeout(300);
  const r = await pag.evaluate(() => {
    const h1 = document.querySelector('#principal h1');
    const topo = document.getElementById('topo');
    return { h1: h1.getBoundingClientRect().top, topo: topo.getBoundingClientRect().bottom };
  });
  if (r.h1 < r.topo) throw new Error(`h1 a ${Math.round(r.h1)} px, cabeçalho acaba a ${Math.round(r.topo)} px`);
});

console.log('\n— Sem scroll horizontal —');
await passo('corpo não transborda', async () => {
  await pag.click('#aba-hoje');
  const r = await pag.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  if (!r) throw new Error('há scroll horizontal');
});

await pag.screenshot({ path: 'testes/ecra-hoje.png', fullPage: true });
await pag.click('#aba-caixa');
await pag.screenshot({ path: 'testes/ecra-caixa.png', fullPage: true });

console.log('\n— Erros de consola —');
if (erros.length) { erros.forEach((e) => console.log('  !', e)); }
else console.log('  nenhum');

await nav.close();
process.exit(erros.length ? 1 : 0);
