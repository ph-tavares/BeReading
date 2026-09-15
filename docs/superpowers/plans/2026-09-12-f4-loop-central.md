# F4 Loop central — plano de implementação

> **Para executores:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development`. Passos com checkbox (`- [ ]`).

**Objetivo:** construir o caminho que faz o app valer a assinatura: **abrir, ver o que ler, registrar, fechar capítulo**. É a primeira fase em que tela nova aparece.

**Spec:** `docs/superpowers/specs/2026-09-11-premium-ui-redesign-design.md` (§7.1 Hoje, §7.2 sheet de registro, §7.3 capítulo fechado, §8 dados)

**Mockup aprovado:** `docs/superpowers/specs/2026-09-11-premium-ui-redesign-mockups/04-loop-central.html` — abra no navegador antes de implementar. **Lembre: os mockups foram desenhados em molduras de 292px, cerca de 0,75 da largura real. Valor em pixel do mockup não é fonte; a fonte é `src/theme/tokens.ts`** (ADR 0010).

**Fase:** F4 de 9. A F3 (navegação e marca) fechou antes desta.

## Restrições globais

- **Branch:** `feature/premium-ui-redesign`, comandos de `mobile/`.
- **Sem push e sem PR.**
- **Nada em `supabase/`.** Em `src/api/` só a mudança autorizada na Tarefa 3.
- **O guard de autenticação do `app/_layout.tsx` é intocável.**
- **Baseline: ver o ledger.** Só cresce.
- **Tudo de `src/theme/tokens.ts`.** Nenhum literal.
- **Todo tocável com `accessibilityRole` e `accessibilityLabel`.** Alvo ≥ 44.
- **Copy:** 18 a 24 anos, sem emoji, sem travessão. As falas do assistente vêm de `src/assistant/lines.ts`; **não escreva fala solta na tela**.
- **Número em tela sai de dado persistido.** Se você precisar de um valor que o banco não tem, **pare e relate** — foi assim que o XP inventado entrou no app original.

---

## Tarefa 1: fechar as guardas antes de escrever tela

**Por quê:** as guardas varrem `src/ui`, `src/assistant` e `src/game`, e **não varrem `app/` nem `src/features`**. Esta fase cria tela nova exatamente nessas pastas. Sem esta tarefa, tela nova nasce descoberta e pode ter cor literal, tamanho de fonte solto e botão sem rótulo, sem nenhum teste acusar. A revisão final da F2 nomeou isso como o buraco concreto da fase seguinte. **Esta tarefa vem antes de qualquer tela, não depois.**

**Arquivos:** modifica `__tests__/guards/{designTokens,copy,a11y}.test.ts`.

**Critério de aceite:**
- [ ] `src/features` entra nas listas `VIGIADAS` das três guardas.
- [ ] `app/` entra nas listas, **com uma lista nominal de exceção** contendo as telas antigas que ainda não migraram. Cada arquivo dessa lista é dívida declarada, e a lista **encolhe a cada fase** até sumir na F6.
- [ ] A checagem inversa de pasta órfã continua funcionando com as pastas novas.
- [ ] **A lista de exceção precisa provar que está viva:** um teste que falhe se um arquivo listado como exceção não existir mais. Exceção para arquivo apagado é lixo que esconde cobertura.
- [ ] As guardas passam com o código como está. Se alguma reprovar arquivo fora da lista de exceção, **corrija o arquivo**.
- [ ] Prove que a guarda nova pega: introduza uma violação numa tela **nova** (crie um arquivo temporário em `src/features/`), veja falhar, desfaça. Registre a mensagem.

---

## Tarefa 2: `Tag`, e alinhar o vocabulário

**Por quê:** a spec pede chip **estático** em quatro lugares (o "+X XP" e o "N dias seguidos" da conquista, o "nota · +XP" do quiz, e as tags de gênero e páginas do livro). Hoje só existe o `Chip`, que exige `onPress` e renderiza `Pressable` com papel de botão — usá-lo com função vazia põe botão falso na árvore de acessibilidade. E o `radius.tag` existe em tokens sem componente.

Junto disso, a revisão final da F2 apontou **três uniões independentes para o mesmo conceito**: `Tone` em `Text.tsx` (7 valores), e as variantes de `Banner` e `Toast`, onde o mesmo papel se chama `danger` num lugar e `error` noutro, `positive` e `success`.

**Arquivos:** cria `src/ui/Tag.tsx` e seu teste; modifica `src/ui/{Banner,Toast}.tsx`, `src/ui/index.ts` e os testes afetados.

**Critério de aceite:**
- [ ] `<Tag label tone icon?>` estático, sem `Pressable`, com `radius.tag`. Tons reusam os do sistema.
- [ ] Uma única união de tom no projeto. Escolha **um** vocabulário e aplique nos três (`Text`, `Banner`, `Toast`), com o motivo da escolha no comentário.
- [ ] Nenhum consumidor existente quebra. Se um teste precisar mudar de valor, é sinal de que a renomeação vazou; **relate antes de mudar teste**.
- [ ] Teste: `Tag` não é tocável e não aparece como botão para o leitor de tela.

---

## Tarefa 3: os dados que a tela precisa

**Por quê:** a Hoje e a tela de conquista mostram XP, nível e sequência. Esses números vêm de `src/game/`, que já existe e está testado, mas **ninguém os alimenta**: falta a consulta que traz as respostas avaliadas do leitor, e falta onde guardar o resultado para a tela não recalcular a cada troca de aba.

**Arquivos:** modifica `src/api/queries.ts`; cria `src/stores/progressStore.ts` e os testes.

**Critério de aceite:**
- [ ] `getMyAnswers(userId)` em `queries.ts`: as `answers` do próprio leitor, com `comprehension_score`, `evaluation_status`, `question_id` e o join que der o `chapter_id`. **Só leitura.** A RLS já permite, porque `getStudentAnswersForChapter` faz o mesmo tipo de consulta.
- [ ] `getBooks(search)` passa a filtrar título **ou autor**. Hoje o placeholder promete autor e a consulta só olha título (spec §7.8). Com teste.
- [ ] `progressStore` (Zustand, que já é dependência): guarda sessões, respostas, conquistas e sequência, expõe o XP e o nível derivados, e tem `refresh(userId)`. Guarda também um **instantâneo anterior**, que é o que permite animar o ganho na tela de conquista.
- [ ] Nada de biblioteca nova de cache.
- [ ] Teste: o store deriva os mesmos números que `src/game/` calcula; o instantâneo anterior sobrevive a um `refresh`.

---

## Tarefa 4: a tela Hoje

**Por quê:** é a primeira tela que o leitor vê. Hoje ela não responde "o que eu faço agora": abre com uma frase fixa no código e o botão de registrar está escondido num botão flutuante.

**Arquivos:** reescreve `app/(tabs)/index.tsx`; cria os blocos em `src/features/home/` e os testes.

**Ordem da tela** (spec §7.1, mockup 04): saudação e anel de nível → semana de sequência e frase → hero do livro em leitura → **ação primária "Registrar leitura"** → card do assistente, condicional → linha de nível e XP.

**Critério de aceite:**
- [ ] Usa `Screen`, `Cover`, `Ring`, `ProgressBar`, `Button`, `Text` e `Tag`. **Nenhum componente novo** sem relatar.
- [ ] "faltam N pág. pra fechar" sai de `chapter.end_page − current_page` do capítulo corrente. Se o livro não tiver capítulo com paginação, a meta **some** em vez de mostrar número errado (a migration da BER-72 deixou `end_page` opcional).
- [ ] O anel de nível leva para a aba Você.
- [ ] O card do assistente aparece **só quando ele tem o que dizer**: quiz pendente, sequência em risco, ou livro parado há três dias ou mais. As falas vêm de `src/assistant/lines.ts`.
- [ ] Com dois livros ou mais em leitura, entra a fileira "Também lendo".
- [ ] **Os quatro estados existem:** carregando (skeleton no formato da tela, não spinner), vazio (primeiro acesso, com a apresentação do assistente), erro (banner, mantendo o que já carregou) e o normal.
- [ ] O guard de perfil com erro (BER-45) continua funcionando.
- [ ] Teste: cada um dos quatro estados; a meta some sem paginação; o card do assistente aparece e some pela condição certa.

---

## Tarefa 5: o sheet de registrar leitura

**Por quê:** é a ação mais frequente do app e o gatilho do quiz. Hoje são dois campos vazios numa página inteira.

**Arquivos:** reescreve `app/register-reading.tsx`; cria `src/features/register/` e os testes.

**Critério de aceite:**
- [ ] O campo "De" vem **pré-preenchido** com `current_page + 1`, e é editável.
- [ ] Atalhos: `+10`, `+20` e **"Fim do cap. X"**, derivado dos capítulos do livro.
- [ ] Resumo ao vivo: páginas, XP previsto e o aviso **"fecha o capítulo X"** quando o "Até" alcança um `end_page`.
- [ ] O aviso de páginas repetidas (BER-54, `pagesAlreadyRead`) aparece antes do envio.
- [ ] A validação continua sendo `validatePageRange`. A troca de livro (BER-44) continua.
- [ ] **Com capítulo fechado** vai para `chapter-complete`; **sem**, fecha o sheet e mostra toast com páginas, XP e sequência.
- [ ] Erro de envio: toast com "Tentar", **preservando o que foi digitado**.
- [ ] Teste: pré-preenchimento; atalho de fim de capítulo; o aviso de "fecha o capítulo"; os dois caminhos de resultado.

---

## Tarefa 6: a tela de capítulo fechado

**Por quê:** substitui o `Alert.alert` no momento mais importante do produto.

**Arquivos:** reescreve `app/chapter-complete.tsx` (o placeholder veio da F3); cria `src/features/chapter-complete/` e os testes.

**Critério de aceite:**
- [ ] Assistente, título vindo de `chapterClosedTitle`, anel grande contando do XP anterior até o atual, e as tags de XP ganho e sequência.
- [ ] Botões: "Bora pro quiz" e "Depois".
- [ ] **Dois capítulos ou mais:** o título muda, o quiz abre pelo primeiro e os outros ficam pendentes na Hoje (lógica da BER-54).
- [ ] **Subiu de nível:** o anel completa, zera e mostra a fala de `levelUpLine`.
- [ ] Motion vem dos tokens; com reduce motion, os valores aparecem prontos, sem contagem.
- [ ] Teste: um capítulo e vários; com e sem subida de nível; reduce motion não anima.

---

## Ao fim da F4

- [ ] Suíte e `tsc` verdes.
- [ ] **Prova no emulador, obrigatória:** percorra o loop inteiro com login real — abrir, registrar leitura que fecha capítulo, ver a conquista, chegar no quiz. Guarde captura de cada tela e **do sheet com o teclado numérico aberto**, que é o risco registrado na spec §12. Confirme também o comportamento de colar no `PageField`, dívida deixada pela F2.
- [ ] Comentar na `BER-77`.

## Autorrevisão

**Cobertura:** §7.1 → T4 · §7.2 → T5 · §7.3 → T6 · §8 dados → T3 · dívidas da revisão final da F2 (guardas, Tag, vocabulário de tom) → T1 e T2.

**Fora desta fase:** livro e quiz (F5); estante, explorar, você e auth (F6); o primitivo `Dialog` (F6, exigido pela §7.9); a remoção dos componentes legados (F6); `eslint-plugin-react-native-a11y`, que troca a guarda grosseira por uma por elemento — fica para a F6, quando o número de telas justificar.

**Risco:** esta é a primeira fase que escreve tela. Se a composição com os primitivos revelar que falta peça, a resposta certa é **parar e relatar**, não inventar componente dentro da tela. Peça nova é decisão de sistema, não de tela.
