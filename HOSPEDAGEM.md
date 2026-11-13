# Arena Milkshake — servidor independente

Esta versão inclui o Pedro HD e mantém o protocolo de salas por código. Não precisa de Sites, D1 ou bibliotecas externas. Requer Node.js 24.

## Executar

Execute `node server.mjs`. A porta padrão é 4175; a variável `PORT` configura a porta da hospedagem. O endpoint `/healthz` verifica disponibilidade.

## Render

O arquivo `render.yaml` configura um Web Service Node, com início em `node server.mjs`. O pacote de entrega contém todos os arquivos necessários, sem credenciais ou metadados do repositório. Para publicar pela integração, é necessário conectar uma conta Render e disponibilizar a origem do projeto ao serviço.

O serviço usa uma única instância. As salas são temporárias, expiram após duas horas e são apagadas quando o servidor reinicia. Não são contas de usuário ou dados permanentes. Em um plano que suspenda serviços ociosos, a primeira visita pode precisar aguardar a inicialização.

## Validação

Testados: carregamento da página e do Pedro HD, cache, isolamento dos arquivos públicos, verificação de origem, criação de sala, entrada do segundo jogador, rejeição de entrada duplicada, mensagens nos dois sentidos, validação de sessão, saída com limpeza e reprodução de áudio por faixas de bytes.

Nenhuma publicação permanente nesta hospedagem foi realizada ainda. A conta Render precisa estar conectada. Os testes com túneis temporários Cloudflare e Pinggy foram bloqueados pela rede deste computador.
