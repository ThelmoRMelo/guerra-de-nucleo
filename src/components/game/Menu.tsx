import { useEffect, useRef, useState } from "react";
import { BOT_NAMES, TEAM_COLORS } from "@/game/config";
import { useGame } from "@/game/store";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

type RoomSettings = {
  coreRestorationEnabled: boolean;
  fillEmptySlotsWithBots: boolean;
  botDifficulty: "facil" | "normal" | "dificil";
};

type LocalRoomState = {
  status: "lobby" | "started";
  settings: RoomSettings;
};

const roomStorageKey = (code: string) => `guerra-de-nucleo:room:${code}`;

function readLocalRoom(code: string): LocalRoomState | null {
  try {
    const raw = localStorage.getItem(roomStorageKey(code));
    return raw ? (JSON.parse(raw) as LocalRoomState) : null;
  } catch {
    return null;
  }
}

function saveLocalRoom(code: string, state: LocalRoomState) {
  try {
    localStorage.setItem(roomStorageKey(code), JSON.stringify(state));
  } catch {
    /* armazenamento local indisponível */
  }
}

export function Menu() {
  const screen = useGame((s) => s.screen);
  const setScreen = useGame((s) => s.setScreen);
  const playerName = useGame((s) => s.playerName);
  const setName = useGame((s) => s.setName);
  const teamColor = useGame((s) => s.teamColor);
  const setTeamColor = useGame((s) => s.setTeamColor);
  const botDifficulty = useGame((s) => s.botDifficulty);
  const setBotDifficulty = useGame((s) => s.setBotDifficulty);
  const coreRestorationEnabled = useGame((s) => s.coreRestorationEnabled);
  const setCoreRestorationEnabled = useGame((s) => s.setCoreRestorationEnabled);
  const fillEmptySlotsWithBots = useGame((s) => s.fillEmptySlotsWithBots);
  const setFillEmptySlotsWithBots = useGame((s) => s.setFillEmptySlotsWithBots);
  const isRoomHost = useGame((s) => s.isRoomHost);
  const setIsRoomHost = useGame((s) => s.setIsRoomHost);
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
  const roomChannel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nucleo:name");
      if (saved && saved !== useGame.getState().playerName) setName(saved);
    } catch {
      /* ignora */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincronização do lobby entre abas/janelas da mesma origem. O visitante não
  // inicia localmente: ele recebe a ordem e as regras definidas pelo anfitrião.
  useEffect(() => {
    if (!roomCode || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(`guerra-de-nucleo:${roomCode}`);
    roomChannel.current = channel;
    const startAsGuest = (settings: RoomSettings) => {
      if (useGame.getState().isRoomHost) return;
      useGame.setState({
        coreRestorationEnabled: settings.coreRestorationEnabled,
        fillEmptySlotsWithBots: settings.fillEmptySlotsWithBots,
        botDifficulty: settings.botDifficulty,
      });
      useGame.getState().startMatch();
    };
    channel.onmessage = (event: MessageEvent<{ type?: string; settings?: RoomSettings }>) => {
      if (event.data.type === "START_MATCH" && event.data.settings) startAsGuest(event.data.settings);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== roomStorageKey(roomCode) || !event.newValue) return;
      try {
        const room = JSON.parse(event.newValue) as LocalRoomState;
        if (room.status === "started") startAsGuest(room.settings);
      } catch {
        /* estado inválido é ignorado */
      }
    };
    window.addEventListener("storage", onStorage);
    const room = readLocalRoom(roomCode);
    if (!isRoomHost && room?.status === "started") startAsGuest(room.settings);
    return () => {
      if (roomChannel.current === channel) roomChannel.current = null;
      channel.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [roomCode, isRoomHost]);

  const openLobby = () => {
    const code = randomCode();
    saveLocalRoom(code, {
      status: "lobby",
      settings: { coreRestorationEnabled, fillEmptySlotsWithBots, botDifficulty },
    });
    setRoomCode(code);
    setIsRoomHost(true);
    setScreen("lobby");
  };

  const startRoomMatch = () => {
    if (!isRoomHost) return;
    const settings = { coreRestorationEnabled, fillEmptySlotsWithBots, botDifficulty };
    saveLocalRoom(roomCode, { status: "started", settings });
    roomChannel.current?.postMessage({ type: "START_MATCH", settings });
    startMatch();
  };

  return (
    <div
      className="relative min-h-[100dvh] w-full overflow-x-hidden overflow-y-auto bg-menu-gradient px-4 pt-10 font-display text-foreground"
      style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-primary/25 blur-3xl" />

      <div className="relative mx-auto w-full max-w-md">
        {screen === "menu" && (
          <div className="text-center">
            <h1 className="text-5xl font-black leading-none tracking-tight text-foreground drop-shadow-lg sm:text-6xl">
              GUERRA
              <span className="block text-accent">DE NÚCLEO</span>
            </h1>
            <p className="mt-3 text-sm font-bold uppercase tracking-[0.25em] text-muted-foreground">
              Sobreviva. Evolua. Destrua.
            </p>
            <p className="mt-6 rounded-xl bg-card/70 px-4 py-2 text-sm">
              Jogando como <span className="font-black text-accent">{playerName}</span>
            </p>
            <div className="mt-4 rounded-xl bg-card/70 p-3 text-left">
              <p className="text-center text-xs font-black uppercase tracking-widest text-muted-foreground">
                Cor da equipe
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {TEAM_COLORS.map((color, i) => {
                  const selected = color === teamColor;
                  return (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Escolher cor ${i + 1}`}
                      aria-pressed={selected}
                      onClick={() => setTeamColor(color)}
                      className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-110 ${
                        selected ? "scale-110 border-white ring-2 ring-accent" : "border-black/30"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  );
                })}
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Se um bot já usa esta cor, ele recebe a sua cor anterior.
              </p>
            </div>
            <div className="mt-3 rounded-xl bg-card/70 p-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Dificuldade dos bots
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(
                  [
                    ["facil", "FÁCIL"],
                    ["normal", "NORMAL"],
                    ["dificil", "DIFÍCIL"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBotDifficulty(value)}
                    className={`rounded-lg px-2 py-2 text-xs font-black ${
                      botDifficulty === value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Define a reação, mira, alcance de visão e decisões dos bots nesta partida.
              </p>
            </div>

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
              O anfitrião controla o início da partida e as regras da sala.
            </p>

            <div className="mt-4 rounded-xl bg-muted/60 p-3">
              <p className="text-sm font-black">RESTAURAÇÃO DE NÚCLEO</p>
              {isRoomHost ? (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Você define se jogadores humanos podem restaurar o núcleo até duas vezes em qualquer comerciante.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      className={`rounded-lg px-3 py-2 text-xs font-black ${
                        coreRestorationEnabled ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                      }`}
                      onClick={() => setCoreRestorationEnabled(true)}
                    >
                      ON
                    </button>
                    <button
                      className={`rounded-lg px-3 py-2 text-xs font-black ${
                        !coreRestorationEnabled ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                      }`}
                      onClick={() => setCoreRestorationEnabled(false)}
                    >
                      OFF
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Regra definida pelo anfitrião: {coreRestorationEnabled ? "ON" : "OFF"}
                </p>
              )}
            </div>

            <div className="mt-3 rounded-xl bg-muted/60 p-3">
              <p className="text-sm font-black">PREENCHER VAGAS COM BOTS</p>
              {isRoomHost ? (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ON completa as vagas restantes com bots. OFF deixa apenas os jogadores humanos da sala.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      className={`rounded-lg px-3 py-2 text-xs font-black ${
                        fillEmptySlotsWithBots ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                      }`}
                      onClick={() => setFillEmptySlotsWithBots(true)}
                    >
                      ON
                    </button>
                    <button
                      className={`rounded-lg px-3 py-2 text-xs font-black ${
                        !fillEmptySlotsWithBots ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                      }`}
                      onClick={() => setFillEmptySlotsWithBots(false)}
                    >
                      OFF
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Regra definida pelo anfitrião: {fillEmptySlotsWithBots ? "ON" : "OFF"}
                </p>
              )}
            </div>

            <ul className="mt-4 space-y-1.5">
              {Array.from({ length: fillEmptySlotsWithBots ? 8 : 1 }, (_, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2 font-bold">
                    <span style={{ color: lobbyColor(i, teamColor) }}>●</span>
                    {i === 0 ? playerName : BOT_NAMES[i % BOT_NAMES.length]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {i === 0 ? "ANFITRIÃO" : "BOT"}
                  </span>
                </li>
              ))}
            </ul>

            {isRoomHost ? (
              <button className="btn-arcade mt-5 w-full" onClick={startRoomMatch}>
                INICIAR PARTIDA
              </button>
            ) : (
              <button className="btn-arcade mt-5 w-full opacity-60" disabled>
                AGUARDANDO O ANFITRIÃO…
              </button>
            )}
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
                  setIsRoomHost(false);
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

function lobbyColor(index: number, selectedColor: string) {
  if (index === 0) return selectedColor;
  return TEAM_COLORS[index] === selectedColor ? TEAM_COLORS[0]! : TEAM_COLORS[index]!;
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
