# A Horas

Aplicação para organizar e lembrar a medicação diária de quem toma muitos
medicamentos. Feita em resposta a um problema concreto: cerca de vinte tomas por
dia, umas já preparadas na caixa semanal e outras dependentes de horários
rígidos — de 8 em 8 horas, de 12 em 12, meia hora antes das três refeições
principais — e a organização a resvalar para a confusão.

> **A Horas não dá conselhos médicos.** Ajuda a organizar e a lembrar. Não
> altera doses, não sugere medicamentos e não substitui o médico nem o
> farmacêutico. Nunca mude, junte ou pare um medicamento por causa do que a
> aplicação mostra.

## O que resolve

| Problema | Resposta da aplicação |
| --- | --- |
| Vinte tomas soltas ao longo do dia | Agrupa as tomas próximas em **momentos** — normalmente cinco ou seis por dia, cada um com um único botão de confirmação |
| Momentos a mais, por horas escolhidas à pressa | **Simplificar o dia**: propõe passar tomas de hora livre para horas que já se usam, sem nunca tocar no que tem razão clínica para estar onde está |
| «De 8 em 8 horas», «30 min antes das refeições» | Escolhe-se a posologia em linguagem corrente; as horas são calculadas |
| Umas na caixa semanal, outras na embalagem | Cada toma diz **onde está o comprimido**: 📅 na caixa semanal ou 📦 na embalagem |
| Encher a caixa é trabalhoso e propício a erros | Ecrã **Caixa semanal** com as quantidades por dia, para riscar à medida que se enche — e um mapa para imprimir |
| «Já tomei ou não?» | Cada momento fica registado com a hora; o dia mostra o que falta |
| O medicamento acabou sem se dar por isso | Controlo de existências que desconta a cada toma e avisa com dias de antecedência |
| A consulta e a lista de medicamentos | Folha para imprimir e ficheiro CSV com a adesão do período |
| Perder o aviso | Notificação, som, voz em português e alarme em ecrã inteiro |

## Simplificar o dia

O problema de origem não é a lista de medicamentos: é o número de vezes por dia
em que é preciso parar tudo. Alguns desses momentos são inevitáveis — um
intervalo de 8 em 8 horas, uma toma meia hora antes do almoço. Outros são
arbitrários: uma hora escrita à pressa na altura de registar o medicamento, que
podia perfeitamente coincidir com um momento que já existe.

Quando o dia passa dos seis momentos, a aplicação propõe juntar os arbitrários.
As regras são conservadoras e estão testadas uma a uma:

**Nunca move**
- tomas com intervalo fixo (8/8h, 12/12h)
- tomas ligadas a refeições
- tudo o que precise de jejum, de comida, de ser antes ou depois de comer
- tomas a mais de 90 minutos do momento mais próximo

**Pode mover**
- tomas de hora livre e sem qualquer restrição alimentar, e só para uma hora
  onde já existe outra toma

A proposta é sempre explícita («Biloban: 09:00 passa para 08:00»), pede
confirmação, lembra que a mudança deve ser falada com o médico ou farmacêutico,
e desfaz-se editando o medicamento.

## Como está feita

Site estático: HTML, CSS e JavaScript sem dependências, sem compilação e sem
servidor. Basta copiar a pasta para qualquer alojamento.

```
a-horas/
├── index.html
├── a-horas-ficheiro-unico.html   Versão de um só ficheiro, para experimentar
├── construir-ficheiro-unico.mjs  Gera a versão acima a partir das fontes
├── manifest.webmanifest      Instalação no ecrã inicial (PWA)
├── sw.js                     Funcionamento sem internet
├── css/app.css
├── assets/                   Ícones
└── js/
    ├── app.js                Arranque, navegação, alarme em ecrã inteiro
    ├── dados.js              Modelo, gravação local e datas
    ├── horarios.js           Posologias → horas → momentos; existências; .ics
    ├── avisos.js             Notificações, som, voz
    ├── vistas.js             Os cinco ecrãs
    ├── ui.js                 Auxiliares de interface
    └── formulario.js         Criar e editar medicamentos
```

Os dados ficam no `localStorage` do dispositivo. **Não há contas, servidores nem
seguimento** — nada sai do telemóvel. É também por isso que a cópia de segurança
importa: ver *Ajustes → Cópia de segurança*.

## Experimentar

### 1. Depressa, sem instalar nada

Abra **`a-horas-ficheiro-unico.html`** com duplo clique. É a aplicação inteira
num só ficheiro: funciona a partir do disco, sem servidor, e dá para enviar por
e-mail a quem a queira ver.

O que **não** funciona assim, por imposição dos navegadores a partir de
`file://`: notificações do sistema e funcionamento offline. Todo o resto —
medicamentos, momentos, caixa semanal, histórico, ajustes — funciona.

O ficheiro é gerado a partir das fontes; não o edite à mão:

```bash
node construir-ficheiro-unico.mjs
```

### 2. No computador, com tudo a funcionar

`localhost` conta como origem segura, por isso aqui já há notificações e
funcionamento offline:

```bash
cd a-horas
python3 -m http.server 8099
```

Abra `http://localhost:8099`, autorize os avisos quando a aplicação pedir, e
experimente *Ajustes → Experimentar um aviso*.

Para simular uma toma iminente sem esperar: em *Ajustes*, acerte as horas das
refeições para daqui a um ou dois minutos.

### 3. No telemóvel, a sério

Este é o teste que conta, porque é onde a aplicação vai viver. Publique numa
pasta do seu domínio (ver abaixo) e abra pelo telemóvel. Depois:

1. *Adicionar ao ecrã principal*, para abrir como aplicação.
2. Autorizar os avisos.
3. *Ajustes → Enviar tomas para o calendário* e importar o `.ics`.
4. Deixar chegar uma hora de toma com o telemóvel pousado.

> Aceder por `http://192.168.x.x:8099` a partir do telemóvel **não** serve para
> testar os lembretes: sem HTTPS o navegador desliga notificações e service
> worker. Serve para ver o aspecto e o toque, nada mais.

## Publicar

Copie o conteúdo da pasta `a-horas/` para a raiz de um domínio (ou subdomínio) e
está feito. Exemplo com um alojamento por FTP/SFTP:

```bash
rsync -av --delete a-horas/ utilizador@servidor:/var/www/ahoras/
```

Ou, no GitHub Pages, coloque estes ficheiros na raiz do repositório publicado.

### Um requisito importante: HTTPS

As notificações, a instalação no ecrã inicial e o funcionamento sem internet só
existem em **HTTPS**. Em `http://` a aplicação continua a funcionar, mas sem
lembretes. Qualquer certificado gratuito (Let's Encrypt) serve.

### Ao publicar uma versão nova

Altere a constante `VERSAO` no topo de `sw.js` (por exemplo `a-horas-v2`). Sem
isso, os telemóveis que já visitaram o site continuam a mostrar a versão antiga
guardada.

## Os lembretes, com honestidade

Um site — mesmo instalado como aplicação — **só consegue avisar enquanto está
aberto**, ainda que em segundo plano. Não há como contornar isto sem um servidor
de notificações. A aplicação assume-o e oferece três camadas:

1. **Com a aplicação aberta:** notificação do sistema, som, voz e alarme em ecrã
   inteiro com botões grandes.
2. **Com a aplicação fechada:** *Ajustes → Enviar tomas para o calendário* gera
   um ficheiro `.ics` com todas as tomas e respetivos alarmes. Importado para o
   calendário do telemóvel, os alarmes passam a ser do sistema operativo e tocam
   sempre. **É esta a camada que garante o aviso** — vale a pena fazê-lo logo no
   primeiro dia, e repetir sempre que a medicação mudar.
3. **Em papel:** *Caixa semanal → Imprimir mapa*, para afixar na cozinha.

Se um dia isto passar a ter servidor, o passo seguinte é *Web Push* com
`pushManager` — o `sw.js` já está preparado para receber o evento.

## Boas práticas que a aplicação segue

**Para o público-alvo (pessoas idosas, com muitos medicamentos)**

- Letra grande por omissão (20 px), com opção *Muito grande*.
- Modo de **contraste alto** (fundo preto, letras amarelas) para baixa visão.
- Alvos de toque de 60 px — bem acima dos 44 px mínimos recomendados.
- Uma decisão por ecrã, sem menus escondidos nem gestos a descobrir.
- Confirmação por momento, não por comprimido: um toque resolve seis medicamentos.
- Linguagem corrente em português de Portugal, sem termos técnicos: «de 8 em 8
  horas», não «q8h»; «30 minutos antes das refeições», não «AC».
- Leitura em voz alta, para quem vê mal.
- Nada de vermelho a culpar: uma toma falhada é informação, não repreensão.
- Reduzir o número de decisões, não só apresentá-las melhor: daí a simplificação
  do dia, que é a diferença entre listar o problema e resolvê-lo.

**De segurança**

- A aplicação **nunca** sugere doses, medicamentos ou alterações.
- A simplificação do dia mexe apenas em horas sem justificação clínica, e mesmo
  essas só com confirmação explícita.
- Avisa quando um momento junta um medicamento em jejum com outro que pede
  comida — e manda perguntar ao médico, sem decidir por si.
- «Saltar» pede confirmação e explica o que fica registado.
- O aviso de que isto não é aconselhamento clínico aparece no primeiro
  arranque e fica permanentemente em *Ajustes*.

**Técnicas**

- Sem dependências externas: nada de CDN a falhar nem versões a envelhecer.
- Sem `innerHTML` com dados do utilizador — todo o texto entra por `textContent`.
- Datas sempre em hora local; nunca UTC, que faz saltar o dia.
- Navegação por teclado e leitores de ecrã: `aria-pressed`, `aria-live`,
  `role="tablist"`, foco visível.
- Respeita `prefers-reduced-motion`.
- Folha de estilo com tokens, para o contraste alto ser uma troca de variáveis.

## Ideias para continuar

- **Perfil de cuidador** com vista só de leitura, partilhada por ligação.
- **Web Push** com um servidor mínimo, para lembretes garantidos sem calendário.
- **Ler a caixa pela câmara**, com leitura do código de barras (Infarmed).
- **Verificação de interações** ligada a uma base de dados clínica — com o
  cuidado de nunca aconselhar, apenas remeter para o farmacêutico.
- **Sincronização entre dispositivos**, se e quando houver servidor. Enquanto não
  houver, a cópia de segurança em ficheiro é o mecanismo.

## Desenvolvimento

Não há passo de compilação. Para ver localmente:

```bash
cd a-horas
python3 -m http.server 8099
# abrir http://localhost:8099
```

`localhost` conta como origem segura, por isso os avisos e o service worker
funcionam também em desenvolvimento.
