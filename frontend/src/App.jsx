import { Loader } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Leva } from "leva";
import { Scenario } from "./components/Scenario";
import { ChatInterface } from "./components/ChatInterface";
import { SpeechProvider } from "./context/SpeechProvider"; // dodaj import
import UserSpeech from "./hooks/UserSpeech"; // dodaj import

function App() {
  return (
    <SpeechProvider> {/* Omotaj sve unutar SpeechProvider */}
    <UserSpeech/>
      <Loader />
      <Leva collapsed hidden />
      <ChatInterface />
      <Canvas shadows camera={{ position: [0, 0, 0], fov: 10 }}>
        <Scenario />
      </Canvas>
    </SpeechProvider>
  );
}
export default App;