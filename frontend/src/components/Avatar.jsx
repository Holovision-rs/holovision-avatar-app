import React, { useEffect, useRef, useState, useCallback } from "react";
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
  const { token } = useAuth();
  const navigate = useNavigate();

  const { message, onMessagePlayed } = useSpeech();
  const { nodes, materials, scene } = useGLTF("/models/avatar.glb");
  const { animations } = useGLTF("/models/animations.glb");

  const group = useRef();
  const { actions, mixer } = useAnimations(animations, group);

  const [animation, setAnimation] = useState(
    animations.find((a) => a.name === "Idle") ? "Idle" : animations[0].name
  );
  const [facialExpression, setFacialExpression] = useState("");
  const [lipsync, setLipsync] = useState(null);
  const [audio, setAudio] = useState(null);
  const [blink, setBlink] = useState(false);
  const [setupMode, setSetupMode] = useState(false);

  // ✅ refs za kontrolu audio lifecycle-a
  const audioRef = useRef(null);
  const endedRef = useRef(false);
  const fallbackTimerRef = useRef(null);

  useSessionTimer(true, token);
  useSubscriptionCheck();

  const safeOnMessagePlayed = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;

    // očisti fallback timer
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    onMessagePlayed?.();
  }, [onMessagePlayed]);

  // ⏯️ Kad dođe poruka: postavi anim/facial/lipsync i pusti audio
  useEffect(() => {
    // pre nego što pustimo novi audio, ugasi stari
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = "";
      } catch {}
      audioRef.current = null;
    }

    // očisti fallback timer
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    endedRef.current = false;

    if (!message) {
      setAnimation("Idle");
      setFacialExpression("");
      setLipsync(null);
      setAudio(null);
      return;
    }

    setAnimation(message.animation || "Idle");
    setFacialExpression(message.facialExpression || "");
    setLipsync(message.lipsync || null);

    const a = new Audio("data:audio/mp3;base64," + message.audio);
    a.playsInline = true; // ✅ iOS

    a.onended = () => {
      safeOnMessagePlayed();
    };

    // ✅ pokušaj play, a ako je blokirano -> fallback
    a.play().catch((err) => {
      console.warn("🔇 audio.play blocked (mobile autoplay)", err);

      // fallback: ako ne može play, posle kratkog vremena simuliraj kraj
      fallbackTimerRef.current = setTimeout(() => {
        safeOnMessagePlayed();
      }, 800);
    });

    audioRef.current = a;
    setAudio(a);

    // cleanup kad se promeni message (ili unmount)
    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = "";
        } catch {}
        audioRef.current = null;
      }
    };
  }, [message, safeOnMessagePlayed]);

  // 🎞️ Animacije
  useEffect(() => {
    if (!actions?.[animation]) return;

    actions[animation]
      .reset()
      .fadeIn(mixer?.stats?.actions?.inUse === 0 ? 0 : 0.5)
      .play();

    return () => {
      actions[animation]?.fadeOut(0.5);
    };
  }, [animation, actions, mixer]);

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

  // Helper: morph lerp
  const lerpMorphTarget = useCallback(
    (target, value, speed = 0.1) => {
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
    },
    [scene]
  );

  // 🧠 Lip sync + mimika
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

    const currentAudioTime = audioRef.current?.currentTime ?? audio?.currentTime;
    if (currentAudioTime == null) return;

    const applied = [];

    lipsync.mouthCues?.forEach((cue) => {
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

  // 🎛️ Leva (ostaje isto)
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
    setupMode: button(() => setSetupMode((v) => !v)),
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

  return (
    <group {...props} dispose={null} ref={group} position={[0, -0.5, 0]}>
      <primitive object={nodes.Hips} />

      <skinnedMesh
        name="EyeLeft"
        geometry={nodes.EyeLeft.geometry}
        material={materials.Wolf3D_Eye}
        skeleton={nodes.EyeLeft.skeleton}
        morphTargetDictionary={nodes.EyeLeft.morphTargetDictionary}
        morphTargetInfluences={nodes.EyeLeft.morphTargetInfluences}
      />

      <skinnedMesh
        name="EyeRight"
        geometry={nodes.EyeRight.geometry}
        material={materials.Wolf3D_Eye}
        skeleton={nodes.EyeRight.skeleton}
        morphTargetDictionary={nodes.EyeRight.morphTargetDictionary}
        morphTargetInfluences={nodes.EyeRight.morphTargetInfluences}
      />

      <skinnedMesh
        name="Wolf3D_Head"
        geometry={nodes.Wolf3D_Head.geometry}
        material={materials.Wolf3D_Skin}
        skeleton={nodes.Wolf3D_Head.skeleton}
        morphTargetDictionary={nodes.Wolf3D_Head.morphTargetDictionary}
        morphTargetInfluences={nodes.Wolf3D_Head.morphTargetInfluences}
      />

      <skinnedMesh
        name="Wolf3D_Teeth"
        geometry={nodes.Wolf3D_Teeth.geometry}
        material={materials.Wolf3D_Teeth}
        skeleton={nodes.Wolf3D_Teeth.skeleton}
        morphTargetDictionary={nodes.Wolf3D_Teeth.morphTargetDictionary}
        morphTargetInfluences={nodes.Wolf3D_Teeth.morphTargetInfluences}
      />

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
useGLTF.preload("/models/animations.glb");