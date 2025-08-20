import { useRef } from "react";
import { useSpeech } from "../context/SpeechContext";
import {VoiceEqualizer} from "./VoiceEqualizer";

export const ChatInterface = ({ hidden, ...props }) => {
  const { analyserNode} = useSpeech();
  const input = useRef();
  const { tts, loading, message, startRecording, stopRecording, recording } = useSpeech();

  const sendMessage = () => {
    const text = input.current.value;
    if (!loading && !message) {
      tts(text);
      input.current.value = "";
    }
  };
  if (hidden) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 z-10 flex justify-between p-4 flex-col pointer-events-none">

      <div className="w-full flex flex-col items-end justify-center gap-4"></div>
      <div className="flex items-center gap-2 pointer-events-auto max-w-screen-sm w-full mx-auto">
        <button
          onClick={recording ? stopRecording : startRecording}
          className={`center bg-red-500 hover:bg-red-600 text-white p-2 px-2 font-semibold uppercase rounded-full ${
            recording ? "bg-green-500 hover:bg-green-600" : ""
          } ${loading || message ? "cursor-not-allowed opacity-30" : ""}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
            />
          </svg>
        </button>
        <VoiceEqualizer analyserNode={analyserNode} /> 
      </div>
    </div>
  );
};
