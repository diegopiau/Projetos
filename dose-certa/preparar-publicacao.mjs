/* ==========================================================================
   preparar-publicacao.mjs
   --------------------------------------------------------------------------
   Reúne em `publicar/dose-certa/` apenas o que vai para o servidor, e cria o
   `publicar/dose-certa.zip` pronto a enviar por FTP ou a largar num painel de
   alojamento.

   Fica de fora tudo o que não serve ao utilizador final: testes, o ficheiro
   único, os scripts e a documentação.

       node preparar-publicacao.mjs
   ========================================================================== */

import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = dirname(fileURLToPath(import.meta.url));
const destino = join(raiz, 'publicar');
const pasta = join(destino, 'dose-certa');

const CONTEUDO = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'assets'];

/* --- A cache do service worker é a armadilha destas publicações -----------
   Se a VERSAO não mudar, os telemóveis que já visitaram o site continuam a
   servir a versão antiga e a actualização passa despercebida. Comparamos com
   a última publicação para avisar a tempo. */

const sw = readFileSync(join(raiz, 'sw.js'), 'utf8');
const versao = sw.match(/const VERSAO = '([^']+)'/)?.[1];
if (!versao) throw new Error('Não encontrei a constante VERSAO em sw.js.');

const registo = join(destino, '.ultima-versao');
const anterior = existsSync(registo) ? readFileSync(registo, 'utf8').trim() : null;

/* --- Montagem ------------------------------------------------------------ */

rmSync(pasta, { recursive: true, force: true });
mkdirSync(pasta, { recursive: true });
CONTEUDO.forEach((item) => cpSync(join(raiz, item), join(pasta, item), { recursive: true }));

const zip = join(destino, 'dose-certa.zip');
rmSync(zip, { force: true });
try {
  execFileSync('zip', ['-rq', zip, 'dose-certa'], { cwd: destino });
} catch {
  console.warn('(sem o comando `zip` — a pasta publicar/dose-certa/ ficou pronta na mesma)');
}

writeFileSync(registo, versao, 'utf8');

/* --- Relatório ----------------------------------------------------------- */

console.log(`publicar/dose-certa/ pronta (versão do service worker: ${versao})`);
if (existsSync(zip)) console.log('publicar/dose-certa.zip criado');
console.log('\nEnvie a pasta para o alojamento, de modo a ficar acessível em');
console.log('https://o-seu-dominio/dose-certa/');

if (anterior && anterior === versao) {
  console.log(`\n⚠  A VERSAO em sw.js continua "${versao}", igual à da última publicação.`);
  console.log('   Se mudou alguma coisa na aplicação, altere-a (ex.: dose-certa-v2) e');
  console.log('   volte a correr este script — senão os telemóveis que já visitaram o');
  console.log('   site continuam a mostrar a versão antiga.');
}
