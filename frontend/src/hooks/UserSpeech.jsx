import { useEffect } from "react";
import { useSpeech } from "../context/SpeechContext";
import { useVoiceTrigger } from "../hooks/useVoiceTrigger";

const UserSpeech = () => {
  const {
    startRecording,
    stopRecording,
    recordingRef,
    micEnabledRef
  } = useSpeech();

  const speechControl = {
    onVoiceStart: () => {
      const isRecording = recordingRef.current;
      const micEnabled = micEnabledRef.current;

      console.debug("UserSpeech - 🔔 onVoiceStart triggered | recording:", isRecording, "| micEnabled:", micEnabled);

      if (!isRecording && micEnabled) {
        console.debug("▶️ Starting recording from onVoiceStart");
        startRecording();
      } else {
        console.debug("UserSpeech - ⏭ Skipping startRecording: Either already recording or mic disabled.");
      }
    },

    onVoiceStop: () => {
      const isRecording = recordingRef.current;

      console.debug("UserSpeech - 🔕 onVoiceStop triggered | recording:", isRecording);

      if (isRecording) {
        console.debug("UserSpeech - ⏹️ Stopping recording from onVoiceStop");
        stopRecording();
      } else {
        console.debug("UserSpeech - ⏭ Skipping stopRecording: Not recording.");
      }
    },
  };

  useVoiceTrigger(speechControl.onVoiceStart, speechControl.onVoiceStop, false);

  useEffect(() => {
    console.debug("📡 UserSpeech component mounted.");
    return () => console.debug("UserSpeech - 📴 UserSpeech component unmounted.");
  }, []);

  return null; // Ne prikazuje ništa, koristi se samo kao "kontroler"
};

export default UserSpeech;