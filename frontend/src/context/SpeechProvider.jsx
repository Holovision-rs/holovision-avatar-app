import React, { useEffect, useRef, useState } from "react";
import { SpeechContext } from "./SpeechContext";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

// Frontend env (Vite):
const SILENCE_MS = Number(import.meta.env.VITE_SILENCE_MS || 2000);
const RMS_THRESHOLD = Number(import.meta.env.VITE_RMS_THRESHOLD || 0.03);

// Safety unlock (mobilni: audio "ended" ponekad ne okine)
const MIC_SAFETY_UNLOCK_MS = Number(import.meta.env.VITE_MIC_SAFETY_UNLOCK_MS || 12000);

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

  // Safety unlock timer (mobilni fallback)
  const micSafetyTimerRef = useRef(null);

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
      // ako smo i dalje zaključani, a ne snimamo -> otključaj
      if (!recordingRef.current && !micEnabledRef.current) {
        console.warn("⚠️ Safety unlock mic (mobile audio end not detected)");
        updateMicState(true);
      }
    }, MIC_SAFETY_UNLOCK_MS);
  };

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
        setMessages((prev) => [...prev, ...(data?.messages || [])]);
      } catch (error) {
        console.error("❌ Audio send error:", error);
        // ako backend padne, nemoj da ostane zaključan mic
        updateMicState(true);
        clearMicSafetyTimer();
      } finally {
        setLoading(false);
      }
    };
  };

  // ✅ Listening: traži mic + napravi analyser (za equalizer)
  const startListening = async () => {
    // već sluša
    if (streamRef.current && analyserRef.current) {
      // iOS: nekad context ostane suspended
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

      // iOS: mora resume u user gesture (mi ovo zovemo iz onFirstGesture)
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

  // ⚠️ Opciono ručno gašenje listening-a (NE koristimo za silence)
  const stopListening = () => {
    stopAutoStopOnSilence();
    clearMicSafetyTimer();

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

  // 🤫 Auto-stop snimanja posle SILENCE_MS tišine (RMS), samo dok recordingRef.current === true
  const startAutoStopOnSilence = () => {
    if (!analyserRef.current) return;

    stopAutoStopOnSilence(); // reset loop

    const analyser = analyserRef.current;
    const data = new Uint8Array(analyser.fftSize); // time-domain buffer (256)

    let lastLoudAt = performance.now();

    const loop = () => {
      // radi samo dok snimaš
      if (!recordingRef.current || !analyserRef.current) return;

      analyser.getByteTimeDomainData(data);

      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128; // -1..1
        sumSquares += v * v;
      }
      const rms = Math.sqrt(sumSquares / data.length);

      if (rms > RMS_THRESHOLD) {
        lastLoudAt = performance.now();
      }

      const silentFor = performance.now() - lastLoudAt;
      if (silentFor >= SILENCE_MS) {
        console.log(`🤫 ${SILENCE_MS}ms silence (rms=${rms.toFixed(4)}) → auto stopRecording()`);
        stopRecording(); // isto kao ručni stop
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

  // ✅ Recorder init koristi postojeći stream iz listening-a
  const initMediaRecorder = async () => {
    if (mediaRecorderRef.current) return mediaRecorderRef.current;

    // ako nema listening — pokreni ga (da equalizer radi i da imamo stream)
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

        // ✅ NE gasimo stream/analyser -> equalizer ostaje živ
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

  // ✅ START (samo dugme)
  const startRecording = async () => {
    // dok avatar priča / loading / message -> nema snimanja
    if (!micEnabledRef.current || loading || message) {
      console.log("🚫 Can't start recording (mic disabled / loading / message).");
      return;
    }

    if (recordingRef.current) {
      console.warn("⚠️ Already recording.");
      return;
    }

    const recorder = await initMediaRecorder();
    console.log(`[StartRecording] micEnabled: ${micEnabledRef.current}, recorder state: ${recorder?.state}`);

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

      // ✅ uključi auto-stop na tišinu
      startAutoStopOnSilence();
    } catch (err) {
      console.error("💥 Failed to start recording:", err);
    }
  };

  // ✅ STOP (ručno ili auto)
  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    console.log(`[StopRecording] recorder state: ${recorder?.state}`);

    // ugasi silence loop
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

      // ✅ MOBILE fallback: ako se onMessagePlayed ne pozove, otključaj posle timeout-a
      armMicSafetyUnlock();

      console.log("⏹️ Recording stopped and mic disabled (until avatar finishes).");
    } catch (err) {
      console.error("💥 Failed to stop recording:", err);
      // ako fail stop, nemoj zaključavati
      updateMicState(true);
      clearMicSafetyTimer();
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

  // 🔓 first click: startListening (equalizer) — ne pali recording
  useEffect(() => {
    const onFirstGesture = async () => {
      await startListening();
      console.log("✅ Mic listening enabled on first user gesture.");
    };

    document.addEventListener("touchstart", onFirstGesture, { once: true });
    document.addEventListener("click", onFirstGesture, { once: true });

    return () => {
      document.removeEventListener("touchstart", onFirstGesture);
      document.removeEventListener("click", onFirstGesture);
    };
  }, []);

  const tts = async (text) => {
    setLoading(true);

    // 🔇 disable mic while avatar will speak
    updateMicState(false);
    clearMicSafetyTimer(); // ovde safety ne treba

    console.log(`[TTS] Mic disabled and message sent: "${text}"`);

    try {
      const response = await fetch(`${backendUrl}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await response.json();
      setMessages((prev) => [...prev, ...(data?.messages || [])]);
    } catch (error) {
      console.error("❌ TTS error:", error);
      // ako tts fail, nemoj da ostane zaključan
      updateMicState(true);
    } finally {
      setLoading(false);
    }
  };

  const onMessagePlayed = () => {
    setMessages((prev) => prev.slice(1));

    // ✅ re-enable mic after avatar speech
    updateMicState(true);

    // ✅ stop safety timer (ako je bio armovan)
    clearMicSafetyTimer();

    console.log("🎤 Mic re-enabled after avatar speech.");
  };

  // cleanup on unmount
  useEffect(() => {
    return () => {
      stopAutoStopOnSilence();
      clearMicSafetyTimer();
      // ostavi listening ako želiš, ali bolje je očistiti:
      try {
        audioContextRef.current?.close();
      } catch {}
      try {
        streamRef.current?.getTracks()?.forEach((t) => t.stop());
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      }}
    >
      {children}
    </SpeechContext.Provider>
  );
};