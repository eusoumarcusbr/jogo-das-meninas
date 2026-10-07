/* ==========================================================================
   PANHÔ! — audio
   Bipes gerados na hora com WebAudio. Nenhum arquivo externo, nada pra subir.
   ========================================================================== */

var Som = (function () {

  var ctx = null;
  var ligado = true;

  function ctxAtivo() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    return ctx;
  }

  /* Retoma o contexto — navegadores bloqueiam audio antes do primeiro toque. */
  function destravar() {
    var c = ctxAtivo();
    if (c && c.state === 'suspended') { c.resume().catch(function () {}); }
  }

  function tocar(freqIni, freqFim, dur, tipo, vol) {
    if (!ligado) return;
    var c = ctxAtivo();
    if (!c) return;
    try {
      var osc = c.createOscillator();
      var gan = c.createGain();
      var t = c.currentTime;

      osc.type = tipo || 'square';
      osc.frequency.setValueAtTime(freqIni, t);
      if (freqFim && freqFim !== freqIni) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(freqFim, 1), t + dur);
      }

      gan.gain.setValueAtTime(vol || 0.06, t);
      gan.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(gan);
      gan.connect(c.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (e) { /* silencio e seguir o jogo */ }
  }

  return {
    destravar: destravar,

    ligado: function () { return ligado; },

    alternar: function () {
      ligado = !ligado;
      if (ligado) { destravar(); tocar(660, 880, 0.08, 'square', 0.05); }
      return ligado;
    },

    pulo:     function () { tocar(420, 780, 0.10, 'square', 0.05); },
    panhou:   function () { tocar(880, 1320, 0.09, 'square', 0.06); },
    mala:     function () { tocar(660, 1760, 0.20, 'square', 0.07); },
    recorde:  function () { tocar(1046, 1568, 0.30, 'triangle', 0.07); },

    perdeu: function () {
      tocar(320, 190, 0.16, 'square', 0.07);
      setTimeout(function () { tocar(190, 90, 0.34, 'sawtooth', 0.07); }, 150);
    }
  };

})();
