# Guia do Vibe Coding Toolkit para o Kronus Digital

Fonte: [soumatheusgomes/vibe-coding-toolkit](https://github.com/soumatheusgomes/vibe-coding-toolkit)
(autor: Matheus Gomes, licença MIT). Não é uma coleção de "skills" no sentido
técnico do Claude Code (arquivos `SKILL.md`) — é um método que combina um
plugin central (Superpowers), um protocolo de orquestração de subagentes,
alguns plugins/CLIs de terceiros, e um punhado de templates e prompts prontos.

Este documento explica **o que já foi instalado neste repositório** (arquivos,
versionados, valem pra qualquer sessão de Claude Code neste projeto) e **o que
só você consegue instalar** (plugins e CLIs vivem na sua máquina/conta, não em
arquivo de repositório) — com o comando exato de cada um e como encaixar cada
peça no dia a dia do Kronus Digital.

> Assumi que o "projeto Kronus Digital" é este repositório. Se na verdade ele
> mora numa pasta separada ou noutro repositório, mova `CLAUDE.md`, a pasta
> `.claude/` e este guia pra lá — o conteúdo não depende de estar na raiz do
> `Projetos`.

## O que já está pronto neste repositório

| Arquivo | Pra que serve |
|---|---|
| `CLAUDE.md` | Instruções de projeto carregadas automaticamente em toda sessão — diretrizes de comportamento, tabela de roteamento de subagentes, e os `[PLACEHOLDER]` de stack/comandos/convenções pra você preencher assim que o projeto tiver isso definido. |
| `.claude/rules/parallel-subagent-driven-development.md` | O protocolo de ondas paralelas — como rodar tarefas independentes ao mesmo tempo sem dois agentes colidirem no mesmo arquivo ou no mesmo commit. |
| `.claude/memory/MEMORY.md` + `.claude/memory/INSTRUCTIONS.md` | O sistema de memória entre sessões — índice curto + critério de quando vale registrar uma lição aprendida. Começa vazio. |
| `.claude/settings.json.example` + `.claude/hooks/hook-io.mjs.example` | Template de hooks (ações automáticas antes/depois de uma ferramenta rodar) e um helper que evita o bug clássico de `JSON.parse("null")` não lançar erro. Renomeie para `.claude/settings.json` só depois de escrever os hooks reais — como está, é referência, não config ativa. |

Nada disso precisa de instalação — são arquivos comuns, já commitados.

## Prioridade 1 — Superpowers

**O que é:** plugin oficial da Anthropic que impõe o fluxo
brainstorm → plano → implementação → revisão antes de qualquer linha de
código, em vez de deixar o agente arriscar a primeira interpretação plausível
de um pedido em aberto.

**Instalar** (dentro de uma sessão `claude`, na sua máquina):

```
/plugin marketplace add anthropics/claude-plugins-official
/plugin install superpowers@claude-plugins-official
```

**Como usar no Kronus Digital:** é o ponto de entrada de qualquer tarefa não
trivial — uma página nova do site institucional, um formulário de captação de
lead, uma integração com CRM. Em vez de pedir direto "implementa X", deixe o
Superpowers puxar brainstorm e plano primeiro; ele já respeita o `CLAUDE.md`
que está na raiz do repositório. Se você só for configurar uma coisa deste
toolkit inteiro, que seja esta.

## Orquestração de subagentes em ondas paralelas (já configurado)

**O que é:** com Superpowers instalado, a sessão principal vira orquestradora
— ela planeja e delega, nunca implementa sozinha — pra um time de subagentes
especialistas. A regra em `.claude/rules/parallel-subagent-driven-development.md`
permite disparar vários desses subagentes ao mesmo tempo quando as tarefas não
compartilham arquivo nem dependência entre si.

**Como usar:** útil assim que o Kronus Digital tiver mais de uma frente
independente em andamento — por exemplo, uma página nova + um ajuste de SEO +
um componente de UI isolado. Peça pro Claude Code formar "ondas" a partir do
plano do Superpowers; a tabela de roteamento em `CLAUDE.md` já tem os papéis
mais prováveis (`frontend-specialist`, `backend-specialist`, `code-reviewer`,
`security-reviewer`, `test-engineer`) — adicione linhas conforme o projeto
crescer. Doc de referência completo (roster de ~20 papéis):
[`docs/tools/02-subagent-orchestration.md`](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/main/docs/tools/02-subagent-orchestration.md).

## Sistema de memória (já configurado)

**O que é:** `MEMORY.md` é lido no início de toda sessão; guarda só o que
seria caro reaprender do zero — uma regra de negócio da Kronus Digital que o
código não deixa óbvia, uma decisão de arquitetura que só faz sentido sabendo
o que já foi tentado e descartado.

**Como usar:** não precisa fazer nada agora — o índice começa vazio de
propósito. Quando uma sessão gastar tempo descobrindo algo que uma sessão
futura devia saber de cara, aplique o teste em
`.claude/memory/INSTRUCTIONS.md` ("uma sessão futura ficaria surpresa e grata
de saber disso?") e registre. Se o índice passar de ~130 linhas, siga a
política de migração pra um armazenamento de longo prazo antes de continuar
adicionando.

## Quality gates de lint (ESLint + Biome) — configurar quando a stack existir

**O que é:** dois linters, papéis sem sobreposição — Biome cobre um punhado
curado de regras rápidas, ESLint cobre o resto (regras que precisam de
informação de tipo e regras específicas do framework). Promoção de aviso pra
erro vira uma migração rastreada, não uma trava abrupta pro time inteiro.

**Como usar no Kronus Digital:** só faz sentido a partir do momento em que o
projeto tiver uma stack de código real (ex.: o site institucional em Next.js,
uma automação em Node). Quando chegar lá, use o prompt pronto
[`docs/prompts/07-eslint-complete-setup.md`](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/main/docs/prompts/07-eslint-complete-setup.md)
pra montar a config do zero, e
[`docs/tools/06-eslint-biome-quality-gates.md`](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/main/docs/tools/06-eslint-biome-quality-gates.md)
como referência completa. Se já existir uma base de código com avisos
acumulados, use
[`docs/prompts/02-eslint-warning-burndown.md`](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/main/docs/prompts/02-eslint-warning-burndown.md)
pra zerar sem virar refatoração silenciosa.

## Ponytail — persona "engenheiro sênior preguiçoso"

**O que é:** uma escada de decisão que para na opção mais simples que resolve
o problema de verdade, antes de escrever qualquer código — nunca à custa de
segurança ou validação.

**Instalar:**

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

**Como usar:** ativa por padrão depois de instalado; segura o agente de
propor soluções mais elaboradas do que o Kronus Digital precisa (ex.: não
montar uma arquitetura de microserviços pra um formulário de contato).

## Caveman — comunicação direta

**O que é:** corta enrolação e gentileza forçada das respostas do agente, sem
perder informação. Independente do Ponytail — um governa o que é construído,
o outro como o agente fala sobre isso.

**Instalar:**

```
/plugin marketplace add JuliusBrussee/caveman
/plugin install caveman@caveman
```

**Como usar:** puramente de comunicação — ative se preferir respostas mais
secas no dia a dia; não muda comportamento de código.

## Atalho — aia-harness (monta boa parte da base sozinho)

**O que é:** plugin com o comando `/aia-harness:init`, que escaneia o projeto
e monta agentes especialistas, regras, hooks, memória e `settings.json`
automaticamente — em vez de montar peça por peça como fizemos manualmente
acima.

**Instalar:**

```
/plugin marketplace add leandrosilvaferreira/claude-plugins-registry
/plugin install aia-harness@leandro-plugins-registry
```

**Como usar:** rode `/aia-harness:init` depois de instalado — ele vai detectar
que já existe `CLAUDE.md` e a pasta `.claude/` e pode complementar em vez de
sobrescrever (revise o diff antes de aceitar). Útil principalmente quando o
Kronus Digital ganhar uma stack de código real e você quiser a base regerada
a partir da estrutura real do projeto.

## Graphify — grafo de conhecimento do projeto

**O que é:** transforma uma pasta de código, docs ou imagens num grafo de
conhecimento persistente — responde "o que quebra se eu mudar isso" numa
consulta só, em vez de dezenas de greps.

**Instalar** (CLI independente, fora da sessão `claude`):

```
uv tool install graphifyy
graphify claude install
```

**Como usar:** vale a pena a partir do momento em que o Kronus Digital tiver
volume de arquivos suficiente pra "onde isso é usado?" deixar de ser trivial
— um site institucional com várias páginas, componentes e integrações.

## agent-browser — automação de navegador pra agentes de IA

**O que é:** CLI de automação que trabalha com árvore de acessibilidade em
vez de screenshot ou seletor CSS frágil — aguenta re-renderização de página
melhor que scraping tradicional.

**Instalar:**

```
npm i -g agent-browser
agent-browser install
```

**Como usar:** útil pra testar o site/app da Kronus Digital de ponta a ponta
(formulário de contato enviando de verdade, navegação funcionando) sem
depender de screenshot manual.

## Context7 — documentação de biblioteca atualizada

**O que é:** servidor MCP que injeta documentação de biblioteca
versionada e atual direto no contexto do agente, evitando API alucinada de
modelo com data de corte.

**Instalar** (abre um fluxo de login no navegador — o clique de confirmação é
seu):

```
npx ctx7 setup --claude
```

**Como usar:** ativa em segundo plano; ajuda sempre que o Kronus Digital usar
uma biblioteca ou framework que mudou depois do treinamento do modelo.

## Chrome DevTools MCP — diagnóstico ao vivo no navegador

**O que é:** servidor MCP oficial do time do Chrome — dá acesso a uma sessão
real do navegador pra diagnosticar performance, rede e console ao vivo.
Complementa o agent-browser: um automatiza um fluxo, o outro investiga o que
está acontecendo nele.

**Instalar:**

```
claude mcp add chrome-devtools --scope user npx chrome-devtools-mcp@latest
```

**Como usar:** rode diagnóstico de performance/Core Web Vitals no site da
Kronus Digital direto do Claude Code, sem abrir o DevTools manualmente.

## Anthropic Skills — já disponíveis nesta conta, sem instalação

**O que é:** o repositório oficial da Anthropic com skills de referência —
geração real de `.docx`/`.pdf`/`.pptx`/`.xlsx`, mais skills "meta" (criar suas
próprias skills, criar servidores MCP). Doc de referência:
[`docs/tools/13-anthropics-skills.md`](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/main/docs/tools/13-anthropics-skills.md).

**Status:** já ativas nesta sessão/conta — não precisa instalar nada. Use
diretamente pedindo, por exemplo, "monta uma proposta comercial em docx pra
Kronus Digital" ou "gera uma planilha de orçamento em xlsx".

## RTK — proxy de tokens (padrão, não binário público)

Documentado no toolkit como padrão pra replicar, não como ferramenta pronta
pra baixar — reescreve comandos repetitivos (status, diff, log) em versões
compactas antes de rodar, economizando tokens em sessões longas. Relevante só
se as sessões no Kronus Digital ficarem longas o bastante pra isso importar;
veja [`docs/tools/03-rtk-token-proxy.md`](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/main/docs/tools/03-rtk-token-proxy.md)
se quiser implementar a ideia.

## Obsidian como memória de longo prazo (opcional, pra quando `MEMORY.md` encher)

Só entra em cena quando o índice rápido em `.claude/memory/MEMORY.md` passar
do teto de ~130 linhas e precisar de destino de migração. Não é urgente agora
— o índice começa vazio. Referência:
[`docs/tools/08-obsidian-memory.md`](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/main/docs/tools/08-obsidian-memory.md).

## Prompts prontos pra colar

Ficam em [`docs/prompts/`](https://github.com/soumatheusgomes/vibe-coding-toolkit/tree/main/docs/prompts)
no repositório original (em inglês, de propósito — funcionam melhor assim,
independente do idioma de quem lê a explicação ao redor):

| Prompt | Quando usar no Kronus Digital |
|---|---|
| `01-project-sanitation.md` | Faxina geral no código depois de um período sem cuidado — mede antes de agir. |
| `02-eslint-warning-burndown.md` | Zerar uma pilha de warnings de lint acumulada, sem virar refatoração silenciosa. |
| `03-multi-agent-code-review.md` | Revisão paralela por vários especialistas antes de um merge importante (ex.: mudança que toca pagamento/lead). |
| `04-brainstorm-to-plan.md` | Transformar um pedido em aberto num plano de implementação de verdade. |
| `05-parallel-wave-dispatch.md` | Quebrar uma lista de tarefas em ondas paralelas seguras. |
| `06-memory-bootstrap.md` | Já aplicado manualmente neste repositório — reveja se quiser recriar o sistema de memória do zero noutro projeto. |
| `07-eslint-complete-setup.md` | Montar `eslint.config.mjs` do zero quando a stack de código existir. |

## Por onde começar, na prática

1. Instale o Superpowers (comando acima) — é a peça que muda como a sessão
   inteira se comporta.
2. Preencha os `[PLACEHOLDER]` de `CLAUDE.md` assim que a stack do site/app da
   Kronus Digital estiver decidida.
3. Peça pro Superpowers levar o primeiro pedido real pelo fluxo
   brainstorm → plano → implementação → revisão, deixando a orquestração de
   subagentes (já configurada) dividir o trabalho quando fizer sentido.
4. Instale Ponytail e Caveman se quiser as personas de decisão e comunicação
   — opcionais, não bloqueiam nada do resto.
5. Deixe quality gates, Graphify, agent-browser e os MCPs (Context7, Chrome
   DevTools) pra quando houver código/site de verdade rodando — instalar
   antes disso é config sem nada pra proteger ainda.
