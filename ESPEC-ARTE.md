# Arte do Jogo das Meninas — o que o ilustrador precisa entregar

Sete personagens, cinco poses cada, 35 arquivos.

---

## O formato (a parte que mais dá retrabalho)

**Todas as poses na mesma tela de 1200 × 900 px, PNG com fundo transparente,
com as patas tocando a base da tela.**

Não recortar. Não centralizar. Não entregar cada pose num tamanho diferente.
A posição dentro da tela é o que define onde o bicho pisa, e é isso que faz ele
não flutuar nem mudar de tamanho ao trocar de pose.

As sete personagens precisam estar **na mesma escala entre si**. Uma Amora
desenhada maior que a Sig deixa o jogo mais fácil para uma e mais difícil para
a outra, porque a caixa de colisão é a mesma para todas.

Tamanho relativo dentro da tela: o corpo em pé (pose `parada`) ocupa
aproximadamente **60% da altura** da tela de 900 px. Gato e cachorro podem ter
diferença natural de porte, mas pequena: no máximo 10% entre a maior e a menor.

---

## As cinco poses

| arquivo | o que é |
|---|---|
| `<nome>-parada.png` | de frente ou de três quartos, parada. Tela inicial e escolha |
| `<nome>-corrida-1.png` | de perfil, correndo, patas em uma fase |
| `<nome>-corrida-2.png` | de perfil, correndo, patas na outra fase |
| `<nome>-pulando.png` | de perfil, no ar, patas recolhidas |
| `<nome>-deslizando.png` | de perfil, **deitada de barriga para baixo, escorregando** |

A pose `deslizando` é a mais importante de acertar: ela precisa ficar
**nitidamente mais baixa** que a corrida, porque o jogo usa isso para passar por
baixo da mesa. Mire em **metade da altura** da pose de corrida. Se ela ficar
alta demais, o obstáculo aéreo vira impossível de calibrar com justiça, e isso
já custou retrabalho em dois projetos anteriores.

Correndo e pulando são de perfil, olhando para a direita.

---

## Os nomes dos arquivos

```
sig-parada.png          sig-corrida-1.png          sig-corrida-2.png
sig-pulando.png         sig-deslizando.png

queijadinha-*.png   furrundu-*.png   lessa-*.png
luck-*.png          nina-*.png       amora-*.png
```

Tudo minúsculo, sem acento, sem espaço.

---

## Quem é quem

| nome | como é |
|---|---|
| **Sig** | golden retriever, mais gordinha |
| **Queijadinha** | golden retriever, mais magra, com um risco entre os olhos até o focinho |
| **Furrundu** | SRD preta e branca com detalhes amarelos, rabo mais peludo |
| **Lessa** | SRD preta e branca com detalhes amarelos, rabo mais fino |
| **Luck** | SRD preto e branco, pelo tipo caroço de manga, descabelado |
| **Nina** | gata siamesa |
| **Amora** | gata preta, orelhas cortadas, lembra o Banguela |

Furrundu e Lessa se diferenciam **só pelo rabo**, e Sig e Queijadinha **só pelo
porte e pelo risco no focinho**. Em 78 px de altura na tela isso quase sempre
some. Vale exagerar essas duas diferenças no desenho, senão o jogador não
distingue quem escolheu.

---

## O que NÃO precisa vir

Cenário, chão, sombra, moldura. O jogo desenha tudo isso.

Obstáculos e itens (petisco, sachê, aspirador, caixa, mesa) também não: são
desenhados em código, como no Panhô.

---

## Armadilha conhecida

Se o PNG tiver pixels com cor escura e alfa zero nas bordas, o recorte
automático sai errado e o personagem aparece com metade do tamanho. Já
aconteceu. **Exportar com as bordas realmente limpas**, ou avisar que não estão.
