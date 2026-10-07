/* ==========================================================================
   JOGO DAS MENINAS — corrida infinita

   Motor herdado do PANHÔ! (github.com/eusoumarcusbr/webgame), com a
   calibragem refeita para um personagem de quatro patas: a caixa de colisão
   passou de 38x66 para 52x44, e a faixa do obstáculo aéreo foi recalculada
   em cima disso.
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- ajustes verticais (iguais em qualquer tela) ----------------- */

  var CFG = {
    altura: 280,
    solo: 232,

    apicePulo: 112,          /* NÃO muda entre telas: as alturas dos
                                obstáculos foram calibradas em cima dele */
    quedaRapida: 1.9,

    valorPetisco: 1,
    valorSache: 5,

    trocaDiaNoite: 2600,

    largura: 900             /* preenchido pelo perfil ativo */
  };

  var LARGURA_MOBILE = 300;

  /* Os níveis mexem só no ritmo: velocidade e espaçamento entre obstáculos.
     O valor das provas NÃO muda, então os recordes continuam comparáveis
     entre os três. Os limiares de obstáculo se ajustam sozinhos, porque são
     calculados a partir da física do pulo e comparados com a velocidade. */
  var DIFICULDADES = {
    facil:   { nome: 'Fácil',   vel: 0.80, gap: 1.25,
               obs: 'Mais devagar e com os obstáculos mais espaçados.' },
    normal:  { nome: 'Normal',  vel: 1.00, gap: 1.00, obs: '' },
    dificil: { nome: 'Difícil', vel: 1.25, gap: 0.85,
               obs: 'Bem mais rápido e com menos espaço entre os obstáculos.' }
  };

  /* Duração do bônus de pontuação dobrada, em quadros (15 segundos a 60fps) */
  var DURACAO_XP = 900;
  /* De quantos em quantos metros o bônus aparece */
  var METROS_XP = 803;

  /* caixas de colisão da menina (o desenho é maior e mais generoso) */
  /* Bicho de quatro patas é largo e baixo, não alto e estreito como o boneco
     em pé do Panhô (38x66 / 58x42). Trocar isso obrigou a recalcular a faixa
     do obstáculo aéreo, logo abaixo em nascerObstaculo(). */
  var EM_PE   = { w: 52, h: 44 };   /* correndo */
  var DESLIZE = { w: 64, h: 24 };   /* deitada, escorregando */

  /* ---------- física do pulo ---------------------------------------------- */

  function fisicaDoPulo(apice, forca) {
    var g = 0.78 * forca;
    return { gravidade: g, forcaPulo: -Math.sqrt(2 * g * apice) };
  }

  function janelaDoPulo(alturaObst, g, v0) {
    var disc = v0 * v0 - 2 * g * alturaObst;
    return disc <= 0 ? 0 : 2 * Math.sqrt(disc) / g;
  }

  /* Velocidade mínima para o obstáculo caber dentro do pulo. A margem é em
     QUADROS absolutos: o jogador precisa de uns 4 de folga de cada lado. */
  function limiarDoObstaculo(larguraObst, g, v0) {
    var janela = janelaDoPulo(46, g, v0) - 8;
    if (janela <= 0) return Infinity;
    return (larguraObst + EM_PE.w - 10) / janela;
  }

  function perfilEstreito(largura) {
    var f = fisicaDoPulo(112, 1.45);          /* pulo mais seco no celular */
    var voo = 2 * Math.abs(f.forcaPulo) / f.gravidade;

    var xJogador = Math.round(largura * 0.096);
    var pista = largura - xJogador - 38;
    var vMax = pista / 30;                    /* ~0,5s de reação no pior caso */
    var vIni = vMax * 0.55;

    return {
      nome: 'estreito',
      largura: largura, xJogador: xJogador,
      gravidade: f.gravidade, forcaPulo: f.forcaPulo,
      vIni: vIni, vMax: vMax, acel: (vMax - vIni) / 2600,
      gapMin: largura * 0.35, gapMax: largura * 0.58, gapVel: voo * 1.05,
      itemMin: largura * 0.24, itemMax: largura * 0.48,
      inicioObst: largura * 0.62, inicioItem: largura * 0.38,
      folgaItem: largura * 0.21,
      limiarDuplo: limiarDoObstaculo(66, f.gravidade, f.forcaPulo),
      limiarTrio:  limiarDoObstaculo(102, f.gravidade, f.forcaPulo),
      limiarDrone: vIni * 1.25,
      escalaCarro: 1.0
    };
  }

  var PERFIS = {
    amplo: {
      nome: 'amplo',
      largura: 900, xJogador: 78,
      gravidade: 0.78, forcaPulo: -Math.sqrt(2 * 0.78 * 112),
      vIni: 6.0, vMax: 14.5, acel: 0.0022,
      gapMin: 250, gapMax: 420, gapVel: 18,
      itemMin: 180, itemMax: 360,
      inicioObst: 560, inicioItem: 320,
      folgaItem: 170,
      limiarDuplo: 0, limiarTrio: 9.0, limiarDrone: 7.6,
      escalaCarro: 1.35
    },
    estreito: perfilEstreito(LARGURA_MOBILE)
  };

  var perfilBase = PERFIS.amplo;   /* escolhido pela largura da tela */
  var dificuldade = 'normal';
  var P = PERFIS.amplo;            /* base + dificuldade, montado abaixo */

  function montarPerfil() {
    var d = DIFICULDADES[dificuldade] || DIFICULDADES.normal;
    var p = {};
    for (var k in perfilBase) p[k] = perfilBase[k];
    p.vIni  *= d.vel;  p.vMax  *= d.vel;  p.acel   *= d.vel;
    p.gapMin *= d.gap; p.gapMax *= d.gap; p.gapVel *= d.gap;
    return p;
  }


  /* As larguras e alturas são o que a calibragem enxerga: não mexer à toa. */
  var TIPOS_OBST = [
    { tipo: 'aspirador', w:  30, h: 46, qtd: 1, voa: false },
    { tipo: 'aspirador', w:  66, h: 46, qtd: 2, voa: false },
    { tipo: 'aspirador', w: 102, h: 46, qtd: 3, voa: false },
    { tipo: 'caixa',     w:  44, h: 38, qtd: 1, voa: false }
    /* Não há obstáculo aéreo: o jogo é só de pulo. Tirar o deslize tirou o
       que justificava um obstáculo que se passa por baixo. */
  ];

  var GRITOS = ['NHAC!', 'NHAC!', 'PEGUEI!', 'MAIS UM!'];

  /* ---------- elementos ---------------------------------------------------- */

  var cv        = document.getElementById('jogo');
  var ctx       = cv.getContext('2d');
  var elProvas  = document.getElementById('hud-provas');
  var elXp      = document.getElementById('hud-xp');
  var elXpTempo = document.getElementById('hud-xp-tempo');
  var elRecorde = document.getElementById('hud-recorde');
  var telaIni   = document.getElementById('tela-inicio');
  var telaFim   = document.getElementById('tela-fim');
  var fimTxt    = document.getElementById('fim-txt');
  var btnSom    = document.getElementById('btn-som');
  var palco     = document.getElementById('palco');

  /* ---------- estado ------------------------------------------------------- */

  var ESTADO = { PARADO: 0, JOGANDO: 1, PAUSADO: 2, FIM: 3 };

  /* quem o jogador escolheu. Fica salvo entre partidas. */
  var meninaAtual = 'sig';
  function lerMenina() {
    try {
      var v = window.localStorage.getItem('meninas_personagem');
      return Sprites.meninaPorId(v) ? v : 'sig';
    } catch (e) { return 'sig'; }
  }
  function gravarMenina(v) {
    meninaAtual = v;
    try { window.localStorage.setItem('meninas_personagem', v); } catch (e) {}
  }
  var estado = ESTADO.PARADO;

  var jogador, obstaculos, itens, flutuantes, nuvensLista;
  var velocidade, distancia, provas, recorde, quadro, ultimoTempo;
  var proxObstaculo, proxItem, noite, tremor, novoRecordeNaPartida;
  var cenaFim;
  var proxXP, bonusXP, xpSegExibido;
  var segurandoBaixo = false;

  /* ---------- recorde ------------------------------------------------------ */

  var memoriaFallback = 0;

  function lerRecorde() {
    try {
      var v = window.localStorage.getItem('meninas_recorde');
      return v ? parseInt(v, 10) || 0 : 0;
    } catch (e) { return memoriaFallback; }
  }

  function gravarRecorde(v) {
    memoriaFallback = v;
    try { window.localStorage.setItem('meninas_recorde', String(v)); } catch (e) {}
  }

  /* ---------- utilidades --------------------------------------------------- */

  function num(v) {
    return Math.floor(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function metros(v) { return num(v / 10); }

  function textoProvas(n) {
    return num(n) + (Math.floor(n) === 1 ? ' petisco' : ' petiscos');
  }

  function sorteio(min, max) { return min + Math.random() * (max - min); }

  function colide(a, b, folga) {
    folga = folga || 0;
    return a.x + folga < b.x + b.w - folga &&
           a.x + a.w - folga > b.x + folga &&
           a.y + folga < b.y + b.h - folga &&
           a.y + a.h - folga > b.y + folga;
  }

  /* ---------- perfil de tela ----------------------------------------------- */

  function perfilDaTela() {
    var larg = palco.clientWidth || window.innerWidth || 900;
    return larg < 620 ? PERFIS.estreito : PERFIS.amplo;
  }

  function aplicarProporcao() {
    cv.style.aspectRatio = P.largura + ' / ' + CFG.altura;
    palco.style.maxWidth = (perfilBase === PERFIS.amplo)
      ? ''
      : 'calc(62vh * ' + (P.largura / CFG.altura).toFixed(3) + ')';
  }

  function aplicarPerfil(novaBase) {
    if (novaBase === perfilBase) return false;
    var anterior = P;
    perfilBase = novaBase;
    P = montarPerfil();
    CFG.largura = P.largura;
    aplicarProporcao();

    if (jogador) {
      var r = P.largura / anterior.largura;
      obstaculos.forEach(function (o) { o.x *= r; });
      itens.forEach(function (i) { i.x *= r; });
      nuvensLista.forEach(function (n) { n.x *= r; });
      jogador.x = P.xJogador;
      velocidade = Math.min(P.vMax, velocidade * (P.vIni / anterior.vIni));
      proxObstaculo *= r;
      proxItem *= r;
    }
    return true;
  }

  /* ---------- preparar partida --------------------------------------------- */

  function reiniciar() {
    jogador = {
      x: P.xJogador, y: CFG.solo - EM_PE.h,
      w: EM_PE.w, h: EM_PE.h,
      vy: 0, noAr: false, deslizando: false, pose: 'parado'
    };

    obstaculos = []; itens = []; flutuantes = [];
    nuvensLista = [
      { x: CFG.largura * 0.20, y: 44 }, { x: CFG.largura * 0.48, y: 70 },
      { x: CFG.largura * 0.78, y: 36 }, { x: CFG.largura * 0.98, y: 82 }
    ];

    velocidade = P.vIni;
    distancia = 0; provas = 0; quadro = 0; tremor = 0;
    noite = false;
    palco.classList.remove('noite');
    proxObstaculo = P.inicioObst;
    proxItem = P.inicioItem;
    novoRecordeNaPartida = false;
    cenaFim = null;
    proxXP = METROS_XP;
    bonusXP = 0;
    xpSegExibido = -1;
    atualizarXP();

    atualizarHud();
  }

  /* selo do bônus: só escreve no DOM quando o segundo exibido muda */
  function atualizarXP() {
    var seg = bonusXP > 0 ? Math.ceil(bonusXP / 60) : 0;
    if (seg === xpSegExibido) return;
    xpSegExibido = seg;
    elXpTempo.textContent = seg + 's';
    elXp.classList.toggle('esconde', seg <= 0);
  }

  function atualizarHud() {
    elProvas.textContent  = num(provas);
    elRecorde.textContent = num(recorde);
  }

  /* ---------- ações -------------------------------------------------------- */

  function pular() {
    if (jogador.noAr) return;
    desativarDeslize();
    jogador.vy = P.forcaPulo;
    jogador.noAr = true;
    Som.pulo();
  }

  /* Segurar para baixo não deita mais a menina, só acelera a queda. A pose de
     deslizar saiu do jogo; se ela voltasse sem a arte, a caixa de colisão
     encolheria sem o desenho mudar, o que é vantagem invisível. */
  function abaixar() { segurandoBaixo = true; }

  function desativarDeslize() {}
  function levantar() { segurandoBaixo = false; }

  /* ---------- geração ------------------------------------------------------ */

  function nascerObstaculo() {
    var permitidos = TIPOS_OBST.filter(function (t) {
      if (t.qtd === 2 && velocidade < P.limiarDuplo) return false;
      if (t.qtd === 3 && velocidade < P.limiarTrio)  return false;
      if (t.voa && velocidade < P.limiarDrone)       return false;
      return true;
    });

    var base = permitidos[Math.floor(Math.random() * permitidos.length)];
    var y;
    if (base.voa) {
      /* Faixa recalculada para a caixa nova (44 correndo, 24 deslizando),
         com a folga de 5px da colisão:

           pega quem corre   →  base da mesa acima de solo-34
           passa quem desliza →  base da mesa em solo-14 ou abaixo

         Com a mesa de 26 de altura, o topo tem que ficar entre solo-60 e
         solo-40. Fora disso ela vira injusta ou inofensiva. */
      var alturas = [CFG.solo - 52, CFG.solo - 48, CFG.solo - 56];
      y = alturas[Math.floor(Math.random() * alturas.length)];
    } else {
      y = CFG.solo - base.h;
    }

    obstaculos.push({
      tipo: base.tipo, qtd: base.qtd, voa: base.voa,
      x: CFG.largura + 30, y: y, w: base.w, h: base.h
    });

    proxObstaculo = sorteio(P.gapMin, P.gapMax) + velocidade * P.gapVel;
  }

  function nascerItem() {
    for (var n = 0; n < obstaculos.length; n++) {
      if (obstaculos[n].x > CFG.largura - P.folgaItem) { proxItem = P.folgaItem * 0.7; return; }
    }

    var ehDossie = Math.random() < 0.14;
    var altura = [CFG.solo - 40, CFG.solo - 96, CFG.solo - 140];

    itens.push({
      tipo: ehDossie ? 'sache' : 'petisco',
      x: CFG.largura + 20,
      y: altura[Math.floor(Math.random() * altura.length)],
      w: ehDossie ? 34 : 26,
      h: ehDossie ? 26 : 20,
      pego: false
    });

    proxItem = sorteio(P.itemMin, P.itemMax);
  }

  function gritar(x, y, txt) { flutuantes.push({ x: x, y: y, txt: txt, vida: 46 }); }

  /* ---------- passo -------------------------------------------------------- */

  function passo(dt) {
    quadro++;

    velocidade = Math.min(P.vMax, velocidade + P.acel * dt);
    var avanco = velocidade * dt;
    distancia += avanco;

    /* Bônus de pontuação dobrada a cada METROS_XP.
       O próximo só arma METROS_XP depois que o atual termina — senão, em
       velocidade alta os marcos chegam mais rápido que os 15 segundos de
       duração e o bônus fica ligado o tempo inteiro, perdendo a graça. */
    if (bonusXP <= 0 && distancia / 10 >= proxXP) {
      bonusXP = DURACAO_XP;
      Som.recorde();
      flutuantes.push({ x: CFG.largura / 2, y: 96, txt: 'VOCÊ GANHOU 2XP',
                        vida: 105, grande: true, parado: true });
    }
    if (bonusXP > 0) {
      bonusXP = Math.max(0, bonusXP - dt);
      if (bonusXP === 0) proxXP = distancia / 10 + METROS_XP;
      atualizarXP();
    }

    var ciclo = Math.floor(distancia / CFG.trocaDiaNoite) % 2 === 1;
    if (ciclo !== noite) { noite = ciclo; palco.classList.toggle('noite', noite); }

    if (jogador.noAr) {
      var g = P.gravidade * (segurandoBaixo && jogador.vy > 0 ? CFG.quedaRapida : 1);
      jogador.vy += g * dt;
      jogador.y  += jogador.vy * dt;
      if (jogador.y >= CFG.solo - jogador.h) {
        jogador.y = CFG.solo - jogador.h;
        jogador.vy = 0; jogador.noAr = false;
        if (segurandoBaixo) abaixar();
      }
    }

    jogador.pose = jogador.noAr ? 'pulando'
                 : jogador.deslizando ? 'deslizando'
                 : 'correndo';


    nuvensLista.forEach(function (n) {
      n.x -= avanco * 0.22;
      if (n.x < -50) { n.x = CFG.largura + sorteio(20, 200); n.y = sorteio(26, 92); }
    });

    proxObstaculo -= avanco;
    if (proxObstaculo <= 0) nascerObstaculo();
    proxItem -= avanco;
    if (proxItem <= 0) nascerItem();

    for (var i = obstaculos.length - 1; i >= 0; i--) {
      var o = obstaculos[i];
      o.x -= avanco;
      if (o.x + o.w < -60) { obstaculos.splice(i, 1); continue; }

      /* A mesa colide pela caixa inteira, de propósito: a faixa de altura
         em nascerObstaculo() foi calculada em cima de o.h cheio. Encolher a
         caixa aqui desfaz essa conta em silêncio. */
      var caixa = o;

      if (colide(jogador, caixa, 5)) { perder(); return; }
    }

    for (var j = itens.length - 1; j >= 0; j--) {
      var it = itens[j];
      it.x -= avanco;
      if (it.x + it.w < -60) { itens.splice(j, 1); continue; }

      if (!it.pego && colide(jogador, it, 2)) {
        it.pego = true;
        var mult = bonusXP > 0 ? 2 : 1;
        provas += (it.tipo === 'sache' ? CFG.valorSache : CFG.valorPetisco) * mult;

        if (it.tipo === 'sache') { Som.mala(); gritar(it.x + 17, it.y - 8, mult > 1 ? 'SACHÊ x2!' : 'SACHÊ!'); }
        else { Som.panhou(); gritar(it.x + 13, it.y - 8, mult > 1 ? 'x2!' : GRITOS[Math.floor(Math.random() * GRITOS.length)]); }

        if (provas > recorde) {
          recorde = provas;
          gravarRecorde(recorde);
          if (!novoRecordeNaPartida) {
            novoRecordeNaPartida = true;
            Som.recorde();
            gritar(jogador.x + 30, jogador.y - 24, 'RECORDE!');
            elProvas.classList.add('pisca');
          }
        }

        atualizarHud();
        itens.splice(j, 1);
      }
    }

    for (var k = flutuantes.length - 1; k >= 0; k--) {
      var f = flutuantes[k];
      f.y -= (f.parado ? 0.25 : 0.9) * dt * Math.sqrt(CFG.largura / 900);
      if (!f.parado) f.x -= avanco * 0.35;
      f.vida -= dt;
      if (f.vida <= 0) flutuantes.splice(k, 1);
    }

    if (tremor > 0) tremor -= dt;
  }

  /* ---------- cena final ----------------------------------------------------
     A menina para de frente no meio da tela e o resultado aparece numa placa
     no alto. Só depois a tela de fim sobe. */

  function passoCena(dt) {
    cenaFim.t += dt;
    if (tremor > 0) tremor -= dt;
  }

  function desenharCena() {
    var L = CFG.largura;
    var m = Sprites.meninaPorId(meninaAtual);

    /* o resultado fica no céu, acima da cena, para nada cobrir a menina */
    var tam = L < 600 ? 15 : 19;
    var l1 = (m ? m.nome : 'Você') + ' juntou ' + textoProvas(provas);
    var l2 = 'em ' + metros(distancia) + ' metros.';

    ctx.textAlign = 'center';
    ctx.font = '800 ' + tam + 'px "Syne", sans-serif';
    var larg = ctx.measureText(l1).width;
    ctx.font = '400 ' + Math.round(tam * 0.95) + 'px "Plus Jakarta Sans", sans-serif';
    larg = Math.max(larg, ctx.measureText(l2).width) + 28;

    var topo = 22, altPlaca = tam * 2 + 22;
    ctx.fillStyle = noite ? 'rgba(26,26,26,.88)' : 'rgba(255,255,255,.92)';
    Sprites.bloco(ctx, L / 2 - larg / 2, topo, larg, altPlaca, 12, ctx.fillStyle);

    ctx.fillStyle = noite ? PALETA.superf : PALETA.tinta;
    ctx.font = '800 ' + tam + 'px "Syne", sans-serif';
    ctx.fillText(l1, L / 2, topo + tam + 3);
    ctx.font = '400 ' + Math.round(tam * 0.95) + 'px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = noite ? 'rgba(255,255,255,.72)' : PALETA.tinta60;
    ctx.fillText(l2, L / 2, topo + tam * 2 + 7);

    /* a menina para no meio da tela, de frente */
    Sprites.menina(ctx, {
      x: L * 0.5 - EM_PE.w / 2, y: CFG.solo - EM_PE.h,
      w: EM_PE.w, h: EM_PE.h, pose: 'parada'
    }, 0, meninaAtual);
  }

  /* ---------- desenho ------------------------------------------------------ */

  function desenhar() {
    var L = CFG.largura, A = CFG.altura;

    ctx.save();
    if (tremor > 0) ctx.translate(sorteio(-3, 3), sorteio(-2, 2));

    Sprites.fundo(ctx, L, A, noite);
    if (noite) Sprites.estrelas(ctx, L, distancia);
    Sprites.casas(ctx, L, A, distancia, noite);
    Sprites.nuvens(ctx, nuvensLista, noite);
    Sprites.chao(ctx, L, CFG.solo, distancia, noite);

    if (cenaFim) {
      desenharCena();
    } else {
      itens.forEach(function (it) { Sprites.item(ctx, it, quadro); });
      obstaculos.forEach(function (o) { Sprites.obstaculo(ctx, o, quadro, noite); });

      Sprites.menina(ctx, jogador, quadro, meninaAtual);
    }

    var escalaTexto = Math.sqrt(CFG.largura / 900);
    flutuantes.forEach(function (f) { Sprites.flutuante(ctx, f, escalaTexto); });

    ctx.font = '400 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = noite ? 'rgba(244,241,234,.42)' : 'rgba(21,16,51,.34)';
    ctx.fillText(metros(distancia) + ' m', 12, CFG.altura - 14);

    if (estado === ESTADO.PAUSADO) {
      ctx.fillStyle = 'rgba(244,241,234,.86)';
      ctx.fillRect(0, 0, L, A);
      ctx.textAlign = 'center';
      ctx.font = '800 26px "Qanelas", sans-serif';
      ctx.fillStyle = PALETA.navy;
      ctx.fillText('PAUSADO', L / 2, A / 2);
      ctx.font = '800 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = 'rgba(21,16,51,.6)';
      ctx.fillText('TOQUE NA TELA OU APERTE P', L / 2, A / 2 + 24);
    }

    ctx.restore();
  }

  /* ---------- laço --------------------------------------------------------- */

  function laco(tempo) {
    requestAnimationFrame(laco);
    if (!ultimoTempo) ultimoTempo = tempo;
    var dt = (tempo - ultimoTempo) / (1000 / 60);
    ultimoTempo = tempo;
    if (dt > 3) dt = 3;

    if (estado === ESTADO.JOGANDO) passo(dt);
    else if (estado === ESTADO.FIM && cenaFim) passoCena(dt);

    desenhar();
  }

  /* ---------- transições --------------------------------------------------- */

  function comecar() {
    Som.destravar();
    aplicarPerfil(perfilDaTela());
    P = montarPerfil();          /* pega a dificuldade escolhida */
    CFG.largura = P.largura;
    reiniciar();
    jogador.pose = 'correndo';
    telaIni.classList.add('tela-off');
    telaFim.classList.add('tela-off');
    elProvas.classList.remove('pisca');
    estado = ESTADO.JOGANDO;
    ultimoTempo = 0;

    /* pede o comprovante da partida ao servidor do ranking. O ranking é um
       extra: se não houver API, ele se desliga sozinho e o jogo nem percebe. */
    if (window.Ranking) Ranking.abrirPartida(dificuldade);
  }

  function perder() {
    estado = ESTADO.FIM;
    tremor = 10;
    Som.perdeu();

    obstaculos = []; itens = []; flutuantes = [];
    jogador.deslizando = false;
    jogador.w = EM_PE.w; jogador.h = EM_PE.h;
    jogador.y = CFG.solo - jogador.h;
    jogador.pose = 'parada';

    cenaFim = { t: 0 };
    bonusXP = 0; atualizarXP();       /* o selo do dobro some junto com a partida */

    fimTxt.textContent = (Sprites.meninaPorId(meninaAtual) || {}).nome +
                         ' juntou ' + textoProvas(provas) + '.';

    /* a tela de fim entra só depois que a cena se monta */
    setTimeout(function () {
      if (estado === ESTADO.FIM) telaFim.classList.remove('tela-off');
    }, 1700);

    if (window.Compartilhar) Compartilhar.atualizar(provas, Math.floor(distancia / 10));
    if (window.Ranking) Ranking.oferecer(provas, Math.floor(distancia / 10), dificuldade);
    pintarNivel();
  }

  function pausar() {
    if (estado === ESTADO.JOGANDO) { estado = ESTADO.PAUSADO; desenhar(); }
    else if (estado === ESTADO.PAUSADO) { estado = ESTADO.JOGANDO; ultimoTempo = 0; }
  }

  /* ---------- entrada ------------------------------------------------------ */

  function acaoPrincipal() {
    if (estado === ESTADO.PARADO) { comecar(); return; }
    if (estado === ESTADO.FIM) {
      /* só reinicia depois que a cena terminou de se montar */
      if (cenaFim && cenaFim.t > 100) comecar();
      return;
    }
    if (estado === ESTADO.PAUSADO) { pausar(); return; }
    pular();
  }

  /* Quando o foco está num campo de texto, o teclado é do campo, não do jogo.
     Sem isso, digitar "Ana Clara" no apelido do ranking come o espaço e ainda
     começa uma partida por baixo — o espaço é a tecla de pular. */
  function digitando() {
    var el = document.activeElement;
    if (!el) return false;
    var tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  document.addEventListener('keydown', function (e) {
    if (digitando()) return;
    var t = e.key;
    if (t === ' ' || t === 'Spacebar' || t === 'ArrowUp' || t === 'w' || t === 'W' || t === 'Enter') {
      e.preventDefault(); acaoPrincipal(); return;
    }
    if (t === 'ArrowDown' || t === 's' || t === 'S') {
      e.preventDefault();
      if (estado === ESTADO.JOGANDO) abaixar();
      return;
    }
    if (t === 'p' || t === 'P') { pausar(); return; }
    if (t === 'm' || t === 'M') { alternarSom(); return; }
  });

  document.addEventListener('keyup', function (e) {
    if (digitando()) return;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') levantar();
  });

  palco.addEventListener('pointerdown', function (e) {
    if (e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    acaoPrincipal();
  });

  var btnPular   = document.getElementById('ctrl-pular');
  btnPular.addEventListener('pointerdown', function (e) { e.preventDefault(); acaoPrincipal(); });

  document.getElementById('btn-comecar').addEventListener('click', function (e) {
    e.stopPropagation(); e.currentTarget.blur(); comecar();
  });
  document.getElementById('btn-denovo').addEventListener('click', function (e) {
    e.stopPropagation(); e.currentTarget.blur(); comecar();
  });

  function alternarSom() {
    btnSom.textContent = 'SOM: ' + (Som.alternar() ? 'ON' : 'OFF');
  }
  btnSom.addEventListener('click', function (e) {
    e.stopPropagation(); e.currentTarget.blur(); alternarSom();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && estado === ESTADO.JOGANDO) estado = ESTADO.PAUSADO;
  });

  /* ---------- seletor de dificuldade --------------------------------------
     A troca vale da próxima partida em diante: mudar o ritmo no meio da
     corrida deixaria o obstáculo que já está na tela injusto. */

  var botoesNivel = Array.prototype.slice.call(document.querySelectorAll('.niv'));
  var elNivelObs  = document.getElementById('nivel-obs');

  function lerDificuldade() {
    try {
      var v = window.localStorage.getItem('meninas_dificuldade');
      return DIFICULDADES[v] ? v : 'normal';
    } catch (e) { return 'normal'; }
  }

  function pintarNivel() {
    botoesNivel.forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.nivel === dificuldade ? 'true' : 'false');
    });
    var d = DIFICULDADES[dificuldade];
    var emJogo = estado === ESTADO.JOGANDO || estado === ESTADO.PAUSADO;
    var txt = d.obs + (emJogo ? ' Vale a partir da próxima partida.' : '');
    elNivelObs.textContent = txt.trim();
    elNivelObs.classList.toggle('ativo', !!txt.trim());
  }

  function trocarDificuldade(nome) {
    if (!DIFICULDADES[nome]) return;
    dificuldade = nome;
    try { window.localStorage.setItem('meninas_dificuldade', nome); } catch (e) {}
    if (estado === ESTADO.PARADO) { P = montarPerfil(); reiniciar(); desenhar(); }
    pintarNivel();
    if (window.Ranking) Ranking.trocarNivel(nome);
  }

  botoesNivel.forEach(function (b) {
    b.addEventListener('click', function () { b.blur(); trocarDificuldade(b.dataset.nivel); });
  });

  /* ---------- escolha da menina --------------------------------------------
     A troca vale na hora quando o jogo está parado. Durante a partida ela
     fica para a próxima: trocar de personagem no meio da corrida mudaria o
     desenho sem mudar a caixa de colisão, e o jogador leria isso como bug. */

  var elElenco = document.getElementById('elenco');
  var botoesMenina = [];

  function montarElenco() {
    if (!elElenco) return;
    elElenco.innerHTML = '';
    botoesMenina = Sprites.MENINAS.map(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'men';
      b.dataset.menina = m.id;

      var cv = document.createElement('canvas');
      cv.width = 112; cv.height = 92;
      b.appendChild(cv);

      var nome = document.createElement('span');
      nome.textContent = m.nome;
      b.appendChild(nome);

      b.addEventListener('click', function () { b.blur(); trocarMenina(m.id); });
      elElenco.appendChild(b);

      /* o retrato é desenhado agora e de novo quando a arte dela carregar */
      Sprites.carregarMenina(m.id, function () { pintarRetrato(cv, m.id); });
      pintarRetrato(cv, m.id);
      return b;
    });
    pintarElenco();
  }

  function pintarRetrato(cv, id) {
    var c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    Sprites.retrato(c, id, cv.width / 2, cv.height - 4, cv.height - 8);
  }

  function pintarElenco() {
    botoesMenina.forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.menina === meninaAtual ? 'true' : 'false');
    });
  }

  function trocarMenina(id) {
    if (!Sprites.meninaPorId(id)) return;
    gravarMenina(id);
    pintarElenco();
    Sprites.carregarMenina(id, function () {
      if (estado === ESTADO.PARADO || estado === ESTADO.FIM) desenhar();
    });
    if (estado === ESTADO.PARADO || estado === ESTADO.FIM) desenhar();
  }

  /* ---------- tamanho e nitidez -------------------------------------------- */

  function ajustarNitidez() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width  = Math.round(CFG.largura * dpr);
    cv.height = Math.round(CFG.altura * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    desenhar();
  }

  function aoRedimensionar() {
    var trocou = aplicarPerfil(perfilDaTela());
    if (trocou && estado === ESTADO.PARADO) reiniciar();
    ajustarNitidez();
  }

  window.addEventListener('resize', aoRedimensionar);
  window.addEventListener('orientationchange', function () { setTimeout(aoRedimensionar, 250); });

  /* ---------- arranque ------------------------------------------------------ */

  if (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
    document.body.classList.add('touch');
  }

  if (window.Compartilhar) Compartilhar.init();

  recorde = lerRecorde();
  dificuldade = lerDificuldade();
  meninaAtual = lerMenina();
  montarElenco();
  perfilBase = perfilDaTela();
  P = montarPerfil();
  pintarNivel();
  if (window.Ranking) Ranking.trocarNivel(dificuldade);
  CFG.largura = P.largura;
  aplicarProporcao();
  reiniciar();
  ajustarNitidez();

  Sprites.carregarMenina(meninaAtual, function () {
    desenhar();
    requestAnimationFrame(laco);
  });

})();
