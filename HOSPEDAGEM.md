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
| `game/peer-transport.js` | Negociação WebRTC e canais diretos de comandos e estados, com retorno ao WebSocket. |
| `worker/index.js` | Protocolo de criação e entrada nas salas, troca de mensagens e controle de sessão. |
| `drizzle/0000_rooms.sql` | Tabelas SQLite para salas e mensagens. |
| `render.yaml` e `prepare-assets.mjs` | Configuração do serviço e extração dos recursos compactados no build público. |

## Duelo online

O anfitrião simula a luta. Após criar ou entrar na sala pela API HTTP, os navegadores abrem uma conexão WebSocket autenticada e negociam uma conexão WebRTC direta. O STUN público da Cloudflare descobre endereços para essa negociação; não recebe os comandos do jogo. Não há captura de câmera ou microfone.

Quando o indicador mostra **Direto**, comandos e áudio usam um canal confiável e ordenado entre os jogadores. Estados são enviados até 30 vezes por segundo por um canal sem retransmissões: estados antigos ou de outro round são descartados. Cada comando tem uma sequência, confirmação e reenvio; os comandos recebidos fora de ordem aguardam os anteriores. A confirmação associa a animação prevista ao mesmo golpe e impede reiniciar a animação na chegada da resposta.

Se a conexão direta falhar, o indicador mostra **Via servidor** e a partida continua pelo WebSocket. Não foi contratado um serviço TURN: algumas combinações de NAT/firewall exigirão o caminho pelo servidor. O servidor atual fica na Virgínia; nesse caminho o ping pode continuar alto para jogadores no Brasil. A meta de 70–100 ms depende da distância, das operadoras e de conseguir estabelecer o caminho direto.

O SQLite em memória mantém o cadastro das salas. Elas expiram após duas horas e encerram quando um jogador desconecta.

O indicador mede o tempo real de ida e volta até o outro jogador pelo caminho em uso. A oscilação usa a variação entre essas amostras. A simulação usa previsão visual do convidado e confirmação pelo anfitrião; não implementa rollback completo. Um teste com dois navegadores no mesmo computador verifica o transporte, mas não comprova o ping entre duas casas.

## Executar localmente

Na pasta do projeto, execute `npm ci` e depois `node server.mjs` com Node.js 24. Abra [Combate 2.0 local](http://127.0.0.1:4175/?combat=2). A variável `PORT` muda a porta e o endpoint `/healthz` verifica a disponibilidade do servidor. Para LAN, os dois jogadores abrem o IPv4 do PC servidor, por exemplo `http://192.168.1.50:4175/?combat=2`, com acesso permitido pelo firewall na rede privada.
