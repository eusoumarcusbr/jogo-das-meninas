#!/usr/bin/env python3
"""
Prepara os PNG das meninas para o jogo.

O que ele resolve, e por que cada passo existe:

1. NOMES. O ilustrador entregou com nomes inconsistentes (corrida1, correndo1,
   correndi1, parado, achachando). O mapa POSE normaliza.

2. FUNDO. Cinco das sete vieram com fundo branco sólido, sem transparência.
   O recorte é por preenchimento a partir das bordas: só some o branco que
   ENCOSTA na borda. O pelo branco da Furrundu, da Lessa e do Luck fica, porque
   está no meio da imagem e não encosta.

3. RECORTE. Pelo canal alfa com limiar (alfa > 8), nunca por getbbox(): borda
   com RGB escuro e alfa zero engana o getbbox e o bicho sai com metade do
   tamanho. Isso já aconteceu em outro projeto.

4. ESCALA. Uma escala por personagem, calculada na pose de corrida, aplicada
   igual às outras poses dela. Assim nenhuma pose flutua nem muda de tamanho,
   e as sete correm do mesmo tamanho — que é o que a caixa de colisão única
   exige.

Saída: assets/img/<id>-<pose>.png, já no tamanho final 2x.
"""
import os, sys, glob
from collections import deque
from PIL import Image
import numpy as np

ORIGEM  = sys.argv[1] if len(sys.argv) > 1 else '.'
DESTINO = sys.argv[2] if len(sys.argv) > 2 else 'assets/img'

POSE = {
    'parada': 'parada', 'parado': 'parada',
    'corrida1': 'corrida-1', 'correndo1': 'corrida-1', 'correndi1': 'corrida-1',
    'corrida2': 'corrida-2', 'correndo2': 'corrida-2',
    'pulando': 'pulando',
    # agachando/achachando ficam de fora: o jogo é só de pulo
}

ALTURA_CORRIDA_2X = 112      # a pose de corrida mede isso no arquivo final
                             # (56 no jogo, com a caixa de colisão em 44)
TRABALHO = 420               # altura de trabalho para o recorte do fundo
LIMIAR_FUNDO = 26            # distância do branco que ainda conta como fundo


def carregar(p):
    return Image.open(p).convert('RGBA')


def tirar_fundo(im):
    """Preenchimento a partir das quatro bordas. Só tira o fundo conectado.

    A cor do fundo é MEDIDA na borda, não presumida branca: a Furrundu veio com
    fundo cinza claro (distância 44 do branco) e um limiar fixo em cima do
    branco deixava passar a imagem inteira."""
    a = np.array(im).astype(np.int16)
    h, w = a.shape[:2]
    borda = np.concatenate([a[0, :, :3], a[-1, :, :3], a[:, 0, :3], a[:, -1, :3]])
    cor = np.median(borda, axis=0)
    dist = np.abs(cor - a[:, :, :3]).max(axis=2)
    claro = dist <= LIMIAR_FUNDO

    visto = np.zeros((h, w), bool)
    fila = deque()
    for x in range(w):
        for y in (0, h - 1):
            if claro[y, x] and not visto[y, x]:
                visto[y, x] = True; fila.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if claro[y, x] and not visto[y, x]:
                visto[y, x] = True; fila.append((y, x))

    while fila:
        y, x = fila.popleft()
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny, nx = y+dy, x+dx
            if 0 <= ny < h and 0 <= nx < w and claro[ny, nx] and not visto[ny, nx]:
                visto[ny, nx] = True; fila.append((ny, nx))

    out = np.array(im)
    out[visto, 3] = 0
    return Image.fromarray(out)


def caixa_alfa(im, limiar=8):
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > limiar)
    if len(ys) == 0:
        return None
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def preparar(p):
    """Devolve a imagem recortada rente à figura, ainda em tamanho grande."""
    im = carregar(p)
    opaca = np.array(im)[:, :, 3].min() == 255

    if opaca:
        # reduz antes de preencher: o preenchimento em 1254x1254 é lento e o
        # resultado final é pequeno de qualquer jeito
        k = TRABALHO / im.height
        im = im.resize((max(1, round(im.width * k)), TRABALHO), Image.LANCZOS)
        im = tirar_fundo(im)

    cx = caixa_alfa(im)
    if cx is None:
        return None
    return im.crop(cx)


def main():
    arquivos = {}
    for p in sorted(glob.glob(os.path.join(ORIGEM, '*.png'))):
        b = os.path.basename(p)
        if b.startswith('._'):
            continue
        pid, _, pose = b[:-4].partition('-')
        pose = POSE.get(pose)
        if pose:
            arquivos.setdefault(pid, {})[pose] = p

    os.makedirs(DESTINO, exist_ok=True)
    print('%-13s %-11s %-11s %s' % ('personagem', 'pose', 'final', 'KB'))

    for pid in sorted(arquivos):
        poses = arquivos[pid]
        prontas = {}
        for pose, p in poses.items():
            im = preparar(p)
            if im is None:
                print('%-13s %-11s SEM FIGURA' % (pid, pose)); continue
            prontas[pose] = im

        ref = prontas.get('corrida-1') or prontas.get('corrida-2')
        if not ref:
            print('%-13s sem pose de corrida: não dá para achar a escala' % pid); continue
        k = ALTURA_CORRIDA_2X / ref.height

        for pose, im in sorted(prontas.items()):
            w = max(1, round(im.width * k))
            h = max(1, round(im.height * k))
            fim = im.resize((w, h), Image.LANCZOS)
            # quantiza mantendo o alfa: PNG de 8 bits com paleta pesa ~1/4
            fim = fim.quantize(colors=160, method=Image.FASTOCTREE).convert('RGBA')
            saida = os.path.join(DESTINO, '%s-%s.png' % (pid, pose))
            fim.save(saida, optimize=True)
            print('%-13s %-11s %3dx%-7d %.1f' % (pid, pose, w, h, os.path.getsize(saida)/1024))


if __name__ == '__main__':
    main()
