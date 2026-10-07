<?php
/* ---------------------------------------------------------------------------
   JOGO DAS MENINAS — ranking

   GET  ?acao=lista&nivel=normal   devolve o top do nível, só nomes aprovados
   GET  ?acao=partida&nivel=normal devolve o comprovante que abre a partida
   POST (JSON no corpo)            registra a pontuação, como pendente

   Registrar entra na hora e o jogador vê a posição dele na hora. O que espera
   moderação é o NOME aparecer na lista pública — ver api/admin.php.
   --------------------------------------------------------------------------- */

require_once __DIR__ . '/comum.php';

header('Content-Type: application/json; charset=utf-8');

if (!rk_configurado()) {
  rk_json(array('ok' => false, 'erro' => 'config',
    'motivo' => 'Ranking desligado: falta trocar o segredo e a senha em api/config.php.'), 503);
}

$metodo = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

/* ---------- GET ----------------------------------------------------------- */

if ($metodo === 'GET') {
  $acao  = isset($_GET['acao'])  ? $_GET['acao']  : 'lista';
  $nivel = isset($_GET['nivel']) ? $_GET['nivel'] : 'normal';
  if (!rk_nivel_valido($nivel)) rk_erro('nível inválido');

  if ($acao === 'partida') {
    rk_json(array('ok' => true, 'token' => rk_emitir_token($nivel)));
  }

  if ($acao === 'lista') {
    $aprovados = rk_do_nivel($nivel, array('aprovado'));
    $lista = array();
    $n = 0;
    foreach ($aprovados as $e) {
      $n++;
      if ($n > RANKING_TOPO) break;
      $lista[] = array(
        'pos'     => $n,
        'apelido' => $e['apelido'],
        'petiscos'  => $e['petiscos'],
        'metros'  => $e['metros']
      );
    }
    /* partidas jogadas, não linhas do ranking: quem joga dez vezes ocupa uma
       linha só, mas as dez contam */
    rk_json(array('ok' => true, 'nivel' => $nivel, 'lista' => $lista,
                  'total' => rk_total_partidas(),
                  'nomes' => count(rk_do_nivel($nivel, array('aprovado', 'pendente')))));
  }

  rk_erro('ação desconhecida');
}

/* ---------- POST ---------------------------------------------------------- */

if ($metodo !== 'POST') rk_erro('método não suportado', 405);

$corpo = json_decode(file_get_contents('php://input'), true);
if (!is_array($corpo)) rk_erro('corpo inválido');

$apelido = rk_limpar_apelido(isset($corpo['apelido']) ? $corpo['apelido'] : '');
if ($apelido === null) {
  rk_json(array('ok' => false, 'erro' => 'apelido', 'motivo' =>
    'Escolha outro apelido: até 12 letras ou números, sem símbolo e sem nome de gente de verdade.'), 200);
}

$petiscos = isset($corpo['petiscos']) ? (int) $corpo['petiscos'] : 0;
$metros = isset($corpo['metros']) ? (int) $corpo['metros'] : 0;
$nivel  = isset($corpo['nivel'])  ? $corpo['nivel']        : '';

if (!rk_nivel_valido($nivel))      rk_erro('nível inválido');
if ($petiscos < 1 || $petiscos > 99999) rk_erro('pontuação fora da faixa');
if ($metros < 1 || $metros > 99999) rk_erro('distância fora da faixa');

/* --- o comprovante da partida --- */

$tk = rk_ler_token(isset($corpo['token']) ? $corpo['token'] : '');
if ($tk === null)          rk_erro('partida não confere');
if ($tk['d'] !== $nivel)   rk_erro('partida não confere');

$duracao = time() - (int) $tk['t'];
if ($duracao < RANKING_PARTIDA_MINIMA) rk_erro('partida curta demais');
if ($duracao > RANKING_PARTIDA_MAXIMA) rk_erro('partida expirada');
if (rk_token_usado($tk['n']))          rk_erro('partida já registrada');

/* --- a pontuação caberia nessa partida? --- */

$velMax = isset($RANKING_VEL_MAX[$nivel]) ? $RANKING_VEL_MAX[$nivel] : 108.6;
if ($metros > ($duracao + 2) * $velMax * 1.1) rk_erro('distância não cabe no tempo da partida');
if ($petiscos > $metros * RANKING_PETISCOS_POR_METRO + 20) rk_erro('pontuação não cabe na distância');

/* --- limite por IP --- */

$ipHash = rk_ip_hash();
if (!rk_dentro_do_limite($ipHash)) {
  rk_json(array('ok' => false, 'erro' => 'limite', 'motivo' =>
    'Muitos envios deste aparelho na última hora. Tente mais tarde.'), 429);
}

/* --- grava ---

   Uma linha por apelido em cada nível, guardando a melhor partida. Sem isso a
   mesma pessoa jogando cinco vezes ocupava o top inteiro.

   Quando o apelido já existe, o ESTADO é herdado de propósito: um nome já
   liberado não volta para a fila só porque melhorou a pontuação (o que passa
   pela moderação é o nome, não o placar), e um nome recusado continua recusado
   por mais que a pessoa jogue de novo. */

rk_marcar_token($tk['n']);

$idAlvo   = null;
$melhorou = true;
$estado   = 'pendente';

rk_transacao('ranking.json', array('entradas' => array(), 'partidas' => 0),
  function ($d) use ($apelido, $petiscos, $metros, $nivel, $ipHash, &$idAlvo, &$melhorou, &$estado) {

  if (!isset($d['entradas']) || !is_array($d['entradas'])) $d['entradas'] = array();
  $d['partidas'] = (isset($d['partidas']) ? (int) $d['partidas'] : 0) + 1;

  $i = rk_indice_do_apelido($d['entradas'], $nivel, $apelido);

  if ($i >= 0) {
    $atual  = $d['entradas'][$i];
    $idAlvo = $atual['id'];
    $estado = $atual['estado'];
    $melhor = $petiscos > $atual['petiscos']
           || ($petiscos === $atual['petiscos'] && $metros > $atual['metros']);
    if ($melhor) {
      $d['entradas'][$i]['apelido'] = $apelido;   /* mantém como digitou agora */
      $d['entradas'][$i]['petiscos']  = $petiscos;
      $d['entradas'][$i]['metros']  = $metros;
      $d['entradas'][$i]['quando']  = time();
      $d['entradas'][$i]['ip']      = $ipHash;
    } else {
      $melhorou = false;
    }
    return $d;
  }

  $idAlvo = bin2hex(random_bytes(6));
  $d['entradas'][] = array(
    'id'      => $idAlvo,
    'apelido' => $apelido,
    'petiscos'  => $petiscos,
    'metros'  => $metros,
    'nivel'   => $nivel,
    'quando'  => time(),
    'estado'  => 'pendente',
    'ip'      => $ipHash
  );

  if (count($d['entradas']) > RANKING_MAX_ENTRADAS) {
    /* descarta os rejeitados mais antigos antes de mexer no resto */
    usort($d['entradas'], function ($a, $b) {
      $pa = $a['estado'] === 'rejeitado' ? 0 : 1;
      $pb = $b['estado'] === 'rejeitado' ? 0 : 1;
      if ($pa !== $pb) return $pa - $pb;
      return $a['quando'] - $b['quando'];
    });
    $d['entradas'] = array_slice($d['entradas'], count($d['entradas']) - RANKING_MAX_ENTRADAS);
  }
  return $d;
});

/* --- posição, contando a fila também --- */

$todas = rk_do_nivel($nivel, array('aprovado', 'pendente'));
$pos   = 0;
foreach ($todas as $i => $e) {
  if ($e['id'] === $idAlvo) { $pos = $i + 1; break; }
}

rk_json(array(
  'ok'       => true,
  'posicao'  => $pos,
  'total'    => rk_total_partidas(),
  'melhorou' => $melhorou,
  'estado'   => $estado
));
