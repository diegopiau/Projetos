// A aplicação vai ser publicada numa subpasta de um domínio, não na raiz.
// Caminhos relativos, âmbito do service worker e funcionamento offline têm de
// aguentar isso — senão só se descobre depois de publicar.
//   node testes/subpasta.teste.mjs
// Requer um servidor na pasta-mãe: cd .. && python3 -m http.server 8100
import { chromium } from 'playwright';

const BASE = process.env.BASE_SUBPASTA || 'http://localhost:8100/dose-certa';
const nav = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-PT' });
const pag = await ctx.newPage();

const erros = [];
pag.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
pag.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
const passo = async (nome, fn) => {
  try { await fn(); console.log('  ✓', nome); }
  catch (e) { console.log('  ✗', nome, '→', e.message.split('\n')[0]); erros.push(nome); }
};

await pag.goto(`${BASE}/index.html`);
await pag.waitForTimeout(1500);

console.log(`\n— Publicada em ${BASE} —`);
await passo('o service worker regista-se no âmbito da subpasta', async () => {
  const escopo = await pag.evaluate(async () =>
    (await navigator.serviceWorker.getRegistration())?.scope || null);
  if (!escopo || !escopo.endsWith('/dose-certa/')) throw new Error('âmbito: ' + escopo);
});
await passo('o manifesto carrega e aponta caminhos relativos', async () => {
  const m = await pag.evaluate(() =>
    fetch(document.querySelector('link[rel=manifest]').href).then((r) => r.json()));
  if (!m.start_url.startsWith('.')) throw new Error('start_url: ' + m.start_url);
  if (!m.scope.startsWith('.')) throw new Error('scope: ' + m.scope);
});
await passo('os ícones carregam', async () => {
  const ok = await pag.evaluate(() => Promise.all(
    ['assets/icone.svg', 'assets/icone-mascara.svg'].map((f) =>
      fetch(new URL(f, location.href).href).then((r) => r.ok).catch(() => false))));
  if (ok.some((x) => !x)) throw new Error('ícones: ' + JSON.stringify(ok));
});
await passo('a aplicação funciona', async () => {
  await pag.waitForSelector('#b-nome');
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
await passo('tudo o que a app precisa fica em cache', async () => {
  const guardado = await pag.evaluate(async () => {
    const c = await caches.open('dose-certa-v1');
    return (await c.keys()).map((r) => new URL(r.url).pathname);
  });
  const precisa = ['index.html', 'css/app.css', 'js/app.js', 'js/dados.js', 'js/horarios.js',
                   'js/avisos.js', 'js/ui.js', 'js/vistas.js', 'js/formulario.js',
                   'assets/icone.svg', 'manifest.webmanifest'];
  const faltam = precisa.filter((f) => !guardado.some((g) => g.endsWith(f)));
  if (faltam.length) throw new Error('em falta: ' + faltam.join(', '));
});
await passo('continua a funcionar sem rede', async () => {
  await ctx.setOffline(true);
  await pag.reload();
  await pag.waitForTimeout(1500);
  if (!await pag.locator('#principal h1').count()) throw new Error('ecrã vazio offline');
  await pag.click('#aba-medicamentos');
  await pag.waitForTimeout(300);
  if (!await pag.locator('article.cartao:has-text("Synjardy")').count()) {
    throw new Error('dados inacessíveis offline');
  }
  await ctx.setOffline(false);
});

console.log('\n— Erros de consola —');
if (erros.length) erros.forEach((e) => console.log('  !', e));
else console.log('  nenhum');
await nav.close();
process.exit(erros.length ? 1 : 0);
