# Sessão de leitura: design

- **Data:** 2026-09-20 · **Status:** decisões fechadas com o time de produto; aguarda revisão desta spec
- **Base:** `main` @ `8acdd37`
- **Issue:** [BER-115](https://linear.app/tpgn/issue/BER-115) · relacionadas: BER-116 (entitlement da Apple), BER-117 (Expo SDK), BER-119 (ambiente local), BER-100 (assistente de leitura)
- **Origem:** sessão de grilling de 20/09/2026. Decisões com motivo e evidência em
  `bereading-docs/produto/sessao-de-leitura/decisoes.md`; pesquisa crua, com tags de confiança, em
  `bereading-docs/pesquisa/`.

> Repositório público: nada aqui traz dado pessoal nem material de negócio.

---

## 1. Objetivo

Dar à leitura **um começo e um fim**.

A promessa deste ciclo, na voz do produto:

> **Um começo e um fim para a sua leitura. Enquanto ela dura, essa tela é a única coisa aberta.**

O leitor escolhe um tempo, um som marca o início, ele larga o celular e lê um livro de papel. No
fim, outro som, e o app pergunta até que página ele foi — registrando a leitura pelo caminho que já
existe.

### 1.1 A promessa que este ciclo NÃO faz

**"O celular para de te interromper" não é promessa do MVP.** Nenhum app de terceiro liga o Foco ou
silencia notificação alheia no iPhone: conferido na documentação da Apple, `SetFocusFilterIntent`
só adapta o comportamento do próprio app, e o `ManagedSettingsStore` não tem grupo de notificações.

Isso é desconfortável, porque **é justamente a promessa que a evidência sustenta**: o estudo famoso
sobre "celular na mesa atrapalha" não replicou, enquanto notificação atrapalha de forma consistente.
No Retratos da Leitura 2024 (n=5.504), **68% se interrompem para ver mensagens no digital, contra
10% no papel**.

Conclusão de produto: o ritual é o que dá para entregar hoje, nos dois sistemas, e ele já vale. O
silêncio de verdade é o ciclo 3, e depende da Apple (BER-116).

### 1.2 O que ela não é

- **Não é bloqueador de apps** neste ciclo.
- **Não é leitor de livro.** O livro está no papel ou em outro aparelho (§2.4).
- **Não é obrigação.** Um dia sem sessão não custa nada: registro obrigatório de leitura reduz a
  motivação comparado ao voluntário (Pak & Weseley 2012).

---

## 2. Decisões

A numeração segue o placar em `bereading-docs/produto/sessao-de-leitura/decisoes.md`, que traz a
evidência de cada uma.

| # | Decisão | Descartado, e por quê |
|---|---|---|
| S2 | Contagem regressiva por padrão, com 10, 20, 30 min, tempo personalizado e "sem tempo definido" | 25 minutos por causa do Pomodoro: não existe ensaio que sustente esse número, e o estudo disponível mostra que **o número não importa** (24/6 ≈ 12/3) |
| S3 | A sessão termina perguntando até que página você foi, e registra | Só parar o cronômetro: criaria um dado paralelo ao registro que já é o coração do app |
| S5 | **Tempo não vale XP.** É informação, com peso zero em XP, sequência e medalhas | Bônus por sessão concluída (era a recomendação anterior, foi derrubada pela evidência): recompensa por tempo engajado é a pior contingência medida |
| S7 | A tela pode apagar. Áudio principal, notificação de rede, "manter tela acesa" opcional | Exigir tela acesa: é o que o Insight Timer manda fazer na mão, e mesmo assim falha |
| S8 | Pausa explícita | Pausa automática ao sair do app: é o julgamento que o iOS não permite fazer |
| S9 | "Ler agora" vira a ação principal da Hoje | Item novo na barra de abas; um segundo botão flutuante (o assistente já tem o dele) |
| S11 | Na tela: tempo, livro, pausar, encerrar, assistente. Nenhum número de jogo | Mostrar sequência e XP durante a leitura |
| S12 | Recuperação por teto e confirmação | Bater ponto para adivinhar quando o app morreu: o tique para quando a pessoa larga o celular, que é o caso bom |
| S14 | O onboarding pergunta o **gatilho**, e o lembrete fala do evento | "Que horas você quer ler?": lembrete por horário sustenta repetição mas **atrapalha** a automaticidade |
| S17 | Ver ou não o cronômetro é escolha do leitor | Cronômetro fixo: o experimento do contador visível reduz o prazer da leitura |

---

## 3. A experiência

### 3.1 O fluxo

```
Hoje → "Ler agora"
  → escolhe o tempo (ou "sem tempo definido") e confirma o livro
  → som de início
  → tela da sessão: tempo, livro, pausar, encerrar, assistente
  → o leitor apaga a tela e lê
  → som de fim
  → "até que página você foi?" → registra a leitura (streak e XP de sempre)
  → resumo curto: tempo de leitura, páginas, e o que isso fechou
```

### 3.2 A tela da sessão

O tempo domina. O livro aparece pequeno, só para lembrar o que está sendo lido. Três ações:
**pausar**, **encerrar** e **assistente**.

Não aparece: XP, nível, sequência, progresso de capítulo, nenhuma meta. Durante a leitura não é hora
de pontuar — e há experimento mostrando que o contador visível **reduz o prazer** da leitura,
mediado por ela passar a parecer trabalho (Etkin, Experimento 4: 16,14 contra 13,44 páginas lidas,
com prazer caindo de 5,97 para 5,19).

**O leitor escolhe ver ou não o cronômetro** (S17). O padrão mostra; a alternativa é uma tela calma,
sem número, com o tempo aparecendo só ao toque.

### 3.3 O fim

O fim chega pelo som, ou porque a pessoa encerrou. Em qualquer um dos casos: **"até que página você
foi?"**, com o número anterior já preenchido, e "agora não" visível e discreto.

Encerrar antes do tempo **não é fracasso**: nenhuma tela de derrota, nada se perde, o que foi lido é
registrado. Ler 4 minutos é melhor que não ler.

### 3.4 Onde o livro está

Desenhada para **livro de papel ou outro aparelho**. Ler no próprio celular fica fora deste ciclo, e
a spec diz isso em voz alta: nesse caso o app fica em segundo plano a sessão inteira, e é exatamente
onde não dá para distinguir leitura de rede social no iOS. Contar ali seria inventar número, o que o
`mobile/DESIGN.md` proíbe.

### 3.5 O gatilho, no primeiro uso

Duas perguntas curtas, com uma frase explicando por quê ("é mais fácil criar um hábito quando ele
tem um gatilho claro"):

1. **"Depois de que coisa você vai ler?"** — depois do jantar, quando deitar, no transporte, depois
   do café, depois do treino, ou escreva a sua.
2. **"Mais ou menos que horas isso acontece?"**

O lembrete então chega no horário, mas **fala do evento**: *"Jantou? Bora ler."* Um por dia, no
máximo, e some no dia em que a pessoa já leu.

Por que assim: intenções de implementação ("quando X, farei Y") têm d = 0,65 em 94 testes com mais
de 8 mil pessoas; e o estudo que comparou os dois achou que **lembrete por horário sustenta a
repetição mas atrapalha a automaticidade**, enquanto gatilho por evento a aumenta. Numa revisão de
115 aplicativos, nenhum suportava gatilho por evento — é espaço vazio.

O horário se corrige sozinho: depois de algumas sessões, o app ajusta o lembrete para a mediana real
de início e avisa que ajustou.

---

## 4. O tempo, e por que ele não vale pontos

**Tempo é informação, nunca pontuação** (S5). Ele não entra em XP, não entra na sequência, não
destrava medalha.

Três razões:

1. **A evidência.** Na meta-análise de Deci, Koestner & Ryan (1999, 128 estudos), a contingência com
   o pior efeito medido é recompensar **tempo engajado** (d = −0,40 sobre motivação livre), pior que
   recompensar conclusão ou desempenho. A mesma revisão mostra devolutiva informativa ajudando
   (d = +0,66) e devolutiva controladora sendo pior que nada (d = −0,44). **Ressalva honesta: esses
   números não foram verificados na fonte primária** (duas tentativas, 404); estão marcados como
   pendência no arquivo de pesquisa.
2. **O mercado.** Nenhum produto de leitura estabelecido premia minutos. O Kindle premia dias,
   semanas, livros e medalhas, e usa minutos só como informação ("tempo restante no capítulo"). Os
   dois que medem tempo, Bookly e Basmo, não documentam como tratam pausa ou ociosidade.
3. **O oráculo.** Tempo não é verificável. Página é. O sinal que não infla já existe no app: a nota
   do quiz.

**O ganho do cronômetro não é pontuação: é que ele facilita e torna mais preciso o registro de
páginas**, que é o que o app já premia.

Se um dia o tempo entrar na pontuação, a regra herdada é: **teto no prêmio, nunca na leitura** — se
o tempo for implausível, nega-se o prêmio, jamais se apaga a leitura registrada.

---

## 5. O som, a tela apagada e o que a gente não sabe

**O que o benchmark faz:** o Insight Timer toca o sino pela **sessão de áudio do próprio app** (o
help centre deles diz que o timer tem controle de volume separado do volume do aparelho, o que só um
player faz). E eles **não prometem** que funcione com a tela apagada: mandam o usuário desligar o
bloqueio automático no iOS e liberar a bateria no Android. Ainda assim há reclamações de loja, de
2020 a 2026, de sinos que não tocam.

**O desenho, em camadas:**

1. **Áudio como caminho principal:** `expo-audio` com `shouldPlayInBackground` e `playsInSilentMode`
   (nomes conferidos na documentação do SDK 54), tocando em silencioso. No Android,
   `setActiveForLockScreen` promove a sessão a serviço de primeiro plano.
2. **Notificação local como rede**, agendada no mesmo instante e cancelada se o áudio tocar. Dois
   furos conhecidos: som personalizado **não funciona no Expo Go**, e notificação **não toca no
   silencioso**.
3. **"Manter a tela acesa"** como opção de quem quer garantia.
4. **A regra que vale mais que o som: o fim é um horário absoluto gravado.** Assim a sessão está
   correta mesmo quando o sino falha. É exatamente o erro que o concorrente brasileiro Leio tem
   registrado em reclamação de loja ("o cronômetro reinicia quando a tela apaga").

**O que não sabemos:** a documentação do Expo SDK 54 diz que áudio em segundo plano no iOS *"is only
available in standalone apps"*, mas o `Info.plist` do próprio Expo Go declara o modo de áudio. Não
há resposta no papel. **Testar em aparelho é a primeira tarefa técnica do ciclo 1**, não a última:
se falhar, a tela de fim muda.

No Android, em Expo Go, a notificação agendada é **inexata** — a documentação do Android admite
entrega "within one hour". Não prometer precisão lá.

---

## 6. Quando o app morre no meio

Não dá para gravar "morri agora": quando o app morre, ninguém está vivo para gravar. E enquanto o
celular está de lado com a tela apagada, que é o caso bom, o JavaScript fica suspenso — a Apple diz
que apps "don't normally receive any extra execution time".

A saída é **teto e confirmação**:

| Situação | O que a sessão vale |
|---|---|
| Com tempo definido | No máximo o tempo escolhido, nunca mais |
| Sem tempo definido | O tempo corrido, com teto de 1 hora |
| Em qualquer caso | Nunca mais que o último tique gravado mais uma folga |

Um tique de 30 segundos é gravado enquanto o app está vivo. Ele é **piso, nunca teto**: se fosse
teto, quem leu 30 minutos com o celular de lado apareceria com 2.

Ao reabrir, sobe uma folha inferior com um personagem e um texto curto: a sessão ficou aberta, o
tempo que está contando, e **até que página você foi**. O tempo é sempre ajustável, e "agora não"
está visível. Na dúvida, a proposta é sempre a menor das três — subcontar é honesto, inflar não.

**Tempo sem registro de página é guardado e não pontua** (S13). A Hoje lembra uma vez, sem insistir.
O número de sessões que terminam sem registro é um sinal de que a tela de fim está ruim, não de que
a pessoa é relapsa.

---

## 7. Dados

**Tabela nova.** A `reading_sessions` de hoje, apesar do nome, é um **intervalo de páginas**: não
tem duração, nem início, nem fim. Registro de páginas existe sem sessão (quem leu no ônibus e
registrou depois) e sessão existe sem páginas (quem pulou o registro), então são conceitos
diferentes e misturá-los estragaria a tabela que alimenta XP e medalhas.

A tabela nova guarda: início, fim previsto e fim real, duração de leitura, duração com o assistente,
pausas, interrupções (saídas do app), o livro, se foi recuperada depois de o app morrer, e o
vínculo com o registro de páginas que ela gerou, quando houve.

Regras, as mesmas da casa: **escrita só pelo servidor**, leitura só do dono, e a tabela entra em
`USER_OWNED_TABLES` do `delete-account`.

O gatilho e o horário do onboarding são preferência do leitor e ficam no perfil dele.

---

## 8. Testes

1. **Unidade (funções puras):** cálculo da duração a partir de horários absolutos; aplicação dos
   tetos da §6; o tique como piso; a virada do dia no fuso de São Paulo.
2. **Recuperação:** app morto com e sem tempo definido, sessão retomada dentro e fora do tempo, e a
   proposta que sobe na folha em cada caso.
3. **App (jest):** a tela da sessão com e sem cronômetro; pausar e retomar; encerrar antes do tempo;
   a folha de fim registrando as páginas; "agora não".
4. **Banco:** a migration aplica do zero; um leitor não lê a sessão de outro; `delete-account` apaga.
5. **Em aparelho, e sem atalho:** o som tocando com a tela apagada, nas duas plataformas, com o app
   em segundo plano e com o app morto. **É critério de aceite, não suposição.**
6. **Não-regressão:** o registro de leitura manual continua funcionando igual, e a sequência não
   muda de comportamento.

---

## 9. Ciclos

**Ciclo 1 — o ritual.** Iniciar com tempo ou livre, tela com cronômetro ou calma, pausar, encerrar,
som de início e fim, recuperação, fim que registra as páginas, tempo guardado como informação,
"Ler agora" na Hoje, as duas perguntas de gatilho e o histórico no Você. O botão do assistente já
nasce na tela, mesmo antes de o assistente existir.

**Ciclo 2 — o hábito.** O lembrete por gatilho, o assistente vivendo dentro da sessão (com os dois
relógios e a folha que fecha sozinha), e silenciar notificação no Android.

**Ciclo 3 — o silêncio de verdade.** Bloqueio de apps (Screen Time no iOS, dependente da Apple),
widget de um toque via `LiveActivityIntent`, Live Activity na tela de bloqueio. Tudo depende de
build nativo (BER-117 e BER-119) e o entitlement é pedido desde já (BER-116).

---

## 10. Hipóteses e riscos

| # | Hipótese | Como validar |
|---|---|---|
| H5 | O ritual sustenta o hábito | Sessões repetidas por leitor ao longo de semanas. **Sem atalho na literatura:** os estudos de "ritual melhora desempenho" mais citados foram **retratados** (Brooks et al. 2016, em nov/2024; Tian et al. 2018) |
| H6 | Perguntar o gatilho aumenta o retorno | Comparar quem respondeu com quem pulou |
| H7 | O cronômetro visível atrapalha o prazer | Teste A/B entre cronômetro e tela calma |
| H8 | O som toca com a tela apagada, no Expo Go | Teste em aparelho, primeira tarefa do ciclo 1 |

**Riscos:**

- **A promessa que a evidência sustenta é a que não conseguimos cumprir hoje.** O valor está na
  supressão de notificação, e ela depende da Apple.
- **Nenhum app resolve o som de forma confiável**, nem o benchmark. O produto tem que estar certo
  mesmo quando o som falha.
- **O Etkin vale para o produto inteiro**, não só para a sessão. A Hoje hoje mostra "faltam 36
  páginas pra fechar o capítulo", que é o tipo de número que a evidência desaconselha. Não é escopo
  desta spec, e merece decisão do time com teste de usuário.

## 11. Pendências do time

- **Verificar Deci, Koestner & Ryan 1999** na fonte primária (§4).
- **Escolher o som** de início e fim, e definir como o time cadastra novos.
- **Decidir o reparo de sequência** (issue própria).
- **Instrumentação de produto** (PostHog ou equivalente): fora do escopo desta spec, mas é o que dá
  o dado para as quatro hipóteses.
