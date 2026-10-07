/* ==========================================================================
   JOGO DAS MENINAS — desenho de tudo que aparece na tela

   As sete meninas vêm de PNG em assets/img/. Enquanto a arte não chega, o
   lugar delas é marcado por um bloco liso: é placeholder declarado, não
   tentativa de desenhar bicho em código.

   O resto (obstáculos, petiscos, cenário) é desenhado em pixels aqui.
   ========================================================================== */

var Sprites = (function () {

  /* As sete. A ordem aqui é a ordem da tela de escolha. */
  var MENINAS = [
    { id: 'sig',         nome: 'Sig',         tipo: 'cao',  cor: '#D9A441' },
    { id: 'queijadinha', nome: 'Queijadinha', tipo: 'cao',  cor: '#E8C070' },
    { id: 'furrundu',    nome: 'Furrundu',    tipo: 'cao',  cor: '#2E2A28' },
    { id: 'lessa',       nome: 'Lessa',       tipo: 'cao',  cor: '#3D3835' },
    { id: 'luck',        nome: 'Luck',        tipo: 'cao',  cor: '#1F1C1A' },
    { id: 'nina',        nome: 'Nina',        tipo: 'gato', cor: '#C9B9A3' },
    { id: 'amora',       nome: 'Amora',       tipo: 'gato', cor: '#17161A' }
  ];

  /* O jogo é só de pulo: a pose de deslizar foi tirada porque o 'agachando'
     entregue tinha 79% da altura da corrida, e com isso o obstáculo aéreo
     ficava com 5px de folga, que é a própria margem de colisão. */
  var POSES = ['parada', 'corrida-1', 'corrida-2', 'pulando'];

  /* A arte já sai do ferramentas/processar-arte.py no tamanho final, recortada
     rente à figura e com UMA escala por personagem medida na pose de corrida.
     Aqui só resta dividir por 2 (os arquivos são 2x, para não borrar em tela
     de alta densidade) e ancorar pelos pés. */
  var ESCALA = 0.5;

  /* Cores do design system do eusoumarcus.com.br. O canvas não lê variável
     CSS, então os valores são repetidos aqui: são os MESMOS tokens e precisam
     ser atualizados junto se o site mudar. */
  var PALETA = {
    acento:    '#E8341C',   /* --ac */
    acentoEsc: '#C5280F',   /* --ac-h */
    acentoCla: '#FF5A3D',   /* --ac-l */
    acentoTr:  '#FFF2F0',   /* --ac-t */
    tinta:     '#1A1A1A',   /* --ink */
    tinta60:   '#666666',   /* --ink60 */
    tinta40:   '#999999',   /* --ink40 */
    tinta10:   '#F2F2F2',   /* --ink10 */
    superf:    '#FFFFFF',   /* --surf */
    fundo:     '#F8F7F5',   /* --bg */
    borda:     '#E4E2DE',   /* --bdr */
    /* duas exceções, para o modo noite do cenário */
    noite:     '#1A1A1A',   /* o --ink usado como céu */
    noiteCla:  '#2E2C2A'
  };

  /* ---------- carregamento ------------------------------------------------- */

  var imagens = {};
  var faltando = {};

  function caminho(id, pose) { return 'assets/img/' + id + '-' + pose + '.png'; }

  /* Carrega as poses de UMA menina. O jogo roda com a arte faltando: o que
     não carregar entra em `faltando` e vira bloco liso na tela. */
  function carregarMenina(id, aoTerminar) {
    var pendentes = POSES.length;
    var pronto = false;

    function passo() {
      pendentes--;
      if (pendentes <= 0 && !pronto) { pronto = true; aoTerminar && aoTerminar(); }
    }

    POSES.forEach(function (pose) {
      var chave = id + '-' + pose;
      if (imagens[chave] || faltando[chave]) { passo(); return; }
      var im = new Image();
      im.onload  = function () { imagens[chave] = im; passo(); };
      im.onerror = function () { faltando[chave] = true; passo(); };
      im.src = caminho(id, pose);
    });

    /* nenhuma pose para carregar */
    if (!POSES.length) passo();
  }

  function temArte(id) {
    for (var i = 0; i < POSES.length; i++) {
      if (!imagens[id + '-' + POSES[i]]) return false;
    }
    return true;
  }

  /* ---------- utilidades --------------------------------------------------- */

  function px(c, x, y, w, h, cor) {
    c.fillStyle = cor;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /* bloco com canto arredondado: o DS do site tem raio em tudo */
  function bloco(c, x, y, w, h, r, cor) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    r = Math.min(r, w / 2, h / 2);
    c.fillStyle = cor;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y,     x + w, y + h, r);
    c.arcTo(x + w, y + h, x,     y + h, r);
    c.arcTo(x,     y + h, x,     y,     r);
    c.arcTo(x,     y,     x + w, y,     r);
    c.closePath();
    c.fill();
  }

  /* Desenha uma pose ancorada pelos pés e centrada no eixo horizontal. */
  function porBase(c, im, cx, base, escala) {
    var w = im.width * escala, h = im.height * escala;
    c.drawImage(im, Math.round(cx - w / 2), Math.round(base - h), Math.round(w), Math.round(h));
  }

  /* ---------- cenário ------------------------------------------------------ */

  function fundo(c, L, A, noite) {
    px(c, 0, 0, L, A, noite ? PALETA.noite : PALETA.fundo);
  }

  function estrelas(c, L, desloc) {
    for (var i = 0; i < 26; i++) {
      var x = (i * 137 + 31 - desloc * 0.12) % (L + 40) - 20;
      var y = 14 + (i * 53) % 96;
      px(c, x, y, 2, 2, 'rgba(255,255,255,.5)');
    }
  }

  /* casas em vez de prédios: o jogo acontece em casa */
  function casas(c, L, A, desloc, noite) {
    var cor = noite ? PALETA.noiteCla : PALETA.borda;
    var base = A - 48;
    for (var i = -1; i < Math.ceil(L / 150) + 2; i++) {
      var x = i * 150 - (desloc * 0.22) % 150;
      var h = 46 + ((i * 7919) % 5) * 11;
      var w = 104;
      px(c, x, base - h, w, h, cor);
      /* telhado */
      c.fillStyle = cor;
      c.beginPath();
      c.moveTo(Math.round(x - 8), Math.round(base - h));
      c.lineTo(Math.round(x + w / 2), Math.round(base - h - 22));
      c.lineTo(Math.round(x + w + 8), Math.round(base - h));
      c.closePath();
      c.fill();
      /* janela */
      px(c, x + 22, base - h + 18, 18, 18, noite ? PALETA.acentoEsc : PALETA.superf);
      px(c, x + 62, base - h + 18, 18, 18, noite ? PALETA.acentoEsc : PALETA.superf);
    }
  }

  function nuvens(c, lista, noite) {
    var cor = noite ? 'rgba(255,255,255,.08)' : PALETA.borda;
    lista.forEach(function (n) {
      bloco(c, n.x, n.y, n.w, n.h, n.h / 2, cor);
      bloco(c, n.x + n.w * 0.26, n.y - n.h * 0.5, n.w * 0.5, n.h, n.h / 2, cor);
    });
  }

  function chao(c, L, solo, desloc, noite) {
    px(c, 0, solo, L, 2, noite ? PALETA.tinta60 : PALETA.tinta);
    /* piso de taco: traços alternados */
    var cor = noite ? 'rgba(255,255,255,.10)' : PALETA.borda;
    for (var i = -1; i < Math.ceil(L / 46) + 2; i++) {
      var x = i * 46 - desloc % 46;
      px(c, x, solo + 10, 30, 3, cor);
      px(c, x + 23, solo + 22, 30, 3, cor);
    }
  }

  /* ---------- a menina ----------------------------------------------------- */

  function poseDaMenina(p, quadro) {
    if (p.pose === 'pulando') return 'pulando';
    if (p.pose === 'parada')  return 'parada';
    return quadro % 16 < 8 ? 'corrida-1' : 'corrida-2';
  }

  function menina(c, p, quadro, id) {
    var pose  = poseDaMenina(p, quadro);
    var im    = imagens[id + '-' + pose];
    var base  = p.y + p.h;
    var cx    = p.x + p.w / 2;

    if (im) { porBase(c, im, cx, base, ESCALA); return; }

    /* sem arte ainda: bloco liso do tamanho da caixa de colisão, para dar
       para jogar e medir. Não tenta parecer bicho. */
    var m = meninaPorId(id);
    bloco(c, p.x, p.y, p.w, p.h, 8, m ? m.cor : PALETA.tinta);
    px(c, p.x + p.w - 10, p.y + 6, 4, 4, PALETA.superf);   /* olho, para saber o lado */
  }

  function meninaPorId(id) {
    for (var i = 0; i < MENINAS.length; i++) if (MENINAS[i].id === id) return MENINAS[i];
    return null;
  }

  /* retrato para a tela de escolha e para o card */
  function retrato(c, id, cx, base, altura) {
    var im = imagens[id + '-parada'];
    if (im) { porBase(c, im, cx, base, altura / im.height); return; }
    var m = meninaPorId(id);
    var w = altura * 0.72;
    bloco(c, cx - w / 2, base - altura * 0.6, w, altura * 0.6, 10, m ? m.cor : PALETA.tinta);
  }

  /* ---------- obstáculos --------------------------------------------------- */

  function obstaculo(c, o, t, noite) {
    if (o.tipo === 'aspirador') return aspirador(c, o);
    if (o.tipo === 'caixa')     return caixa(c, o);
    if (o.tipo === 'mesa')      return mesa(c, o, t, noite);
  }

  /* chão, pula por cima. Vem em 1, 2 ou 3 de largura */
  function aspirador(c, o) {
    var n = Math.max(1, Math.round(o.w / 36));
    for (var i = 0; i < n; i++) {
      var x = o.x + i * 36;
      /* corpo */
      bloco(c, x + 2, o.y + 14, 30, o.h - 14, 6, PALETA.acento);
      /* cabo */
      px(c, x + 14, o.y, 5, 16, PALETA.tinta60);
      px(c, x + 8, o.y, 17, 4, PALETA.tinta);
      /* rodinha */
      bloco(c, x + 4, o.y + o.h - 6, 10, 6, 3, PALETA.tinta);
      bloco(c, x + 20, o.y + o.h - 6, 10, 6, 3, PALETA.tinta);
    }
  }

  /* chão, pula por cima */
  function caixa(c, o) {
    bloco(c, o.x, o.y, o.w, o.h, 4, PALETA.tinta40);
    px(c, o.x, o.y + o.h * 0.42, o.w, 3, PALETA.tinta60);
    px(c, o.x + o.w / 2 - 2, o.y, 4, o.h, PALETA.tinta60);
  }

  /* aéreo, passa por baixo deslizando */
  function mesa(c, o, t, noite) {
    var tampo = PALETA.tinta;
    var perna = noite ? PALETA.tinta60 : PALETA.tinta40;
    bloco(c, o.x, o.y, o.w, 8, 3, tampo);
    px(c, o.x + 5, o.y + 8, 5, o.h - 8, perna);
    px(c, o.x + o.w - 10, o.y + 8, 5, o.h - 8, perna);
    /* toalha balançando, só para dar vida */
    var b = Math.sin(t * 0.12) * 2;
    px(c, o.x + 12, o.y + 8, o.w - 24, 5 + b, PALETA.acentoCla);
  }

  /* ---------- o que pegar -------------------------------------------------- */

  function item(c, it, t) {
    if (it.tipo === 'sache') return sache(c, it, t);
    return petisco(c, it, t);
  }

  /* vale 1 */
  function petisco(c, it, t) {
    var fl = Math.sin(t * 0.14 + it.x * 0.02) * 2;
    var y  = it.y + fl;
    bloco(c, it.x + 3, y + 4, it.w - 6, it.h - 8, 5, PALETA.acentoEsc);
    bloco(c, it.x + 5, y + 6, it.w - 10, it.h - 13, 4, PALETA.acentoCla);
  }

  /* vale 5 */
  function sache(c, it, t) {
    var fl = Math.sin(t * 0.14 + it.x * 0.02) * 2;
    var y  = it.y + fl;
    bloco(c, it.x, y, it.w, it.h, 5, PALETA.acento);
    px(c, it.x + 4, y + 5, it.w - 8, 3, PALETA.superf);
    px(c, it.x + 4, y + 12, it.w - 14, 3, PALETA.superf);
    /* orelhinha do pacote */
    px(c, it.x + it.w / 2 - 4, y - 3, 8, 4, PALETA.acentoEsc);
  }

  /* ---------- texto flutuante --------------------------------------------- */

  function flutuante(c, f, escala) {
    escala = escala || 1;
    var a = Math.max(0, Math.min(1, f.vida / 40));
    c.save();
    c.globalAlpha = a;
    c.fillStyle = f.grande ? PALETA.acento : PALETA.tinta;
    c.font = (f.grande ? 800 : 700) + ' ' + Math.round((f.grande ? 22 : 14) * escala) +
             'px "Syne", system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText(f.txt, f.x, f.y);
    c.restore();
  }

  /* ---------- API ---------------------------------------------------------- */

  return {
    MENINAS:        MENINAS,
    POSES:          POSES,
    PALETA:         PALETA,
    ESCALA:         ESCALA,
    carregarMenina: carregarMenina,
    temArte:        temArte,
    meninaPorId:    meninaPorId,
    fundo:          fundo,
    estrelas:       estrelas,
    casas:          casas,
    nuvens:         nuvens,
    chao:           chao,
    menina:         menina,
    retrato:        retrato,
    obstaculo:      obstaculo,
    item:           item,
    flutuante:      flutuante,
    bloco:          bloco
  };
})();

/* O jogo.js e o compartilhar.js desenham texto e placas direto no canvas e
   usam PALETA como global, herança do Panhô. Mantido para não espalhar
   `Sprites.PALETA.` por dois arquivos. */
var PALETA = Sprites.PALETA;
