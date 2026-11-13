# Arena Milkshake

Jogo de luta com Pedro HD, modo contra a máquina e salas online.

Requer Node.js 24. Execute `node prepare-assets.mjs` uma vez e depois `node server.mjs`.

Os recursos binários do jogo estão compactados em `assets/`; o script de preparação os restaura em `game/`. O código JavaScript e HTML permanece editável em `game/`.

As salas são temporárias e são apagadas ao reiniciar o servidor.
