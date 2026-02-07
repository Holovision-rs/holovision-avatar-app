import React, { useEffect, useRef, useState, useCallback } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { button, useControls } from "leva";
import * as THREE from "three";

import { useSpeech } from "../context/SpeechContext";
import { useAuth } from "../context/AuthContext";
import { useSessionTimer } from "../hooks/useSessionTimer";
import { useSubscriptionCheck } from "../hooks/useSubscriptionCheck";

import facialExpressions from "../constants/facialExpressions";
import visemesMapping from "../constants/visemesMapping";
import morphTargets from "../constants/morphTargets";

// base64 -> ArrayBuffer
const base64ToArrayBuffer = (base64) => {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

const makeMsgKey = (msg) =>
  msg?.id || msg?.audio?.slice?.(0, 24) || JSON.stringify(msg || {}).slice(0, 48);

export function Avatar(props) {
  const { token } = useAuth();

  const {
    message,
    onMessagePlayed,
    onAvatarPlaybackStart,
    ensurePlaybackContext,
    playbackCtxRef,
  } = useSpeech();

  const { nodes, materials, scene } = useGLTF("/models/avatar.glb");
  const { animations } = useGLTF("/models/animations.glb");

  const group = useRef();
  const { actions, mixer } = useAnimations(animations, group);

  const [animation, setAnimation] = useState(
    animations.find((a) => a.name === "Idle") ? "Idle" : animations[0].name
  );
  const [facialExpression, setFacialExpression] = useState("");
  const [lipsync, setLipsync] = useState(null);
  const [blink, setBlink] = useState(false);
  const [setupMode, setSetupMode] = useState(false);

  useSessionTimer(true, token);
  useSubscriptionCheck();

  // ✅ WebAudio refs
  const sourceRef = useRef(null);
  const startedAtRef = useRef(null);

  // guards
  const endedRef = useRef(false);
  const manualStopRef = useRef(false);
  const playJobIdRef = useRef(0);        // cancel async decode/play
  const endedJobIdRef = useRef(0);       // ✅ spreči da “stari job” okine dequeue
  const handledKeyRef = useRef(null);    // ✅ spreči dupli dequeue iste poruke

  const safeOnMessagePlayed = useCallback(
    (key, jobId) => {
      // 1) ako je već završeno, ne ponavljaj
      if (endedRef.current) return;

      // 2) ako je ovo stari job, ignoriši
      if (jobId !== endedJobIdRef.current) return;

      // 3) ako je ista poruka već handled, ignoriši
      if (handledKeyRef.current === key) return;

      handledKeyRef.current = key;
      endedRef.current = true;

      onMessagePlayed?.();
    },
    [onMessagePlayed]
  );

  const stopCurrentAudio = useCallback(() => {
    manualStopRef.current = true;

    try {
      if (sourceRef.current) {
        sourceRef.current.onended = null;
        sourceRef.current.stop(0);
      }
    } catch {}

    sourceRef.current = null;
    startedAtRef.current = null;

    setTimeout(() => {
      manualStopRef.current = false;
    }, 0);
  }, []);

  const playWebAudioFromMessage = useCallback(
    async (msg) => {
      if (!msg?.audio) return;

      const key = makeMsgKey(msg);

      // ✅ novi job (otkazuje sve prethodne async decode/play)
      const myJobId = ++playJobIdRef.current;
      endedJobIdRef.current = myJobId;

      // reset local guards za novu poruku
      endedRef.current = false;
      handledKeyRef.current = null;

      // obezbedi ctx
      let ctx = playbackCtxRef?.current;
      if (!ctx) ctx = await ensurePlaybackContext?.();
      if (!ctx) {
        console.warn("❌ No AudioContext available for playback");
        return;
      }

      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {}
      }

      // stop prethodno (pre decode-a da ne preklapa)
      stopCurrentAudio();

      // decode
      const arrayBuffer = base64ToArrayBuffer(msg.audio);

      let audioBuffer = null;
      try {
        audioBuffer = await new Promise((resolve, reject) => {
          ctx.decodeAudioData(
            arrayBuffer.slice(0),
            (buf) => resolve(buf),
            (err) => reject(err)
          );
        });
      } catch (e) {
        if (myJobId !== playJobIdRef.current) return;
        console.warn("❌ decodeAudioData failed", e);
        // ako decode fail -> da ne zaglavi queue
        safeOnMessagePlayed(key, myJobId);
        return;
      }

      // ✅ ako je stigla nova poruka dok smo dekodirali → ne startuj staro
      if (myJobId !== playJobIdRef.current) return;

      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(ctx.destination);

      src.onended = () => {
        if (manualStopRef.current) return;
        safeOnMessagePlayed(key, myJobId);
      };

      sourceRef.current = src;

      const when = ctx.currentTime + 0.005;
      startedAtRef.current = when;

      try {
        src.start(when);

        // ✅ NEW: javi provider-u da je playback stvarno krenuo + trajanje
        // (samo ako je i dalje aktuelan job)
        if (myJobId === playJobIdRef.current) {
          onAvatarPlaybackStart?.(Number(audioBuffer?.duration || 0));
        }
      } catch (e) {
        console.warn("❌ WebAudio start failed", e);
        safeOnMessagePlayed(key, myJobId);
      }
    },
    [
      ensurePlaybackContext,
      playbackCtxRef,
      onAvatarPlaybackStart,
      safeOnMessagePlayed,
      stopCurrentAudio,
    ]
  );

  // ⏯️ Kad dođe poruka: set anim/facial/lipsync i pusti WebAudio
  useEffect(() => {
    // ✅ otkaži prethodne async poslove + stop audio
    playJobIdRef.current++;
    stopCurrentAudio();

    endedRef.current = false;
    handledKeyRef.current = null;

    if (!message) {
      setAnimation("Idle");
      setFacialExpression("");
      setLipsync(null);
      return;
    }

    setAnimation(message.animation || "Idle");
    setFacialExpression(message.facialExpression || "");
    setLipsync(message.lipsync || null);

    playWebAudioFromMessage(message);

    return () => {
      playJobIdRef.current++;
      stopCurrentAudio();
    };
  }, [message, playWebAudioFromMessage, stopCurrentAudio]);

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

    const ctx = playbackCtxRef?.current;
    const startedAt = startedAtRef.current;
    if (!ctx || startedAt == null) return;

    const currentAudioTime = Math.max(0, ctx.currentTime - startedAt);

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

  // 🎛️ Leva
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