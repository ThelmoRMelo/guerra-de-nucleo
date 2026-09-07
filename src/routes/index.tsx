import { createFileRoute } from "@tanstack/react-router";
import { Menu } from "@/components/game/Menu";
import { GameCanvas } from "@/components/game/GameCanvas";
import { useGame } from "@/game/store";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Núcleo de Fogo — Batalha 3D de ilhas e núcleos" },
      {
        name: "description",
        content:
          "Jogo 3D em terceira pessoa: 8 ilhas, 8 participantes, armas de fogo, minérios e destruição de núcleos. Jogue no celular ou no PC.",
      },
      { property: "og:title", content: "Núcleo de Fogo — Batalha 3D de ilhas e núcleos" },
      {
        property: "og:description",
        content:
          "Colete ferro e diamantes, compre armas, destrua os núcleos inimigos e seja o último sobrevivente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const screen = useGame((s) => s.screen);
  const matchId = useGame((s) => s.matchId);

  if (screen === "match") return <GameCanvas key={matchId} />;
  return <Menu />;
}
