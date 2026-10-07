#!/usr/bin/env python3
"""
Gera o panhou-v2-arquivo-unico.html: o jogo inteiro em um arquivo só, com CSS,
JS, sprites, logo e as fontes do design system embutidos.

Serve para testar com dois cliques, sem servidor. Por que existe: abrindo o
index.html direto do disco (file://), o navegador bloqueia a leitura do canvas
e o card de compartilhamento não é gerado. Com tudo em data URI o canvas não é
contaminado e o jogo funciona completo, inclusive offline.

Uso, a partir da raiz do projeto:
    python3 ferramentas/gerar-arquivo-unico.py
"""

import base64
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SAIDA = RAIZ / 'panhou-v2-arquivo-unico.html'
SCRIPTS = ['audio.js', 'sprites.js', 'compartilhar.js', 'ranking.js', 'jogo.js']

# só as variações de fonte que o jogo realmente usa; o resto do DS fica de fora
FONTES_USADAS = {'qanelas-semibold', 'qanelas-heavy', 'barlow-regular', 'barlow-extrabold'}


def b64(caminho: pathlib.Path) -> str:
    return base64.b64encode(caminho.read_bytes()).decode()


def tipografia_embutida() -> str:
    """Lê o typography.css do DS, embute as fontes usadas e descarta as outras."""
    css = (RAIZ / 'DS/tokens/typography.css').read_text(encoding='utf-8')
    blocos = re.split(r'(@font-face\s*\{[^}]*\})', css, flags=re.S)
    saida = []
    for bloco in blocos:
        if not bloco.startswith('@font-face'):
            saida.append(bloco)
            continue
        m = re.search(r'\.\./assets/fonts/([a-z0-9-]+)\.woff2', bloco)
        if not m or m.group(1) not in FONTES_USADAS:
            continue                                   # fonte não usada: some
        arq = RAIZ / 'DS/assets/fonts' / (m.group(1) + '.woff2')
        dados = 'data:font/woff2;base64,' + b64(arq)
        saida.append(re.sub(r'url\("[^"]+"\)', 'url("%s")' % dados, bloco))
    return ''.join(saida)


def sem_medicao(html: str) -> str:
    """Tira o Google Analytics, o Meta Pixel e o noscript deles.

    O arquivo único existe para rodar offline, com dois cliques e zero pedido
    externo. Script de medição é exatamente um pedido externo, e num arquivo
    que circula por e-mail e pendrive ele mediria coisa nenhuma de útil."""
    antes = html
    html = re.sub(r'<!-- ===== Medição =.*?<!-- ===== fim da medição =+ -->',
                  '', html, flags=re.S)
    html = re.sub(r'<noscript><img[^>]*facebook\.com/tr[^>]*></noscript>',
                  '', html, flags=re.S)
    if html == antes:
        print('aviso: não achei o bloco de medição no index.html')
    return html


def main():
    html = (RAIZ / 'index.html').read_text(encoding='utf-8')
    html = sem_medicao(html)
    css = (RAIZ / 'css/estilo.css').read_text(encoding='utf-8')
    js = '\n'.join((RAIZ / 'js' / nome).read_text(encoding='utf-8') for nome in SCRIPTS)

    # sprites viram data URI (o og-* é só prévia de link, não entra no jogo)
    for png in sorted((RAIZ / 'assets/img').glob('*.png')):
        if png.name.startswith('og-'):
            continue
        js = js.replace("'assets/img/%s'" % png.name,
                        "'data:image/png;base64,%s'" % b64(png))
    if "'assets/img/" in js:
        sys.exit('ERRO: sobrou caminho de sprite sem embutir')

    # logo do topo, referenciado direto no HTML
    logo = RAIZ / 'assets/img/logo-pedro-taques.png'
    html = html.replace('src="assets/img/logo-pedro-taques.png"',
                        'src="data:image/png;base64,%s"' % b64(logo))

    # os três <link> de CSS (dois do DS, um da página) viram um <style> só
    ds_cores = (RAIZ / 'DS/tokens/colors.css').read_text(encoding='utf-8')
    tudo_css = ds_cores + '\n' + tipografia_embutida() + '\n' + css

    novo, n = re.subn(
        r'<link rel="stylesheet" href="DS/tokens/colors\.css">.*?'
        r'<link rel="stylesheet" href="css/estilo\.css(?:\?v=\d+)?">',
        lambda _: '<style>\n' + tudo_css + '\n</style>', html, flags=re.S)
    if n != 1:
        sys.exit('ERRO: não achei o bloco de <link> de CSS no index.html')
    html = novo

    # os quatro <script src="..."> viram um bloco só
    padrao = r'(?:\s*<script src="js/[a-z]+\.js(?:\?v=\d+)?"></script>){%d}' % len(SCRIPTS)
    novo, n = re.subn(padrao, lambda _: '\n<script>\n' + js + '\n</script>', html)
    if n != 1:
        sys.exit('ERRO: não achei os %d <script> do jogo no index.html' % len(SCRIPTS))
    html = novo

    SAIDA.write_text(html, encoding='utf-8')
    print('gerado: %s (%d KB)' % (SAIDA.name, len(html.encode('utf-8')) // 1024))


if __name__ == '__main__':
    main()
