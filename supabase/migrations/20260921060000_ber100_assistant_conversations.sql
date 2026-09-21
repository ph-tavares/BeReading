-- BER-100: a conversa do assistente de leitura.
--
-- O leitor fotografa a página em que travou; a Edge Function `scan-page` manda a
-- foto para o modelo e guarda o que voltou: a transcrição do trecho e, depois, as
-- perguntas e respostas (BER-101). A imagem em si NÃO é gravada em lugar nenhum —
-- nem aqui, nem em Storage (spec §4.1). O que fica é o texto.
--
-- O que este arquivo cria:
--   - `assistant_conversations`: uma conversa, ancorada (quando dá) num livro da
--     estante e na página detectada na foto.
--   - `assistant_messages`: as falas, na ordem. A transcrição da página entra como
--     mensagem de `kind = 'page_text'`, o que mantém a ordem da conversa e evita uma
--     tabela só para isso (spec §5).
--
-- Escrita só pelo servidor, leitura só do dono — a mesma forma que a BER-28 deu à
-- gamificação. Com policy de escrita para o cliente, a cota do assistente (BER-105)
-- e a trava de spoiler (BER-103) seriam decoração: bastaria gravar direto na tabela.
--
-- `book_id` e `chapter_number` são anuláveis de propósito (decisão D20 da spec): o
-- catálogo tem 3 livros e o leitor ainda não consegue cadastrar o dele (BER-60), então
-- o assistente precisa funcionar com o livro fora da estante — só sem o contexto dele.

create table public.assistant_conversations (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  -- Livro da estante, quando houver. `set null` e não `cascade`: tirar um livro do
  -- catálogo não pode apagar a conversa que o leitor teve sobre ele.
  book_id uuid references public.books(id) on delete set null,
  -- O título que o leitor digitou, quando o livro não está na estante (D20).
  book_title_text text,
  chapter_number int,
  -- O número impresso que o modelo leu na foto. Ele NÃO atualiza o progresso do
  -- leitor: quem grava página é o `register-reading-session`, e só com confirmação
  -- (decisão D11; a oferta de registrar é a BER-104).
  detected_page int check (detected_page is null or detected_page >= 1),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

-- A tela abre pela conversa mais recente do leitor (BER-102).
create index assistant_conversations_user_recent
  on public.assistant_conversations (user_id, last_message_at desc);

create table public.assistant_messages (
  id uuid primary key default extensions.uuid_generate_v4(),
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  -- `user_id` repetido aqui de propósito, apesar de já vir pela conversa: o
  -- `delete-account` varre as tabelas do leitor por `user_id` (ver USER_OWNED_TABLES),
  -- e a policy de leitura fica sem subconsulta. O cascade acima é a segunda rede.
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  role text not null check (role in ('reader', 'assistant')),
  kind text not null check (kind in ('question', 'answer', 'page_text')),
  content text not null,
  -- Como a mensagem chegou: da foto ou digitada. Nulo quando não se aplica.
  source_kind text check (source_kind is null or source_kind in ('photo', 'typed')),
  -- BER-103: o leitor liberou o spoiler nesta pergunta específica. Nunca é uma
  -- chave global — uma configuração ligada há três meses vira spoiler que ninguém
  -- pediu hoje.
  spoiler_unlocked boolean not null default false,
  -- Custo real da chamada que produziu esta mensagem, para o custo por interação ser
  -- medido e não estimado (spec §7, mesmo raciocínio da BER-59).
  model text,
  input_tokens int,
  output_tokens int,
  created_at timestamptz not null default now()
);

create index assistant_messages_conversation
  on public.assistant_messages (conversation_id, created_at);

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;

-- Só leitura, e só do dono. Quem escreve é o servidor, com a chave de serviço.
-- A conversa é o espaço privado do leitor: a transcrição de um leitor nunca responde
-- à pergunta de outro nem alimenta a base da BER-59 (spec §5).
create policy assistant_conversations_own_read on public.assistant_conversations for select to authenticated
  using (user_id = auth.uid());

create policy assistant_messages_own_read on public.assistant_messages for select to authenticated
  using (user_id = auth.uid());
