# Como usar o sistema de memória

Baseado no [Sistema de memória do Claude](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/main/docs/tools/09-claude-memory-system.md)
do Vibe Coding Toolkit. Referência completa lá; aqui vai o essencial pra uso
diário neste projeto.

## Critério de salvamento

Antes de escrever uma entrada nova em `MEMORY.md`, aplicar este teste:

> Uma sessão futura ficaria surpresa e grata de saber disso antes de começar?

Se a resposta for não, **não salvar**. Isso exclui:

- Qualquer coisa derivável só de ler o código ou o histórico do Git.
- Prazos, motivações ou contexto temporário do momento atual.
- Passos de debug ou receita de correção (isso já mora na mensagem do commit).
- Qualquer coisa já documentada em `CLAUDE.md`/`README.md`.

Errar pro lado de não salvar. Um índice pequeno e de alto sinal vence um índice
grande que ninguém lê.

## Formato de uma entrada

Um arquivo por tópico em `.claude/memory/`, nome em kebab-case, com frontmatter:

```markdown
---
name: slug-em-kebab-case
description: resumo de uma linha — usado pra decidir relevância em sessões futuras
metadata:
  type: feedback | architecture | business-rule | reference
---

O fato ou a regra em si, por que importa, e quando se aplica.
```

`type` é um conjunto fixo de quatro valores — não inventar categoria nova:

- **`feedback`** — um erro que precisou de correção durante uma sessão.
- **`architecture`** — um padrão descoberto só depois de tentativa que falhou.
- **`business-rule`** — algo que afeta o código/conteúdo mas não é óbvio.
- **`reference`** — onde uma informação externa mora (painel, wiki, sistema de
  tickets, biblioteca de assets da Kronus Digital, etc.).

Depois de criar o arquivo, adicionar uma linha em `MEMORY.md` apontando pra ele.

## Política de crescimento

Quando `MEMORY.md` passar de ~130 linhas, não apagar entradas de baixo valor —
migrar pra um armazenamento de longo prazo (uma pasta de documentação, um
vault do Obsidian, uma wiki — o que o projeto já usar), nesta ordem, sem pular
passo:

1. Checar duplicidade no destino de longo prazo.
2. Adequar ao formato/template exigido pelo destino.
3. Criar a entrada lá.
4. Confirmar lendo a entrada recém-criada de volta.
5. Só então apagar o arquivo de curto prazo e a linha dele em `MEMORY.md`.

Nunca pular direto pro passo 5 — uma migração não confirmada é perda de dado.
