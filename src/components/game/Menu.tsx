import { useEffect, useState } from "react";
import { BOT_NAMES, TEAM_COLORS } from "@/game/config";
import { useGame } from "@/game/store";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function Menu() {
  const screen = useGame((s) => s.screen);
  const setScreen = useGame((s) => s.setScreen);
  const playerName = useGame((s) => s.playerName);
  const setName = useGame((s) => s.setName);
  const roomCode = useGame((s) => s.roomCode);
  const setRoomCode = useGame((s) => s.setRoomCode);
  const startMatch = useGame((s) => s.startMatch);
  const sfxVolume = useGame((s) => s.sfxVolume);
  const musicVolume = useGame((s) => s.musicVolume);
  const quality = useGame((s) => s.quality);
  const sensitivity = useGame((s) => s.sensitivity);
  const vibration = useGame((s) => s.vibration);
  const settings = { sfxVolume, musicVolume, quality, sensitivity, vibration };
  const setSetting = useGame((s) => s.setSetting);

  const [nameOpen, setNameOpen] = useState(false);
  const [draft, setDraft] = useState(playerName);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nucleo:name");
      if (saved && saved !== useGame.getState().playerName) setName(saved);
    } catch {
      /* ignora */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openLobby = () => {
    setRoomCode(randomCode());
    setScreen("lobby");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-menu-gradient px-4 py-10 font-display text-foreground">
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-primary/25 blur-3xl" />

      <div className="relative mx-auto w-full max-w-md">
        {screen === "menu" && (
          <div className="text-center">
            <h1 className="text-5xl font-black leading-none tracking-tight text-foreground drop-shadow-lg sm:text-6xl">
              NÚCLEO
              <span className="block text-accent">DE FOGO</span>
            </h1>
            <p className="mt-3 text-sm font-bold uppercase tracking-[0.25em] text-muted-foreground">
              Sobreviva. Evolua. Destrua.
            </p>
            <p className="mt-6 rounded-xl bg-card/70 px-4 py-2 text-sm">
              Jogando como <span className="font-black text-accent">{playerName}</span>
            </p>

            <div className="mt-6 space-y-3">
              <button className="btn-arcade w-full text-lg" onClick={startMatch}>
                JOGAR
              </button>
              <button className="btn-arcade-ghost w-full" onClick={openLobby}>
                CRIAR SALA
              </button>
              <button className="btn-arcade-ghost w-full" onClick={() => setJoinOpen(true)}>
                ENTRAR NA SALA
              </button>
              <button className="btn-arcade-ghost w-full" onClick={() => setNameOpen(true)}>
                MUDAR NOME
              </button>
              <button className="btn-arcade-ghost w-full" onClick={() => setScreen("howto")}>
                COMO JOGAR
              </button>
              <button className="btn-arcade-ghost w-full" onClick={() => setScreen("settings")}>
                CONFIGURAÇÕES
              </button>
            </div>
          </div>
        )}

        {screen === "lobby" && (
          <div className="rounded-2xl bg-card/85 p-5 shadow-2xl">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Sua sala</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-3xl font-black tracking-[0.3em] text-accent">{roomCode}</span>
              <button
                className="btn-arcade-sm"
                onClick={() => {
                  navigator.clipboard?.writeText(roomCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "COPIADO" : "COPIAR"}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Compartilhe este código com seus amigos. Enquanto o jogo online não estiver ligado, as
              vagas são preenchidas por bots.
            </p>

            <ul className="mt-4 space-y-1.5">
              {Array.from({ length: 8 }, (_, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2 font-bold">
                    <span style={{ color: TEAM_COLORS[i] }}>●</span>
                    {i === 0 ? playerName : BOT_NAMES[i % BOT_NAMES.length]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {i === 0 ? "ANFITRIÃO" : "BOT"}
                  </span>
                </li>
              ))}
            </ul>

            <button className="btn-arcade mt-5 w-full" onClick={startMatch}>
              INICIAR PARTIDA
            </button>
            <button className="btn-arcade-ghost mt-2 w-full" onClick={() => setScreen("menu")}>
              VOLTAR
            </button>
          </div>
        )}

        {screen === "howto" && (
          <div className="space-y-4 rounded-2xl bg-card/85 p-5 text-sm shadow-2xl">
            <h2 className="text-2xl font-black">COMO JOGAR</h2>
            <Section title="OBJETIVO">
              Destrua os núcleos inimigos e seja o último sobrevivente entre 8 participantes.
            </Section>
            <Section title="NÚCLEO">
              Enquanto seu núcleo estiver vivo você renasce. Sem núcleo, a próxima morte elimina você.
            </Section>
            <Section title="RECURSOS">
              Colete ferro nas ilhas e diamantes no centro do mapa para comprar armas e melhorias.
            </Section>
            <Section title="CELULAR">
              Analógico à esquerda para andar, arraste na metade direita para olhar, botão vermelho
              para atirar e o botão de loja aparece perto do comerciante.
            </Section>
            <Section title="PC">
              W A S D para andar, mouse para olhar, clique para atirar, R recarrega, E fala com o
              comerciante e ESC abre a pausa.
            </Section>
            <button className="btn-arcade-ghost w-full" onClick={() => setScreen("menu")}>
              VOLTAR
            </button>
          </div>
        )}

        {screen === "settings" && (
          <div className="space-y-4 rounded-2xl bg-card/85 p-5 text-sm shadow-2xl">
            <h2 className="text-2xl font-black">CONFIGURAÇÕES</h2>
            <Slider
              label={`Volume dos efeitos: ${Math.round(settings.sfxVolume * 100)}%`}
              value={settings.sfxVolume}
              onChange={(v) => setSetting("sfxVolume", v)}
            />
            <Slider
              label={`Volume da música: ${Math.round(settings.musicVolume * 100)}%`}
              value={settings.musicVolume}
              onChange={(v) => setSetting("musicVolume", v)}
            />
            <Slider
              label={`Sensibilidade da câmera: ${settings.sensitivity.toFixed(1)}x`}
              value={settings.sensitivity / 3}
              onChange={(v) => setSetting("sensitivity", Math.max(0.2, v * 3))}
            />
            <div>
              <p className="mb-1 font-bold">Qualidade gráfica</p>
              <div className="flex gap-2">
                {(["baixa", "media", "alta"] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => setSetting("quality", q)}
                    className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold uppercase ${
                      settings.quality === q
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
              <span className="font-bold">Vibração no celular</span>
              <input
                type="checkbox"
                checked={settings.vibration}
                onChange={(e) => setSetting("vibration", e.target.checked)}
              />
            </label>
            <button className="btn-arcade-ghost w-full" onClick={() => setScreen("menu")}>
              VOLTAR
            </button>
          </div>
        )}
      </div>

      {nameOpen && (
        <Modal onClose={() => setNameOpen(false)}>
          <h3 className="text-xl font-black">MUDAR NOME</h3>
          <input
            className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-base"
            maxLength={14}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Seu nome"
          />
          <div className="mt-4 flex gap-2">
            <button
              className="btn-arcade flex-1"
              onClick={() => {
                const v = draft.trim();
                if (!v) return;
                setName(v);
                setNameOpen(false);
              }}
            >
              SALVAR
            </button>
            <button className="btn-arcade-ghost flex-1" onClick={() => setNameOpen(false)}>
              CANCELAR
            </button>
          </div>
        </Modal>
      )}

      {joinOpen && (
        <Modal onClose={() => setJoinOpen(false)}>
          <h3 className="text-xl font-black">ENTRAR NA SALA</h3>
          <input
            className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-center text-lg font-black uppercase tracking-[0.3em]"
            maxLength={6}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="A7K92X"
          />
          {joinError && <p className="mt-2 text-sm font-bold text-destructive">{joinError}</p>}
          <div className="mt-4 flex gap-2">
            <button
              className="btn-arcade flex-1"
              onClick={() => {
                if (joinCode.length < 4) setJoinError("Sala não encontrada.");
                else {
                  setJoinError("");
                  setRoomCode(joinCode);
                  setJoinOpen(false);
                  setScreen("lobby");
                }
              }}
            >
              ENTRAR
            </button>
            <button className="btn-arcade-ghost flex-1" onClick={() => setJoinOpen(false)}>
              CANCELAR
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-black text-accent">{title}</p>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="mb-1 font-bold">{label}</p>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
