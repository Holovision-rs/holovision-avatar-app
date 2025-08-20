
import React, { useEffect, useRef, useState } from "react";
import { SpeechContext } from "./SpeechContext";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

export const SpeechProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState(null);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [analyserNode, setAnalyserNode] = useState(null);
  const micEnabledRef = useRef(true);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingRef = useRef(false);

  const updateMicState = (enabled) => {
    setMicEnabled(enabled);
    micEnabledRef.current = enabled;
  };

  const initiateRecording = () => {
    audioChunksRef.current = [];
  };

  const onDataAvailable = (e) => {
    audioChunksRef.current.push(e.data);
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
        setMessages((prev) => [...prev, ...data.messages]);
      } catch (error) {
        console.error("❌ Audio send error:", error);
      } finally {
        setLoading(false);
      }
    };
  };

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        const recorder = new MediaRecorder(stream);
        recorder.onstart = initiateRecording;
        recorder.ondataavailable = onDataAvailable;
        recorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          sendAudioData(audioBlob);
        };
        mediaRecorderRef.current = recorder;
        console.log("🎙️ MediaRecorder is ready.");
      })
      .catch((err) => console.error("🎤 Microphone access error:", err));
  }, []);

  const startRecording = () => {
    const recorder = mediaRecorderRef.current;
    console.log(`[StartRecording] micEnabled: ${micEnabledRef.current}, recorder state: ${recorder?.state}`);
    if (!micEnabledRef.current) {
      console.log("🚫 Mic is disabled during avatar speech.");
      return;
    }

    if (!recorder) {
      console.warn("❌ MediaRecorder is not initialized.");
      return;
    }

    const actions = {
      inactive: () => {
        try {
          recorder.start();
          setRecording(true);
          recordingRef.current = true;
          console.log("🎬 Recording started");
        } catch (err) {
          console.error("💥 Failed to start recording:", err);
        }
      },
      recording: () => console.warn("⚠️ Already recording."),
      paused: () => console.warn("⚠️ Recorder is paused."),
    };

    (actions[recorder.state] || (() => console.warn("⚠️ Unknown state:", recorder.state)))();
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    console.log(`[StopRecording] recorder state: ${recorder?.state}`);
    if (!recorder) {
      console.warn("❌ MediaRecorder is not initialized.");
      return;
    }

    const actions = {
      recording: () => {
        try {
          recorder.stop();
          setRecording(false);
          recordingRef.current = false;
          updateMicState(false); // Disable mic until avatar finishes
          console.log("⏹️ Recording stopped and mic disabled");
        } catch (err) {
          console.error("💥 Failed to stop recording:", err);
        }
      },
      inactive: () => console.warn("⚠️ Already inactive."),
      paused: () => console.warn("⚠️ Recorder paused."),
    };

    (actions[recorder.state] || (() => console.warn("⚠️ Unknown state:", recorder.state)))();
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

  useEffect(() => {
    const unlockAudio = () => {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();
      const buffer = context.createBuffer(1, 1, 22050);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      if (source.start) source.start(0);
      else if (source.noteOn) source.noteOn(0);
      document.removeEventListener("touchstart", unlockAudio, false);
      document.removeEventListener("click", unlockAudio, false);
      console.log("🔓 Audio context unlocked");
    };

    document.addEventListener("touchstart", unlockAudio, false);
    document.addEventListener("click", unlockAudio, false);
  }, []);

  const tts = async (message) => {
    setLoading(true);
    updateMicState(false); // 🔇 disable mic
    console.log(`[TTS] Mic disabled and message sent: "${message}"`);
    try {
      const response = await fetch(`${backendUrl}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      setMessages((prev) => [...prev, ...data.messages]);
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
        setAnalyserNode
      }}
    >
      {children}
    </SpeechContext.Provider>
  );
};
