# Jogo das Meninas

Corrida infinita com os sete pets de casa: Sig, Queijadinha, Furrundu, Lessa,
Luck, Nina e Amora. HTML, CSS e JavaScript puros, sem framework e sem build.
O ranking é um PHP que grava JSON em disco, sem banco.

Publicado em **https://www.eusoumarcus.com.br/jogo-das-meninas/**

## Pastas

| pasta | o que é |
|---|---|
| `index.html`, `css/`, `js/`, `assets/img/`, `api/` | o jogo. É isto que sobe para o servidor |
| `assets-originais/` | os 35 PNGs como o ilustrador entregou, antes do recorte |
| `ferramentas/` | scripts de apoio, não vão para o servidor |
| `ESPEC-ARTE.md` | o briefing que o ilustrador recebe |
| `CONTEXTO.md` | como o jogo funciona por dentro. Leia antes de mexer |

## Publicar

Copiar `index.html`, `css/`, `js/`, `assets/` e `api/` para
`public_html/jogo-das-meninas`.

Duas regras que já custaram caro:

1. **Nunca sobrescrever `api/config.php` no servidor.** Ele guarda o segredo e a
   senha preenchidos lá. O que entra no repositório é o `api/config.exemplo.php`.
2. **Nunca subir `api/dados/` por cima.** É onde o ranking de verdade está.

O `api/dados/.htaccess` é arquivo oculto e cliente de FTP esconde por padrão.
Sem ele o JSON do ranking fica aberto no navegador.
