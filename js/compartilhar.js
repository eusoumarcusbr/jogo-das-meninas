/* ==========================================================================
   PANHÔ! — compartilhamento
   Gera um card 1080x1920 (formato Stories) com o resultado da partida e
   entrega para WhatsApp, Instagram Stories, Facebook ou para o menu nativo
   do celular.
   ========================================================================== */

/* --------------------------------------------------------------------------
   ENDEREÇO DO JOGO

   Quando o jogo estiver publicado, ele usa sozinho o endereço da própria
   página. O valor abaixo só é usado em teste local (arquivo aberto direto
   no navegador), onde não existe endereço público.
   -------------------------------------------------------------------------- */

var URL_DO_JOGO = 'https://www.eusoumarcus.com.br/jogo-das-meninas/';

/* Endereço que aparece escrito no card e vai junto na mensagem. É fixo de
   propósito: é o endereço que a campanha divulga, não importa em que pasta o
   jogo esteja hospedado no momento. */
var ENDERECO_DIVULGADO = 'https://www.eusoumarcus.com.br/jogo-das-meninas/';

/* ========================================================================== */

var Compartilhar = (function () {

  var ultimoResultado = null;    /* {provas, metros} da última partida */
  var elStatus, elBarra;
  var cacheBlob = null, cacheChave = '';

  /* ---- endereço público -------------------------------------------------- */

  function endereco() {
    return ENDERECO_DIVULGADO;
  }

  function ehLocal() {
    return location.protocol === 'file:' ||
           location.hostname === 'localhost' ||
           location.hostname === '127.0.0.1';
  }

  /* ---- textos ------------------------------------------------------------ */

  function num(v) {
    return Math.floor(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function provas(v) {
    return num(v) + (Math.floor(v) === 1 ? ' petisco' : ' petiscos');
  }

  function legenda() {
    if (ultimoResultado && ultimoResultado.provas > 0) {
      return 'Peguei ' + provas(ultimoResultado.provas) + ' no Jogo das Meninas, em ' +
             num(ultimoResultado.metros) + ' metros. Duvido você juntar mais.';
    }
    return 'Corri no Jogo das Meninas. Vem ver quanto petisco você pega.';
  }

  function status(msg) {
    if (!elStatus) return;
    elStatus.textContent = msg || '';
    elStatus.classList.toggle('ativo', !!msg);
  }

  /* ---- desenho do card --------------------------------------------------- */

  function textoEspacado(c, txt, x, y, esp) {
    var larg = 0, i;
    for (i = 0; i < txt.length; i++) larg += c.measureText(txt[i]).width + esp;
    larg -= esp;
    var cx = x - larg / 2;
    for (i = 0; i < txt.length; i++) {
      c.fillText(txt[i], cx + c.measureText(txt[i]).width / 2, y);
      cx += c.measureText(txt[i]).width + esp;
    }
  }

  function fonte(peso, tam, familia) {
    return peso + ' ' + tam + 'px ' + familia + ', sans-serif';
  }

  function desenharCard() {
    var L = 1080, A = 1920;
    var cv = document.createElement('canvas');
    cv.width = L; cv.height = A;
    var c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;

    var TIT = '"Syne"', COND = '"Plus Jakarta Sans"';

    /* fundo */
    c.fillStyle = PALETA.tinta;
    c.fillRect(0, 0, L, A);

    c.fillStyle = 'rgba(255,255,255,.10)';
    for (var i = 0; i < 90; i++) c.fillRect((i * 173) % L, (i * 271) % A, 4, 4);

    c.fillStyle = PALETA.acento;
    c.fillRect(0, 0, L, 18);
    c.fillRect(0, A - 18, L, 18);

    c.textAlign = 'center';

    /* título */
    c.fillStyle = PALETA.acento;
    c.font = fonte(800, 200, TIT);
    c.fillText('PANHÔ!', L / 2, 320);

    c.fillStyle = 'rgba(244,241,234,.62)';
    c.font = fonte(400, 50, COND);
    textoEspacado(c, 'ATRÁS DO PANHÔZINHO', L / 2, 388, 10);

    /* documentos soltos */
    var notas = [[120, 560], [905, 600], [95, 940], [930, 900], [175, 790]];
    notas.forEach(function (n, k) {
      c.save();
      c.translate(n[0], n[1]);
      c.scale(2.4, 2.4);
      c.rotate(k % 2 ? 0.22 : -0.18);
      Sprites.item(c, { tipo: 'petisco', x: -13, y: -10 }, k * 8);
      c.restore();
    });

    /* Panhôzinho fugindo no chão, Pedro no ar indo atrás dele */
    var base = 1080;
        var quem = 'sig';
    try { quem = window.localStorage.getItem('meninas_personagem') || 'sig'; } catch (e) {}
    Sprites.retrato(c, quem, L * 0.5, base, 520);

    /* chão */
    c.fillStyle = 'rgba(244,241,234,.75)';
    c.fillRect(0, base, L, 6);

    /* resultado */
    var temGrana = ultimoResultado && ultimoResultado.provas > 0;

    if (temGrana) {
      c.fillStyle = 'rgba(244,241,234,.62)';
      c.font = fonte(400, 54, COND);
      textoEspacado(c, 'JUNTEI', L / 2, 1250, 12);

      c.fillStyle = PALETA.acento;
      c.font = fonte(800, 168, TIT);
      c.fillText(provas(ultimoResultado.provas).toUpperCase(), L / 2, 1400);

      c.fillStyle = PALETA.superf;
      c.font = fonte(400, 56, COND);
      textoEspacado(c, 'EM ' + num(ultimoResultado.metros) + ' METROS', L / 2, 1480, 8);
    } else {
      c.fillStyle = PALETA.acento;
      c.font = fonte(800, 124, TIT);
      c.fillText('VEM AJUDAR', L / 2, 1340);

      c.fillStyle = PALETA.superf;
      c.font = fonte(400, 54, COND);
      textoEspacado(c, 'O PANHÔZINHO ESTÁ FUGINDO', L / 2, 1425, 6);
    }

    /* chamada final */
    c.fillStyle = 'rgba(244,241,234,.5)';
    c.font = fonte(400, 46, COND);
    textoEspacado(c, temGrana ? 'CONSEGUE JUNTAR MAIS?' : 'JOGUE EM', L / 2, 1690, 8);

    c.fillStyle = PALETA.superf;
    c.font = fonte(800, 42, COND);
    c.fillText(ENDERECO_DIVULGADO, L / 2, 1762);

    return cv;
  }

  /* ---- blob (com cache por resultado) ------------------------------------ */

  function gerarBlob() {
    var chave = ultimoResultado
      ? ultimoResultado.provas + '/' + ultimoResultado.metros
      : 'convite';

    if (cacheBlob && cacheChave === chave) return Promise.resolve(cacheBlob);

    var prontas = (document.fonts && document.fonts.ready)
      ? document.fonts.ready
      : Promise.resolve();

    return prontas.then(function () {
      return new Promise(function (resolve) {
        desenharCard().toBlob(function (blob) {
          cacheBlob = blob; cacheChave = chave;
          resolve(blob);
        }, 'image/png');
      });
    });
  }

  function arquivo(blob) {
    try {
      return new File([blob], 'panho.png', { type: 'image/png' });
    } catch (e) { return null; }
  }

  function podeMandarArquivo(f) {
    return !!(f && navigator.canShare && navigator.canShare({ files: [f] }));
  }

  /* ---- ações ------------------------------------------------------------- */

  function nativo() {
    status('Preparando a imagem…');
    gerarBlob().then(function (blob) {
      var f = arquivo(blob);
      if (podeMandarArquivo(f)) {
        return navigator.share({ files: [f], text: legenda() });
      }
      if (navigator.share) {
        return navigator.share({ title: 'PANHÔ!', text: legenda(), url: endereco() });
      }
      throw new Error('sem-share');
    }).then(function () {
      status('');
    }).catch(function (e) {
      if (e && e.name === 'AbortError') { status(''); return; }
      status('Esse navegador não abre o menu de compartilhar. Use os botões abaixo.');
    });
  }

  function whatsapp() {
    var txt = legenda() + ' ' + endereco();
    window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener');
    status(ehLocal() ? 'Em teste local o link aponta para o endereço definitivo do jogo.' : '');
  }

  function facebook() {
    if (ehLocal()) {
      status('O Facebook precisa de um endereço público. Funciona depois que o jogo estiver no ar.');
      return;
    }
    window.open(
      'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(endereco()),
      '_blank', 'noopener,width=640,height=640'
    );
    status('');
  }

  /* O Instagram não aceita link de compartilhamento pela web. No celular
     usamos o menu nativo, que lista o Instagram. No computador, baixamos a
     imagem e copiamos a legenda para postar na mão. */
  function instagram() {
    status('Preparando a imagem…');
    gerarBlob().then(function (blob) {
      var f = arquivo(blob);

      if (podeMandarArquivo(f)) {
        return navigator.share({ files: [f], text: legenda() })
          .then(function () { status('Escolha o Instagram e depois Stories.'); })
          .catch(function (e) {
            if (e && e.name === 'AbortError') { status(''); return; }
            baixar(blob);
          });
      }
      baixar(blob);
    }).catch(function (e) {
      status(erroDeImagem(e));
    });
  }

  function erroDeImagem(e) {
    /* abrir o index.html direto do disco bloqueia a leitura do canvas.
       Publicado, ou por um servidor local, funciona normalmente. */
    if (location.protocol === 'file:') {
      return 'Aqui o card só funciona com o jogo publicado ou rodando por um servidor. ' +
             'Para testar agora, use o arquivo único.';
    }
    return 'Não consegui gerar a imagem neste navegador.';
  }

  function baixar(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'panho-stories.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);

    copiar(legenda() + ' ' + endereco());
    status('Imagem baixada e legenda copiada. Poste no Stories pelo celular.');
  }

  function copiar(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(txt).catch(function () {});
    }
    var ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  function copiarLink() {
    copiar(endereco());
    status('Link copiado.');
  }

  function baixarImagem() {
    status('Preparando a imagem…');
    gerarBlob().then(baixar).catch(function (e) {
      status(erroDeImagem(e));
    });
  }

  /* ---- ligação com a página ---------------------------------------------- */

  function init() {
    elStatus = document.getElementById('share-status');
    elBarra  = document.getElementById('share');

    var btnNativo = document.getElementById('sh-nativo');
    if (navigator.share) btnNativo.classList.remove('esconde');

    btnNativo.addEventListener('click', nativo);
    document.getElementById('sh-whats').addEventListener('click', whatsapp);
    document.getElementById('sh-insta').addEventListener('click', instagram);
    document.getElementById('sh-face').addEventListener('click', facebook);
    document.getElementById('sh-link').addEventListener('click', copiarLink);
    document.getElementById('sh-baixar').addEventListener('click', baixarImagem);
  }

  /* chamado pelo jogo ao fim de cada partida */
  function atualizar(qtdProvas, metros) {
    ultimoResultado = { provas: qtdProvas, metros: metros };
    cacheBlob = null;
    status('');
    if (elBarra) {
      elBarra.classList.add('destaque');
      setTimeout(function () { elBarra.classList.remove('destaque'); }, 2600);
    }
  }

  return { init: init, atualizar: atualizar };

})();
