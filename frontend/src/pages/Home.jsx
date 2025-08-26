// pages/Home.jsx
import React from "react";
import { Loader } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Leva } from "leva";
import { Scenario } from "../components/Scenario";
import { ChatInterface } from "../components/ChatInterface";
import { SpeechProvider } from "../context/SpeechProvider";
import UserSpeech from "../hooks/UserSpeech";
import Navbar from "../components/Navbar";

const Home = () => (

  <SpeechProvider>
    <UserSpeech />
    <Navbar /> {/* 👈 Ovde prikazuješ navbar */}
    <Loader />
    <Leva collapsed hidden />
    <ChatInterface />
    <Canvas shadows camera={{ position: [0, 0, 0], fov: 10 }}>
      <Scenario />
    </Canvas>
  </SpeechProvider>
);

export default Home;