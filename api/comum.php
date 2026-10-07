<?php
/* ---------------------------------------------------------------------------
   JOGO DAS MENINAS — funções compartilhadas pelo ranking e pelo painel de moderação.
   --------------------------------------------------------------------------- */

if (!is_file(__DIR__ . '/config.php')) {
  http_response_code(503);
  header('Content-Type: text/plain; charset=utf-8');
  exit("Falta o api/config.php. Copie o api/config.exemplo.php para api/config.php e preencha o segredo e a senha.\n");
}
require_once __DIR__ . '/config.php';

/* Trava de segurança: enquanto o segredo e a senha forem os de exemplo, o
   ranking não funciona. É de propósito — publicar com o segredo que está no
   repositório é o mesmo que publicar sem assinatura nenhuma, e qualquer um
   conseguiria forjar partidas. */
function rk_configurado() {
  return strpos(RANKING_SEGREDO, 'TROQUE') !== 0
      && strpos(RANKING_ADMIN_SENHA, 'TROQUE') !== 0;
}

/* ---------- arquivos ------------------------------------------------------ */

/* Os arquivos de dados terminam em .php e começam com esta linha. Se alguém
   pedir o arquivo pelo navegador, o servidor executa em vez de mostrar, e a
   execução para na primeira instrução: sai página em branco, não o conteúdo.
   O .htaccess da pasta já bloqueia, mas isso aqui continua valendo mesmo se o
   .htaccess for esquecido no upload ou o servidor não honrar arquivo por
   diretório. */
define('RK_GUARDA', "<?php exit; ?>\n");

function rk_caminho($nome) {
  return rtrim(RANKING_DADOS, '/') . '/' . $nome . '.php';
}

function rk_garantir_pasta() {
  if (!is_dir(RANKING_DADOS)) { @mkdir(RANKING_DADOS, 0755, true); }
}

/* Lê um JSON. Devolve $padrao se não existir ou estiver corrompido — um arquivo
   quebrado não pode derrubar o jogo inteiro. */
function rk_ler($nome, $padrao) {
  $p = rk_caminho($nome);
  if (!is_file($p)) return $padrao;
  $txt = @file_get_contents($p);
  if ($txt === false || $txt === '') return $padrao;
  if (strpos($txt, RK_GUARDA) === 0) $txt = substr($txt, strlen(RK_GUARDA));
  $dado = json_decode($txt, true);
  return is_array($dado) ? $dado : $padrao;
}

/* Grava com trava exclusiva e troca atômica: dois jogadores terminando a
   partida no mesmo segundo não escrevem um por cima do outro. */
function rk_gravar($nome, $dado) {
  rk_garantir_pasta();
  $p    = rk_caminho($nome);
  $tmp  = $p . '.tmp' . getmypid();
  $txt  = json_encode($dado, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
  if ($txt === false) return false;
  if (@file_put_contents($tmp, RK_GUARDA . $txt, LOCK_EX) === false) return false;
  return @rename($tmp, $p);
}

/* Executa $fn com o arquivo travado, para leitura-alteração-gravação sem
   corrida. $fn recebe o conteúdo atual e devolve o novo. */
function rk_transacao($nome, $padrao, $fn) {
  rk_garantir_pasta();
  $lock = fopen(rk_caminho($nome . '.lock'), 'c');
  if ($lock) { flock($lock, LOCK_EX); }
  $atual = rk_ler($nome, $padrao);
  $novo  = $fn($atual);
  $ok    = ($novo === null) ? true : rk_gravar($nome, $novo);
  if ($lock) { flock($lock, LOCK_UN); fclose($lock); }
  return $ok;
}

/* ---------- resposta ------------------------------------------------------ */

function rk_json($dado, $codigo = 200) {
  http_response_code($codigo);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($dado, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function rk_erro($mensagem, $codigo = 400) {
  rk_json(array('ok' => false, 'erro' => $mensagem), $codigo);
}

/* ---------- identificação do visitante ------------------------------------ */

/* Guardamos só um hash do IP: serve para limitar envios sem manter endereço
   de ninguém em arquivo. */
function rk_ip_hash() {
  $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0';
  return substr(hash_hmac('sha256', $ip, RANKING_SEGREDO), 0, 16);
}

/* ---------- comprovante de partida ---------------------------------------- */

function rk_b64_encode($txt) {
  return rtrim(strtr(base64_encode($txt), '+/', '-_'), '=');
}

function rk_b64_decode($txt) {
  $t = strtr($txt, '-_', '+/');
  $r = strlen($t) % 4;
  if ($r) { $t .= str_repeat('=', 4 - $r); }
  return base64_decode($t);
}

/* Emitido quando a partida começa. Diz quando começou e em que nível, e vem
   assinado — o navegador não consegue inventar um. */
function rk_emitir_token($nivel) {
  $dado = array(
    'n' => bin2hex(random_bytes(8)),
    't' => time(),
    'd' => $nivel
  );
  $corpo = rk_b64_encode(json_encode($dado));
  $assin = rk_b64_encode(hash_hmac('sha256', $corpo, RANKING_SEGREDO, true));
  return $corpo . '.' . $assin;
}

function rk_ler_token($token) {
  if (!is_string($token) || strpos($token, '.') === false) return null;
  list($corpo, $assin) = explode('.', $token, 2);
  $esperado = rk_b64_encode(hash_hmac('sha256', $corpo, RANKING_SEGREDO, true));
  if (!hash_equals($esperado, $assin)) return null;
  $dado = json_decode(rk_b64_decode($corpo), true);
  if (!is_array($dado) || !isset($dado['n'], $dado['t'], $dado['d'])) return null;
  return $dado;
}

/* Um comprovante vale uma vez só. */
function rk_token_usado($nonce) {
  $usados = rk_ler('tokens.json', array());
  return isset($usados[$nonce]);
}

function rk_marcar_token($nonce) {
  rk_transacao('tokens.json', array(), function ($usados) use ($nonce) {
    $agora = time();
    foreach ($usados as $k => $exp) {
      if ($exp < $agora) unset($usados[$k]);   /* limpa os vencidos de carona */
    }
    $usados[$nonce] = $agora + RANKING_PARTIDA_MAXIMA;
    return $usados;
  });
}

/* ---------- limite por IP ------------------------------------------------- */

function rk_dentro_do_limite($ipHash) {
  $ok = true;
  rk_transacao('limites.json', array(), function ($lim) use ($ipHash, &$ok) {
    $agora  = time();
    $inicio = $agora - RANKING_LIMITE_JANELA;
    foreach ($lim as $k => $lista) {
      $lim[$k] = array_values(array_filter($lista, function ($t) use ($inicio) { return $t > $inicio; }));
      if (!$lim[$k]) unset($lim[$k]);
    }
    $meus = isset($lim[$ipHash]) ? $lim[$ipHash] : array();
    if (count($meus) >= RANKING_LIMITE_ENVIOS) { $ok = false; return $lim; }
    $meus[] = $agora;
    $lim[$ipHash] = $meus;
    return $lim;
  });
  return $ok;
}

/* ---------- apelido ------------------------------------------------------- */

/* Reduz o apelido à sua forma comparável: sem acento, sem maiúscula, sem
   caractere repetido e sem separador. É nessa forma que a lista de bloqueio é
   conferida, então "T4QU3S", "t a q u e s" e "taaaques" caem todos no mesmo. */
function rk_normalizar($txt) {
  $t = mb_strtolower($txt, 'UTF-8');
  $de = array('á','à','â','ã','ä','é','è','ê','ë','í','ì','î','ï','ó','ò','ô','õ','ö','ú','ù','û','ü','ç','ñ');
  $pa = array('a','a','a','a','a','e','e','e','e','i','i','i','i','o','o','o','o','o','u','u','u','u','c','n');
  $t = str_replace($de, $pa, $t);
  $t = strtr($t, array('0'=>'o','1'=>'i','3'=>'e','4'=>'a','5'=>'s','7'=>'t','@'=>'a','$'=>'s'));
  $t = preg_replace('/[^a-z]/', '', $t);
  $t = preg_replace('/(.)\1+/', '$1', $t);   /* colapsa letras repetidas */
  return $t;
}

/* Devolve o apelido limpo, ou null se não serve. */
function rk_limpar_apelido($bruto) {
  global $RANKING_BLOQUEADOS_TRECHO, $RANKING_BLOQUEADOS_EXATOS;

  if (!is_string($bruto)) return null;
  $a = trim(preg_replace('/\s+/u', ' ', $bruto));
  if ($a === '') return null;
  if (mb_strlen($a, 'UTF-8') < 2)  return null;
  if (mb_strlen($a, 'UTF-8') > 12) return null;

  /* letras (com acento), números, espaço e três separadores. Nada de emoji,
     link, arroba ou pontuação que permita escrever frase. */
  if (!preg_match('/^[\p{L}\p{Nd} ._-]+$/u', $a)) return null;
  if (!preg_match('/\p{L}/u', $a)) return null;   /* precisa ter ao menos uma letra */

  $n = rk_normalizar($a);
  if ($n === '') return null;

  /* trecho: vale em qualquer posição */
  foreach ($RANKING_BLOQUEADOS_TRECHO as $ruim) {
    $r = rk_normalizar($ruim);
    if ($r !== '' && strpos($n, $r) !== false) return null;
  }

  /* exatos: só quando são o apelido inteiro ou uma palavra dele. É o que
     impede "cu" de recusar "Marcus". */
  $palavras = array($n);
  foreach (preg_split('/[^\p{L}\p{Nd}]+/u', $a) as $pedaco) {
    $pn = rk_normalizar($pedaco);
    if ($pn !== '') $palavras[] = $pn;
  }
  foreach ($RANKING_BLOQUEADOS_EXATOS as $ruim) {
    if (in_array(rk_normalizar($ruim), $palavras, true)) return null;
  }

  return $a;
}

/* ---------- ranking ------------------------------------------------------- */

function rk_niveis() {
  return array('facil', 'normal', 'dificil');
}

function rk_nivel_valido($n) {
  return in_array($n, rk_niveis(), true);
}

function rk_entradas() {
  $d = rk_ler('ranking.json', array('entradas' => array()));
  return isset($d['entradas']) && is_array($d['entradas']) ? $d['entradas'] : array();
}

/* Ordena por petiscos e, no empate, por distância; o mais antigo ganha o
   desempate final, para a posição de quem já está na lista não mudar quando
   alguém empata depois. */
function rk_ordenar(&$lista) {
  usort($lista, function ($a, $b) {
    if ($a['petiscos'] !== $b['petiscos']) return $b['petiscos'] - $a['petiscos'];
    if ($a['metros'] !== $b['metros']) return $b['metros'] - $a['metros'];
    return $a['quando'] - $b['quando'];
  });
}

/* Acha a entrada de um apelido num nível. A busca é pela forma normalizada,
   então "Bia", "BIA" e "bia" são a mesma pessoa. Devolve o índice em
   $entradas, ou -1. */
function rk_indice_do_apelido(&$entradas, $nivel, $apelido) {
  $alvo = rk_normalizar($apelido);
  foreach ($entradas as $i => $e) {
    if ($e['nivel'] === $nivel && rk_normalizar($e['apelido']) === $alvo) return $i;
  }
  return -1;
}

/* Quantas partidas já foram registradas no total. Fica separado da contagem de
   entradas porque uma pessoa que joga dez vezes ocupa uma linha só. */
function rk_total_partidas() {
  $d = rk_ler('ranking.json', array());
  return isset($d['partidas']) ? (int) $d['partidas'] : 0;
}

function rk_do_nivel($nivel, $estados) {
  $out = array();
  foreach (rk_entradas() as $e) {
    if ($e['nivel'] === $nivel && in_array($e['estado'], $estados, true)) $out[] = $e;
  }
  rk_ordenar($out);
  return $out;
}
