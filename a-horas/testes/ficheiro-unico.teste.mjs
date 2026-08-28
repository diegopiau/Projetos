// Verifica que a versão de ficheiro único abre a partir do disco (file://),
// sem servidor, e que o essencial funciona.
//   node construir-ficheiro-unico.mjs && node testes/ficheiro-unico.teste.mjs
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const ficheiro = resolve('a-horas-ficheiro-unico.html');
const nav = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const pag = await (await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-PT' })).newPage();

const erros = [];
pag.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
pag.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });

const passo = async (nome, fn) => {
  try { await fn(); console.log('  ✓', nome); }
  catch (e) { console.log('  ✗', nome, '→', e.message.split('\n')[0]); erros.push(nome); }
};

await pag.goto(pathToFileURL(ficheiro).href);
await pag.waitForTimeout(700);

console.log('\n— Ficheiro único, aberto do disco —');
await passo('a aplicação arranca sem servidor', async () => {
  await pag.waitForSelector('dialog.modal', { timeout: 5000 });
  const t = await pag.textContent('.modal__cabeca h2');
  if (!/Bem-vindo/.test(t)) throw new Error('título: ' + t);
});
await passo('cria um medicamento e mostra os momentos', async () => {
  await pag.fill('#b-nome', 'Margarida');
  await pag.click('.modal__rodape .btn--principal');
  await pag.waitForSelector('#f-nome');
  await pag.fill('#f-nome', 'Synjardy');
  await pag.check('input[name="modelo"][value="x3"]');
  await pag.click('.modal__rodape .btn--principal');
  await pag.waitForSelector('dialog.modal', { state: 'detached' });
  const n = await pag.locator('.bloco').count();
  if (n !== 3) throw new Error('blocos = ' + n);
});
await passo('regista uma toma', async () => {
  await pag.locator('.btn--tomei').first().click();
  await pag.waitForTimeout(300);
  if (!await pag.locator('.bloco--concluido').count()) throw new Error('nada registado');
});
await passo('os separadores funcionam', async () => {
  for (const aba of ['medicamentos', 'caixa', 'historico', 'ajustes', 'hoje']) {
    if (await pag.locator('.alarme').count()) {
      await pag.locator('.alarme button:has-text("Ver no ecrã principal")').click();
      await pag.waitForSelector('.alarme', { state: 'detached' });
    }
    await pag.click(`#aba-${aba}`);
    await pag.waitForTimeout(150);
    if (!await pag.locator('#principal h1').count()) throw new Error('separador vazio: ' + aba);
  }
});
await passo('os dados persistem ao recarregar', async () => {
  await pag.reload();
  await pag.waitForTimeout(700);
  if (await pag.locator('dialog.modal').count()) throw new Error('boas-vindas reapareceram');
});

console.log('\n— Erros de consola —');
if (erros.length) erros.forEach((e) => console.log('  !', e));
else console.log('  nenhum');

await nav.close();
process.exit(erros.length ? 1 : 0);
