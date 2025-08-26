import React, { useEffect, useRef, useState } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { button, useControls } from "leva";
import * as THREE from "three";

import { useSpeech } from "../context/SpeechContext";
import { useAuth } from "../context/AuthContext";        
import { useNavigate } from "react-router-dom";          
import { useSessionTimer } from "../hooks/useSessionTimer";
import { useSubscriptionCheck } from "../hooks/useSubscriptionCheck";

import facialExpressions from "../constants/facialExpressions";
import visemesMapping from "../constants/visemesMapping";
import morphTargets from "../constants/morphTargets";

export function Avatar(props) {
  const { token, user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const { message, onMessagePlayed } = useSpeech();
  const { nodes, materials, scene } = useGLTF("/models/avatar.glb");
  const { animations } = useGLTF("/models/animations.glb");

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const group = useRef();
  const startTimeRef = useRef(null);

  const { actions, mixer } = useAnimations(animations, group);
  const [animation, setAnimation] = useState(
    animations.find((a) => a.name === "Idle") ? "Idle" : animations[0].name
  );
  const [facialExpression, setFacialExpression] = useState("");
  const [lipsync, setLipsync] = useState();
  const [audio, setAudio] = useState();
  const [blink, setBlink] = useState(false);
  const [setupMode, setSetupMode] = useState(false);

  // ✅ SUBSCRIPTION CHECK
  useSubscriptionCheck();

  // ✅ SESSION TIME LOG
  useEffect(() => {
    const startTime = Date.now();

    const sendUsageData = () => {
      const now = Date.now();
      const durationMs = now - startTime;
      const minutes = Math.floor(durationMs / 60000);

      if (minutes > 0 && token) {
        const data = JSON.stringify({
          timestamp: new Date().toISOString(),
          minutes,
        });

        navigator.sendBeacon(
          `${BACKEND_URL}/api/users/me/usage-log`,
          new Blob([data], { type: "application/json" })
        );

        fetch(`${BACKEND_URL}/api/me/usage-log`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: data,
        }).catch((err) => {
          console.error("Greška pri slanju usage log:", err);
        });
      }
    };

    const handleBeforeUnload = () => {
      sendUsageData();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      sendUsageData();
    };
  }, []);

  // ⏯️ Promena animacija kada dođe poruka
  useEffect(() => {
    if (!message) {
      setAnimation("Idle");
      return;
    }

    setAnimation(message.animation);
    setFacialExpression(message.facialExpression);
    setLipsync(message.lipsync);

    const audio = new Audio("data:audio/mp3;base64," + message.audio);
    audio.play();
    setAudio(audio);
    audio.onended = onMessagePlayed;
  }, [message]);

  // 🎞️ Pokretanje animacija
  useEffect(() => {
    if (actions[animation]) {
      actions[animation]
        .reset()
        .fadeIn(mixer.stats.actions.inUse === 0 ? 0 : 0.5)
        .play();

      return () => {
        actions[animation]?.fadeOut(0.5);
      };
    }
  }, [animation]);

  // 👀 Treptanje
  useEffect(() => {
    let blinkTimeout;

    const nextBlink = () => {
      blinkTimeout = setTimeout(() => {
        setBlink(true);
        setTimeout(() => {
          setBlink(false);
          nextBlink();
        }, 200);
      }, THREE.MathUtils.randInt(1000, 5000));
    };

    nextBlink();
    return () => clearTimeout(blinkTimeout);
  }, []);

  // 🧠 Lip sync i mimika
  useFrame(() => {
    if (!setupMode) {
      morphTargets.forEach((key) => {
        const mapping = facialExpressions[facialExpression];
        if (key !== "eyeBlinkLeft" && key !== "eyeBlinkRight") {
          lerpMorphTarget(key, mapping?.[key] || 0, 0.1);
        }
      });
    }

    lerpMorphTarget("eyeBlinkLeft", blink ? 1 : 0, 0.5);
    lerpMorphTarget("eyeBlinkRight", blink ? 1 : 0, 0.5);

    if (setupMode || !message || !lipsync) return;

    const currentAudioTime = audio?.currentTime;
    const applied = [];

    lipsync.mouthCues.forEach((cue) => {
      if (currentAudioTime >= cue.start && currentAudioTime <= cue.end) {
        const target = visemesMapping[cue.value];
        applied.push(target);
        lerpMorphTarget(target, 1, 0.2);
      }
    });

    Object.values(visemesMapping).forEach((key) => {
      if (!applied.includes(key)) lerpMorphTarget(key, 0, 0.1);
    });
  });

  // 🎛️ Leva kontrola (leva panel)
  useControls("FacialExpressions", {
    animation: {
      value: animation,
      options: animations.map((a) => a.name),
      onChange: setAnimation,
    },
    facialExpression: {
      options: Object.keys(facialExpressions),
      onChange: setFacialExpression,
    },
    setupMode: button(() => setSetupMode(!setupMode)),
    logMorphTargetValues: button(() => {
      const emotionValues = {};
      Object.values(nodes).forEach((node) => {
        if (node.morphTargetInfluences && node.morphTargetDictionary) {
          morphTargets.forEach((key) => {
            if (["eyeBlinkLeft", "eyeBlinkRight"].includes(key)) return;
            const value = node.morphTargetInfluences[node.morphTargetDictionary[key]];
            if (value > 0.01) emotionValues[key] = value;
          });
        }
      });
      console.log(JSON.stringify(emotionValues, null, 2));
    }),
  });

  useControls("MorphTarget", () =>
    Object.assign(
      {},
      ...morphTargets.map((key) => ({
        [key]: {
          label: key,
          value: 0,
          min: 0,
          max: 1,
          onChange: (val) => lerpMorphTarget(key, val, 0.1),
        },
      }))
    )
  );

  // 💀 Helper funkcija za morph target
  const lerpMorphTarget = (target, value, speed = 0.1) => {
    scene.traverse((child) => {
      if (child.isSkinnedMesh && child.morphTargetDictionary) {
        const index = child.morphTargetDictionary[target];
        if (index !== undefined) {
          child.morphTargetInfluences[index] = THREE.MathUtils.lerp(
            child.morphTargetInfluences[index],
            value,
            speed
          );
        }
      }
    });
  };

  // 🧍‍♂️ Render 3D avatara
  return (
    <group {...props} dispose={null} ref={group} position={[0, -0.5, 0]}>
      <primitive object={nodes.Hips} />
      
      <skinnedMesh name="EyeLeft" geometry={nodes.EyeLeft.geometry} material={materials.Wolf3D_Eye} skeleton={nodes.EyeLeft.skeleton} morphTargetDictionary={nodes.EyeLeft.morphTargetDictionary} morphTargetInfluences={nodes.EyeLeft.morphTargetInfluences} />

      <skinnedMesh name="EyeRight" geometry={nodes.EyeRight.geometry} material={materials.Wolf3D_Eye} skeleton={nodes.EyeRight.skeleton} morphTargetDictionary={nodes.EyeRight.morphTargetDictionary} morphTargetInfluences={nodes.EyeRight.morphTargetInfluences} />

      <skinnedMesh name="Wolf3D_Head" geometry={nodes.Wolf3D_Head.geometry} material={materials.Wolf3D_Skin} skeleton={nodes.Wolf3D_Head.skeleton} morphTargetDictionary={nodes.Wolf3D_Head.morphTargetDictionary} morphTargetInfluences={nodes.Wolf3D_Head.morphTargetInfluences} />

      <skinnedMesh name="Wolf3D_Teeth" geometry={nodes.Wolf3D_Teeth.geometry} material={materials.Wolf3D_Teeth} skeleton={nodes.Wolf3D_Teeth.skeleton} morphTargetDictionary={nodes.Wolf3D_Teeth.morphTargetDictionary} morphTargetInfluences={nodes.Wolf3D_Teeth.morphTargetInfluences} />

      <skinnedMesh geometry={nodes.Wolf3D_Glasses.geometry} material={materials.Wolf3D_Glasses} skeleton={nodes.Wolf3D_Glasses.skeleton} />

      <skinnedMesh geometry={nodes.Wolf3D_Headwear.geometry} material={materials.Wolf3D_Headwear} skeleton={nodes.Wolf3D_Headwear.skeleton} />

      <skinnedMesh geometry={nodes.Wolf3D_Body.geometry} material={materials.Wolf3D_Body} skeleton={nodes.Wolf3D_Body.skeleton} />

      <skinnedMesh geometry={nodes.Wolf3D_Outfit_Bottom.geometry} material={materials.Wolf3D_Outfit_Bottom} skeleton={nodes.Wolf3D_Outfit_Bottom.skeleton} />

      <skinnedMesh geometry={nodes.Wolf3D_Outfit_Footwear.geometry} material={materials.Wolf3D_Outfit_Footwear} skeleton={nodes.Wolf3D_Outfit_Footwear.skeleton} />

      <skinnedMesh geometry={nodes.Wolf3D_Outfit_Top.geometry} material={materials.Wolf3D_Outfit_Top} skeleton={nodes.Wolf3D_Outfit_Top.skeleton} />
    </group>
  );
}

useGLTF.preload("/models/avatar.glb");
