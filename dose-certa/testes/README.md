# Testes

## Motor de horários (sem navegador)

Verifica posologias, agrupamento em momentos, existências, adesão e o ficheiro
`.ics`. Não precisa de nada instalado além do Node.

```bash
cd dose-certa/testes
node horarios.teste.mjs
```

## Interface, ponta a ponta

Percorre a aplicação num navegador: primeira utilização, criar medicamentos,
registar tomas, caixa semanal, histórico, ajustes, persistência e acessibilidade
do esquema. Falha se aparecer qualquer erro na consola.

```bash
cd dose-certa
python3 -m http.server 8099 &     # servidor local
npm install playwright             # numa pasta à parte, se preferir
node testes/interface.teste.mjs
```

Variáveis opcionais: `BASE_URL` (por omissão `http://localhost:8099`) e
`PW_CHROME` (caminho para um Chromium já instalado).

## Versão de ficheiro único

Confirma que `dose-certa-ficheiro-unico.html` abre a partir do disco (`file://`),
sem servidor, e que o essencial funciona.

```bash
cd dose-certa
node construir-ficheiro-unico.mjs
node testes/ficheiro-unico.teste.mjs
```

O próprio script de construção recusa-se a gerar o ficheiro se dois módulos
declararem o mesmo nome no topo — num ficheiro único isso colidiria em silêncio.

## Migração do nome anterior

A aplicação chamou-se «A Horas» antes de passar a «Dose Certa». Quem experimentou
a versão anterior tem dados guardados sob a chave antiga do navegador; este teste
garante que nada se perde na mudança — medicamentos, stock, histórico, horas das
refeições e preferências de acessibilidade — e que a migração nunca escreve por
cima de dados mais recentes.

```bash
cd dose-certa
python3 -m http.server 8099 &
node testes/migracao.teste.mjs
```

## Avisos e diagnóstico

Os avisos são a parte que falha em silêncio com mais facilidade, porque cada
ambiente os recusa à sua maneira. Esta suite percorre os quatro cenários —
aberto do disco, autorização por dar, autorização concedida e avisos bloqueados
nas definições — e confirma que a aplicação explica sempre o que se passa. Cobre
também o guia de importação para o calendário.

```bash
cd dose-certa
node construir-ficheiro-unico.mjs      # o cenário file:// usa o ficheiro único
python3 -m http.server 8099 &
node testes/avisos.teste.mjs
```
