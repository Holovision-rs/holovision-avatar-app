import { useEffect, useRef, useState } from "react";
import { useSpeech } from "../context/SpeechContext";

export const useVoiceTrigger = (onVoiceStart, onVoiceStop) => {
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const speakingRef = useRef(false);
  const silenceTimer = useRef(null);
  const [analyserNode] = useState(null);
  const { micEnabledRef, setAnalyserNode } = useSpeech();

  const volumeMonitor = {
    threshold: 50,
    timeoutMs: 1000,

    getCurrentVolume: () => {
      if (!analyserRef.current || !dataArrayRef.current) return 0;
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      return (
        dataArrayRef.current.reduce((sum, val) => sum + val, 0) /
        dataArrayRef.current.length
      );
    },

    handleVoiceStart(volume) {
      if (!micEnabledRef.current) {
        console.debug("useVoiceTrigger - 🛑 Mic is disabled — skipping onVoiceStart()");
        return;
      }
      if (!speakingRef.current) {
        speakingRef.current = true;
        console.debug(`useVoiceTrigger - 🎤 Voice START detected — Volume: ${volume.toFixed(2)} | micEnabled: ${micEnabledRef.current}`);
        onVoiceStart?.();
      }
    },

    handleVoiceStop(volume) {
      if (speakingRef.current) {
        speakingRef.current = false;
        console.debug(`useVoiceTrigger - 🤫 Voice STOPPED after silence — Volume: ${volume.toFixed(2)} | micEnabled: ${micEnabledRef.current}`);
        onVoiceStop?.();
      }
    },
  };

  const checkVolume = () => {
    const volume = volumeMonitor.getCurrentVolume();
    const isLoud = volume > volumeMonitor.threshold;

    console.debug(`useVoiceTrigger - 🔊 Volume Check — Volume: ${volume.toFixed(2)} | isLoud: ${isLoud} | speaking: ${speakingRef.current} | micEnabled: ${micEnabledRef.current}`);

    if (isLoud) {
      volumeMonitor.handleVoiceStart(volume);

      clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => {
        volumeMonitor.handleVoiceStop(volume);
      }, volumeMonitor.timeoutMs);
    }

    requestAnimationFrame(checkVolume);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContextRef.current.createMediaStreamSource(stream);

        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
        setAnalyserNode(analyserRef.current); // for visualizer component
        source.connect(analyserRef.current);
        console.debug("useVoiceTrigger - 🎧 Microphone stream connected, starting volume check loop...");
        checkVolume();
      } catch (err) {
        console.error("useVoiceTrigger - ❌ Failed to access microphone:", err);
      }
    };

    init();

    return () => {
      if (audioContextRef.current) audioContextRef.current.close();
      clearTimeout(silenceTimer.current);
      console.debug("useVoiceTrigger - 🧹 Cleaned up audio context and timers.");
    };
  }, []);
};
