import React, { useEffect, useRef, useState, useCallback } from "react";
import { SpeechContext } from "./SpeechContext";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

// Frontend env (Vite):
const SILENCE_MS = Number(import.meta.env.VITE_SILENCE_MS || 2000);
const RMS_THRESHOLD = Number(import.meta.env.VITE_RMS_THRESHOLD || 0.03);

// ✅ Auto-stop radi i na mobilnom (isti behavior kao desktop)
const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const ENABLE_AUTO_STOP = true;

// Safety unlock (mobilni: audio "ended" ponekad ne okine)
const MIC_SAFETY_UNLOCK_MS = Number(import.meta.env.VITE_MIC_SAFETY_UNLOCK_MS || 12000);

// Ako audio play bude blokiran, posle koliko da “pustimo” mic (ALI NE diramo queue poruka)
const PLAY_BLOCKED_FALLBACK_MS = Number(import.meta.env.VITE_PLAY_BLOCKED_FALLBACK_MS || 900);

export const SpeechProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState(null);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);

  // 🔒 micEnabled: da li sme da startuje snimanje (dok avatar priča / dok čeka odgovor)
  const [micEnabled, setMicEnabled] = useState(true);
  const micEnabledRef = useRef(true);

  // 🎚️ Equalizer node (analyser)
  const [analyserNode, setAnalyserNode] = useState(null);

  // 🎧 Listening (stream + analyser) — ostaje aktivno za equalizer
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);

  // 🎙️ Recording
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingRef = useRef(false);

  // 🤫 Auto-stop on silence (samo dok snimaš)
  const rafRef = useRef(null);

  // Timers
  const micSafetyTimerRef = useRef(null);
  const playBlockedFallbackTimerRef = useRef(null);

  // ✅ Unlock samo jednom (na MIC tapu)
  const audioUnlockedRef = useRef(false);

  // ✅ Anti-dupli onMessagePlayed
  const handledMessageKeyRef = useRef(null);

  // ✅ Dok čekamo playback (Avatar -> onended)
  const pendingPlaybackRef = useRef(false);

  // 🔋 Mobile keep-alive audio session (iOS)
  const keepAliveCtxRef = useRef(null);
  const keepAliveOscRef = useRef(null);
  const keepAliveGainRef = useRef(null);

  const startKeepAlive = useCallback(async () => {
    // uglavnom treba samo na mobilnom, ali može i svuda bez štete
    if (keepAliveCtxRef.current) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const ctx = new AudioContext();
      keepAliveCtxRef.current = ctx;

      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {}
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      // ultra-tiho (nemoj 0)
      gain.gain.value = 0.00001;

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      keepAliveOscRef.current = osc;
      keepAliveGainRef.current = gain;

      // console.log("🔋 keepAlive ON");
    } catch (e) {
      console.warn("keepAlive start failed", e);
    }
  }, []);

  const stopKeepAlive = useCallback(() => {
    try {
      keepAliveOscRef.current?.stop?.();
    } catch {}
    keepAliveOscRef.current = null;
    keepAliveGainRef.current = null;

    try {
      keepAliveCtxRef.current?.close?.();
    } catch {}
    keepAliveCtxRef.current = null;

    // console.log("🔋 keepAlive OFF");
  }, []);

  const updateMicState = (enabled) => {
    setMicEnabled(enabled);
    micEnabledRef.current = enabled;
  };

  const clearMicSafetyTimer = () => {
    if (micSafetyTimerRef.current) {
      clearTimeout(micSafetyTimerRef.current);
      micSafetyTimerRef.current = null;
    }
  };

  const armMicSafetyUnlock = () => {
    clearMicSafetyTimer();
    micSafetyTimerRef.current = setTimeout(() => {
      if (!recordingRef.current && !micEnabledRef.current) {
        console.warn("⚠️ Safety unlock mic (mobile audio end not detected)");
        updateMicState(true);
      }
    }, MIC_SAFETY_UNLOCK_MS);
  };

  const clearPlayBlockedFallback = () => {
    if (playBlockedFallbackTimerRef.current) {
      clearTimeout(playBlockedFallbackTimerRef.current);
      playBlockedFallbackTimerRef.current = null;
    }
  };

  // ✅ audio unlock helper (iOS) — ZOVI IZ USER GESTURE (MIC TAP)
  const unlockAudioOnce = useCallback(async () => {
    if (audioUnlockedRef.current) return true;

    try {
      // WebAudio unlock
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        if (ctx.state === "suspended") {
          try {
            await ctx.resume();
          } catch {}
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.01);

        setTimeout(() => {
          try {
            ctx.close?.();
          } catch {}
        }, 50);
      }

      // Prime HTMLAudio
      const a = new Audio();
      a.muted = true;
      a.volume = 0;
      a.playsInline = true;
      await a.play().catch(() => {});

      audioUnlockedRef.current = true;
      return true;
    } catch {
      return false;
    }
  }, []);

  const safeOnMessagePlayed = useCallback(() => {
    setMessages((prev) => (prev.length ? prev.slice(1) : prev));
    updateMicState(true);
    clearMicSafetyTimer();
    pendingPlaybackRef.current = false;
    clearPlayBlockedFallback();
    stopKeepAlive(); // ✅ prekid keepAlive kad poruka završi
    console.log("🎤 Mic re-enabled after avatar speech.");
  }, [stopKeepAlive]);

  // ✅ fallback ako audio.play bude blokiran:
  // BITNO: NE smemo da "pojedemo" poruku (NE zovemo safeOnMessagePlayed),
  // samo otključamo mic da app ne ostane zaglavljena.
  const armPlayBlockedFallback = useCallback(() => {
    clearPlayBlockedFallback();
    playBlockedFallbackTimerRef.current = setTimeout(() => {
      if (pendingPlaybackRef.current && !recordingRef.current) {
        console.warn("⚠️ audio.play likely blocked → unlock mic (do not dequeue message)");
        pendingPlaybackRef.current = false;
        updateMicState(true);
        clearMicSafetyTimer();
        // keepAlive može ostati upaljen do sledećeg onended, ali da ne “visi”:
        stopKeepAlive();
      }
    }, PLAY_BLOCKED_FALLBACK_MS);
  }, [stopKeepAlive]);

  const initiateRecording = () => {
    audioChunksRef.current = [];
  };

  const onDataAvailable = (e) => {
    if (e?.data && e.data.size > 0) {
      audioChunksRef.current.push(e.data);
    }
  };

  const sendAudioData = async (audioBlob) => {
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);

    reader.onloadend = async function () {
      const base64Audio = reader.result.split(",")[1];
      setLoading(true);

      try {
        const response = await fetch(`${backendUrl}/sts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: base64Audio }),
        });

        const data = await response.json();
        const newMessages = data?.messages || [];

        if (!newMessages.length) {
          console.warn("⚠️ Backend returned no messages → unlocking mic");
          updateMicState(true);
          pendingPlaybackRef.current = false;
          clearMicSafetyTimer();
          clearPlayBlockedFallback();
          stopKeepAlive();
          return;
        }

        setMessages((prev) => [...prev, ...newMessages]);

        // čekamo playback (Avatar -> onended)
        pendingPlaybackRef.current = true;
        armPlayBlockedFallback();
      } catch (error) {
        console.error("❌ Audio send error:", error);
        updateMicState(true);
        pendingPlaybackRef.current = false;
        clearMicSafetyTimer();
        clearPlayBlockedFallback();
        stopKeepAlive();
      } finally {
        setLoading(false);
      }
    };
  };

  // ✅ Listening: traži mic + napravi analyser (equalizer)
  const startListening = async () => {
    if (streamRef.current && analyserRef.current) {
      try {
        if (audioContextRef.current?.state === "suspended") {
          await audioContextRef.current.resume();
        }
      } catch {}
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      try {
        if (ctx.state === "suspended") await ctx.resume();
      } catch {}

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      source.connect(analyser);

      analyserRef.current = analyser;
      setAnalyserNode(analyser);

      console.log("👂 Listening started (equalizer active).");
    } catch (err) {
      console.error("🎤 Microphone access error (listening):", err);
    }
  };

  const stopListening = () => {
    stopAutoStopOnSilence();
    clearMicSafetyTimer();
    clearPlayBlockedFallback();
    stopKeepAlive();

    try {
      audioContextRef.current?.close();
    } catch {}
    audioContextRef.current = null;

    try {
      streamRef.current?.getTracks()?.forEach((t) => t.stop());
    } catch {}

    streamRef.current = null;
    analyserRef.current = null;
    setAnalyserNode(null);

    console.log("🔇 Listening stopped.");
  };

  // 🤫 Auto-stop snimanja posle SILENCE_MS tišine (RMS)
  const startAutoStopOnSilence = () => {
    if (!ENABLE_AUTO_STOP) return;
    if (!analyserRef.current) return;

    stopAutoStopOnSilence();

    const analyser = analyserRef.current;
    const data = new Uint8Array(analyser.fftSize);

    let lastLoudAt = performance.now();

    const loop = () => {
      if (!recordingRef.current || !analyserRef.current) return;

      analyser.getByteTimeDomainData(data);

      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sumSquares += v * v;
      }
      const rms = Math.sqrt(sumSquares / data.length);

      if (rms > RMS_THRESHOLD) lastLoudAt = performance.now();

      const silentFor = performance.now() - lastLoudAt;
      if (silentFor >= SILENCE_MS) {
        console.log(`🤫 ${SILENCE_MS}ms silence (rms=${rms.toFixed(4)}) → auto stop`);
        // auto-stop nije user gesture:
        stopRecording({ userGesture: false });
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  };

  const stopAutoStopOnSilence = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const initMediaRecorder = async () => {
    if (mediaRecorderRef.current) return mediaRecorderRef.current;

    if (!streamRef.current) {
      await startListening();
    }

    if (!streamRef.current) {
      console.warn("❌ No microphone stream available.");
      return null;
    }

    try {
      const recorder = new MediaRecorder(streamRef.current);
      recorder.onstart = initiateRecording;
      recorder.ondataavailable = onDataAvailable;

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        sendAudioData(audioBlob);
        mediaRecorderRef.current = null;
        console.log("⏹️ Recorder stopped (listening/equalizer remains active).");
      };

      mediaRecorderRef.current = recorder;
      console.log("🎙️ MediaRecorder initialized.");
      return recorder;
    } catch (err) {
      console.error("🎙️ MediaRecorder init error:", err);
      return null;
    }
  };

  // ✅ START (tap mic) — unlock mora biti NA TAPU
  const startRecording = async () => {
    await unlockAudioOnce();
    // ✅ keepAlive start (posebno pomaže na iOS)
    if (IS_MOBILE) await startKeepAlive();

    if (!micEnabledRef.current || loading || message) {
      console.log("🚫 Can't start recording (mic disabled / loading / message).");
      return;
    }

    if (recordingRef.current) {
      console.warn("⚠️ Already recording.");
      return;
    }

    const recorder = await initMediaRecorder();
    if (!recorder) return;

    if (recorder.state !== "inactive") {
      console.warn("⚠️ Recorder not inactive:", recorder.state);
      return;
    }

    try {
      recorder.start();
      setRecording(true);
      recordingRef.current = true;
      console.log("🎬 Recording started");

      startAutoStopOnSilence();
    } catch (err) {
      console.error("💥 Failed to start recording:", err);
    }
  };

  // ✅ STOP (tap mic ili auto)
  // UI treba da zove: stopRecording({ userGesture: true })
  const stopRecording = async ({ userGesture } = {}) => {
    if (userGesture) {
      await unlockAudioOnce();
      if (IS_MOBILE) await startKeepAlive(); // ✅ obnovi session na tap-u
    }

    const recorder = mediaRecorderRef.current;
    console.log(`[StopRecording] recorder state: ${recorder?.state}`);

    stopAutoStopOnSilence();

    if (!recorder) {
      console.warn("❌ MediaRecorder is not initialized.");
      return;
    }

    if (recorder.state !== "recording") {
      console.warn("⚠️ Not recording, state:", recorder.state);
      return;
    }

    try {
      recorder.stop();
      setRecording(false);
      recordingRef.current = false;

      // 🔒 zaključaj mic dok avatar ne završi poruku
      updateMicState(false);

      // fallback unlock
      armMicSafetyUnlock();

      console.log("⏹️ Recording stopped and mic disabled (until avatar finishes).");
    } catch (err) {
      console.error("💥 Failed to stop recording:", err);
      updateMicState(true);
      clearMicSafetyTimer();
      stopKeepAlive();
    }
  };

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  useEffect(() => {
    if (messages.length > 0) setMessage(messages[0]);
    else setMessage(null);
  }, [messages]);

  // ✅ reset anti-double guard kad stigne nova poruka
  useEffect(() => {
    handledMessageKeyRef.current = null;
  }, [message]);

  const tts = async (text) => {
    setLoading(true);

    updateMicState(false);
    clearMicSafetyTimer();

    try {
      const response = await fetch(`${backendUrl}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await response.json();
      const newMessages = data?.messages || [];

      if (!newMessages.length) {
        console.warn("⚠️ TTS returned no messages → unlocking mic");
        updateMicState(true);
        pendingPlaybackRef.current = false;
        stopKeepAlive();
        return;
      }

      setMessages((prev) => [...prev, ...newMessages]);

      pendingPlaybackRef.current = true;
      armPlayBlockedFallback();
    } catch (error) {
      console.error("❌ TTS error:", error);
      updateMicState(true);
      pendingPlaybackRef.current = false;
      stopKeepAlive();
    } finally {
      setLoading(false);
    }
  };

  const onMessagePlayed = () => {
    // zaštita od duplog poziva
    const key =
      message?.id ||
      message?.audio?.slice?.(0, 24) ||
      JSON.stringify(message || {}).slice(0, 48);

    if (handledMessageKeyRef.current === key) return;
    handledMessageKeyRef.current = key;

    safeOnMessagePlayed();
  };

  useEffect(() => {
    return () => {
      stopAutoStopOnSilence();
      clearMicSafetyTimer();
      clearPlayBlockedFallback();
      stopKeepAlive();
      try {
        audioContextRef.current?.close();
      } catch {}
      try {
        streamRef.current?.getTracks()?.forEach((t) => t.stop());
      } catch {}
    };
  }, [stopKeepAlive]);

  return (
    <SpeechContext.Provider
      value={{
        recording,
        recordingRef,
        startRecording,
        stopRecording, // <-- async, UI: stopRecording({ userGesture: true })
        message,
        loading,
        tts,
        onMessagePlayed,
        micEnabled,
        micEnabledRef,
        analyserNode,
        setAnalyserNode,
        startListening,
        stopListening,
        unlockAudioOnce, // <-- opcionalno (ako želiš da pozoveš iz UI)
      }}
    >
      {children}
    </SpeechContext.Provider>
  );
};