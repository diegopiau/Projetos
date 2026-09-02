# Kronus Digital

> Memória de projeto para o Claude Code. Mantenha este arquivo curto e de alto sinal.
> Se você preencher as seções `[PLACEHOLDER]` abaixo à medida que o projeto ganhar
> stack e convenções definidas, este arquivo continua útil — ele não serve pra nada
> se ficar genérico pra sempre.

## Diretrizes de comportamento

1. **Pensar antes de codar** — declarar suposições explicitamente. Se existem várias
   interpretações possíveis, apresentá-las em vez de escolher uma sozinho. Avisar
   quando existe uma abordagem mais simples. Se algo é genuinamente ambíguo, parar
   e perguntar.
2. **Simplicidade primeiro** — o mínimo de código que resolve o problema. Sem
   funcionalidade especulativa, sem abstração pra código de uso único, sem
   configurabilidade não pedida, sem tratamento de erro pra cenário impossível.
3. **Mudanças cirúrgicas** — tocar só no que o pedido exige. Respeitar o estilo já
   existente. Não refatorar, reformatar ou "melhorar" código vizinho que não fazia
   parte do pedido.
4. **Execução orientada a objetivo verificável** — transformar tarefas em metas
   checáveis (ex.: "corrigir o bug" vira "escrever um teste que reproduz o bug,
   depois fazer ele passar"). Em tarefas de vários passos, declarar um plano curto
   com um jeito de verificar cada passo, e só seguir adiante depois de confirmar.
5. **Orquestrador, não implementador** — a sessão principal planeja, decide e
   coordena; ela não implementa sozinha. Trabalho de implementação e análise que
   pode ser delegado vai para um subagente especialista, disparado em paralelo
   quando os escopos das tarefas não colidem (ver
   `.claude/rules/parallel-subagent-driven-development.md`).

## Stack

[PLACEHOLDER: linguagens, frameworks e gerenciador de pacotes do projeto Kronus
Digital — ex. "TypeScript · Next.js + React · npm"]

## Comandos canônicos

Sempre usar os comandos exatos daqui — não adivinhar.

- **Install:** `[PLACEHOLDER]`
- **Lint:** `[PLACEHOLDER]`
- **Typecheck:** `[PLACEHOLDER]`
- **Test:** `[PLACEHOLDER]`
- **Build:** `[PLACEHOLDER]`
- **Run/Dev:** `[PLACEHOLDER]`

## Memória do projeto

No início de cada sessão, ler `.claude/memory/MEMORY.md` — o índice de lições
caras de aprender de novo (erros já corrigidos, regras de negócio implícitas,
decisões de arquitetura que só fazem sentido sabendo o que já foi tentado). O
critério de quando registrar uma entrada nova está em
`.claude/memory/INSTRUCTIONS.md`.

## Tabela de roteamento de subagentes

Ao delegar trabalho, disparar o especialista que combina com a tarefa em vez de
um agente genérico. Conjunto inicial — ajuste conforme o projeto crescer:

| Agente | Quando usar |
|---|---|
| `orchestrator` | Coordena tarefas multi-domínio ou que precisam de subagentes em paralelo. |
| `code-reviewer` | Revisa mudanças de código por bugs, segurança, tratamento de erro e cobertura de teste. Usar depois de editar qualquer arquivo de código. |
| `security-reviewer` | Revisa código contra o OWASP Top 10, segredos hardcoded, falhas de autenticação e CVEs de dependência. Usar antes de qualquer merge que toque autenticação, input de usuário ou segredos. |
| `test-engineer` | Escreve testes unitários e de integração com disciplina de TDD e cobertura de casos de borda. Usar depois de implementar lógica nova. |
| `frontend-specialist` | Implementa UI, layout e performance de front-end — o grosso do site/app institucional da Kronus Digital provavelmente cai aqui. |
| `backend-specialist` | Implementa endpoints de API, lógica de servidor e persistência — formulários de contato, integrações, CMS. |

## Convenções

[PLACEHOLDER: estilo de import, convenções de teste, regras de formatação/lint,
padrões de tratamento de erro etc.]

## Saiba mais

Guia completo de como usar cada ferramenta do Vibe Coding Toolkit neste projeto:
[`docs/vibe-coding-toolkit-guia.md`](docs/vibe-coding-toolkit-guia.md).
