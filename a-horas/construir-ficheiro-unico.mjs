/* ==========================================================================
   construir-ficheiro-unico.mjs
   --------------------------------------------------------------------------
   Gera `a-horas-ficheiro-unico.html`: a aplicação inteira num só ficheiro,
   que abre por duplo clique, sem servidor.

   Serve para experimentar depressa e para enviar a alguém por e-mail. Não
   substitui a versão publicada: aberto a partir do disco (file://) o navegador
   não permite service worker nem notificações do sistema, por isso ficam de
   fora os lembretes e o funcionamento offline. Tudo o resto funciona.

       node construir-ficheiro-unico.mjs
   ========================================================================== */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = dirname(fileURLToPath(import.meta.url));
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');

/* Ordem de dependências: cada módulo só usa os que vêm antes. */
const MODULOS = [
  'js/dados.js',
  'js/ui.js',
  'js/horarios.js',
  'js/avisos.js',
  'js/formulario.js',
  'js/vistas.js',
  'js/app.js',
];

/* Os módulos importados por espaço de nomes precisam do objeto equivalente. */
const ESPACOS = {
  avisos: ['definirCallbackAlarme', 'estadoPermissao', 'pedirPermissao', 'tocarSom', 'falar',
           'vibrar', 'iniciarVigia', 'pararVigia', 'reagendar', 'esquecerAviso',
           'ultimoBlocoAvisado', 'testarAviso'],
  vistas: ['reporDia', 'vistaHoje', 'vistaMedicamentos', 'vistaCaixa', 'vistaHistorico',
           'vistaAjustes'],
};

function limparModulo(codigo) {
  return codigo
    .replace(/^import\s+[\s\S]*?\s+from\s+'[^']*';?[ \t]*$/gm, '')
    .replace(/^export\s+(async\s+function|function|const|let|class)\b/gm, '$1')
    .trimEnd();
}

/* --- verificações que impedem um ficheiro silenciosamente partido --------- */

const nomesTopo = new Map();
MODULOS.forEach((caminho) => {
  const codigo = ler(caminho);
  for (const achado of codigo.matchAll(/^(?:export\s+)?(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    const nome = achado[1];
    if (nomesTopo.has(nome)) {
      throw new Error(`Nome repetido no topo de dois módulos: "${nome}" `
        + `(${nomesTopo.get(nome)} e ${caminho}). Num ficheiro único isto colide.`);
    }
    nomesTopo.set(nome, caminho);
  }
});

Object.entries(ESPACOS).forEach(([espaco, membros]) => {
  membros.forEach((membro) => {
    if (!nomesTopo.has(membro)) {
      throw new Error(`O espaço de nomes "${espaco}" refere "${membro}", que já não existe. `
        + 'Actualize ESPACOS em construir-ficheiro-unico.mjs.');
    }
  });
});

/* --- montagem ------------------------------------------------------------ */

const partes = MODULOS.map((caminho) => `/* ===== ${caminho} ===== */\n${limparModulo(ler(caminho))}`);

partes.push('/* ===== espaços de nomes ===== */\n' + Object.entries(ESPACOS)
  .map(([espaco, membros]) => `const ${espaco} = { ${membros.join(', ')} };`)
  .join('\n') + '\nconst avisosMod = avisos;');

/* `arrancar()` está no fim de app.js e corre sozinho; aqui basta a IIFE. */
const guiao = `(function () {\n'use strict';\n\n${partes.join('\n\n')}\n})();`;

const estilo = ler('css/app.css');
const icone = 'data:image/svg+xml;base64,' + Buffer.from(ler('assets/icone.svg')).toString('base64');

let html = ler('index.html')
  .replace('<link rel="manifest" href="manifest.webmanifest">\n', '')
  .replace('<link rel="apple-touch-icon" href="assets/icone.svg">\n', '')
  .replace('href="assets/icone.svg" type="image/svg+xml"', `href="${icone}" type="image/svg+xml"`)
  .replace('<link rel="stylesheet" href="css/app.css">', `<style>\n${estilo}\n</style>`)
  .replace('<script type="module" src="js/app.js"></script>', `<script>\n${guiao}\n</script>`);

html = html.replace('</head>', `<!-- Gerado por construir-ficheiro-unico.mjs a partir de index.html, css/ e js/.
     Não editar à mão: as alterações pertencem aos ficheiros de origem. -->
</head>`);

writeFileSync(join(raiz, 'a-horas-ficheiro-unico.html'), html, 'utf8');

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0);
console.log(`a-horas-ficheiro-unico.html criado (${kb} KB, ${MODULOS.length} módulos).`);
