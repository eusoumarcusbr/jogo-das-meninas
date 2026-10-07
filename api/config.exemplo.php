<?php
/* ---------------------------------------------------------------------------
   JOGO DAS MENINAS — configuração do ranking (MODELO)

   Este é o modelo, e é o único que entra no repositório. Copie para
   config.php e preencha lá:

       cp config.exemplo.php config.php

   O config.php está no .gitignore de propósito. Segredo e senha em repositório
   público não têm volta: mesmo apagando depois, ficam no histórico do Git.
   --------------------------------------------------------------------------- */

/* Chave que assina o comprovante de partida. Troque por uma sequência longa e
   aleatória ANTES de publicar. Se ficar com o valor de exemplo, qualquer um que
   leia este repositório consegue forjar partidas.
   Para gerar uma: https://www.random.org/strings ou, no terminal:
       openssl rand -hex 32                                                    */
define('RANKING_SEGREDO', 'TROQUE-ESTE-VALOR-POR-UMA-SEQUENCIA-ALEATORIA-LONGA');

/* Usuário e senha do painel de moderação (api/admin.php). */
define('RANKING_ADMIN_USUARIO', 'admin');
define('RANKING_ADMIN_SENHA', 'TROQUE-ESTA-SENHA');

/* Onde ficam os arquivos de dados. O .htaccess dessa pasta bloqueia acesso pelo
   navegador; se você preferir, pode apontar para fora do public_html. */
define('RANKING_DADOS', __DIR__ . '/dados');

/* Quantos nomes o ranking público mostra, por nível. */
define('RANKING_TOPO', 10);

/* Quantas entradas o arquivo guarda no total antes de descartar as mais
   antigas. Serve só para o JSON não crescer para sempre. */
define('RANKING_MAX_ENTRADAS', 3000);

/* Limite de envios por IP. */
define('RANKING_LIMITE_ENVIOS', 20);      /* quantos */
define('RANKING_LIMITE_JANELA', 3600);    /* em quantos segundos */

/* Uma partida precisa durar pelo menos isso para valer, e o comprovante expira
   depois disso. Em segundos. */
define('RANKING_PARTIDA_MINIMA', 4);
define('RANKING_PARTIDA_MAXIMA', 7200);

/* Velocidade máxima do jogo, em metros por segundo, por nível. Sai da
   calibragem: vMax do perfil desktop × 6 (vMax é px por quadro, o metro são
   10px, e o jogo roda a 60 quadros). É o teto usado para saber se a distância
   enviada caberia no tempo que a partida durou. */
$RANKING_VEL_MAX = array(
  'facil'   => 69.6,
  'normal'  => 87.0,
  'dificil' => 108.6
);

/* Teto de petiscos por metro percorrido. Sai do espaçamento mínimo entre itens no
   perfil de cer (o mais generoso dos dois), com o dossiê valendo 5 e o
   bônus de 2XP dobrando. Ninguém chega perto disso jogando de verdade — serve
   só para barrar pontuação inventada. */
define('RANKING_PETISCOS_POR_METRO', 1.5);

/* Apelidos recusados. A comparação ignora acento, maiúscula, caractere
   repetido e troca de letra por número, então "T4QU3S" e "taaaques" caem aqui
   junto com "marcus".

   São DUAS listas porque casar por trecho em palavra curta é uma armadilha
   conhecida: "cu" dentro de "Marcus" recusaria um nome perfeitamente normal.
   Palavra curta só é recusada quando é a palavra inteira; trecho só vale para
   sequência longa que não aparece por acaso dentro de outra coisa. */

/* recusadas em qualquer posição — sequências que não surgem por acaso */
$RANKING_BLOQUEADOS_TRECHO = array(
  'marcus', 'pedromarcus', 'meninas', '', '',
  'caralho', 'buceta', 'xoxota', 'vagabundo', 'arrombado', 'desgraca',
  'filhadaputa', 'filhodaputa', 'puta', 'viado', 'boiola', 'traveco',
  'corrupto', 'ladrao', 'safado', 'nazista', 'hitler'
);

/* recusadas só quando são a palavra inteira — curtas ou ambíguas */
$RANKING_BLOQUEADOS_EXATOS = array(
  'meninas', 'admin', 'moderador', 'root', 'anonimo',
  'cu', 'cuzao', 'pau', 'pinto', 'rola', 'penis', 'xota', 'sexo', 'transa',
  'merda', 'bosta', 'porra', 'foda', 'foder', 'bicha', 'macaco',
  'fdp', 'vsf', 'tnc', 'pqp', 'krl', 'otario', 'idiota', 'burro'
);

/* Nota deliberada: este filtro é a primeira peneira, não a garantia. Quem
   quiser burlar consegue — escrevendo junto, trocando letra, inventando. O que
   garante é a fila de moderação em api/admin.php: nada aparece na lista pública
   antes de alguém liberar. */
