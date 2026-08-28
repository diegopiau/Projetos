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
