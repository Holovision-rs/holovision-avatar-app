import React, { useEffect, useRef, useState, useCallback } from "react";
import { SpeechContext } from "./SpeechContext";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const SILENCE_MS = Number(import.meta.env.VITE_SILENCE_MS || 2000);
const RMS_THRESHOLD = Number(import.meta.env.VITE_RMS_THRESHOLD || 0.010);

const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const ENABLE_AUTO_STOP = true;

const MIC_SAFETY_UNLOCK_MS = Number(import.meta.env.VITE_MIC_SAFETY_UNLOCK_MS || 12000);

// ✅ pomoćno: da unlock nikad ne blokira
const withTimeout = (promise, ms = 250) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(false), ms))]);

export const SpeechProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState(null);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);

  const [micEnabled, setMicEnabled] = useState(true);
  const micEnabledRef = useRef(true);

  const [analyserNode, setAnalyserNode] = useState(null);

  // 🎧 mic listening ctx (analyser)
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);

  // ✅ WebAudio playback ctx (Avatar koristi ovo)
  const playbackCtxRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingRef = useRef(false);
  const rafRef = useRef(null);

  const micSafetyTimerRef = useRef(null);

  // ✅ “playback nije startovao” fallback timer
  const playBlockedFallbackTimerRef = useRef(null);

  // ✅ playback safety timer (kad playback realno krene)
  const playbackSafetyTimerRef = useRef(null);

  const audioUnlockedRef = useRef(false);

  // dedupe onMessagePlayed (Avatar onended) per current message
  const handledMessageKeyRef = useRef(null);

  // dedupe safeOnMessagePlayed (any end reason) per message id
  const messageEndKeyRef = useRef(null);

  // ✅ “čekamo playback” state
  const pendingPlaybackRef = useRef(false);

  // keepAlive (iOS)
  const keepAliveOscRef = useRef(null);
  const keepAliveGainRef = useRef(null);
  const keepAliveActiveRef = useRef(false);

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

  const clearPlaybackSafety = () => {
    if (playbackSafetyTimerRef.current) {
      clearTimeout(playbackSafetyTimerRef.current);
      playbackSafetyTimerRef.current = null;
    }
  };

  // ✅ MIME type picker (bitno za mobilni)
  const pickMimeType = () => {
    try {
      if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return null;
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || null;
    } catch {
      return null;
    }
  };

  // ✅ ensure playback AudioContext exists + resumed (u user gesture pozivu)
  const ensurePlaybackContext = useCallback(async () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;

    if (!playbackCtxRef.current) playbackCtxRef.current = new AudioContext();

    const ctx = playbackCtxRef.current;
    if (ctx.state === "suspended") {
      try {
        await withTimeout(ctx.resume(), 200);
      } catch {}
    }
    return ctx;
  }, []);

  // ✅ audio unlock helper — NE SME BLOKIRATI startRecording
  const unlockAudioOnce = useCallback(async () => {
    if (audioUnlockedRef.current) return true;

    const doUnlock = async () => {
      try {
        // 1) otključaj playback ctx (važnije od svega)
        await ensurePlaybackContext();

        // 2) mali “tick” (nekad pomaže na iOS)
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          try {
            if (ctx.state === "suspended") await ctx.resume();
          } catch {}
          try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            gain.gain.value = 0.0001;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.01);
          } catch {}
          setTimeout(() => {
            try {
              ctx.close?.();
            } catch {}
          }, 80);
        }

        // 3) Prime HTMLAudio (može da visi → timeout)
        const a = new Audio();
        a.muted = true;
        a.volume = 0;
        a.playsInline = true;
        await withTimeout(a.play().catch(() => false), 200);

        audioUnlockedRef.current = true;
        return true;
      } catch {
        return false;
      }
    };

    return doUnlock();
  }, [ensurePlaybackContext]);

  const startKeepAlive = useCallback(async () => {
    if (!IS_MOBILE) return;
    if (keepAliveActiveRef.current) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      // koristi mic ctx ako postoji
      const ctx = audioContextRef.current || new AudioContext();
      audioContextRef.current = ctx;

      try {
        if (ctx.state === "suspended") await withTimeout(ctx.resume(), 200);
      } catch {}

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 30;
      gain.gain.value = 0.000001;

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      keepAliveOscRef.current = osc;
      keepAliveGainRef.current = gain;
      keepAliveActiveRef.current = true;
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
    keepAliveActiveRef.current = false;
  }, []);

  // ✅ ako playback uopšte ne STARTUJE, samo odblokiraj mic, NE diraj queue
  const armPlayBlockedFallback = useCallback(() => {
    clearPlayBlockedFallback();
    playBlockedFallbackTimerRef.current = setTimeout(() => {
      if (pendingPlaybackRef.current && !recordingRef.current) {
        console.warn("⚠️ playback NOT started → unlock mic but KEEP message (no dequeue)", {
          reason: "play_not_started_fallback",
        });

        updateMicState(true);
        pendingPlaybackRef.current = false; // da ne blokira UI
        clearMicSafetyTimer();
        clearPlaybackSafety();
        stopKeepAlive();
      }
    }, 8000);
  }, [stopKeepAlive]);

  // ✅ KLJUČ: mic se pali TEK kad queue postane prazan (poslednja poruka odigrana)
  const safeOnMessagePlayed = useCallback(
    (reason = "unknown") => {
      setMessages((prev) => {
        if (!prev.length) return prev;

        const current = prev[0];
        const key =
          current?.id ||
          current?.audio?.slice?.(0, 24) ||
          JSON.stringify(current || {}).slice(0, 48);

        if (messageEndKeyRef.current === key) {
          console.log("🟡 safeOnMessagePlayed ignored (duplicate)", { reason, key });
          return prev;
        }
        messageEndKeyRef.current = key;

        const next = prev.slice(1);
        const hasMore = next.length > 0;

        // uvek očisti safety timere za trenutno odigranu poruku
        clearPlayBlockedFallback();
        clearPlaybackSafety();

        if (!hasMore) {
          // ✅ nema više poruka -> tek sad pali mic + reset state
          updateMicState(true);
          clearMicSafetyTimer();
          pendingPlaybackRef.current = false;
          stopKeepAlive();
          console.log("🎤 Mic re-enabled after ALL avatar speech.", { reason, key });
        } else {
          // ✅ ima još poruka -> ostaje mic disabled, čekamo sledeći playback
          pendingPlaybackRef.current = true;
          // na sledeću poruku opet armujemo "not started" fallback
          armPlayBlockedFallback();
          console.log("➡️ Next message queued, keep mic disabled.", {
            reason,
            key,
            remaining: next.length,
          });
        }

        return next;
      });
    },
    [armPlayBlockedFallback, stopKeepAlive]
  );

  // ✅ Avatar zove čim playback stvarno krene
  const onAvatarPlaybackStart = useCallback(
    (durationSec) => {
      // čim playback krene, više nije “blocked” -> gasi brzi fallback
      clearPlayBlockedFallback();

      // postavi normalan safety timeout: trajanje + 1.5s
      clearPlaybackSafety();
      const ms = Math.max(1500, Math.floor((Number(durationSec) || 0) * 1000) + 1500);

      playbackSafetyTimerRef.current = setTimeout(() => {
        if (pendingPlaybackRef.current) {
          console.warn("⚠️ Playback safety timeout hit → force end");
          safeOnMessagePlayed("playback_safety_timeout");
        }
      }, ms);
    },
    [safeOnMessagePlayed]
  );

  const initiateRecording = () => {
    audioChunksRef.current = [];
  };

  const onDataAvailable = (e) => {
    if (e?.data && e.data.size > 0) audioChunksRef.current.push(e.data);
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

        // ✅ LOG: koliko poruka backend vraća + kratak info
        console.log("🟦 STS messages length:", newMessages.length);
        console.log(
          "🟦 STS message keys:",
          newMessages.map((m) => ({
            id: m?.id,
            audioHead: m?.audio?.slice?.(0, 18),
            textHead: m?.text?.slice?.(0, 40) ?? m?.message?.slice?.(0, 40),
          }))
        );

        if (!newMessages.length) {
          console.warn("⚠️ Backend returned no messages → unlocking mic");
          updateMicState(true);
          pendingPlaybackRef.current = false;
          clearMicSafetyTimer();
          clearPlayBlockedFallback();
          clearPlaybackSafety();
          stopKeepAlive();
          return;
        }

        // ✅ dodaj u queue
        setMessages((prev) => [...prev, ...newMessages]);

        // ✅ čekamo da Avatar krene playback
        pendingPlaybackRef.current = true;
        armPlayBlockedFallback();
      } catch (error) {
        console.error("❌ Audio send error:", error);
        updateMicState(true);
        pendingPlaybackRef.current = false;
        clearMicSafetyTimer();
        clearPlayBlockedFallback();
        clearPlaybackSafety();
        stopKeepAlive();
      } finally {
        setLoading(false);
      }
    };
  };

  const startListening = async () => {
    if (streamRef.current && analyserRef.current) {
      try {
        if (audioContextRef.current?.state === "suspended") {
          await withTimeout(audioContextRef.current.resume(), 200);
        }
      } catch {}
      return;
    }

    try {
      console.log("🎤 getUserMedia request...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = audioContextRef.current || new AudioContext();
      audioContextRef.current = ctx;

      try {
        if (ctx.state === "suspended") await withTimeout(ctx.resume(), 200);
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
    clearPlaybackSafety();
    stopKeepAlive();

    try {
      streamRef.current?.getTracks()?.forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;
    analyserRef.current = null;
    setAnalyserNode(null);

    console.log("🔇 Listening stopped.");
  };

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

    if (!streamRef.current) await startListening();

    if (!streamRef.current) {
      console.warn("❌ No microphone stream available.");
      return null;
    }

    try {
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(streamRef.current, { mimeType })
        : new MediaRecorder(streamRef.current);

      recorder.onstart = initiateRecording;
      recorder.ondataavailable = onDataAvailable;

      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type });
        sendAudioData(audioBlob);
        mediaRecorderRef.current = null;
        console.log("⏹️ Recorder stopped (listening/equalizer remains active).");
      };

      mediaRecorderRef.current = recorder;
      console.log("🎙️ MediaRecorder initialized:", recorder.mimeType);
      return recorder;
    } catch (err) {
      console.error("🎙️ MediaRecorder init error:", err);
      return null;
    }
  };

  const startRecording = async () => {
    // fire-and-forget unlock (ne blokira)
    unlockAudioOnce();
    startKeepAlive();

    console.log("🎤 startRecording() called");
    console.log("START CHECK:", {
      micEnabled: micEnabledRef.current,
      loading,
      hasMessage: !!message,
    });

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

  const stopRecording = async (opts) => {
    const userGesture = opts?.userGesture !== undefined ? opts.userGesture : true;

    // ni ovo ne sme da blokira stop
    if (userGesture) {
      unlockAudioOnce();
      startKeepAlive();
    }

    const recorder = mediaRecorderRef.current;
    console.log(`[StopRecording] recorder state: ${recorder?.state} (userGesture=${userGesture})`);

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

      // mic off dok avatar priča (i dok queue traje)
      updateMicState(false);
      armMicSafetyUnlock();

      console.log("⏹️ Recording stopped and mic disabled (until avatar finishes).");
    } catch (err) {
      console.error("💥 Failed to stop recording:", err);
      updateMicState(true);
      clearMicSafetyTimer();
      clearPlayBlockedFallback();
      clearPlaybackSafety();
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

  // reset per message change (ok)
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
        clearPlayBlockedFallback();
        clearPlaybackSafety();
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
      clearPlayBlockedFallback();
      clearPlaybackSafety();
      stopKeepAlive();
    } finally {
      setLoading(false);
    }
  };

  const onMessagePlayed = () => {
    const key =
      message?.id ||
      message?.audio?.slice?.(0, 24) ||
      JSON.stringify(message || {}).slice(0, 48);

    if (handledMessageKeyRef.current === key) {
      console.log("🟡 onMessagePlayed ignored (duplicate)", { key });
      return;
    }

    handledMessageKeyRef.current = key;
    safeOnMessagePlayed("avatar_onended");
  };

  useEffect(() => {
    return () => {
      stopAutoStopOnSilence();
      clearMicSafetyTimer();
      clearPlayBlockedFallback();
      clearPlaybackSafety();
      stopKeepAlive();
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
        stopRecording,
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

        // ✅ IMPORTANT: Avatar koristi WebAudio ctx odavde
        playbackCtxRef,
        ensurePlaybackContext,
        unlockAudioOnce,

        // ✅ NEW: Avatar javlja kad playback startuje + trajanje
        onAvatarPlaybackStart,
      }}
    >
      {children}
    </SpeechContext.Provider>
  );
};