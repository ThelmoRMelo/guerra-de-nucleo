import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getLocalPlayerId } from "@/lib/room";
import { useGame } from "@/game/store";

type VoiceSignal = {
  from: string;
  to?: string;
  type: "ready" | "offer" | "answer" | "ice" | "leave";
  data?: RTCSessionDescriptionInit | RTCIceCandidateInit;
};

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/** Voz em grupo P2P: a sala transmite somente a sinalização; o áudio não passa pelo banco. */
export function useVoiceChat() {
  const roomCode = useGame((s) => s.roomCode);
  const matchPlayers = useGame((s) => s.matchPlayers);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const audioRef = useRef(new Map<string, HTMLAudioElement>());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const remoteIdsRef = useRef(new Set<string>());

  useEffect(() => {
    remoteIdsRef.current = new Set(matchPlayers.map((player) => player.playerId));
    remoteIdsRef.current.delete(getLocalPlayerId());
  }, [matchPlayers]);

  const disable = useCallback(() => setEnabled(false), []);

  useEffect(() => {
    if (!enabled || !roomCode || remoteIdsRef.current.size === 0) return;
    const localId = getLocalPlayerId();
    let disposed = false;

    const send = (signal: VoiceSignal) => {
      void channelRef.current?.send({ type: "broadcast", event: "voice-signal", payload: signal });
    };
    const closePeer = (id: string) => {
      peersRef.current.get(id)?.close();
      peersRef.current.delete(id);
      const audio = audioRef.current.get(id);
      if (audio) {
        audio.srcObject = null;
        audio.remove();
      }
      audioRef.current.delete(id);
    };
    const makePeer = (remoteId: string) => {
      const existing = peersRef.current.get(remoteId);
      if (existing) return existing;
      const peer = new RTCPeerConnection(ICE_SERVERS);
      for (const track of streamRef.current?.getTracks() ?? []) peer.addTrack(track, streamRef.current!);
      peer.onicecandidate = ({ candidate }) => {
        if (candidate) send({ from: localId, to: remoteId, type: "ice", data: candidate.toJSON() });
      };
      peer.ontrack = ({ streams }) => {
        const stream = streams[0];
        if (!stream) return;
        let audio = audioRef.current.get(remoteId);
        if (!audio) {
          audio = document.createElement("audio");
          audio.autoplay = true;
          audio.playsInline = true;
          audioRef.current.set(remoteId, audio);
          document.body.appendChild(audio);
        }
        audio.srcObject = stream;
        void audio.play().catch(() => undefined);
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed" || peer.connectionState === "closed") closePeer(remoteId);
      };
      peersRef.current.set(remoteId, peer);
      return peer;
    };
    const createOffer = async (remoteId: string) => {
      if (peersRef.current.has(remoteId)) return;
      const peer = makePeer(remoteId);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      send({ from: localId, to: remoteId, type: "offer", data: offer });
    };
    const onSignal = async (signal: VoiceSignal) => {
      if (disposed || signal.from === localId || !remoteIdsRef.current.has(signal.from)) return;
      if (signal.to && signal.to !== localId) return;
      try {
        if (signal.type === "ready") {
          // Quem já estava conectado responde ao jogador recém-chegado; assim
          // ele conhece pares que anunciaram voz antes de sua entrada.
          if (!signal.to) send({ from: localId, to: signal.from, type: "ready" });
          // Um iniciador determinístico evita duas ofertas concorrentes para o mesmo par.
          if (localId.localeCompare(signal.from) < 0) await createOffer(signal.from);
          return;
        }
        if (signal.type === "leave") {
          closePeer(signal.from);
          return;
        }
        const peer = makePeer(signal.from);
        if (signal.type === "offer") {
          await peer.setRemoteDescription(signal.data as RTCSessionDescriptionInit);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          send({ from: localId, to: signal.from, type: "answer", data: answer });
        } else if (signal.type === "answer") {
          await peer.setRemoteDescription(signal.data as RTCSessionDescriptionInit);
        } else if (signal.type === "ice" && signal.data) {
          await peer.addIceCandidate(signal.data as RTCIceCandidateInit);
        }
      } catch {
        // Uma nova mensagem "ready" tenta negociar novamente sem interromper a partida.
      }
    };

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const channel = supabase
          .channel(`voice:${roomCode}`)
          .on("broadcast", { event: "voice-signal" }, ({ payload }) => void onSignal(payload as VoiceSignal))
          .subscribe((status) => {
            if (status !== "SUBSCRIBED") return;
            send({ from: localId, type: "ready" });
          });
        channelRef.current = channel;
      } catch {
        setError("Não foi possível usar o microfone. Verifique a permissão do navegador.");
        setEnabled(false);
      }
    };
    void start();

    return () => {
      disposed = true;
      send({ from: localId, type: "leave" });
      for (const id of peersRef.current.keys()) closePeer(id);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (channelRef.current) void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, [enabled, roomCode]);

  const toggle = useCallback(() => {
    setError("");
    setEnabled((current) => !current);
  }, []);

  return { enabled, error, toggle, disable };
}
