-- book_contents para os 3 livros do piloto
-- Conteúdo: resumos/paráfrases originais por capítulo para uso da IA
-- Fonte: baseado em obras de domínio público ou resumos próprios para fins educacionais
-- NÃO contém texto literal dos livros protegidos por direitos autorais

-- ============================================================
-- Livro 1: O Guia do Mochileiro das Galáxias — Douglas Adams
-- ============================================================

-- Cap 1 (p. 1–20): Arthur Dent acorda numa manhã comum e descobre que sua casa
-- será demolida para dar passagem a uma nova estrada de desvio. Enquanto tenta impedir
-- a demolição ficando deitado na lama, seu amigo Ford Prefect aparece com pressa
-- incomum e insiste que Arthur vá com ele tomar cerveja no pub. Ford revela que é de
-- outro planeta e que a Terra será destruída em minutos pelos Vogons para construir
-- uma via expressa hiperespacial. O par é transportado para a nave Vogon instantes
-- antes da explosão do planeta.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Arthur Dent acorda e descobre que sua casa será demolida para dar passagem a uma estrada de desvio. Ele protesta ficando deitado na lama na frente das máquinas. Seu amigo Ford Prefect chega com urgência incomum e convence Arthur a ir ao pub. Lá, Ford revela que é alienígena de Betelgeuse, não humano, e que esteve preso na Terra por quinze anos pesquisando para o Guia do Mochileiro das Galáxias. Ford avisa que a Terra será destruída em doze minutos pelos Vogons. Arthur mal acredita no que ouve. Eles são teletransportados para a nave Vogon no último instante. A Terra explode.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0001-000000000001' and c.number = 1
on conflict (chapter_id) do nothing;

-- Cap 2 (p. 21–40): A bordo da nave Vogon, Arthur e Ford enfrentam a poesia Vogon,
-- considerada a terceira pior do universo. O capitão Vogon lê seus versos para os dois
-- e os tortura com a experiência. Arthur e Ford são capturados e levados para serem
-- jogados ao espaço. Antes de serem ejetados, o capitão explica burocrática e
-- friamente por que a Terra precisava ser destruída — simples progresso administrativo.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'A bordo da nave Vogon, Arthur e Ford descobrem que os Vogons são criaturas burocráticas, feias e sem sentimentos. O capitão Vogon decide torturá-los lendo sua poesia, considerada a terceira pior do universo. Arthur sofre com os versos enquanto Ford tenta apreciar a experiência como antropólogo. Depois da sessão de poesia, o capitão explica com indiferença burocrática que a Terra foi destruída para dar lugar a uma via expressa hiperespacial — os papéis estavam disponíveis para consulta há cinquenta anos nos Planetas Alfa de Centauro. Arthur e Ford são jogados para fora da nave no espaço.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0001-000000000001' and c.number = 2
on conflict (chapter_id) do nothing;

-- Cap 3 (p. 41–60): No espaço e prestes a morrer, Arthur e Ford são resgatados
-- de forma improvável pela nave Coração de Ouro, equipada com o Motor de
-- Improbabilidade Infinita. A bordo estão Zaphod Beeblebrox, ex-presidente da
-- Galáxia e primo de Ford, e Trillian, uma mulher que Arthur conheceu numa festa
-- em Londres. A situação é altamente improvável e ninguém consegue explicar bem
-- por que estão todos ali juntos.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Arthur e Ford estão flutuando no espaço, prestes a morrer, quando são resgatados pela nave Coração de Ouro. A nave usa o Motor de Improbabilidade Infinita, que faz coisas matematicamente improváveis acontecerem. A bordo estão Zaphod Beeblebrox, presidente da Galáxia com duas cabeças e três braços, e Trillian, uma astrofísica que Arthur conheceu numa festa em Southampton. Zaphod é primo de Ford. A coincidência de todos se encontrarem é estatisticamente impossível, mas o motor de improbabilidade explica isso. Arthur fica atordoado tentando processar tudo que aconteceu — o fim da Terra, o espaço, e agora isso.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0001-000000000001' and c.number = 3
on conflict (chapter_id) do nothing;

-- Cap 4 (p. 61–85): A tripulação discute o destino da nave: Zaphod quer chegar
-- ao planeta lendário Magrathea, criador de planetas de luxo sob encomenda. O Guia
-- do Mochileiro das Galáxias é apresentado em detalhes — um livro eletrônico que
-- contém informações sobre tudo no universo, vendido por menos que o Guia Enciclopédico
-- da Galáxia porque tem escrito na capa "Não Entre em Pânico". Marvin, o robô
-- deprimido, é apresentado e reclama existencialmente de tudo.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Zaphod revela que roubou a nave Coração de Ouro e quer encontrar o planeta Magrathea, que faz planetas sob encomenda e desapareceu há cinco milhões de anos. O Guia do Mochileiro das Galáxias é descrito: um livro eletrônico com informações sobre todo o universo, mais popular que o Guia Enciclopédico porque é mais barato e tem "Não Entre em Pânico" escrito na capa. Ford explica que trabalha como pesquisador do Guia. Marvin, o robô androide de personalidade genuinamente deprimida, é apresentado. Ele tem um cérebro do tamanho de um planeta e é forçado a fazer tarefas triviais, o que o deixa ainda mais deprimido. Marvin reclama de dor em todos os diodos do lado esquerdo.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0001-000000000001' and c.number = 4
on conflict (chapter_id) do nothing;

-- Cap 5 (p. 86–110): A nave chega a Magrathea, cercada por avisos de perigo.
-- Dois mísseis são disparados contra eles. O Motor de Improbabilidade é ativado e
-- os mísseis se transformam num vaso de petúnias e uma baleia que cai do céu.
-- A baleia tem pensamentos existenciais durante sua breve existência. Eles poisam
-- no planeta deserto e frio.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'A nave chega a Magrathea, que parece deserto e morto. Avisos automáticos ameaçam destruir qualquer nave que se aproxime. Dois mísseis nucleares são disparados. Zaphod ativa o Motor de Improbabilidade Infinita e os mísseis se transformam: um vira um vaso de petúnias e o outro vira uma baleia enorme que materializa no ar e começa a cair. A baleia, existindo há apenas alguns segundos, tenta entender o mundo ao seu redor antes de colidir com o solo. O vaso de petúnias pensa "Oh, não, não de novo." A tripulação pousa em Magrathea e encontra um planeta árido e silencioso.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0001-000000000001' and c.number = 5
on conflict (chapter_id) do nothing;

-- Cap 6 (p. 111–140): Na superfície de Magrathea, Arthur encontra Slartibartfast,
-- um arquiteto de planetas que o leva para dentro do planeta em suas cavernas
-- imensuráveis. Lá, Arthur vê a linha de produção onde novos planetas são esculpidos.
-- Slartibartfast revela que foi ele quem projetou as costas da Noruega (seu trabalho
-- favorito). Ele conta a história do planeta Terra — que na verdade foi encomendado
-- por camundongos para ser um computador orgânico gigante.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Arthur encontra Slartibartfast, um velho arquiteto magrathiano que gosta especialmente de fiordes. Ele leva Arthur para dentro do planeta, onde gigantescas cavernas abrigam a produção de novos planetas. Arthur vê planetas em construção sendo esculpidos por artesãos. Slartibartfast explica que Magrathea construía planetas de luxo sob encomenda para clientes ricos. Ele revela que a Terra foi encomendada e construída por eles — um computador orgânico de dez milhões de anos projetado para calcular a Pergunta Fundamental da Vida, do Universo e de Tudo Mais. O encomendante eram, na verdade, os camundongos, que são seres hiperdimensionais disfarçados. Slartibartfast ganhou um prêmio pelas costas da Noruega.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0001-000000000001' and c.number = 6
on conflict (chapter_id) do nothing;

-- Cap 7 (p. 141–170): Slartibartfast explica a história do computador Deep Thought,
-- que foi construído para responder à Grande Pergunta. Após sete milhões e meio de anos
-- de cálculo, Deep Thought anunciou que a resposta era 42 — mas ninguém sabia qual
-- era a pergunta. Por isso a Terra foi construída: para calcular a pergunta. Mas foi
-- destruída cinco minutos antes de completar o processo. Os camundongos querem agora
-- usar o cérebro de Arthur para tentar recuperar a pergunta.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Slartibartfast conta a história de Deep Thought, o segundo maior computador do universo, construído para responder à Pergunta Fundamental da Vida, do Universo e de Tudo Mais. Após 7,5 milhões de anos de cálculo, Deep Thought revelou que a resposta era 42. O problema: ninguém sabia qual era a pergunta. Deep Thought então projetou um computador ainda maior para calcular a pergunta — a Terra. A Terra funcionou por quase dez milhões de anos como computador orgânico, com toda a vida sendo parte do processo. Mas foi destruída pelos Vogons cinco minutos antes de concluir o cálculo. Os camundongos, frustrados, descobrem que o cérebro de Arthur pode conter fragmentos da pergunta e querem extraí-lo.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0001-000000000001' and c.number = 7
on conflict (chapter_id) do nothing;

-- Cap 8 (p. 171–215): Os camundongos propõem comprar o cérebro de Arthur.
-- Ele recusa. Uma perseguição se inicia dentro do planeta. Policiais galácticos
-- aparecem e tentam prender Zaphod. No caos, a tripulação escapa. Marvin salva
-- todos deprimindo o computador policial ao conversar com ele. Ao final, eles
-- estão de volta na nave, vivos, sem destino certo — e com fome. O livro termina
-- com eles indo ao Restaurante no Fim do Universo.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Os camundongos Frankie e Benjy oferecem dinheiro pelo cérebro de Arthur para extrair a Pergunta Fundamental. Arthur recusa — prefere continuar vivo com seu cérebro. Uma confusão se instala. Policiais galácticos, Shooty e Bang Bang, aparecem para prender Zaphod por roubar a nave Coração de Ouro. No caos dos túneis de Magrathea, a tripulação foge. Marvin fica para trás e conversa com o computador policial, deprimindo-o completamente ao compartilhar sua visão sombria do universo. O computador para de funcionar. A tripulação foge na nave e todos estão com fome. Zaphod propõe ir ao Restaurante no Fim do Universo — o lugar mais extraordinário do universo para jantar.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0001-000000000001' and c.number = 8
on conflict (chapter_id) do nothing;

-- ============================================================
-- Livro 2: 1984 — George Orwell
-- ============================================================

-- Cap 1 / Parte 1 Cap 1 (p. 1–30): Winston Smith, funcionário do Ministério da
-- Verdade na Londres distópica de 1984, volta do trabalho num dia frio de abril.
-- Cartazes do Grande Irmão estão por toda parte. Winston vai ao seu apartamento
-- e começa a escrever num diário — ato proibido pelo Partido. Ele descreve o mundo
-- ao seu redor: telecrãs que monitoram tudo, a Polícia do Pensamento, os ministérios.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Winston Smith, 39 anos, trabalha no Ministério da Verdade em Airstrip One (antiga Londres), em 1984. O Partido, liderado pelo Grande Irmão, controla tudo. Telecrãs em cada parede transmitem propaganda e monitoram os cidadãos. Winston volta para seu apartamento miserável e, escondido de um ângulo que o telecran não alcança, começa a escrever num diário — ato que pode resultar em morte ou campos de trabalho. Ele escreve sobre um filme de guerra assistido e sobre o ódio que sente pelo sistema. Winston sabe que a Polícia do Pensamento pode prendê-lo a qualquer momento só por ter pensamentos contrários ao Partido. A sociedade é dividida entre o Partido Externo, o Partido Interno e os proles.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0002-000000000002' and c.number = 1
on conflict (chapter_id) do nothing;

-- Cap 2 / Parte 1 Cap 2 (p. 31–60): Winston encontra seus vizinhos, a família
-- Parsons. A filha deles é membro dos Espiões Juvenis e denuncia qualquer desvio.
-- No trabalho, Winston revisita a Neolíngua e como o Partido destrói palavras para
-- limitar o pensamento. Ele vê uma colega chamada Julia que ele desconfia ser
-- espiã. Winston pensa em O'Brien, um membro do Partido Interno que parece
-- guardar alguma resistência secreta.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Winston interage com seus vizinhos, os Parsons: um homem gordo e entusiasta do Partido e seus filhos que são membros dos Espiões Juvenis, treinados para denunciar qualquer comportamento suspeito, inclusive dos próprios pais. No Ministério da Verdade, Winston trabalha reescrevendo artigos antigos de jornais para que se alinhem à versão atual da história — o Partido apaga e reescreve o passado constantemente. Ele observa uma colega chamada Julia e a suspeita de ser espiã do Pensamento. Winston nota O'Brien, um membro do Partido Interno de aparência inteligente, e imagina que talvez ele seja secretamente um rebelde. A Neolíngua, idioma criado pelo Partido para reduzir o vocabulário e suprimir o pensamento livre, é discutida com um colega linguista.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0002-000000000002' and c.number = 2
on conflict (chapter_id) do nothing;

-- Cap 3 / Parte 1 Cap 3 (p. 61–100): Winston tem sonhos com sua mãe e irmã,
-- que desapareceram quando ele era criança. No trabalho, participa dos Dois Minutos
-- de Ódio — sessão diária de propaganda intensa. Durante um desses momentos vê
-- Julia e a odeia e deseja ao mesmo tempo. Vê O'Brien novamente e tem a sensação
-- de que eles são aliados. Winston reflete sobre como o Partido controla o passado
-- e questiona se existiu mesmo um tempo diferente.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Winston tem sonhos recorrentes com sua mãe e irmã, lembranças vagas de quando eram felizes antes de desaparecerem misteriosamente. Ele participa dos Dois Minutos de Ódio, ritual diário em que todos gritam contra Emmanuel Goldstein, inimigo do Partido. Durante a sessão, Winston sente raiva irracional e ao mesmo tempo olha para Julia com ódio e desejo. Ele troca um olhar com O'Brien que parece comunicar cumplicidade. Winston escreve no diário sobre a Polícia do Pensamento e reflete que provavelmente já está morto — é só questão de tempo. Ele questiona se existiu mesmo um mundo diferente ou se o Partido sempre existiu assim. A ideia de que o passado pode ser totalmente fabricado o perturba profundamente.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0002-000000000002' and c.number = 3
on conflict (chapter_id) do nothing;

-- Cap 4 / Parte 1 Cap 4 (p. 101–140): Winston visita um bairro de proles e entra
-- numa loja de antiguidades onde compra um pedaço de coral. Ele conhece o dono,
-- o senhor Charrington, que parece simpático. Winston aluga um quarto acima da
-- loja. Ele começa a refletir sobre os proles — 85% da população — e se eles
-- poderiam ser a chave para derrubar o Partido se tomassem consciência.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Winston caminha pelo bairro dos proles, onde a vida é miserável mas mais livre — sem telecrãs nas casas, menos vigilância. Ele entra numa antiquaria de um velho chamado Charrington e compra um peso de papel de vidro com coral dentro, objeto inútil e belo de uma época passada. Charrington mostra um quarto para alugar acima da loja, sem telecran — Winston fica fascinado. Ele pensa nos proles como a única esperança de revolução: são maioria esmagadora da população, mas o Partido os mantém ignorantes e distraídos com entretenimento barato. Se os proles acordassem, poderiam destruir o Partido. Winston reflete: "Se há esperança, ela está nos proles."'
from public.chapters c
where c.book_id = '00000000-0000-0000-0002-000000000002' and c.number = 4
on conflict (chapter_id) do nothing;

-- Cap 5 / Parte 2 Cap 1 (p. 141–180): Julia passa uma nota para Winston dizendo
-- "Eu te amo." Eles combinam um encontro secreto no campo, longe dos telecrãs.
-- Lá, se beijam e conversam. Julia é pragmática e subversiva por prazer pessoal,
-- não por ideologia. Eles começam um caso amoroso proibido. Winston aluga o quarto
-- acima da loja de Charrington para terem um lugar privado.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Julia passa uma nota para Winston: "Eu te amo." Winston fica chocado — ela era quem ele mais suspeitava ser espiã. Eles se encontram secretamente num campo no campo onde não há câmeras. Julia é jovem, prática e rebelde por instinto — ela tem casos com membros do Partido como forma de subversão, sem grandes ideologias. Eles se beijam e conversam sobre a vida sob o Partido. Julia diz que o Partido pode controlar o que as pessoas dizem e fazem, mas não o que sentem por dentro. Winston e Julia começam um relacionamento proibido. Eles alugam o quarto acima da loja do velho Charrington como esconderijo particular, um espaço sem telecran onde podem ser eles mesmos.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0002-000000000002' and c.number = 5
on conflict (chapter_id) do nothing;

-- Cap 6 / Parte 2 Cap 2 (p. 181–220): Winston e Julia se encontram regularmente
-- no quarto. Ela traz café e chocolate real — itens de luxo. Eles conversam sobre
-- o Partido e suas vidas. O'Brien os contata e convida Winston para sua casa,
-- dizendo ter um dicionário de Neolíngua para ele. Winston e Julia vão ao
-- apartamento luxuoso de O'Brien, que revela ser membro da Irmandade — a resistência.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Winston e Julia se encontram regularmente no quarto sobre a antiquaria. Julia traz alimentos que o Partido reserva para a elite — café real, açúcar, pão branco, chocolate — obtidos no mercado negro. Eles vivem momentos de normalidade proibida. O'Brien contata Winston discretamente e o convida ao seu apartamento para receber um dicionário de Neolíngua. Winston e Julia vão juntos. O apartamento de O'Brien é luxuoso — ele é membro do Partido Interno. O'Brien desliga o telecran (membros do Partido Interno têm esse privilégio por curtos períodos) e revela que é membro da Irmandade, o movimento clandestino de resistência liderado por Goldstein. Ele diz que enviará a Winston o livro de Goldstein.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0002-000000000002' and c.number = 6
on conflict (chapter_id) do nothing;

-- Cap 7 / Parte 2 Cap 3 (p. 221–265): Winston recebe o livro de Goldstein e
-- o lê no quarto com Julia adormecida ao lado. O livro explica como o mundo
-- chegou ao estado atual: três superpotências em guerra eterna que mantêm o
-- equilíbrio do poder e a classe dominante no controle. A guerra não é para
-- vencer, mas para justificar a miséria e o controle. Winston entende finalmente
-- a estrutura do poder.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Winston recebe o livro proibido de Goldstein e começa a ler no quarto enquanto Julia dorme. O livro, "A Teoria e a Prática do Coletivismo Oligárquico", explica que o mundo é dividido em três superpotências — Oceânia, Eurásia e Lestásia — em guerra constante. A guerra não tem objetivo de vitória; ela existe para consumir o excedente de produção e manter o povo na pobreza e sob controle. As classes dominantes de todos os países mantêm o status quo mutuamente. O prole nunca saberá a verdade porque não tem acesso à informação. Winston compreende que o objetivo do Partido não é a felicidade humana nem a eficiência — é o poder pelo poder, eterno e absoluto. O'Brien enviou o livro como parte da iniciação na Irmandade.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0002-000000000002' and c.number = 7
on conflict (chapter_id) do nothing;

-- Cap 8 / Parte 3 Cap 1 (p. 266–300): Winston e Julia são presos no quarto pela
-- Polícia do Pensamento. Charrington era um agente infiltrado. O'Brien também era
-- agente — tudo foi uma armadilha. Winston é levado ao Ministério do Amor e
-- torturado. O'Brien aparece como seu torturador e explica que o objetivo não é
-- a confissão, mas a transformação completa de Winston.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Enquanto Winston e Julia estão no quarto, uma voz surge atrás do quadro na parede — havia um telecran escondido. A Polícia do Pensamento invade. Charrington remove a máscara: era um agente da Polícia do Pensamento há anos. Winston e Julia são brutalmente capturados. No Ministério do Amor, Winston é mantido numa cela sem janelas, sem dormir, com luz constante. Outros prisioneiros chegam e saem. O'Brien aparece — não como aliado, mas como um dos principais agentes do Partido. Tudo era uma armadilha cuidadosamente planejada. O'Brien explica que o Partido sabe de tudo há anos. A tortura começa: física e psicológica. O'Brien diz que não quer apenas a confissão de Winston — quer que ele acredite genuinamente.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0002-000000000002' and c.number = 8
on conflict (chapter_id) do nothing;

-- Cap 9 / Parte 3 Cap 2 (p. 301–328): O processo de "cura" de Winston avança.
-- Ele é levado ao Quarto 101, onde enfrenta seu maior medo — ratos. Ele trai Julia
-- para se salvar. Depois, solto e reconformado, Winston encontra Julia brevemente
-- e ambos admitem que se traíram. Sentado num café, Winston olha para um retrato
-- do Grande Irmão e percebe que finalmente o ama.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'A tortura de Winston avança em três fases: aprender, entender, aceitar. O'Brien o força a acreditar que dois mais dois são cinco se o Partido disser isso. Winston resiste mentalmente mas seu corpo cede. Ele é levado ao Quarto 101, onde cada pessoa enfrenta seu pior medo. O medo de Winston são ratos. Quando uma gaiola de ratos é encostada ao seu rosto, Winston grita para colocarem Julia no lugar dele. Ele a trai completamente. Depois, solto e trabalhando novamente, Winston encontra Julia acidentalmente. Ela diz que também o traiu. Não há mais sentimento entre eles. Sentado sozinho num café, bebendo gim, Winston olha para o rosto do Grande Irmão num telecran. Ele sente um amor quente e tranquilo pelo Grande Irmão. A batalha foi vencida — sobre si mesmo.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0002-000000000002' and c.number = 9
on conflict (chapter_id) do nothing;

-- ============================================================
-- Livro 3: Coraline — Neil Gaiman
-- ============================================================

-- Cap 1 (p. 1–18): Coraline Jones se muda com os pais para um apartamento antigo
-- dividido com vizinhos excêntricos. Ela está entediada — os pais trabalham o dia
-- todo. Ela explora o apartamento e encontra uma porta pequena selada que dá para
-- uma parede de tijolos.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Coraline Jones, uma garota curiosa e aventureira de uns 11 anos, se muda com os pais para um apartamento velho dividido com vizinhos estranhos: a senhorita Spink e a senhorita Forcible, duas atrizes aposentadas com cães, e o velho louco do andar de cima que diz ter um circo de ratos. Os pais de Coraline trabalham em casa no computador e raramente prestam atenção nela. Ela explora a propriedade e o jardim encharcado. Dentro do apartamento, descobre uma pequena porta trancada na parede da sala. Quando sua mãe a abre com uma chave antiquada, há apenas uma parede de tijolos do outro lado. Coraline está entediada e quer que alguém brinque com ela.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0003-000000000003' and c.number = 1
on conflict (chapter_id) do nothing;

-- Cap 2 (p. 19–36): Coraline acorda de madrugada e vê que a porta está aberta.
-- Do outro lado há um corredor que leva a um apartamento idêntico ao dela, mas
-- diferente. Lá encontra a Outra Mãe — igual à sua mãe, mas com botões no lugar
-- dos olhos. A Outra Mãe é atenciosa, cozinha comida deliciosa e tem tempo para
-- Coraline. O apartamento espelho parece perfeito.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'De madrugada, Coraline vê que a porta pequena está aberta e há um corredor comprido e escuro do outro lado. Ela atravessa e chega num apartamento que parece idêntico ao seu, mas mais vivo e colorido. Lá mora a Outra Mãe: uma mulher que se parece exatamente com sua mãe, mas tem botões pretos costurados no lugar dos olhos. O Outro Pai também está lá, com botões nos olhos. A Outra Mãe cozinha uma refeição deliciosa e presta total atenção em Coraline. O apartamento espelho tem jardim encantado e brinquedos. Tudo parece melhor que a vida real de Coraline. Antes de ir dormir, ela retorna pelo corredor para sua casa real.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0003-000000000003' and c.number = 2
on conflict (chapter_id) do nothing;

-- Cap 3 (p. 37–54): Coraline visita o mundo espelho novamente. Encontra versões
-- dos vizinhos excêntricos — igualmente estranhas mas mais encantadoras. Um gato
-- misterioso aparece no mundo espelho e pode falar. Ele avisa Coraline que ela
-- deve ter cuidado. A Outra Mãe propõe que Coraline fique para sempre — mas
-- precisaria costurar botões nos olhos.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Coraline volta ao mundo espelho e encontra as outras versões das senhoritas Spink e Forcible, que fazem um show de teatro mágico. O gato misterioso aparece — no mundo real ele não fala, mas aqui sim. O gato diz que os nomes são importantes e que ele não tem nome porque é um gato. Ele alerta Coraline que as coisas neste mundo não são o que parecem. A Outra Mãe revela que ama Coraline muito mais que seus pais reais e propõe que ela fique para sempre. Mas para ficar, Coraline precisaria deixar costurar botões pretos no lugar dos seus olhos. Coraline recusa, com um arrepio. Ela volta para casa e encontra seus pais reais, frios e distraídos, mas prefere isso à proposta perturbadora da Outra Mãe.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0003-000000000003' and c.number = 3
on conflict (chapter_id) do nothing;

-- Cap 4 (p. 55–75): Coraline acorda e seus pais reais desapareceram. Ela procura
-- por toda a casa e não os encontra. Um espelho na entrada mostra seus pais presos
-- num lugar frio e escuro. Coraline entende que a Outra Mãe os capturou para forçá-la
-- a voltar ao mundo espelho. Decidida, ela atravessa a porta novamente.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Coraline acorda e chama pelos pais — silêncio. A casa está vazia. Ela procura por toda a propriedade, nos quartos dos vizinhos, no jardim. À noite, vê no espelho da sala dois rostos — seus pais, congelados num lugar escuro e frio, tentando falar mas sem som. Ela entende: a Outra Mãe os sequestrou para atrair Coraline de volta. O gato aparece e confirma que é uma armadilha. Coraline pondera: poderia ficar com os vizinhos e ignorar tudo, mas não consegue abandonar os pais. Ela pega a chave da porta e atravessa o corredor para o mundo espelho, determinada a resgatar seus pais. O gato a acompanha.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0003-000000000003' and c.number = 4
on conflict (chapter_id) do nothing;

-- Cap 5 (p. 76–95): No mundo espelho, Coraline confronta a Outra Mãe, agora menos
-- disfarçada — mais alta, mais fina, com dedos compridos como agulhas. Coraline
-- propõe um jogo: se encontrar as almas de três crianças escondidas e seus pais,
-- ela vai embora. Se perder, fica com botões nos olhos. A Outra Mãe aceita,
-- confiante de que vai ganhar.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'No mundo espelho, a Outra Mãe está diferente — mais alta, com dedos longos como agulhas de tricô, menos humana. Ela sente que Coraline voltou por vontade própria e fica satisfeita. Coraline percebe que precisa ser esperta. Ela propõe um desafio: vai procurar os pais e as almas das outras crianças que a Outra Mãe capturou ao longo dos anos — três fantasmas de crianças que Coraline viu presas no espelho. Se Coraline encontrar tudo, a Outra Mãe deixa todos irem. Se não encontrar, Coraline fica para sempre. A Outra Mãe concorda — ela gosta de jogos porque sempre ganha. Coraline começa a busca com o gato como aliado, usando sua observação aguçada e a pedra com buraco que as senhoritas Spink e Forcible lhe deram.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0003-000000000003' and c.number = 5
on conflict (chapter_id) do nothing;

-- Cap 6 (p. 96–115): Coraline usa a pedra com buraco para enxergar as almas
-- escondidas. Ela encontra duas delas em lugares diferentes do mundo espelho —
-- no teatro das outras senhoras e no circo do outro velho louco. A cada alma
-- encontrada, o mundo espelho fica mais vazio e instável, como se estivesse
-- se desfazendo.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Coraline usa a pedra com buraco no centro que as senhoritas Spink e Forcible lhe deram — ela permite ver coisas escondidas e almas presas. Ela encontra a primeira alma no teatro das Outras Spink e Forcible, brilhando entre as cortinas. Encontra a segunda alma no circo do Outro velho do andar de cima, escondida entre os ratos que executam truques. A cada alma encontrada e recolhida, o mundo espelho perde detalhes — fica mais cinza, mais raso, como um cenário de teatro sendo desmontado. A Outra Mãe percebe o progresso de Coraline e fica irritada. O mundo espelho começa a se dissolver. Falta encontrar a terceira alma.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0003-000000000003' and c.number = 6
on conflict (chapter_id) do nothing;

-- Cap 7 (p. 116–135): Coraline encontra a terceira alma no jardim espelho.
-- Ela também precisa encontrar seus pais, presos numa bola de neve na mão da
-- Outra Mãe. Coraline usa astúcia para pegar a bola de neve com os pais e
-- declara que ganhou o jogo. A Outra Mãe furiosa tenta impedi-la de sair.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Coraline encontra a terceira alma no jardim espelho, que está quase completamente apagado. Ela coleta as três almas. Agora precisa resgatar os pais — vê-os dentro de uma bola de neve de vidro na mão da Outra Mãe. Com astúcia, Coraline distrai a Outra Mãe e agarra a bola de neve. Ela anuncia que ganhou o desafio e exige que a Outra Mãe libere todos. A Outra Mãe, enraivecida e transformada numa criatura quase insetóide, tenta bloquear a porta do corredor. Coraline joga o gato contra o rosto da criatura — o gato arranha e cega temporariamente a Outra Mãe. Coraline corre para o corredor com os pais dentro da bola e as três almas.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0003-000000000003' and c.number = 7
on conflict (chapter_id) do nothing;

-- Cap 8 (p. 136–162): Coraline atravessa o corredor e volta para casa com os pais
-- e as três almas. Ela libera as almas e os pais aparecem como se nada tivesse
-- acontecido — sem memória do que passaram. Coraline percebe que a Outra Mãe
-- pode ainda tentar passar pelo corredor. Ela usa um truque final para destruir
-- a chave e selar a porta para sempre. As almas das crianças agradecem e partem.
insert into public.book_contents (chapter_id, content_text)
select c.id,
'Coraline atravessa o corredor de volta para casa real. Seus pais aparecem na cozinha como se nada tivesse acontecido — eles não lembram de ter ficado presos. Coraline libera as três almas das crianças capturadas ao longo dos anos. Os fantasmas aparecem brevemente, agradecem e partem para onde almas vão. Mas Coraline sabe que a Outra Mãe pode tentar passar pela porta. Ela tem um plano: finge que a chave caiu no poço do jardim e arrasta a Outra Mão — que saiu rastejando pelo corredor antes da porta fechar — para o poço, deixando cair a chave. A Outra Mão afunda no poço com a chave. Coraline sela o caminho para sempre. Na última noite, os fantasmas das crianças aparecem em sonho e agradecem. Coraline acorda para o primeiro dia de aula com seus pais reais — imperfeitos, distraídos, mas seus.'
from public.chapters c
where c.book_id = '00000000-0000-0000-0003-000000000003' and c.number = 8
on conflict (chapter_id) do nothing;
