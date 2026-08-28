# Testes

## Motor de horários (sem navegador)

Verifica posologias, agrupamento em momentos, existências, adesão e o ficheiro
`.ics`. Não precisa de nada instalado além do Node.

```bash
cd a-horas/testes
node horarios.teste.mjs
```

## Interface, ponta a ponta

Percorre a aplicação num navegador: primeira utilização, criar medicamentos,
registar tomas, caixa semanal, histórico, ajustes, persistência e acessibilidade
do esquema. Falha se aparecer qualquer erro na consola.

```bash
cd a-horas
python3 -m http.server 8099 &     # servidor local
npm install playwright             # numa pasta à parte, se preferir
node testes/interface.teste.mjs
```

Variáveis opcionais: `BASE_URL` (por omissão `http://localhost:8099`) e
`PW_CHROME` (caminho para um Chromium já instalado).

## Versão de ficheiro único

Confirma que `a-horas-ficheiro-unico.html` abre a partir do disco (`file://`),
sem servidor, e que o essencial funciona.

```bash
cd a-horas
node construir-ficheiro-unico.mjs
node testes/ficheiro-unico.teste.mjs
```

O próprio script de construção recusa-se a gerar o ficheiro se dois módulos
declararem o mesmo nome no topo — num ficheiro único isso colidiria em silêncio.
