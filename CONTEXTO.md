# Contexto do Jogo das Meninas

Leia antes de mexer. O que está aqui é o que já custou retrabalho.

---

## O que é

Corrida infinita de lado, no canvas. O jogador escolhe uma das sete meninas,
corre, pula obstáculo e junta petisco. Sem fim: a velocidade sobe até o teto do
perfil e a pessoa joga até errar.

Endereço: `https://www.eusoumarcus.com.br/jogo-das-meninas/`

O motor veio do **PANHÔ! v2** (`github.com/eusoumarcusbr/webgame`, pasta `v2/`).
A física, os perfis de tela, o compartilhamento e o ranking são os mesmos. O que
mudou foi a caixa de colisão, o elenco, o design system e a retirada do deslize.

---

## Decisões tomadas, e por quê

**O jogo é só de pulo.** Não existe deslize nem obstáculo aéreo. A pose
`agachando` que o ilustrador entregou ficou com 79% a 82% da altura da pose de
corrida. Para um obstáculo aéreo ser justo, ele precisa pegar quem corre e passar
por cima de quem desliza, e com 20% de diferença não sobra faixa de altura para
calibrar. Em vez de pedir a arte de novo, o deslize saiu. Se um dia voltar, a
pose precisa ter **metade** da altura da corrida, e isso está escrito no
`ESPEC-ARTE.md`.

**O recorte da arte foi feito aqui, não pelo ilustrador.** 25 dos 35 PNGs vieram
com fundo opaco. O `ferramentas/processar-arte.py` resolve isso.

**Sete personagens com a mesma caixa de colisão.** Todas são escaladas para a
mesma altura de corrida, senão uma ficaria mais fácil que a outra.

---

## A caixa de colisão, que é o número que manda em tudo

```js
var EM_PE   = { w: 52, h: 44 };   /* correndo */
var DESLIZE = { w: 64, h: 24 };   /* pose removida do jogo, constante mantida */
```

No Panhô era `38x66`: um boneco em pé, alto e estreito. Bicho de quatro patas é
o contrário, largo e baixo. Trocar isso obrigou a refazer a conta do espaçamento
entre obstáculos, porque a largura do jogador entra no limiar:

```js
limiarDoObstaculo(w, g, v0) = (w + EM_PE.w - 10) / (janelaDoPulo - 8)
```

**`EM_PE` precisa estar declarado acima da seção de física.** Já quebrou com
`Cannot read properties of undefined (reading 'w')` por estar embaixo.

Efeito colateral medido: no celular o `vMax` caiu de 7,8 para 7,3, porque a
menina, sendo mais larga, come pista.

---

## Física do pulo

```js
fisicaDoPulo(apice, forca)  →  g = 0.78 * forca,  v0 = -raiz(2 * g * apice)
```

**O ápice é fixo em 112 e não muda entre telas.** É o que garante que um
obstáculo que dá para pular no desktop também dê para pular no celular.

O espaçador se protege sozinho: calcula quanto tempo a menina fica no ar e só
solta um obstáculo se couber. A margem é de **8 quadros absolutos**, nunca uma
porcentagem, porque porcentagem some quando a velocidade sobe.

Conferido na calibragem atual: no desktop as três larguras de aspirador nascem
em todas as dificuldades. No celular a dupla só no difícil, e a tripla nunca.
É o mesmo comportamento do Panhô.

---

## Perfis de tela

Só a **largura** do mundo muda entre telas, a altura não. Corte em 620px, e
abaixo disso `LARGURA_MOBILE = 300`.

A regra que mantém o boneco do mesmo tamanho aparente:

```
tamanho na tela = alturaDoJogo ÷ larguraDoMundo × larguraDoCanvas
```

---

## Arte

Arquivos em `assets/img/`, quatro poses por menina: `parada`, `corrida-1`,
`corrida-2`, `pulando`. Os arquivos são **2x** e o `sprites.js` desenha com
`ESCALA = 0.5`.

Os originais do ilustrador ficam em `assets-originais/`, intocados.

`ferramentas/processar-arte.py` faz o caminho de um para o outro:

1. Mede a **cor mediana da borda** e tira o fundo por preenchimento a partir das
   bordas. Não assumir branco: o fundo da Furrundu era cinza claro, a 44 de
   distância do branco, e um limiar baseado em branco deixava a tela inteira.
2. Recorta pelo **canal alfa** (`np.where(alpha > 8)`), **nunca** por
   `getbbox()`, que erra quando há pixel escuro com alfa zero na borda e o
   personagem sai com metade do tamanho.
3. Uma escala por personagem, medida na pose `corrida-1`, com
   `ALTURA_CORRIDA_2X = 112`.
4. Quantiza em 160 cores.

Obstáculos e itens são desenhados em código, não são imagem: `aspirador`,
`caixa`, `petisco`, `sache`.

---

## Design system

Tokens do eusoumarcus.com.br, não do Panhô. Vermelho `#e8341c`, fundo claro,
cantos bem arredondados (8 a 24px), Syne nos títulos e Plus Jakarta Sans no
corpo.

O `js/sprites.js` repete esses valores no objeto `PALETA`, porque canvas não lê
variável CSS. **Mudou no CSS, muda no PALETA.**

Detalhe de carregamento: o global é `Sprites`, e no fim do arquivo há
`var PALETA = Sprites.PALETA;` porque `jogo.js` e `compartilhar.js` usam `PALETA`
como global solto.

---

## Ranking

PHP gravando JSON em disco, sem banco. Igual ao do Panhô v2.

- Uma lista por nível de dificuldade.
- Um apelido por pessoa, de 2 a 12 caracteres.
- Fila de moderação: o apelido só aparece depois de liberado no painel.
- Se o mesmo apelido jogar de novo, a linha é **substituída** quando o resultado
  for melhor, e herda o estado de moderação. Não duplica.
- Comprovante de partida assinado com HMAC, de uso único, com duração mínima e
  máxima e teste de plausibilidade (distância contra tempo, pontos contra
  distância).
- Limite por IP guardado como hash, nunca o IP.
- Filtro de palavrão com **duas listas**: `..._TRECHO` casa pedaço de palavra e
  `..._EXATOS` casa palavra inteira. Isso existe porque uma lista só de trechos
  barrava "Marcus".

Os arquivos de dados são gravados como `<nome>.json.php` com `<?php exit; ?>` na
primeira linha, **mais** um `.htaccess` negando a pasta. São duas proteções
independentes de propósito.

Enquanto o segredo ou a senha começarem com `TROQUE`, a função `rk_configurado()`
desliga o ranking de propósito. Ranking sumido logo depois de publicar quase
sempre é isso.

Painel de moderação: `/api/admin.php`.

---

## Armadilhas que já custaram tempo

- **Cache.** O `.htaccess` guarda CSS e JS por um mês, mas não guarda o HTML.
  Sintoma clássico: "o texto mudou mas o comportamento não". Subir o `?v=N` em
  **todas** as linhas de `<script>` e `<link>` do `index.html` a cada mexida.
- **Sempre testar o endereço com `www`.** Já dei diagnóstico errado por ter
  testado sem.
- **`api/config.php` nunca é sobrescrito** numa atualização, e **`api/dados/`
  nunca sobe por cima**. Já apaguei o segredo do servidor subindo um pacote de
  atualização que incluía o `config.php`.
- **`api/dados/.htaccess` é oculto** e some na hora de subir por FTP.
- O Finder cria `._arquivo` e `.DS_Store` na pasta de publicação. Limpar antes.
- **Canvas em `file://` contamina** e o `toBlob` do compartilhamento quebra. Por
  isso as imagens embutidas são data URI. Teste local tem que ser por servidor,
  não abrindo o arquivo.

---

## Método

Medir, não sentir. Quando a dúvida for de calibragem, rodar o piloto automático
dentro da página e olhar o número, em **as duas** larguras de tela, e testar
também o caminho de erro, não só o caminho feliz.
