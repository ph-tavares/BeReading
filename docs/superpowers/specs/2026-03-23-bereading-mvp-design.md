# BeReading MVP — Design Spec

## Contexto

BeReading e um ecossistema de leitura gamificada criado para transformar a leitura em habito por meio de gamificacao, IA reflexiva e dados acionaveis para escolas. O projeto esta em fase de validacao, com entrevista exploratoria realizada com Oliveira (professor de literatura do Colegio Nacional) e formulario com 127 respostas validando a hipotese central.

### Hipotese Central

> Se gamificarmos o registro e a compreensao de leitura, alunos vao ler mais e com mais profundidade.

### Escopo do MVP

O menor conjunto de funcionalidades que valida a hipotese para um piloto com a escola do Oliveira:

- Registro de leitura (pagina inicial/final)
- Perguntas geradas por IA ao completar capitulo
- Streaks e badges (gamificacao)
- Dashboard do professor (visao por turma e por aluno)

### O que NAO entra no MVP

| Feature | Motivo |
|---|---|
| Rankings entre alunos | Pode gerar pressao/competicao negativa |
| Olimpiadas | Requer gestao de eventos, escopo grande |
| Moedas/pontos trocaveis | Economia virtual desnecessaria no MVP |
| Rede social/feed | Escopo grande, nao valida hipotese |
| E-commerce de livros | Complexidade de operacao, nao valida hipotese |
| Modo foco/bloqueador de apps | Nice-to-have, nao essencial |
| Notificacoes motivacionais | Nice-to-have |
| Verificacao de posse do livro | Adiciona friccao, confianca no MVP |

---

## Arquitetura Geral

### Stack

| Componente | Tecnologia |
|---|---|
| App Mobile (aluno) | React Native + Expo |
| Dashboard Web (professor) | Next.js (React) |
| Backend | Supabase (Auth + PostgreSQL + Storage + Edge Functions) |
| IA | Claude API ou OpenAI API (via Edge Functions) |
| Push Notifications | Expo Push Notifications (via Expo SDK) |

### Diagrama

```
┌─────────────────┐     ┌─────────────────┐
│  App Mobile      │     │  Dashboard Web   │
│  (React Native   │     │  (Next.js)       │
│   + Expo)        │     │  Professor       │
│  Aluno           │     │                  │
└───────┬─────────┘     └───────┬─────────┘
        │                       │
        └───────────┬───────────┘
                    │
            ┌───────▼─────────┐
            │   Supabase      │
            │  - Auth         │
            │  - PostgreSQL   │
            │  - Storage      │
            │  - Edge Funcs   │
            └───────┬─────────┘
                    │
            ┌───────▼─────────┐
            │  API de IA      │
            │  (Claude/OpenAI)│
            └─────────────────┘
```

- Ambos os clientes se comunicam com o Supabase via SDK (auth, queries, realtime) e via Edge Functions para logica complexa (IA, calculos de gamificacao).
- API de IA e chamada exclusivamente pelas Edge Functions (nunca direto do cliente). A chave da API fica segura no servidor.

---

## Modelo de Dados

### Entidades

| Entidade | Campos principais | Notas |
|---|---|---|
| **School** | id, name, city, state | Escola participante |
| **Classroom** | id, school_id, name, grade, year | Ex: "7o ano A - 2026" |
| **Teacher** | id, user_id, school_id | Vinculado ao auth do Supabase |
| **ClassroomTeacher** | id, classroom_id, teacher_id | Juncao N-N entre professor e turma |
| **Student** | id, user_id, classroom_id, display_name | Vinculado ao auth do Supabase |
| **Book** | id, title, author, cover_url, total_pages, genre | Catalogo universal |
| **Chapter** | id, book_id, number, title, start_page, end_page | Mapeamento de capitulos por livro |
| **BookContent** | id, chapter_id, content_text | Conteudo ingerido para a IA gerar perguntas (ver secao Ingestao de Conteudo) |
| **StudentBook** | id, student_id, book_id, status (reading/finished/dropped), current_page, started_at, finished_at | Relacionamento ativo do aluno com um livro |
| **ReadingSession** | id, student_id, book_id, start_page, end_page, read_at, pages_read | Cada registro de leitura |
| **Question** | id, chapter_id, type (comprehension/reflection), question_text, generated_at | Perguntas geradas pela IA (cacheadas por capitulo, compartilhadas entre alunos) |
| **Answer** | id, question_id, student_id, answer_text, comprehension_score, answered_at | Resposta do aluno + score da IA |
| **Streak** | id, student_id, current_streak, longest_streak, last_read_at | Calculado a cada ReadingSession |
| **Badge** | id, name, description, icon_url, criteria | Ex: "Leitor de 7 dias" |
| **StudentBadge** | id, student_id, badge_id, earned_at | Badges conquistados |
| **ClassroomBook** | id, classroom_id, book_id, assigned_by, status (required/recommended) | Livros atribuidos a turma pelo professor |

### Relacionamentos-chave

- School 1-N Classroom 1-N Student
- Classroom N-N Teacher (via ClassroomTeacher)
- Book 1-N Chapter 1-1 BookContent
- Student 1-N StudentBook (livros que o aluno esta lendo/finalizou)
- Student 1-N ReadingSession
- Quando ReadingSessions acumuladas cobrem um Chapter inteiro, dispara geracao de Questions
- Question pertence a Chapter (compartilhada entre alunos, sem student_id)
- Answer vincula Question + Student (uma resposta por pergunta por aluno)
- Student 1-1 Streak (atualizado a cada sessao)
- ClassroomBook vincula livros da grade a turmas especificas
- A cada ReadingSession, o sistema atualiza StudentBook.current_page

### Regra de Capitulo Completo

Um capitulo e considerado completo quando a uniao de todas as ReadingSessions do aluno para aquele livro cobre a pagina final do capitulo (end_page). Ou seja: se o aluno ja leu ate pelo menos a end_page do capitulo (considerando o maximo de end_page entre todas as suas sessoes acumuladas), o capitulo esta completo. Paginas sobrepostas entre sessoes sao ignoradas — o que importa e o progresso maximo atingido.

### Validacao de ReadingSession

- start_page deve ser >= 1 e <= total_pages do livro
- end_page deve ser >= start_page e <= total_pages do livro
- Sessoes com paginas identicas a uma sessao anterior sao aceitas (o aluno pode reler)
- pages_read = end_page - start_page + 1

### Roles e Admin

O MVP tem 3 roles:

| Role | Acesso | Como e criado |
|---|---|---|
| **Student** | App mobile, seus proprios dados | Self-signup no app + codigo da turma |
| **Teacher** | Dashboard web, dados da turma (apenas livros da grade) | Self-signup no dashboard + codigo da escola |
| **Admin** | Supabase Dashboard (painel nativo) | Acesso direto ao Supabase pelos devs |

No MVP, operacoes de admin sao feitas diretamente pelo painel do Supabase:
- Criar/editar Schools
- Gerenciar o catalogo de Books (adicionar livros, capitulos, conteudo)
- Upload de BookContent (ingestao de conteudo para IA)
- Monitoramento geral

Nao ha dashboard admin custom no MVP. O painel nativo do Supabase e suficiente para o piloto (~1 escola, ~3 livros, ~50 alunos).

### Ingestao de Conteudo (BookContent)

No MVP, a ingestao e manual feita pelos devs/admin:

1. Obter o texto do livro (digitado, copiado de ebook, ou OCR de fisico)
2. Dividir o texto por capitulos seguindo o mapeamento da tabela Chapter
3. Inserir cada trecho na tabela BookContent via painel do Supabase

Para o piloto com Oliveira (~3 livros, ~10-20 capitulos cada), isso e viavel manualmente. Automacao de ingestao (upload de PDF com parsing automatico) fica fora do MVP.

---

## Fluxos do Aluno (App Mobile)

### Onboarding

1. Aluno baixa o app e cria conta (email/senha ou login social)
2. Insere codigo da turma (fornecido pelo professor) e vincula-se a Classroom + School
3. Ve os livros da grade ja atribuidos a turma + pode buscar qualquer livro do catalogo
4. Seleciona o livro que esta lendo atualmente

### Registro de Leitura (fluxo principal)

1. Aluno abre o app e ve o livro atual (capa, progresso, streak)
2. Toca "Registrar leitura"
3. Informa pagina inicial e pagina final
4. Sistema calcula: paginas lidas, progresso total (%), atualiza streak
5. Verifica se completou algum capitulo novo:
   - **Sim:** notifica "Capitulo X completo! Responder perguntas agora?" — aluno pode responder agora ou deixar pendente
   - **Nao:** tela de parabens com stats da sessao e streak atualizado

### Quiz por Capitulo

1. IA gera 3-5 perguntas (mix compreensao + reflexao) baseadas no conteudo do capitulo
2. Perguntas aparecem uma por vez, estilo conversacional (nao estilo prova)
3. Aluno responde em texto livre
4. IA avalia cada resposta e atribui comprehension_score (0-100)
5. No final: tela de resumo com score medio do capitulo + feedback encorajador
6. Para livros fora da grade: quiz e opcional (notificacao gentil, sem pressao)

### Telas principais do app

| Tela | Conteudo |
|---|---|
| **Home** | Livro atual, streak, botao "Registrar leitura", quizzes pendentes |
| **Meus Livros** | Livros ativos + finalizados, progresso de cada um |
| **Catalogo** | Buscar/adicionar livros (grade + extras) |
| **Quiz** | Perguntas do capitulo, respostas, scores |
| **Perfil** | Badges, stats, streak, historico |

---

## Dashboard do Professor (Web)

### Onboarding do Professor

1. Professor acessa o dashboard web e cria conta
2. Vincula-se a uma School (por convite ou codigo da escola)
3. Cria suas Classrooms (ex: "7o ano A") — sistema gera codigo da turma para alunos
4. Atribui livros da grade a turma (busca no catalogo, marca como obrigatorio)

### Visao por Turma

O professor ve para cada turma:

- **Resumo:** alunos ativos (ultimos 7 dias), streak medio, compreensao media, quizzes pendentes
- **Livros da grade:** % da turma lendo cada livro, compreensao media por livro
- **Ranking de streaks:** top alunos por streak (streaks refletem leitura geral, nao apenas grade)
- **Alertas:** alunos que nao leram na ultima semana, alunos com compreensao abaixo de 50%

### Visao por Aluno

Ao clicar em um aluno, o professor ve:

| Dado | Detalhe |
|---|---|
| **Livros da grade** | Quais esta lendo, progresso (%) de cada |
| **Leitura** | Paginas por dia (grafico), frequencia, streak atual e mais longo |
| **Compreensao** | Score medio por livro da grade, score por capitulo, evolucao |
| **Respostas** | Respostas do aluno as perguntas da IA (apenas livros da grade) |

### Regra de Privacidade

- Professor ve APENAS dados de livros marcados como obrigatorios/recomendados na grade da turma (ClassroomBook)
- Livros pessoais do aluno: progresso, respostas, scores e ate a existencia deles sao INVISIVEIS para o professor
- Streak e visivel (sem detalhar de qual livro vem)
- O aluno ve tudo no seu proprio app — livros pessoais e da grade juntos

### Gestao de Livros

- Professor busca livros no catalogo e atribui a turma
- Marca como obrigatorio ou recomendado
- Ve o andamento da turma naquele livro especifico

### Telas principais do dashboard

| Tela | Conteudo |
|---|---|
| **Minhas Turmas** | Lista de turmas, resumo rapido de cada |
| **Turma (detalhe)** | Metricas agregadas, ranking, alertas, livros |
| **Aluno (detalhe)** | Dados individuais, progresso, respostas |
| **Gerenciar Livros** | Atribuir/remover livros da grade por turma |

---

## Sistema de IA

### Geracao de Perguntas

1. Aluno completa capitulo (ReadingSessions cobrem start_page a end_page do Chapter)
2. Edge Function disparada
3. Busca BookContent do capitulo no banco
4. Monta prompt para a LLM com: conteudo do capitulo, tipo mix, quantidade 3-5, tom conversacional, contexto do livro e faixa etaria
5. LLM retorna perguntas em JSON estruturado
6. Salva Questions no banco vinculadas ao chapter (sem student_id — compartilhadas)
7. Push notification ou badge no app para o aluno que completou o capitulo

### Prompt Template

```
Voce e um companheiro de leitura para estudantes do ensino
fundamental (11-15 anos). Gere {n} perguntas sobre o capitulo
abaixo, sendo aproximadamente metade de compreensao e metade
de reflexao.

Livro: {title} — {author}
Capitulo {number}: {chapter_title}
Conteudo: {content_text}

Regras:
- Tom conversacional e curioso, nunca de prova
- Perguntas de compreensao: verificam se o aluno leu e entendeu
  o que aconteceu
- Perguntas de reflexao: pedem opiniao, conexao pessoal,
  pensamento critico
- Linguagem adequada para {grade} ano
- Retorne em JSON: [{type, question_text}]
```

### Avaliacao das Respostas

1. Aluno responde uma pergunta (texto livre)
2. Edge Function envia para LLM: pergunta original, resposta do aluno, conteudo do capitulo, tipo da pergunta
3. LLM retorna: comprehension_score (0-100) + feedback curto (1-2 frases encorajadoras)
4. Salva Answer no banco

**Compreensao:** score mede se a resposta demonstra conhecimento do conteudo.

**Reflexao:** score mede profundidade e coerencia (nao existe certo/errado, mas avalia se o aluno engajou de verdade vs resposta vazia/generica).

### Cache de Perguntas

Perguntas sao geradas por capitulo (sem student_id) e compartilhadas entre alunos. Quando o primeiro aluno completa um capitulo, as perguntas sao geradas e salvas. Alunos subsequentes que completam o mesmo capitulo recebem as mesmas perguntas. Isso reduz drasticamente as chamadas a API de IA.

### Fallback de IA

Se a API de IA estiver indisponivel ou retornar erro:
- Geracao de perguntas: marcar capitulo como "quiz pendente" e tentar novamente via pg_cron (extensao nativa do Supabase) com backoff exponencial, max 3 tentativas
- Avaliacao de respostas: salvar a resposta e avaliar posteriormente. Aluno ve "Resposta recebida, avaliacao em breve."

### Custo Estimado

Com ~50 alunos, ~3 livros (~15 capitulos cada):
- Geracao: ~45 chamadas unicas (cacheadas por capitulo) = ~$2-5
- Avaliacao: ~50 alunos x 45 capitulos x 4 perguntas = ~9.000 avaliacoes. Com batching (avaliar todas as respostas de um quiz em 1 chamada), ~2.250 chamadas = ~$15-40/mes
- Estimativa total IA: ~$20-45/mes

---

## Gamificacao

### Streaks

| Regra | Detalhe |
|---|---|
| **Incremento** | Qualquer ReadingSession no dia (minimo 1 pagina) conta como dia ativo |
| **Reset** | Se o aluno nao registra nenhuma leitura por 1 dia completo (meia-noite a meia-noite, fuso horario America/Sao_Paulo para o MVP), streak zera |
| **Protecao** | Sem freeze/protecao no MVP |
| **Exibicao** | Numero grande na home do app, com animacao de fogo |
| **Historico** | Guarda longest_streak no perfil |

### Badges

| Badge | Criterio |
|---|---|
| Primeira Pagina | Registrar primeira leitura |
| Leitor de 7 dias | Streak de 7 dias |
| Leitor de 30 dias | Streak de 30 dias |
| Capitulo Completo | Completar primeiro capitulo + quiz |
| Livro Finalizado | Terminar todas as paginas de um livro |
| Pensador Critico | Score de reflexao acima de 80 em 5 quizzes |
| Devorador de Paginas | Ler 500 paginas no total |
| Explorador | Ler um livro fora da grade |
| Mestre da Compreensao | Score medio acima de 90 em um livro completo |

### Stats do Perfil

- Streak atual e maior streak
- Total de paginas lidas (lifetime)
- Livros finalizados (contagem)
- Score medio de compreensao (so visivel pro aluno)
- Badges conquistados (vitrine visual)
- Grafico de paginas lidas por dia nos ultimos 30 dias

---

## Infraestrutura e Deploy

### Supabase

| Recurso | Uso |
|---|---|
| **Auth** | Login de alunos e professores. Roles via metadata (student/teacher) |
| **PostgreSQL** | Todas as tabelas. Row Level Security (RLS) para privacidade |
| **Storage** | Capas de livros, conteudo dos livros por capitulo |
| **Edge Functions** | Geracao de perguntas, avaliacao de respostas, calculo de streaks/badges |

### Row Level Security (RLS)

```
Aluno:
  - Ve/edita apenas suas ReadingSessions, Answers, Streaks, Badges, StudentBooks
  - Ve todos os Books, Chapters e Questions (catalogo publico)
  - Ve ClassroomBooks da sua turma

Professor:
  - Ve ReadingSessions dos alunos da sua turma
    APENAS para livros vinculados a turma (ClassroomBook)
  - Ve Answers/Questions dos alunos da sua turma
    APENAS para livros da grade
  - NAO ve livros pessoais, sessoes pessoais, StudentBooks pessoais,
    nem respostas de livros pessoais
  - Gerencia ClassroomBooks da sua turma

Admin:
  - Acesso via painel nativo do Supabase (service_role key)
  - Gerencia Schools, Books, Chapters, BookContent
  - Sem RLS — acesso total ao banco
```

### Deploy

| Componente | Plataforma | Custo estimado (MVP) |
|---|---|---|
| Supabase | supabase.com (free tier a Pro) | $0-25/mes |
| Dashboard Web | Vercel (Next.js) | $0/mes |
| App Mobile | Expo EAS (builds iOS/Android) | $0 |
| API de IA | Claude API ou OpenAI API | ~$20-45/mes |
| **Total** | | **~$20-70/mes** |

### App Stores

- Android: Google Play ($25 taxa unica)
- iOS: App Store ($99/ano)
- Para o piloto: TestFlight (iOS) e APK direto (Android) antes de publicar nas stores

### Comportamento Offline

O MVP requer conexao com internet para funcionar. Registro de leitura, quizzes e sincronizacao de dados dependem do Supabase. Se o aluno estiver offline, o app mostra mensagem pedindo conexao. Suporte a offline (queue local + sync) fica fora do MVP.
