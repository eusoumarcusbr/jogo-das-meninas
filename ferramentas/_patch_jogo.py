import io, re, sys

p = sys.argv[1]
s = io.open(p, encoding='utf-8').read()
orig = s

def troca(a, b, n=1):
    global s
    c = s.count(a)
    assert c == n, 'esperava %d ocorrencia(s), achei %d:\n%s' % (n, c, a[:120])
    s = s.replace(a, b)

# ---------- caixas de colisão: bicho de quatro patas ----------
troca("""  var EM_PE   = { w: 38, h: 66 };
  var DESLIZE = { w: 58, h: 42 };

  /* Mesmas dimensões da v1 — só o desenho mudou. As larguras e alturas são
     o que a calibragem enxerga, então não devem ser alteradas à toa. */""",
"""  /* Bicho de quatro patas é largo e baixo, não alto e estreito como o boneco
     em pé do Panhô (38x66 / 58x42). Trocar isso obrigou a recalcular a faixa
     do obstáculo aéreo, logo abaixo em nascerObstaculo(). */
  var EM_PE   = { w: 52, h: 44 };   /* correndo */
  var DESLIZE = { w: 64, h: 24 };   /* deitada, escorregando */

  /* As larguras e alturas são o que a calibragem enxerga: não mexer à toa. */""")

# ---------- tipos de obstáculo ----------
troca("""    { tipo: 'sigilo',     w:  30, h: 46, qtd: 1, voa: false },
    { tipo: 'sigilo',     w:  66, h: 46, qtd: 2, voa: false },
    { tipo: 'sigilo',     w: 102, h: 46, qtd: 3, voa: false },
    { tipo: 'burocracia', w:  44, h: 38, qtd: 1, voa: false },
    { tipo: 'drone',      w:  56, h: 30, qtd: 1, voa: true  }""",
"""    { tipo: 'aspirador', w:  30, h: 46, qtd: 1, voa: false },
    { tipo: 'aspirador', w:  66, h: 46, qtd: 2, voa: false },
    { tipo: 'aspirador', w: 102, h: 46, qtd: 3, voa: false },
    { tipo: 'caixa',     w:  44, h: 38, qtd: 1, voa: false },
    { tipo: 'mesa',      w:  56, h: 26, qtd: 1, voa: true  }""")

# ---------- faixa do aéreo, recalculada ----------
troca("""      /* faixa calibrada: em pé bate, deslizando passa. Fora de 149..176
         (contando a folga de 5px) o drone vira injusto ou inofensivo. */
      var alturas = [CFG.solo - 72, CFG.solo - 68, CFG.solo - 76];""",
"""      /* Faixa recalculada para a caixa nova (44 correndo, 24 deslizando),
         com a folga de 5px da colisão:

           pega quem corre   →  base da mesa acima de solo-34
           passa quem desliza →  base da mesa em solo-14 ou abaixo

         Com a mesa de 26 de altura, o topo tem que ficar entre solo-60 e
         solo-40. Fora disso ela vira injusta ou inofensiva. */
      var alturas = [CFG.solo - 52, CFG.solo - 48, CFG.solo - 56];""")

# ---------- largura do jogador na conta do limiar ----------
troca("    return (larguraObst + 38 - 10) / janela;",
      "    return (larguraObst + EM_PE.w - 10) / janela;")

# ---------- itens ----------
troca("    valorDocumento: 1,\n    valorDossie: 5,",
      "    valorPetisco: 1,\n    valorSache: 5,")
troca("      tipo: ehDossie ? 'dossie' : 'documento',",
      "      tipo: ehDossie ? 'sache' : 'petisco',")
troca("        provas += (it.tipo === 'dossie' ? CFG.valorDossie : CFG.valorDocumento) * mult;",
      "        provas += (it.tipo === 'sache' ? CFG.valorSache : CFG.valorPetisco) * mult;")
troca("""        if (it.tipo === 'dossie') { Som.mala(); gritar(it.x + 17, it.y - 8, mult > 1 ? 'DOSSIÊ x2!' : 'DOSSIÊ!'); }""",
"""        if (it.tipo === 'sache') { Som.mala(); gritar(it.x + 17, it.y - 8, mult > 1 ? 'SACHÊ x2!' : 'SACHÊ!'); }""")

# ---------- texto da pontuação ----------
troca("    return num(n) + (Math.floor(n) === 1 ? ' prova' : ' provas');",
      "    return num(n) + (Math.floor(n) === 1 ? ' petisco' : ' petiscos');")

# ---------- cenário ----------
troca("    Sprites.predios(ctx, L, A, distancia, noite);",
      "    Sprites.casas(ctx, L, A, distancia, noite);")

# ---------- a menina no lugar do Pedro ----------
troca("      Sprites.pedro(ctx, jogador, quadroAnim);",
      "      Sprites.menina(ctx, jogador, quadro, meninaAtual);")
troca("""      /* o Panhôzinho fica atrás: os obstáculos passam à frente dele */
      Sprites.panhoFugindo(ctx, panhoX, CFG.solo, quadro);

""", "")
troca("""      var quadroAnim = Math.floor(quadro / (velocidade > P.vMax * 0.7 ? 4 : 6)) % 2;
""", "")

# ---------- cena final: sem carro, sem balão, sem perseguido ----------
cena_velha = s[s.index("  function desenharCena() {"):s.index("  /* ---------- desenho ---------")]
troca(cena_velha,
"""  function desenharCena() {
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

""")

# passoCena fica só com o tempo
troca("""  function passoCena(dt) {
    cenaFim.t += dt;
    var alvo = CFG.largura * 0.66;
    if (cenaFim.t > 30) {
      cenaFim.carroX += (alvo - cenaFim.carroX) * Math.min(1, 0.055 * dt);
    }
    cenaFim.balaoAlfa = Math.max(0, Math.min(1, (cenaFim.t - 18) / 18));
    if (tremor > 0) tremor -= dt;
  }""",
"""  function passoCena(dt) {
    cenaFim.t += dt;
    if (tremor > 0) tremor -= dt;
  }""")

troca("    cenaFim = { t: 0, carroX: CFG.largura + 140, balaoAlfa: 0 };",
      "    cenaFim = { t: 0 };")
troca("    jogador.pose = 'bracos';", "    jogador.pose = 'parada';")

# ---------- o perseguido não existe mais ----------
troca("  var panhoX, cenaFim;", "  var cenaFim;")
troca("      panhoX *= r;\n", "")
troca("    panhoX = CFG.largura * 0.76;\n", "")
troca("    panhoX = CFG.largura * (0.74 + 0.05 * Math.sin(quadro / 47));\n", "")

# ---------- texto do fim ----------
fim = s[s.index("    fimTxt.textContent ="):]
fim = fim[:fim.index(";\n") + 2]
troca(fim, """    fimTxt.textContent = (Sprites.meninaPorId(meninaAtual) || {}).nome +
                         ' juntou ' + textoProvas(provas) + '.';\n""")

# ---------- menina escolhida ----------
troca("  var ESTADO = { PARADO: 0, JOGANDO: 1, PAUSADO: 2, FIM: 3 };",
"""  var ESTADO = { PARADO: 0, JOGANDO: 1, PAUSADO: 2, FIM: 3 };

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
  }""")

# ---------- carregamento das imagens ----------
troca("  Sprites.carregarImagens(function () {",
      "  Sprites.carregarMenina(meninaAtual, function () {")

# ---------- recorde: chave própria ----------
s = s.replace('panho_v2_recorde', 'meninas_recorde')
s = s.replace('panho_v2_dificuldade', 'meninas_dificuldade')

# ---------- fonte dos textos no canvas ----------
s = s.replace('"Barlow", sans-serif', '"Plus Jakarta Sans", sans-serif')

# ---------- cabeçalho ----------
s = re.sub(r'^/\* =+\n.*?=+ \*/\n',
"""/* ==========================================================================
   JOGO DAS MENINAS — corrida infinita

   Motor herdado do PANHÔ! (github.com/eusoumarcusbr/webgame), com a
   calibragem refeita para um personagem de quatro patas: a caixa de colisão
   passou de 38x66 para 52x44, e a faixa do obstáculo aéreo foi recalculada
   em cima disso.
   ========================================================================== */
""", s, count=1, flags=re.S)

io.open(p, 'w', encoding='utf-8').write(s)
print('jogo.js: %d -> %d bytes' % (len(orig), len(s)))
