# Milk Down atualizado

Implementação baseada na referência fornecida: milkshake sempre na mão, Abraço Down e Gorfinho de Morango, mais a passiva Amoroso descrita na imagem.

- Abraço Down: dano-base 20 (11 após o multiplicador geral de dano), corações e 40% de lentidão por 2 segundos. Pode ser defendido ou esquivado pulando no início do abraço. Sem arremesso ao chão.
- Gorfinho de Morango: preparação de 0,25 segundo para tomar um gole, jato de morango com dano-base 14 (7,7 após o multiplicador geral), um acerto por jato e congelamento de 0,5 segundo. Defesa e salto podem evitar o acerto. Interrompe investidas e ações durante o congelamento.
- Amoroso: após um golpe acertar, concede 15% de redução de dano recebido e regenera 2 HP/s por 3 segundos. Acertos renovam a duração sem acumular bônus. Não excede 100 HP nem revive.

Os valores de lentidão, defesa e regeneração foram escolhas iniciais de equilíbrio, pois não foram especificados numericamente na referência. O congelamento segue os 0,5 segundos pedidos.

Arte: 12 poses-chave geradas pela ferramenta integrada image_gen usando referencia.png como referência de identidade, normalizadas em telas de 768 × 768, em WebP com transparência. Alguns quadros são reutilizados nos ciclos; não são oito desenhos únicos por movimento. Os sprites originais permanecem preservados no projeto e nos backups.

Prompts: preservar o rosto e tipo físico do homem adulto da referência, cabelo grisalho curto, camisa tropical roxa SAY, bermuda azul-marinho, meias brancas e tênis preto/branco; manter milkshake de morango na mão em todas as poses; câmera em três quartos voltada à direita, sem cenário ou legendas, transparência real. Folhas 2 × 2: (1) parado, andar, correr e socar; (2) abraço, cuspir, defesa e chute; (3) salto, agachamento, dano e queda.

Testes: ambos os slots de jogador, acerto e bloqueio dos especiais, esquiva e alcance, duração exata do congelamento, imobilização, lentidão, defesa, regeneração, limites e reset; regressões de Pedro/Adélia e defesa geral.

