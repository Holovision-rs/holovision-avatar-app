import React, { useEffect, useRef, useState } from "react";
import { SpeechContext } from "./SpeechContext";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
const SILENCE_MS = Number(import.meta.env.VITE_SILENCE_MS || 2000);
const RMS_THRESHOLD = Number(import.meta.env.VITE_RMS_THRESHOLD || 0.03);

export const SpeechProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState(null);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);

  // 🔒 micEnabled: kontrola da li sme da snima (dok avatar priča)
  const [micEnabled, setMicEnabled] = useState(true);
  const micEnabledRef = useRef(true);

  // 🎚️ Equalizer
  const [analyserNode, setAnalyserNode] = useState(null);

  // 🎧 Listening (mic stream + analyser) — ostaje aktivno za equalizer
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);

  // 🎙️ Recording
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingRef = useRef(false);

  // 🤫 Auto-stop on silence (samo dok snimaš)
  const silenceTimerRef = useRef(null);
  const rafRef = useRef(null);

  const updateMicState = (enabled) => {
    setMicEnabled(enabled);
    micEnabledRef.current = enabled;
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
      } finally {
        setLoading(false);
      }
    };
  };

  // ✅ Listening: traži mic + napravi analyser (za equalizer)
  const startListening = async () => {
    if (streamRef.current && analyserRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;

      source.connect(analyser);

      analyserRef.current = analyser;
      setAnalyserNode(analyser);

      console.log("👂 Listening started (equalizer active).");
    } catch (err) {
      console.error("🎤 Microphone access error (listening):", err);
    }
  };

  // ⚠️ Opciono: ako baš želiš da ugasiš mic listening ručno (ne koristimo za auto-stop)
  const stopListening = () => {
    // stop raf/timer ako slučajno radi
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;

    try {
      audioContextRef.current?.close();
    } catch (e) {}
    audioContextRef.current = null;

    try {
      streamRef.current?.getTracks()?.forEach((t) => t.stop());
    } catch (e) {}

    streamRef.current = null;
    analyserRef.current = null;
    setAnalyserNode(null);

    console.log("🔇 Listening stopped.");
  };

  // 🤫 Auto-stop snimanja posle 3s tišine (ALI samo dok recordingRef.current === true)
const startAutoStopOnSilence = () => {
  if (!analyserRef.current) return;

  // reset starih loopova
  if (rafRef.current) cancelAnimationFrame(rafRef.current);
  rafRef.current = null;

  if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  silenceTimerRef.current = null;

  const analyser = analyserRef.current;
  const data = new Uint8Array(analyser.fftSize); // time-domain buffer

 // prag u RMS (0.00 - 0.30). Tipično 0.01–0.03.
 // koristi iz .env (ili fallback)
  const SILENCE_MS_LOCAL = SILENCE_MS;
  const RMS_THRESHOLD_LOCAL = RMS_THRESHOLD;

  let lastLoudAt = performance.now();

  const loop = () => {
    // radi samo dok snimaš
    if (!recordingRef.current || !analyserRef.current) return;

    analyser.getByteTimeDomainData(data);

    // RMS računanje
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128; // -1..1
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / data.length);

    // DEBUG (ostavi dok ne podesiš prag)
    // console.log("rms:", rms.toFixed(4));

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
  if (rafRef.current) cancelAnimationFrame(rafRef.current);
  rafRef.current = null;

  if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  silenceTimerRef.current = null;
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

      // ✅ uključi auto-stop na tišinu (3s)
      startAutoStopOnSilence();
    } catch (err) {
      console.error("💥 Failed to start recording:", err);
    }
  };

  // ✅ STOP (ručno ili auto)
  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    console.log(`[StopRecording] recorder state: ${recorder?.state}`);

    // ugasi silence loop/timer
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

      // 🔒 isto stanje kao kad klikneš stop: zaključaj mic dok avatar ne završi poruku
      updateMicState(false);

      console.log("⏹️ Recording stopped and mic disabled (until avatar finishes).");
    } catch (err) {
      console.error("💥 Failed to stop recording:", err);
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

  // 🔓 first click: unlock audio + startListening (equalizer) — ne pali recording
  useEffect(() => {
    const unlockAudio = () => {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();
      const buffer = context.createBuffer(1, 1, 22050);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      if (source.start) source.start(0);
      console.log("🔓 Audio context unlocked");
    };

    const onFirstGesture = async () => {
      unlockAudio();
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
    updateMicState(false); // 🔇 disable mic
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
    } finally {
      setLoading(false);
    }
  };

  const onMessagePlayed = () => {
    setMessages((prev) => prev.slice(1));
    updateMicState(true); // ✅ re-enable mic
    console.log("🎤 Mic re-enabled after avatar speech.");
  };

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