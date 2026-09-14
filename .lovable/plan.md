# Corrigir os oito acessos da Ilha Pirata

## Objetivo
Manter o navio central fechado e murado, abrindo somente oito portais reais, exatamente alinhados às oito pontes existentes.

## Alterações
- Derivar os pontos de encontro das pontes com o retângulo atual do navio usando os mesmos ângulos de `ISLANDS`.
- Substituir os trechos manuais e desalinhados da muralha por segmentos sólidos que terminam nas laterais de cada portal.
- Montar uma moldura de madeira em cada acesso, com pilares laterais, travessa superior e tochas, mantendo o centro realmente vazio.
- Gerar os colisores da muralha a partir dos mesmos limites e vãos usados pela geometria visual, impedindo passagem fora dos portais e liberando os oito corredores.
- Preservar as caveiras e obstáculos internos existentes.

## Arquivos
- `src/game/world.ts`: medidas compartilhadas, cálculo dos oito acessos e colisores da muralha.
- `src/components/game/World3D.tsx`: geometria visual da muralha e dos portais baseada nesses mesmos dados.

## Validação
- Conferir numericamente o alinhamento das oito direções e a continuidade dos segmentos sólidos.
- Executar TypeScript e verificar a compilação automática.
- Abrir o mapa pirata no navegador e inspecionar a geometria renderizada sem erros.
