import { useEffect, useRef } from "react";
import { useSpeech } from "../context/SpeechContext";

export const useVoiceTrigger = (onVoiceStart, onVoiceStop, enabled = false) => {
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const speakingRef = useRef(false);
  const silenceTimer = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);

  const { micEnabledRef, setAnalyserNode } = useSpeech();

  const threshold = 50;
  const timeoutMs = 1000;

  const getCurrentVolume = () => {
    if (!analyserRef.current || !dataArrayRef.current) return 0;
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);

    let sum = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) sum += dataArrayRef.current[i];
    return sum / dataArrayRef.current.length;
  };

  const stopAll = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    silenceTimer.current = null;

    speakingRef.current = false;

    try {
      if (audioContextRef.current) audioContextRef.current.close();
    } catch (e) {}
    audioContextRef.current = null;

    try {
      streamRef.current?.getTracks()?.forEach((t) => t.stop());
    } catch (e) {}
    streamRef.current = null;

    analyserRef.current = null;
    dataArrayRef.current = null;

    setAnalyserNode(null);
    console.debug("useVoiceTrigger - 🧹 stopped (audio + stream + raf).");
  };

  const checkVolume = () => {
    const volume = getCurrentVolume();
    const isLoud = volume > threshold;

    // Debug (možeš ugasiti kasnije)
    // console.debug(`useVoiceTrigger - 🔊 ${volume.toFixed(2)} loud=${isLoud} speaking=${speakingRef.current} micEnabled=${micEnabledRef.current}`);

    if (isLoud) {
      if (!micEnabledRef.current) {
        // mic “zaključan” dok avatar priča → ignoriši
      } else if (!speakingRef.current) {
        speakingRef.current = true;
        console.debug(`useVoiceTrigger - 🎤 Voice START — vol=${volume.toFixed(2)}`);
        onVoiceStart?.();
      }

      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => {
        if (speakingRef.current) {
          speakingRef.current = false;
          console.debug(`useVoiceTrigger - 🤫 Voice STOP — vol=${volume.toFixed(2)}`);
          onVoiceStop?.();
        }
      }, timeoutMs);
    }

    rafRef.current = requestAnimationFrame(checkVolume);
  };

  useEffect(() => {
    // ✅ najbitnije: dok nije enabled, ne pipaj mic uopšte
    if (!enabled) {
      stopAll();
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext();

        const source = audioContextRef.current.createMediaStreamSource(stream);

        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;

        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);

        setAnalyserNode(analyserRef.current); // za equalizer

        source.connect(analyserRef.current);

        console.debug("useVoiceTrigger - 🎧 enabled, mic connected, monitoring...");
        checkVolume();
      } catch (err) {
        console.error("useVoiceTrigger - ❌ mic access failed:", err);
        stopAll();
      }
    };

    init();

    return () => {
      cancelled = true;
      stopAll();
    };
    // bitno: zavisi od enabled
  }, [enabled]);
};