import { useRef } from "react";
import { useSpeech } from "../context/SpeechContext";
import { VoiceEqualizer } from "./VoiceEqualizer";

export const ChatInterface = ({ hidden }) => {
  const input = useRef();

  const {
    analyserNode,
    loading,
    message,
    startRecording,
    stopRecording,
    recording,
    micEnabled,
    unlockAudioOnce,
  } = useSpeech();

  if (hidden) return null;

  // ✅ START je blokiran ako čekamo odgovor ili mic nije dozvoljen
  const startBlocked = loading || !!message || !micEnabled;

  // ✅ STOP nikad ne blokiraj (moraš uvek moći da prekineš snimanje)
  const disabled = recording ? false : startBlocked;

  const handleMicClick = async () => {
    console.log("[MIC CLICK]", { recording, loading, hasMessage: !!message, micEnabled });

    // ✅ STOP uvek radi
    if (recording) {
      await stopRecording({ userGesture: true });
      return;
    }

    // ✅ START radi samo ako nije blokiran
    if (startBlocked) return;

    try {
      await unlockAudioOnce?.();
    } catch {}

    await startRecording();
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 z-10 flex justify-between p-4 flex-col pointer-events-none">
      <div className="w-full flex flex-col items-end justify-center gap-4" />

      <div className="flex items-center gap-2 pointer-events-auto max-w-screen-sm w-full mx-auto">
        <button
          type="button"
          onClick={handleMicClick}
          disabled={disabled}
          className={`center text-white p-2 px-2 font-semibold uppercase rounded-full
            ${recording ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}
            ${disabled ? "cursor-not-allowed opacity-30" : ""}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
            />
          </svg>
        </button>

        <VoiceEqualizer analyserNode={analyserNode} />
      </div>
    </div>
  );
};