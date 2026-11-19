# Arena Milkshake

O jogo é servido pelo [Render](https://arena-milkshake.onrender.com/?combat=2) a partir da branch `main` do [repositório no GitHub](https://github.com/petalomeu/arena-milkshake).

## Estrutura local

| Caminho | Função |
| --- | --- |
| `game/index.html` | Tela de seleção, controles e interface em HTML e CSS. |
| `game/game.js` | Luta, CPU, desenho no Canvas 2D, especiais e sincronização online em JavaScript. |
| `game/combat-v2.js` | Regras de golpes, colisões e energia do Combate 2.0. |
| `game/combat-audio.js` | Efeitos de combate e ambiente via Web Audio. |
| `game/combat-art.js` e `game/combat-stance-art.js` | Coordenadas dos quadros nas folhas de sprites. |
| `game/frames/` | Sprites, retratos e quadros de animação. As arenas e os áudios ficam em `game/`. |
| `server.mjs` | Servidor HTTP em Node.js 24. Serve o jogo e encaminha os pedidos de sala. |
| `realtime.mjs` | Conexões WebSocket autenticadas, encaminhamento imediato dos comandos e manutenção da conexão. |
| `worker/index.js` | Protocolo de criação e entrada nas salas, troca de mensagens e controle de sessão. |
| `drizzle/0000_rooms.sql` | Tabelas SQLite para salas e mensagens. |
| `render.yaml` e `prepare-assets.mjs` | Configuração do serviço e extração dos recursos compactados no build público. |

## Duelo online

O anfitrião simula a luta. Após criar ou entrar na sala pela API HTTP, os navegadores abrem uma conexão WebSocket autenticada. Os comandos são encaminhados imediatamente e o anfitrião envia o estado até 30 vezes por segundo. O tráfego da luta passa diretamente entre as conexões, e o SQLite em memória mantém o cadastro das salas. As salas expiram após duas horas e encerram quando um jogador desconecta.

O indicador mede o tempo de ida e volta até o outro jogador através do servidor. A oscilação usa a variação entre essas amostras. Esse ping inclui o caminho dos dois jogadores. A simulação atual usa previsão visual do convidado e confirmação pelo anfitrião.

## Executar localmente

Na pasta do projeto, execute `npm ci` e depois `node server.mjs` com Node.js 24. Abra [Combate 2.0 local](http://127.0.0.1:4175/?combat=2). A variável `PORT` muda a porta e o endpoint `/healthz` verifica a disponibilidade do servidor. Para LAN, os dois jogadores abrem o IPv4 do PC servidor, por exemplo `http://192.168.1.50:4175/?combat=2`, com acesso permitido pelo firewall na rede privada.
