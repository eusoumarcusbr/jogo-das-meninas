<?php
/* ---------------------------------------------------------------------------
   JOGO DAS MENINAS — painel de moderação do ranking

   A pontuação entra na hora; o NOME só aparece na lista pública depois de
   passar por aqui. Endereço: /jogo/api/admin.php — não é linkado em lugar
   nenhum, e a senha está em config.php.
   --------------------------------------------------------------------------- */

require_once __DIR__ . '/comum.php';

if (!rk_configurado()) {
  header('Content-Type: text/html; charset=utf-8');
  echo '<meta charset="utf-8"><p style="font:16px system-ui;padding:24px;max-width:44em">'
     . 'O ranking ainda não está configurado. Abra <code>api/config.php</code> no servidor e '
     . 'troque <code>RANKING_SEGREDO</code> e <code>RANKING_ADMIN_SENHA</code>. '
     . 'Enquanto os valores de exemplo estiverem lá, o ranking fica desligado de propósito.</p>';
  exit;
}

session_start();

/* ---------- entrar -------------------------------------------------------- */

if (isset($_POST['senha'])) {
  $u = isset($_POST['usuario']) ? (string) $_POST['usuario'] : '';
  if (hash_equals(RANKING_ADMIN_USUARIO, $u) &&
      hash_equals(RANKING_ADMIN_SENHA, (string) $_POST['senha'])) {
    session_regenerate_id(true);
    $_SESSION['rk_ok']   = true;
    $_SESSION['rk_csrf'] = bin2hex(random_bytes(16));
  } else {
    $erroLogin = 'Usuário ou senha incorretos.';
    usleep(600000);          /* atrasa a tentativa seguinte */
  }
}

if (isset($_GET['sair'])) { session_destroy(); header('Location: admin.php'); exit; }

$logado = !empty($_SESSION['rk_ok']);

/* ---------- ações --------------------------------------------------------- */

$aviso = '';

if ($logado && isset($_POST['acao'], $_POST['id'], $_POST['csrf'])) {
  if (!hash_equals($_SESSION['rk_csrf'], (string) $_POST['csrf'])) {
    $aviso = 'Sessão expirada. Recarregue a página.';
  } else {
    $id   = (string) $_POST['id'];
    $acao = (string) $_POST['acao'];
    $mapa = array('aprovar' => 'aprovado', 'rejeitar' => 'rejeitado', 'tirar' => 'rejeitado');
    if (isset($mapa[$acao])) {
      $novoEstado = $mapa[$acao];
      rk_transacao('ranking.json', array('entradas' => array()), function ($d) use ($id, $novoEstado) {
        foreach ($d['entradas'] as $i => $e) {
          if ($e['id'] === $id) { $d['entradas'][$i]['estado'] = $novoEstado; break; }
        }
        return $d;
      });
      $aviso = $acao === 'aprovar' ? 'Nome liberado.' : 'Entrada tirada da lista.';
    }
  }
}

/* ---------- dados da tela ------------------------------------------------- */

$pendentes = array();
$aprovados = array();
if ($logado) {
  foreach (rk_entradas() as $e) {
    if ($e['estado'] === 'pendente') $pendentes[] = $e;
    if ($e['estado'] === 'aprovado') $aprovados[] = $e;
  }
  usort($pendentes, function ($a, $b) { return $b['quando'] - $a['quando']; });
  rk_ordenar($aprovados);
}

function h($t) { return htmlspecialchars($t, ENT_QUOTES, 'UTF-8'); }
function quando($t) { return date('d/m H:i', $t); }
$csrf = $logado ? $_SESSION['rk_csrf'] : '';
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Moderação do ranking — Panhô!</title>
<style>
  :root { --navy:#2B1574; --amarelo:#FFC000; --verm:#E20016; --verde:#009532;
          --tinta:#383838; --off:#F5F5F3; }
  * { box-sizing:border-box; }
  body { margin:0; padding:24px 16px 60px; background:var(--off); color:var(--tinta);
         font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; }
  .wrap { max-width:760px; margin:0 auto; }
  h1 { font-size:22px; margin:0 0 4px; color:var(--navy); }
  .sub { margin:0 0 28px; font-size:14px; opacity:.7; }
  h2 { font-size:15px; text-transform:uppercase; letter-spacing:.06em;
       margin:32px 0 10px; color:var(--navy); }
  .aviso { background:var(--amarelo); padding:10px 14px; border-radius:6px;
           margin-bottom:20px; font-size:14px; }
  .erro { background:var(--verm); color:#fff; padding:10px 14px; border-radius:6px;
          margin-bottom:20px; font-size:14px; }
  .vazio { opacity:.55; font-size:14px; font-style:italic; }
  table { width:100%; border-collapse:collapse; background:#fff; border-radius:6px;
          overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.08); }
  th, td { padding:9px 12px; text-align:left; font-size:14px;
           border-bottom:1px solid rgba(56,56,56,.1); }
  th { background:rgba(43,21,116,.06); font-size:12px; text-transform:uppercase;
       letter-spacing:.05em; }
  tr:last-child td { border-bottom:0; }
  .apelido { font-weight:700; }
  .num { text-align:right; font-variant-numeric:tabular-nums; }
  .acoes { white-space:nowrap; text-align:right; }
  button { font:inherit; font-size:13px; font-weight:600; border:0; border-radius:5px;
           padding:5px 11px; cursor:pointer; color:#fff; }
  .ok  { background:var(--verde); }
  .nao { background:var(--verm); }
  .neutro { background:#8a8a8a; }
  form.linha { display:inline; }
  .login { max-width:340px; }
  input[type=password], input[type=text] { width:100%; padding:10px 12px; font:inherit;
      border:2px solid rgba(56,56,56,.2); border-radius:6px; margin-bottom:12px; }
  .login button { background:var(--navy); padding:10px 18px; font-size:15px; }
  .sair { float:right; font-size:13px; color:var(--navy); }
  .nivel { font-size:12px; text-transform:uppercase; letter-spacing:.04em; opacity:.65; }
</style>
</head>
<body>
<div class="wrap">

<?php if (!$logado): ?>

  <h1>Moderação do ranking</h1>
  <p class="sub">Jogo das Meninas</p>
  <?php if (!empty($erroLogin)): ?><p class="erro"><?= h($erroLogin) ?></p><?php endif; ?>
  <form method="post" class="login">
    <input type="text" name="usuario" placeholder="Usuário" autofocus autocomplete="username">
    <input type="password" name="senha" placeholder="Senha" autocomplete="current-password">
    <button type="submit">Entrar</button>
  </form>

<?php else: ?>

  <a class="sair" href="?sair=1">sair</a>
  <h1>Moderação do ranking</h1>
  <p class="sub">O nome só aparece na lista pública depois que você libera aqui.</p>

  <?php if ($aviso): ?><p class="aviso"><?= h($aviso) ?></p><?php endif; ?>

  <h2>Na fila — <?= count($pendentes) ?></h2>
  <?php if (!$pendentes): ?>
    <p class="vazio">Nada esperando.</p>
  <?php else: ?>
    <table>
      <tr><th>Apelido</th><th>Nível</th><th class="num">Petiscos</th><th class="num">Metros</th><th>Quando</th><th></th></tr>
      <?php foreach ($pendentes as $e): ?>
      <tr>
        <td class="apelido"><?= h($e['apelido']) ?></td>
        <td class="nivel"><?= h($e['nivel']) ?></td>
        <td class="num"><?= (int) $e['petiscos'] ?></td>
        <td class="num"><?= (int) $e['metros'] ?></td>
        <td><?= quando($e['quando']) ?></td>
        <td class="acoes">
          <form method="post" class="linha">
            <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
            <input type="hidden" name="id" value="<?= h($e['id']) ?>">
            <button class="ok" name="acao" value="aprovar">liberar</button>
          </form>
          <form method="post" class="linha">
            <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
            <input type="hidden" name="id" value="<?= h($e['id']) ?>">
            <button class="nao" name="acao" value="rejeitar">recusar</button>
          </form>
        </td>
      </tr>
      <?php endforeach; ?>
    </table>
  <?php endif; ?>

  <h2>No ar — <?= count($aprovados) ?></h2>
  <?php if (!$aprovados): ?>
    <p class="vazio">A lista pública ainda está vazia.</p>
  <?php else: ?>
    <table>
      <tr><th>Apelido</th><th>Nível</th><th class="num">Petiscos</th><th class="num">Metros</th><th>Quando</th><th></th></tr>
      <?php foreach ($aprovados as $e): ?>
      <tr>
        <td class="apelido"><?= h($e['apelido']) ?></td>
        <td class="nivel"><?= h($e['nivel']) ?></td>
        <td class="num"><?= (int) $e['petiscos'] ?></td>
        <td class="num"><?= (int) $e['metros'] ?></td>
        <td><?= quando($e['quando']) ?></td>
        <td class="acoes">
          <form method="post" class="linha">
            <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
            <input type="hidden" name="id" value="<?= h($e['id']) ?>">
            <button class="neutro" name="acao" value="tirar">tirar</button>
          </form>
        </td>
      </tr>
      <?php endforeach; ?>
    </table>
  <?php endif; ?>

<?php endif; ?>

</div>
</body>
</html>
