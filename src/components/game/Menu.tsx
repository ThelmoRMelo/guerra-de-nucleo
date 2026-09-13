import { useEffect, useRef, useState } from "react";
import { Repeat2 } from "lucide-react";
import { Canvas, useThree } from "@react-three/fiber";
import { World3D } from "./World3D";
import { SKINS, TEAM_COLORS } from "@/game/config";
import { useGame } from "@/game/store";
import { useRoomSync } from "@/hooks/useRoomSync";
import {
  createRoom,
  fetchRoom,
  fetchRoomPlayers,
  getLocalPlayerId,
  joinRoom,
  leaveRoom,
  roomErrorMessage,
  startRoomMatch,
  updateRoomPlayerColor,
  updateRoomSettings,
} from "@/lib/room";

export function Menu() {
  const screen = useGame((s) => s.screen);
  const setScreen = useGame((s) => s.setScreen);
  const playerName = useGame((s) => s.playerName);
  const setName = useGame((s) => s.setName);
  const teamColor = useGame((s) => s.teamColor);
  const setTeamColor = useGame((s) => s.setTeamColor);
  const playerSkin = useGame((s) => s.playerSkin);
  const setPlayerSkin = useGame((s) => s.setPlayerSkin);
  const botDifficulty = useGame((s) => s.botDifficulty);
  const setBotDifficulty = useGame((s) => s.setBotDifficulty);
  const coreRestorationEnabled = useGame((s) => s.coreRestorationEnabled);
  const setCoreRestorationEnabled = useGame((s) => s.setCoreRestorationEnabled);
  const fillEmptySlotsWithBots = useGame((s) => s.fillEmptySlotsWithBots);
  const setFillEmptySlotsWithBots = useGame((s) => s.setFillEmptySlotsWithBots);
  const teamMode = useGame((s) => s.teamMode);
  const setTeamMode = useGame((s) => s.setTeamMode);
  const selectedMap = useGame((s) => s.selectedMap);
  const setSelectedMap = useGame((s) => s.setSelectedMap);
  const isRoomHost = useGame((s) => s.isRoomHost);
  const setIsRoomHost = useGame((s) => s.setIsRoomHost);
  const roomCode = useGame((s) => s.roomCode);
  const setRoomCode = useGame((s) => s.setRoomCode);
  const startMatch = useGame((s) => s.startMatch);
  const setMatchPlayers = useGame((s) => s.setMatchPlayers);
  const sfxVolume = useGame((s) => s.sfxVolume);
  const musicVolume = useGame((s) => s.musicVolume);
  const quality = useGame((s) => s.quality);
  const sensitivity = useGame((s) => s.sensitivity);
  const vibration = useGame((s) => s.vibration);
  const settings = { sfxVolume, musicVolume, quality, sensitivity, vibration };
  const setSetting = useGame((s) => s.setSetting);
  const superPlayerUnlocked = useGame((s) => s.superPlayerUnlocked);
  const unlockSuperPlayer = useGame((s) => s.unlockSuperPlayer);
  const godMode = useGame((s) => s.godMode);
  const setGodMode = useGame((s) => s.setGodMode);
  const coreShieldMode = useGame((s) => s.coreShieldMode);
  const setCoreShieldMode = useGame((s) => s.setCoreShieldMode);
  const infiniteDiamondsMode = useGame((s) => s.infiniteDiamondsMode);
  const setInfiniteDiamondsMode = useGame((s) => s.setInfiniteDiamondsMode);
  const superSpeedMode = useGame((s) => s.superSpeedMode);
  const setSuperSpeedMode = useGame((s) => s.setSuperSpeedMode);
  const guidedAimMode = useGame((s) => s.guidedAimMode);
  const setGuidedAimMode = useGame((s) => s.setGuidedAimMode);

  const [nameOpen, setNameOpen] = useState(false);
  const [draft, setDraft] = useState(playerName);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinColor, setJoinColor] = useState<string | null>(null);
  const [joinOccupiedColors, setJoinOccupiedColors] = useState<string[]>([]);
  const [joinTeamMode, setJoinTeamMode] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lobbyError, setLobbyError] = useState("");
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [superPlayerOpen, setSuperPlayerOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const settingsTitlePresses = useRef({ count: 0, lastAt: 0 });

  const inLobby = screen === "lobby";
  const { room, players, connection, notice } = useRoomSync(roomCode, inLobby);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nucleo:name");
      if (saved && saved !== useGame.getState().playerName) setName(saved);
    } catch {
      /* ignora */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinOccupiedColors([]);
      return;
    }
    void Promise.all([fetchRoomPlayers(code), fetchRoom(code)]).then(([roomPlayers, room]) => {
      setJoinTeamMode(Boolean(room?.team_mode));
      setJoinOccupiedColors(
        TEAM_COLORS.filter((color) => roomPlayers.filter((player) => player.player_id !== getLocalPlayerId() && player.color === color).length >= (room?.team_mode ? 2 : 1)),
      );
    });
  }, [joinCode]);

  const openLobby = async () => {
    setBusy(true);
    setLobbyError("");
    const res = await createRoom({
      hostId: getLocalPlayerId(),
      name: playerName,
      color: teamColor,
      botDifficulty,
      fillWithBots: fillEmptySlotsWithBots,
      coreRestoration: coreRestorationEnabled,
    });
    setBusy(false);
    if (!res.ok) {
      setLobbyError(roomErrorMessage(res.error));
      return;
    }
    setRoomCode(res.code);
    setIsRoomHost(true);
    setScreen("lobby");
  };

  const doJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinError("Digite o código de 6 caracteres.");
      return;
    }
    if (!joinColor) {
      setJoinError("Escolha uma cor de equipe antes de entrar.");
      return;
    }
    setBusy(true);
    const res = await joinRoom(code, getLocalPlayerId(), playerName, joinColor);
    setBusy(false);
    if (!res.ok) {
      setJoinError(roomErrorMessage(res.error));
      return;
    }
    setJoinError("");
    setTeamColor(res.color ?? joinColor);
    setRoomCode(code);
    setIsRoomHost(false);
    setJoinOpen(false);
    setScreen("lobby");
  };

  const pushSettings = (next: {
    botDifficulty?: typeof botDifficulty;
    fillWithBots?: boolean;
    coreRestoration?: boolean;
    teamMode?: boolean;
  }) => {
    if (!isRoomHost || !roomCode) return;
    void updateRoomSettings(roomCode, getLocalPlayerId(), {
      botDifficulty: next.botDifficulty ?? botDifficulty,
      fillWithBots: next.fillWithBots ?? fillEmptySlotsWithBots,
      coreRestoration: next.coreRestoration ?? coreRestorationEnabled,
      teamMode: next.teamMode ?? teamMode,
    });
  };

  const startRoom = async () => {
    if (!isRoomHost) return;
    setBusy(true);
    const res = await startRoomMatch(roomCode, getLocalPlayerId());
    setBusy(false);
    if (!res.ok) {
      setLobbyError(roomErrorMessage(res.error));
      return;
    }
    setMatchPlayers(players.map((player) => ({ playerId: player.player_id, name: player.name, color: player.color })));
    startMatch();
  };

  const exitLobby = async () => {
    if (roomCode) await leaveRoom(roomCode, getLocalPlayerId());
    setRoomCode("");
    setIsRoomHost(true);
    setLobbyError("");
    setScreen("menu");
  };

  const humanCount = players.length;
  const slots = fillEmptySlotsWithBots ? 8 : Math.max(humanCount, 1);
  const colorUse = (color: string) => players.filter((player) => player.color === color).length;
  const myPlayerId = getLocalPlayerId();

  const changeLobbyColor = async (color: string) => {
    if (room?.status !== "lobby" || color === teamColor) return;
    setBusy(true);
    const res = await updateRoomPlayerColor(roomCode, myPlayerId, color);
    setBusy(false);
    if (!res.ok) {
      setLobbyError(roomErrorMessage(res.error));
      return;
    }
    setLobbyError("");
    setTeamColor(res.color ?? color);
  };

  const revealSuperPlayer = () => {
    const now = Date.now();
    const presses = settingsTitlePresses.current;
    presses.count = now - presses.lastAt < 4500 ? presses.count + 1 : 1;
    presses.lastAt = now;
    if (presses.count < 10) return;
    presses.count = 0;
    unlockSuperPlayer();
    setSuperPlayerOpen(true);
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
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Skin do personagem</p>
              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {SKINS.map((skin) => (
                  <button
                    key={skin.id}
                    type="button"
                    title={skin.nome}
                    onClick={() => setPlayerSkin(skin.id)}
                    className={`rounded-lg px-1 py-2 text-lg transition-colors ${
                      playerSkin === skin.id ? "bg-primary ring-2 ring-accent" : "bg-muted hover:bg-muted/70"
                    }`}
                  >
                    <span className="block">{skin.emoji}</span>
                    <span className="mt-1 block text-[8px] font-black">{skin.nome}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Skins prontas: cabeça redonda e corpo cilíndrico são preservados.</p>
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

            {lobbyError && (
              <p className="mt-3 rounded-lg bg-destructive/15 px-3 py-2 text-sm font-bold text-destructive">
                {lobbyError}
              </p>
            )}

            <div className="mt-6 space-y-3">
              <button className="btn-arcade w-full text-lg" onClick={() => setMapOpen(true)}>
                JOGAR
              </button>
              <button className="btn-arcade-ghost w-full" disabled={busy} onClick={() => void openLobby()}>
                {busy ? "CRIANDO…" : "CRIAR SALA"}
              </button>
              <button
                className="btn-arcade-ghost w-full"
                onClick={() => {
                  setJoinColor(null);
                  setJoinOccupiedColors([]);
                  setJoinError("");
                  setJoinOpen(true);
                }}
              >
                ENTRAR NA SALA
              </button>
              <button className="btn-arcade-ghost w-full" onClick={() => setNameOpen(true)}>
                MUDAR NOME
              </button>
              <button className="btn-arcade-ghost w-full" onClick={() => setScreen("howto")}>
                COMO JOGAR
              </button>
              <button className="btn-arcade-ghost w-full" onClick={() => setSettingsOpen(true)}>
                CONFIGURAÇÕES
              </button>
            </div>
          </div>
        )}

        {screen === "lobby" && (
          <div className="rounded-2xl bg-card/85 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Sua sala</p>
              <span
                className={`text-xs font-black uppercase ${
                  connection === "online"
                    ? "text-accent"
                    : connection === "conectando"
                      ? "text-muted-foreground"
                      : "text-destructive"
                }`}
              >
                {connection === "online"
                  ? "● AO VIVO"
                  : connection === "conectando"
                    ? "● CONECTANDO"
                    : "● RECONECTANDO"}
              </span>
            </div>
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
              Compartilhe este código: qualquer pessoa, em outro celular ou computador, pode entrar.
            </p>

            {(notice || lobbyError) && (
              <p className="mt-3 rounded-lg bg-destructive/15 px-3 py-2 text-sm font-bold text-destructive">
                {notice || lobbyError}
              </p>
            )}

            <div className="mt-4 rounded-xl bg-muted/60 p-3">
              <div className="flex items-center gap-2">
                <Repeat2 className="h-4 w-4 text-accent" />
                <p className="text-sm font-black">TROCAR DE EQUIPE</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {teamMode
                  ? "Escolha a cor da equipe e a ilha/base onde você vai nascer. Cada equipe tem duas vagas."
                  : "Escolha a cor e a ilha/base onde você vai nascer."}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(teamMode ? TEAM_COLORS.slice(0, 4) : TEAM_COLORS).map((color, index) => {
                  const used = colorUse(color);
                  const capacity = teamMode ? 2 : 1;
                  const selected = color === teamColor;
                  const full = used >= capacity && !selected;
                  return (
                    <button
                      key={color}
                      type="button"
                      disabled={full || room?.status !== "lobby" || busy}
                      aria-label={full ? "Equipe completa" : `Trocar para a equipe ${index + 1}`}
                      onClick={() => void changeLobbyColor(color)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        selected ? "border-accent bg-accent/15 ring-1 ring-accent" : "border-border bg-background/60 hover:bg-background"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-xs font-black">
                        <span className="h-4 w-4 rounded-full border border-white/60" style={{ backgroundColor: color }} />
                        {teamMode ? `EQUIPE ${index + 1}` : `BASE ${index + 1}`}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                        {used}/{capacity} <Repeat2 className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {fillEmptySlotsWithBots ? "Vagas sem pessoas serão preenchidas por bots ao iniciar." : "Vagas sem pessoas ficarão livres."}
              </p>
            </div>

            <div className="mt-4 rounded-xl bg-muted/60 p-3">
              <p className="text-sm font-black">MODO DE JOGO</p>
              {isRoomHost ? (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">Equipe permite duas pessoas por cor, quatro equipes e até 8 participantes.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[false, true].map((enabled) => (
                      <button key={String(enabled)} className={`rounded-lg px-2 py-2 text-xs font-black ${teamMode === enabled ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`} onClick={() => {
                        if (enabled && !TEAM_COLORS.slice(0, 4).includes(teamColor)) {
                          setLobbyError("Para Equipes, escolha uma das quatro cores de equipe acima.");
                          return;
                        }
                        setTeamMode(enabled);
                        pushSettings({ teamMode: enabled });
                      }}>
                        {enabled ? "EQUIPES (2)" : "INDIVIDUAL"}
                      </button>
                    ))}
                  </div>
                </>
              ) : <p className="mt-1 text-xs text-muted-foreground">{teamMode ? "EQUIPES DE 2" : "INDIVIDUAL"}</p>}
            </div>

            <div className="mt-3 rounded-xl bg-muted/60 p-3">
              <p className="text-sm font-black">RESTAURAÇÃO DE NÚCLEO</p>
              {isRoomHost ? (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Você define se jogadores humanos podem restaurar o núcleo até duas vezes em qualquer comerciante.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[true, false].map((on) => (
                      <button
                        key={String(on)}
                        className={`rounded-lg px-3 py-2 text-xs font-black ${
                          coreRestorationEnabled === on
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground"
                        }`}
                        onClick={() => {
                          setCoreRestorationEnabled(on);
                          pushSettings({ coreRestoration: on });
                        }}
                      >
                        {on ? "ON" : "OFF"}
                      </button>
                    ))}
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
                    {[true, false].map((on) => (
                      <button
                        key={String(on)}
                        className={`rounded-lg px-3 py-2 text-xs font-black ${
                          fillEmptySlotsWithBots === on
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground"
                        }`}
                        onClick={() => {
                          setFillEmptySlotsWithBots(on);
                          pushSettings({ fillWithBots: on });
                        }}
                      >
                        {on ? "ON" : "OFF"}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Regra definida pelo anfitrião: {fillEmptySlotsWithBots ? "ON" : "OFF"}
                </p>
              )}
            </div>

            <div className="mt-3 rounded-xl bg-muted/60 p-3">
              <p className="text-sm font-black">DIFICULDADE DOS BOTS</p>
              {isRoomHost ? (
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
                      className={`rounded-lg px-2 py-2 text-xs font-black ${
                        botDifficulty === value
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground"
                      }`}
                      onClick={() => {
                        setBotDifficulty(value);
                        pushSettings({ botDifficulty: value });
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Regra definida pelo anfitrião: {botDifficulty.toUpperCase()}
                </p>
              )}
            </div>

            <p className="mt-4 text-xs font-black uppercase tracking-widest text-muted-foreground">
              Jogadores conectados ({humanCount}/{room?.max_players ?? 8})
            </p>
            <ul className="mt-2 space-y-1.5">
              {players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2 font-bold">
                    <span style={{ color: `#${p.color.replace(/^#/, "").split("#")[0]}` }}>●</span>
                    {p.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.is_host ? "ANFITRIÃO" : p.connected ? "JOGADOR" : "DESCONECTADO"}
                  </span>
                </li>
              ))}
              {Array.from({ length: Math.max(0, slots - humanCount) }, (_, i) => (
                <li
                  key={`bot-${i}`}
                  className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="font-bold text-muted-foreground">
                    {fillEmptySlotsWithBots ? "Bot" : "Vaga livre"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {fillEmptySlotsWithBots ? "BOT" : "—"}
                  </span>
                </li>
              ))}
            </ul>

            {isRoomHost ? (
              <button className="btn-arcade mt-5 w-full" disabled={busy} onClick={() => void startRoom()}>
                {busy ? "INICIANDO…" : "INICIAR PARTIDA"}
              </button>
            ) : (
              <button className="btn-arcade mt-5 w-full opacity-60" disabled>
                AGUARDANDO O ANFITRIÃO…
              </button>
            )}
            <button className="btn-arcade-ghost mt-2 w-full" onClick={() => void exitLobby()}>
              SAIR DA SALA
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
          <p className="mt-4 text-sm font-black">ESCOLHA SUA COR</p>
          <p className="mt-1 text-xs text-muted-foreground">{joinTeamMode ? "Cada cor aceita até duas pessoas." : "Cores ocupadas na sala ficam bloqueadas."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(joinTeamMode ? TEAM_COLORS.slice(0, 4) : TEAM_COLORS).map((color) => {
              const occupied = joinOccupiedColors.includes(color);
              const selected = joinColor === color;
              return (
                <button
                  key={color}
                  type="button"
                  disabled={occupied}
                  aria-label={occupied ? "Cor ocupada" : "Selecionar cor"}
                  className={`h-9 w-9 rounded-full border-2 transition-transform disabled:cursor-not-allowed disabled:opacity-25 ${
                    selected ? "scale-110 border-white ring-2 ring-accent" : "border-black/30"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    setJoinColor(color);
                    setJoinError("");
                  }}
                />
              );
            })}
          </div>
          {joinError && <p className="mt-2 text-sm font-bold text-destructive">{joinError}</p>}
          <div className="mt-4 flex gap-2">
            <button className="btn-arcade flex-1" disabled={busy} onClick={() => void doJoin()}>
              {busy ? "ENTRANDO…" : "ENTRAR"}
            </button>
            <button className="btn-arcade-ghost flex-1" onClick={() => setJoinOpen(false)}>
              CANCELAR
            </button>
          </div>
        </Modal>
      )}

      {settingsOpen && (
        <Modal onClose={() => setSettingsOpen(false)}>
          <button
            type="button"
            className="w-full cursor-default text-left text-2xl font-black"
            onClick={revealSuperPlayer}
            aria-label="Configurações"
          >
            CONFIGURAÇÕES
          </button>
          <p className="mt-1 text-xs text-muted-foreground">Ajuste sua experiência de jogo.</p>
          <div className="mt-5 space-y-4 text-sm">
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
                {(["ultra", "baixa", "media", "alta"] as const).map((q) => (
                  <button key={q} onClick={() => setSetting("quality", q)} className={`flex-1 rounded-lg px-1 py-2 text-[10px] font-bold uppercase ${settings.quality === q ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {q}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">ULTRA reduz resolução, sombras e iluminação para celulares fracos.</p>
            </div>
            <label className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
              <span className="font-bold">Vibração no celular</span>
              <input type="checkbox" checked={settings.vibration} onChange={(e) => setSetting("vibration", e.target.checked)} />
            </label>
            {superPlayerUnlocked && (
              <button className="w-full rounded-lg border border-amber-300/50 bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-200" onClick={() => setSuperPlayerOpen(true)}>
                ✦ SUPER PLAYER DESBLOQUEADO
              </button>
            )}
            <button className="btn-arcade-ghost w-full" onClick={() => setSettingsOpen(false)}>FECHAR</button>
          </div>
        </Modal>
      )}

      {superPlayerOpen && (
        <Modal onClose={() => setSuperPlayerOpen(false)}>
          <div className="rounded-xl border border-amber-300/50 bg-gradient-to-br from-amber-400/15 to-fuchsia-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-200">Acesso secreto</p>
            <h3 className="mt-1 text-2xl font-black text-amber-100">SUPER PLAYER</h3>
            <p className="mt-2 text-sm text-muted-foreground">Cada poder é independente e é aplicado ao iniciar a próxima partida.</p>
            <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl bg-black/25 px-3 py-3">
              <span>
                <span className="block font-black text-amber-100">MODO DEUS</span>
                <span className="block text-xs text-muted-foreground">Seu personagem não recebe dano e não morre.</span>
              </span>
              <input className="h-5 w-5 accent-amber-400" type="checkbox" checked={godMode} onChange={(e) => setGodMode(e.target.checked)} />
            </label>
            <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl bg-black/25 px-3 py-3">
              <span><span className="block font-black text-amber-100">NÚCLEO INDESTRUTÍVEL</span><span className="block text-xs text-muted-foreground">Trava o núcleo em 100% até o fim da partida.</span></span>
              <input className="h-5 w-5 accent-amber-400" type="checkbox" checked={coreShieldMode} onChange={(e) => setCoreShieldMode(e.target.checked)} />
            </label>
            <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl bg-black/25 px-3 py-3">
              <span><span className="block font-black text-amber-100">DIAMANTES 9.999</span><span className="block text-xs text-muted-foreground">Começa com 9.999; compras e coletas seguem normalmente.</span></span>
              <input className="h-5 w-5 accent-amber-400" type="checkbox" checked={infiniteDiamondsMode} onChange={(e) => setInfiniteDiamondsMode(e.target.checked)} />
            </label>
            <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl bg-black/25 px-3 py-3">
              <span><span className="block font-black text-amber-100">SUPER VELOCIDADE</span><span className="block text-xs text-muted-foreground">Velocidade extrema, acima de bots e jogadores com upgrades máximos.</span></span>
              <input className="h-5 w-5 accent-amber-400" type="checkbox" checked={superSpeedMode} onChange={(e) => setSuperSpeedMode(e.target.checked)} />
            </label>
            <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl bg-black/25 px-3 py-3">
              <span><span className="block font-black text-amber-100">MIRA GUIADA</span><span className="block text-xs text-muted-foreground">Puxa o disparo para o bot mais próximo somente na área de uma ilha.</span></span>
              <input className="h-5 w-5 accent-amber-400" type="checkbox" checked={guidedAimMode} onChange={(e) => setGuidedAimMode(e.target.checked)} />
            </label>
          </div>
          <button className="btn-arcade mt-4 w-full" onClick={() => setSuperPlayerOpen(false)}>CONFIRMAR</button>
        </Modal>
      )}

      {mapOpen && (
        <Modal onClose={() => setMapOpen(false)}>
          <h3 className="text-2xl font-black">ESCOLHA A ILHA</h3>
          <p className="mt-1 text-sm text-muted-foreground">A arena é definida antes de a partida começar.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(["nucleo", "pirata"] as const).map((map) => (
              <button key={map} onClick={() => setSelectedMap(map)} className={`overflow-hidden rounded-xl border-2 text-left ${selectedMap === map ? "border-accent ring-2 ring-accent" : "border-border"}`}>
                <MapPreview map={map} />
                <span className="block px-3 py-2 text-sm font-black">{map === "nucleo" ? "ILHA DO NÚCLEO" : "ILHA PIRATA"}</span>
              </button>
            ))}
          </div>
          <button className="btn-arcade mt-4 w-full" onClick={() => { setMapOpen(false); startMatch(); }}>JOGAR NESTA ILHA</button>
          <button className="btn-arcade-ghost mt-2 w-full" onClick={() => { setSelectedMap(Math.random() < 0.5 ? "nucleo" : "pirata"); setMapOpen(false); startMatch(); }}>SORTEAR ILHA</button>
        </Modal>
      )}
    </div>
  );
}

function MapPreview({ map }: { map: "nucleo" | "pirata" }) {
  return (
    <div className="relative h-24 overflow-hidden bg-sky-500">
      <Canvas dpr={[0.5, 1]} camera={{ position: [0, 80, 72], fov: 42 }} gl={{ antialias: false }}>
        <PreviewCamera />
        <color attach="background" args={["#6cc9ec"]} />
        <hemisphereLight args={["#d9f6ff", "#49613f", 1.4]} />
        <directionalLight position={[30, 60, 30]} intensity={1.5} />
        <World3D selectedMap={map} />
      </Canvas>
      <span className="pointer-events-none absolute bottom-1 left-2 text-[9px] font-black uppercase tracking-wider text-white/90">mapa real · vista inclinada</span>
    </div>
  );
}

function PreviewCamera() {
  const { camera } = useThree();
  useEffect(() => { camera.lookAt(0, 0, 0); }, [camera]);
  return null;
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
      className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/65 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto overscroll-contain rounded-2xl bg-card p-5 shadow-2xl"
        style={{ WebkitOverflowScrolling: "touch" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
