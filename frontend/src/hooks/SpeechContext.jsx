import { createContext, useContext } from "react";

export const SpeechContext = createContext();


export const useSpeech = () => {
  const context = useContext(SpeechContext);
  if (!context) throw new Error("useSpeech must be used within SpeechProvider");
  return context;
};
