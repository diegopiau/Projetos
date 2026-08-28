// Os avisos são a parte que falha em silêncio com mais facilidade: cada
// ambiente recusa-os à sua maneira. Estes testes garantem que a aplicação
// diz sempre o que se passa, em vez de deixar a pessoa sem lembrete e sem
// explicação.
//   node testes/avisos.teste.mjs   (com o servidor local a correr)
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:8099';
const nav = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});

const erros = [];
const passo = async (nome, fn) => {
  try { await fn(); console.log('  ✓', nome); }
  catch (e) { console.log('  ✗', nome, '→', e.message.split('\n')[0]); erros.push(nome); }
};

const SEMENTE = {
  versao: 1,
  config: { nome: 'Margarida', refeicoes: { pequenoAlmoco: '08:00', almoco: '13:00',
            lanche: '16:30', jantar: '20:00', deitar: '23:00' } },
  medicamentos: [{ id: 'm1', nome: 'Synjardy', dosagem: '5 mg', forma: 'comprimido',
    quantidadePorToma: 1, instrucoes: 'durante', naCaixaSemanal: false, activo: true,
    inicio: '2020-01-01', fim: '', motivo: '', medico: '', notas: '',
    stock: { unidades: null, alertaUnidades: null },
    regime: { tipo: 'horas', horas: ['08:00'] } }],
  registos: {}, preparacoes: {},
};

async function abrir(url, { conceder = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-PT' });
  if (conceder) await ctx.grantPermissions(['notifications'], { origin: new URL(url).origin });
  const pag = await ctx.newPage();
  pag.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  await pag.goto(url);
  await pag.evaluate((d) => localStorage.setItem('dose-certa.v1', JSON.stringify(d)), SEMENTE);
  await pag.reload();
  await pag.waitForTimeout(700);
  return { ctx, pag };
}

const textoDosAjustes = async (pag) => {
  await pag.click('#aba-ajustes');
  await pag.waitForTimeout(700);          // o diagnóstico é assíncrono
  return pag.locator('#principal').innerText();
};

/* ---------------------------------------------------------------------- */

console.log('\n— A partir do disco (file://), como no ficheiro único —');
{
  const { ctx, pag } = await abrir(pathToFileURL(resolve('dose-certa-ficheiro-unico.html')).href);
  await passo('explica que a culpa é da origem, não da pessoa', async () => {
    const t = await textoDosAjustes(pag);
    if (!/não funcionam a partir do ficheiro/i.test(t)) throw new Error(t.slice(0, 200));
  });
  await passo('não oferece um botão de autorizar que nunca resultaria', async () => {
    if (await pag.locator('button:has-text("Autorizar avisos")').count()) {
      throw new Error('ofereceu autorizar');
    }
  });
  await passo('aponta o calendário como alternativa', async () => {
    const t = await pag.locator('#principal').innerText();
    if (!/calendário do telemóvel/i.test(t)) throw new Error('não sugeriu o calendário');
  });
  await passo('o ecrã Hoje avisa em vez de ficar calado', async () => {
    await pag.click('#aba-hoje');
    await pag.waitForTimeout(700);
    const t = await pag.locator('#principal').innerText();
    if (!/não funcionam a partir do ficheiro/i.test(t)) throw new Error('Hoje não avisou');
  });
  await ctx.close();
}

console.log('\n— Autorização ainda por dar (https/localhost) —');
{
  const { ctx, pag } = await abrir(`${BASE}/index.html`);
  await passo('pede a autorização e oferece o botão', async () => {
    const t = await textoDosAjustes(pag);
    if (!/Ainda não autorizou/i.test(t)) throw new Error(t.slice(0, 200));
    if (!await pag.locator('button:has-text("Autorizar avisos")').count()) {
      throw new Error('faltou o botão');
    }
  });
  await ctx.close();
}

console.log('\n— Autorização concedida —');
{
  const { ctx, pag } = await abrir(`${BASE}/index.html`, { conceder: true });
  await passo('confirma que os avisos funcionam', async () => {
    const t = await textoDosAjustes(pag);
    if (!/estão a funcionar/i.test(t)) throw new Error(t.slice(0, 200));
  });
  await passo('o teste do aviso diz honestamente que resultou', async () => {
    const r = await pag.evaluate(async () => {
      const vistos = [];
      const reg = await navigator.serviceWorker.getRegistration();
      const original = reg.showNotification.bind(reg);
      reg.showNotification = (t, o) => { vistos.push(t); return original(t, o); };
      return { vistos, temReg: !!reg };
    });
    if (!r.temReg) throw new Error('sem service worker');
    await pag.locator('button:has-text("Experimentar um aviso")').click();
    await pag.waitForTimeout(600);
    const t = await pag.locator('.aviso-flutuante').innerText();
    if (!/Aviso enviado/i.test(t)) throw new Error('relatou: ' + t);
  });
  await passo('o guia do calendário explica Android, iPhone e computador', async () => {
    await pag.locator('button:has-text("Como é que faço isto?")').click();
    await pag.waitForSelector('dialog.modal');
    const t = await pag.locator('.modal__corpo').innerText();
    for (const esperado of ['Android', 'iPhone', 'Computador', 'Transferências', 'Importar']) {
      if (!t.includes(esperado)) throw new Error('falta: ' + esperado);
    }
    if (!/medicação mudar/i.test(t)) throw new Error('falta o aviso de reexportar');
    await pag.locator('.modal__rodape .btn--principal').click();
    await pag.waitForSelector('dialog.modal', { state: 'detached' });
  });
  await passo('exportar as tomas abre o guia automaticamente', async () => {
    const [descarga] = await Promise.all([
      pag.waitForEvent('download'),
      pag.locator('button:has-text("Enviar tomas para o calendário")').click(),
    ]);
    if (descarga.suggestedFilename() !== 'dose-certa-medicacao.ics') {
      throw new Error('nome: ' + descarga.suggestedFilename());
    }
    await pag.waitForSelector('dialog.modal', { timeout: 3000 });
    const t = await pag.locator('.modal__cabeca h2').innerText();
    if (!/calendário/i.test(t)) throw new Error('abriu: ' + t);
  });
  await ctx.close();
}

console.log('\n— Avisos bloqueados nas definições —');
{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-PT' });
  await ctx.grantPermissions([], { origin: new URL(BASE).origin });   // nega explicitamente
  const pag = await ctx.newPage();
  await pag.goto(`${BASE}/index.html`);
  await pag.evaluate((d) => localStorage.setItem('dose-certa.v1', JSON.stringify(d)), SEMENTE);
  await pag.reload();
  await pag.waitForTimeout(700);
  await passo('ensina a desbloquear no navegador', async () => {
    const t = await textoDosAjustes(pag);
    if (!/bloqueados/i.test(t) || !/cadeado/i.test(t)) throw new Error(t.slice(0, 250));
  });
  await ctx.close();
}

console.log('\n— Erros de consola —');
if (erros.length) erros.forEach((e) => console.log('  !', e));
else console.log('  nenhum');
await nav.close();
process.exit(erros.length ? 1 : 0);
