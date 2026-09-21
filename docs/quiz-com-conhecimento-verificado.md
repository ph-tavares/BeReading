# Quiz com conhecimento verificado (BER-59, MVP)

Como o conhecimento que a ingestão por ISBN confirma em fontes independentes chega ao quiz do app,
o que o leitor vê, e o que ainda não está pronto. Feito em 21/09/2026 para a apresentação do
BeReading.

## O que mudou para o leitor

Quando o capítulo tem conhecimento verificado, as perguntas do quiz são geradas com esses fatos,
além do texto do catálogo. A tela do quiz mostra, logo abaixo do título, de onde veio o conteúdo:

> Perguntas feitas a partir de fatos conferidos em 3 fontes independentes: historyhit.com, uol.com.br, wikipedia.org.

O leitor vê **só a origem**: domínios e quantidade. O texto dos fatos nunca vai para o app, porque
fato de capítulo é spoiler por natureza (spec §6.4) e porque "a IA não lê por você"
(`docs/product.md`).

Capítulo sem conhecimento verificado continua exatamente como antes: quiz a partir do texto do
catálogo, sem a linha de origem.

## Livro cadastrado pelo leitor: nenhum capítulo sem quiz (BER-60)

O `generate-questions` escolhe o conteúdo do capítulo nesta ordem, e sempre gera o quiz:

| Ordem | Conteúdo | O que o leitor vê abaixo do título |
|---|---|---|
| 1 | Texto do catálogo e/ou conhecimento verificado (acima) | a origem conferida, ou nada |
| 2 | Busca do capítulo na web, na hora (Tavily, 1 crédito, cerca de 3 s) | "Perguntas feitas a partir de resumos da web, sem conferência: …" |
| 3 | Nada achado: perguntas sobre a leitura da pessoa, sem o modelo supor fato do livro | "Ainda não temos o conteúdo deste capítulo. As perguntas são sobre a sua leitura." |

- **Trechos da web não são gravados.** O mesmo pedido à IA devolve um resumo interno do capítulo,
  com as palavras dela, que vai para `book_contents` e serve ao `evaluate-answer`. `book_contents`
  não tem policy de leitura: o resumo nunca chega ao app.
- **Spoiler:** resumos da web falam do livro inteiro. O prompt manda usar só o que for do capítulo
  e proíbe citar o que vem depois. É instrução, não garantia; por isso o app diz que não foi conferido.
- **Sem conteúdo (ordem 3), a avaliação não julga fatos:** avalia se a resposta é específica e coerente.
- **Com ISBN, o cadastro também dispara a ingestão verificada.** Quando o run fecha, o `publish`
  troca os capítulos do livro do leitor pelos da edição (só se nenhum capítulo foi fechado) e gera
  de novo os quizzes que tinham ficado em NO_CONTENT (`_shared/ingestion/app-sync.ts`).

## Como funciona

```
leitor fecha o capítulo
  → generate-questions
      → loadChapterGrounding (_shared/chapter-grounding.ts)
          livro do app → edição ligada (book_editions.book_id)
          capítulo do app → capítulo da edição ("Parte 2 - Capítulo 1" → 9º da edição)
          chapter_knowledge desse capítulo, só se confirmed/partial e com ≥ 2 fatos
          chapter_facts (até 20, fato antes de interpretação) + domínios das fontes
      → prompt = texto do catálogo + "Fatos deste capítulo, confirmados em fontes independentes"
      → chapter_quiz_status.grounding = { fontes, dominios, fatos, status }
  → app lê chapter_quiz_status e mostra a origem (QuizConversation)
  → evaluate-answer avalia a resposta com o mesmo texto + fatos
```

**A ponte entre a numeração do app e a da edição.** O *1984* do app tem 9 capítulos, e a edição
ingerida tem 24 (8 + 10 + 6, com a parte recomeçando a contagem). A ponte é o rótulo
"Parte X - Capítulo Y" do capítulo no app. Sem esse rótulo, ela só vale quando os dois têm o mesmo
número de capítulos. Na dúvida, o capítulo fica sem conhecimento, e o quiz sai do catálogo como
antes.

**Guarda de spoiler.** Só entram fatos do capítulo que o leitor fechou. A leitura passa pelo
`getKnowledgeUpTo`, a mesma leitura que a spec reserva para consumo (§6.4, guarda 3). Os testes
conferem que um fato do capítulo seguinte não chega ao prompt.

**Falha nunca derruba o quiz.** Qualquer erro ao ler o conhecimento cai no caminho antigo, e o erro
vai para o log.

**Capítulo sem texto no catálogo.** Se tem conhecimento verificado, agora gera quiz. Antes caía em
`NO_CONTENT` (BER-66). O mínimo de 200 caracteres continua valendo para o texto do catálogo; para o
conhecimento verificado, o mínimo são 2 fatos.

## Arquivos

| Arquivo | O que é |
|---|---|
| `supabase/functions/_shared/chapter-grounding.ts` | Ponte app ↔ edição, leitura do conhecimento, texto do prompt, resumo da origem |
| `supabase/functions/generate-questions/index.ts` | Usa o conhecimento na geração e grava a origem |
| `supabase/functions/evaluate-answer/index.ts` | Avalia com os mesmos fatos |
| `supabase/migrations/20260921180000_ber59_quiz_com_conhecimento_verificado.sql` | Coluna `chapter_quiz_status.grounding`; tira de uso o conhecimento com spoiler |
| `mobile/src/features/quiz-chat/logic.ts` (`groundingCaption`) | Frase de origem |
| `mobile/src/features/quiz-chat/QuizConversation.tsx` | Mostra a frase |
| `mobile/app/quiz/[chapterId].tsx` | Lê a origem do status e passa para a conversa |

## Estado do conhecimento em produção (21/09/2026)

Só o *1984* (ISBN 9788535914849) tem conhecimento verificado, vindo do run `8f615823`. Situação de
cada capítulo do app:

| Capítulo no app | Na edição | Conhecimento | Quiz atual |
|---|---|---|---|
| Parte 1 - Capítulo 1 | 1 | **retirado** (tinha spoiler das Partes 2 e 3) | do catálogo |
| Parte 1 - Capítulos 2 a 4 | 2 a 4 | confirmado, 15 a 22 fatos | gerado em junho, com respostas |
| Parte 2 - Capítulo 1 | 9 | **retirado** (tinha spoiler do capítulo 17) | do catálogo |
| Parte 2 - Capítulo 2 | 10 | parcial, 4 fatos | gerado em junho, com respostas |
| Parte 2 - Capítulo 3 | 11 | confirmado, 6 fatos | gerado em junho, **sem respostas** |
| Parte 3 - Capítulo 1 | 19 | parcial, 3 fatos | gerado em junho, **sem respostas** |
| Parte 3 - Capítulo 2 | 20 | confirmado, 9 fatos | gerado em junho, **sem respostas** |

As perguntas ficam em cache por capítulo: o conhecimento só entra quando um quiz é gerado de novo.
Por isso, quizzes que já existem não mostram a origem.

## Runbook: gerar de novo o quiz de um capítulo

Só para capítulo **sem nenhuma resposta**. Apagar perguntas apaga as respostas em cascata, e resposta
é dado do leitor. No *1984* hoje: os capítulos do app 7, 8 e 9.

Depois do deploy deste PR, no SQL Editor de produção:

```sql
-- 1. Confirma que nenhum capítulo tem resposta (tem de voltar 0 em todos).
select c.number, count(a.id) as respostas
from chapters c
join questions q on q.chapter_id = c.id
left join answers a on a.question_id = q.id
where c.book_id = '00000000-0000-0000-0002-000000000002' and c.number in (7, 8, 9)
group by c.number;

-- 2. Apaga as perguntas e devolve o capítulo para a fila de retentativa.
delete from questions
where chapter_id in (select id from chapters where book_id = '00000000-0000-0000-0002-000000000002' and number in (7, 8, 9))
  and not exists (select 1 from answers a where a.question_id = questions.id);
update chapter_quiz_status
set status = 'failed', error_message = 'BER-59: gerar de novo com conhecimento verificado'
where chapter_id in (select id from chapters where book_id = '00000000-0000-0000-0002-000000000002' and number in (7, 8, 9));

-- 3. Dispara a retentativa agora (é o mesmo comando do cron retry-pending-quizzes, que roda de hora em hora).
select command from cron.job where jobname = 'retry-pending-quizzes';  -- copie o comando e execute
```

Para conferir, os três capítulos têm de voltar `generated` com `grounding` preenchido:

```sql
select c.number, s.status, s.grounding
from chapters c join chapter_quiz_status s on s.chapter_id = c.id
where c.book_id = '00000000-0000-0000-0002-000000000002' and c.number in (7, 8, 9);
```

Isso é escrita de dados em produção, não de schema. Por isso fica como runbook e não como
migration.

## Limitações conhecidas

- **Só o *1984*.** É o único livro com edição ingerida. Os outros livros do catálogo não mudam.
- **Sem cadastro por ISBN no app.** Ingerir um livro novo continua sendo tarefa do time
  (`ingest-book`, interna), e levar esse conhecimento para livros fora do catálogo é a BER-60.
- **A ingestão ainda não passou na aceitação** (precisão ≥ 90%, cobertura ≥ 70%, zero spoiler). Os
  dois capítulos com spoiler conhecido foram retirados, mas os outros não foram conferidos contra um
  gabarito. Os defeitos abertos estão no PR #76 e na BER-59 (defeito 5: numeração por parte).
- **A ponte depende do rótulo "Parte X - Capítulo Y".** Um livro do catálogo com outra convenção de
  título só recebe conhecimento se a contagem de capítulos bater com a da edição.
