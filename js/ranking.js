/* ===========================================================================
   PANHÔ! — ranking

   Conversa com api/ranking.php. Três momentos:

   1. a partida começa  → pede um comprovante assinado ao servidor
   2. a partida termina → oferece o campo de apelido
   3. o jogador envia   → registra e mostra a posição

   Se a API não responder — jogo aberto do disco, arquivo único, pasta api/
   ausente no servidor — a seção inteira se esconde e o jogo segue igual.
   O ranking é um extra; ele nunca pode quebrar a partida.
   =========================================================================== */

window.Ranking = (function () {
  'use strict';

  var API = 'api/ranking.php';

  var secao    = document.getElementById('ranking');
  var elNivel  = document.getElementById('rk-nivel-nome');
  var form     = document.getElementById('rk-form');
  var campo    = document.getElementById('rk-apelido');
  var botao    = document.getElementById('rk-enviar');
  var status   = document.getElementById('rk-status');
  var lista    = document.getElementById('rk-lista');
  var vazio    = document.getElementById('rk-vazio');
  var elTotal  = document.getElementById('rk-total');
  var cab      = document.getElementById('rk-cab');

  if (!secao) return { abrirPartida: nada, oferecer: nada, trocarNivel: nada };

  var NOMES = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' };

  var token       = null;   /* comprovante da partida em curso */
  var nivelAtual  = 'normal';
  var pendente    = null;   /* {petiscos, metros, nivel} esperando o apelido */
  var enviando    = false;
  var disponivel  = true;   /* vira false no primeiro sinal de que não há API */

  function nada() {}

  /* ---------- rede --------------------------------------------------------- */

  function pedir(metodo, url, corpo, aoTerminar) {
    var r = new XMLHttpRequest();
    var respondeu = false;

    function terminar(erro, dado) {
      if (respondeu) return;
      respondeu = true;
      aoTerminar(erro, dado);
    }

    try { r.open(metodo, url, true); } catch (e) { terminar('rede'); return; }
    r.timeout = 8000;
    if (corpo) r.setRequestHeader('Content-Type', 'application/json');

    r.onload = function () {
      var dado = null;
      try { dado = JSON.parse(r.responseText); } catch (e) {}
      if (!dado) { terminar('resposta'); return; }
      terminar(null, dado);
    };
    r.onerror   = function () { terminar('rede'); };
    r.ontimeout = function () { terminar('rede'); };

    try { r.send(corpo ? JSON.stringify(corpo) : null); }
    catch (e) { terminar('rede'); }
  }

  function desligar() {
    disponivel = false;
    secao.classList.add('esconde');
  }

  /* ---------- lista -------------------------------------------------------- */

  function pintarLista(dado) {
    lista.innerHTML = '';

    if (!dado.lista || !dado.lista.length) {
      vazio.classList.remove('esconde');
      lista.classList.add('esconde');
      if (cab) cab.classList.add('esconde');
    } else {
      vazio.classList.add('esconde');
      lista.classList.remove('esconde');
      if (cab) cab.classList.remove('esconde');
      for (var i = 0; i < dado.lista.length; i++) {
        var e  = dado.lista[i];
        var li = document.createElement('li');
        li.className = 'rk-item';
        li.appendChild(span('rk-pos', e.pos + 'º'));
        li.appendChild(span('rk-nome', e.apelido));
        li.appendChild(span('rk-pts', formatar(e.petiscos)));
        li.appendChild(span('rk-m', formatar(e.metros) + ' m'));
        lista.appendChild(li);
      }
    }

    if (elTotal) {
      elTotal.textContent = dado.total === 1
        ? '1 partida registrada'
        : formatar(dado.total || 0) + ' partidas registradas';
    }

    /* uma linha por apelido: quem joga de novo melhora a própria marca em vez
       de criar uma linha nova */
  }

  function span(classe, texto) {
    var s = document.createElement('span');
    s.className = classe;
    s.textContent = texto;
    return s;
  }

  function formatar(n) {
    return String(Math.floor(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function carregar(nivel) {
    if (!disponivel) return;
    pedir('GET', API + '?acao=lista&nivel=' + encodeURIComponent(nivel), null, function (erro, dado) {
      if (erro || !dado || !dado.ok) { desligar(); return; }
      if (nivel !== nivelAtual) return;      /* o jogador já trocou de nível */
      pintarLista(dado);
    });
  }

  /* ---------- status ------------------------------------------------------- */

  function dizer(texto, tipo) {
    status.textContent = texto;
    status.className = 'rk-status ativo' + (tipo ? ' rk-' + tipo : '');
  }

  function calar() {
    status.textContent = '';
    status.className = 'rk-status';
  }

  /* ---------- momentos do jogo --------------------------------------------- */

  /* Chamado quando a partida começa. O comprovante carrega a hora de início
     assinada pelo servidor: é o que permite conferir depois se a distância
     enviada caberia no tempo que a partida durou. */
  function abrirPartida(nivel) {
    if (!disponivel) return;
    token = null;
    pedir('GET', API + '?acao=partida&nivel=' + encodeURIComponent(nivel), null, function (erro, dado) {
      if (erro || !dado || !dado.ok) { desligar(); return; }
      token = dado.token;
    });
  }

  /* Chamado quando a partida termina. */
  function oferecer(petiscos, metros, nivel) {
    if (!disponivel) return;
    calar();

    if (!petiscos || !token) {          /* zero petisco não entra em ranking */
      form.classList.add('esconde');
      pendente = null;
      return;
    }

    pendente = { petiscos: petiscos, metros: metros, nivel: nivel };
    form.classList.remove('esconde');
    secao.classList.add('destaque');
    botao.disabled = false;
    botao.textContent = 'ENTRAR NO RANKING';
  }

  function enviar(e) {
    if (e) e.preventDefault();
    if (!pendente || enviando) return;

    var apelido = campo.value.trim();
    if (apelido.length < 2) { dizer('Escreva um apelido de pelo menos duas letras.', 'aviso'); campo.focus(); return; }

    enviando = true;
    botao.disabled = true;
    botao.textContent = 'ENVIANDO…';
    dizer('Registrando…');

    pedir('POST', API, {
      token:   token,
      apelido: apelido,
      petiscos:  pendente.petiscos,
      metros:  pendente.metros,
      nivel:   pendente.nivel
    }, function (erro, dado) {
      enviando = false;
      botao.disabled = false;
      botao.textContent = 'ENTRAR NO RANKING';

      if (erro || !dado) { dizer('Não deu para registrar agora. Tente de novo mais tarde.', 'aviso'); return; }

      if (!dado.ok) {
        dizer(dado.motivo || 'Não deu para registrar essa partida.', 'aviso');
        if (dado.erro === 'apelido') campo.focus();
        return;
      }

      token    = null;                /* o comprovante vale uma vez só */
      pendente = null;
      form.classList.add('esconde');
      secao.classList.remove('destaque');

      if (dado.melhorou === false) {
        dizer('Dessa vez você fez menos que o seu recorde. Continua em ' +
              dado.posicao + 'º com a melhor partida.', 'ok');
      } else if (dado.estado === 'aprovado') {
        dizer('Novo recorde seu. Você está em ' + dado.posicao + 'º.', 'ok');
      } else {
        dizer('Você ficou em ' + dado.posicao + 'º. O apelido aparece na lista ' +
              'assim que for conferido.', 'ok');
      }

      carregar(nivelAtual);
    });
  }

  /* Chamado pelo seletor de dificuldade e uma vez no carregamento. */
  function trocarNivel(nivel) {
    nivelAtual = nivel;
    if (elNivel) elNivel.textContent = NOMES[nivel] || nivel;
    carregar(nivel);
  }

  /* ---------- ligação ------------------------------------------------------ */

  if (form) form.addEventListener('submit', enviar);

  /* O campo aceita só o que o servidor aceitaria, para o jogador não descobrir
     tarde demais que o apelido não serve.

     A regra é montada com new RegExp de propósito: \p{L} escrito como literal
     é erro de sintaxe em navegador antigo, e erro de sintaxe aqui derrubaria o
     arquivo inteiro na hora de carregar — window.Ranking nem existiria, e o
     jogo quebraria junto. Assim, no pior caso, cai na regra simples. */
  var SO_VALIDO;
  try { SO_VALIDO = new RegExp('[^\\p{L}\\p{Nd} ._-]', 'gu'); }
  catch (e) { SO_VALIDO = /[^A-Za-zÀ-ÿ0-9 ._-]/g; }

  if (campo) {
    campo.addEventListener('input', function () {
      var limpo = campo.value.replace(SO_VALIDO, '');
      if (limpo !== campo.value) campo.value = limpo;
    });
  }

  return {
    abrirPartida: abrirPartida,
    oferecer:     oferecer,
    trocarNivel:  trocarNivel
  };
})();
