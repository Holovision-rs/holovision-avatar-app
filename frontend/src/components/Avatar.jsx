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

export function Avatar(props) {
  const { token } = useAuth();

  const {
    playBatch,
    playBatchId,
    onBatchPlayed,
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

  // ✅ Playback session refs
  const sessionIdRef = useRef(0);
  const sourcesRef = useRef([]); // [{src, startAt, endAt, msg}]
  const startedAtRef = useRef(null); // start time of first segment (ctx time)

  const activeIndexRef = useRef(0); // which segment currently "active" for lipsync/face
  const [activeIndex, setActiveIndex] = useState(0);

  // ✅ viseme keys (da facialExpression ne gazi viseme)
  const VISEME_KEYS = useRef(new Set(Object.values(visemesMapping))).current;

  const stopAll = useCallback(() => {
    try {
      sourcesRef.current.forEach((s) => {
        try {
          s.src.onended = null;
          s.src.stop(0);
        } catch {}
      });
    } catch {}
    sourcesRef.current = [];
    startedAtRef.current = null;
    activeIndexRef.current = 0;
    setActiveIndex(0);
  }, []);

  const decodeAudio = useCallback(async (ctx, base64) => {
    const arrayBuffer = base64ToArrayBuffer(base64);
    return await new Promise((resolve, reject) => {
      ctx.decodeAudioData(
        arrayBuffer.slice(0),
        (buf) => resolve(buf),
        (err) => reject(err)
      );
    });
  }, []);

  // ✅ start a full batch gapless
  const playBatchGapless = useCallback(
    async (batch) => {
      if (!batch?.length) return;

      const mySession = ++sessionIdRef.current;

      let ctx = playbackCtxRef?.current;
      if (!ctx) ctx = await ensurePlaybackContext?.();
      if (!ctx) return;

      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {}
      }

      stopAll();

      // decode all first (stabilno i bez seckanja)
      let buffers = [];
      try {
        buffers = await Promise.all(batch.map((m) => decodeAudio(ctx, m.audio)));
      } catch (e) {
        if (mySession !== sessionIdRef.current) return;
        console.warn("❌ decode failed", e);
        onBatchPlayed?.("decode_failed");
        return;
      }

      if (mySession !== sessionIdRef.current) return;

      const now = ctx.currentTime;
      const firstWhen = now + 0.02; // mali offset za sigurnost
      startedAtRef.current = firstWhen;

      const scheduled = [];
      let t = firstWhen;

      buffers.forEach((buf, i) => {
        const msg = batch[i];

        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);

        const startAt = t;
        const endAt = t + buf.duration;

        // onended samo na poslednjem segmentu
        if (i === buffers.length - 1) {
          src.onended = () => {
            if (mySession !== sessionIdRef.current) return;
            onBatchPlayed?.("batch_onended");
          };
        }

        scheduled.push({ src, startAt, endAt, msg, duration: buf.duration });

        t = endAt; // gapless
      });

      // schedule start
      scheduled.forEach((s) => {
        try {
          s.src.start(s.startAt);
        } catch (e) {
          console.warn("❌ start failed", e);
        }
      });

      sourcesRef.current = scheduled;

      // ✅ IMPORTANT FIX:
      // Force apply FIRST message immediately (jer activeIndex je već 0 pa effect ne okine)
      activeIndexRef.current = 0;
      setActiveIndex(0);
      const firstMsg = scheduled?.[0]?.msg;
      setAnimation(firstMsg?.animation || "Idle");
      setFacialExpression(firstMsg?.facialExpression || "");
      setLipsync(firstMsg?.lipsync || null);

      // marker za “start”
      onAvatarPlaybackStart?.(buffers.reduce((sum, b) => sum + b.duration, 0));
    },
    [
      decodeAudio,
      ensurePlaybackContext,
      onAvatarPlaybackStart,
      onBatchPlayed,
      playbackCtxRef,
      stopAll,
    ]
  );

  // ✅ When new batch arrives → play it
  useEffect(() => {
    // cancel previous session
    sessionIdRef.current++;
    stopAll();

    if (!playBatch?.length) {
      setAnimation("Idle");
      setFacialExpression("");
      setLipsync(null);
      return;
    }

    playBatchGapless(playBatch);

    return () => {
      sessionIdRef.current++;
      stopAll();
    };
  }, [playBatchId, playBatch, playBatchGapless, stopAll]);

  // ✅ determine which segment is currently active, update expression/lipsync
  useFrame(() => {
    if (!sourcesRef.current.length) return;

    const ctx = playbackCtxRef?.current;
    if (!ctx || startedAtRef.current == null) return;

    const t = ctx.currentTime;

    // find active segment
    let idx = activeIndexRef.current;

    // move forward only (cheap)
    while (idx < sourcesRef.current.length - 1 && t >= sourcesRef.current[idx].endAt) {
      idx++;
    }

    if (idx !== activeIndexRef.current) {
      activeIndexRef.current = idx;
      setActiveIndex(idx);
    }
  });

  // when activeIndex changes, apply message animation/face/lipsync
  useEffect(() => {
    const seg = sourcesRef.current?.[activeIndex];
    if (!seg?.msg) return;

    const msg = seg.msg;

    setAnimation(msg.animation || "Idle");
    setFacialExpression(msg.facialExpression || "");
    setLipsync(msg.lipsync || null);
  }, [activeIndex]);

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

  // 🧠 Lip sync + mimika (po aktivnom segmentu)
  useFrame(() => {
    // 1) facial expression (ali NE diraj viseme)
    if (!setupMode) {
      morphTargets.forEach((key) => {
        if (VISEME_KEYS.has(key)) return; // ✅ ne gazimo viseme facial expression-om

        const mapping = facialExpressions[facialExpression];
        if (key !== "eyeBlinkLeft" && key !== "eyeBlinkRight") {
          lerpMorphTarget(key, mapping?.[key] || 0, 0.1);
        }
      });
    }

    // 2) blink
    lerpMorphTarget("eyeBlinkLeft", blink ? 1 : 0, 0.5);
    lerpMorphTarget("eyeBlinkRight", blink ? 1 : 0, 0.5);

    // 3) visemes
    if (setupMode || !lipsync) return;

    const ctx = playbackCtxRef?.current;
    const seg = sourcesRef.current?.[activeIndexRef.current];
    if (!ctx || !seg) return;

    // audio time within current segment
    const localTime = Math.max(0, ctx.currentTime - seg.startAt);

    const applied = [];

    lipsync.mouthCues?.forEach((cue) => {
      if (localTime >= cue.start && localTime <= cue.end) {
        const target = visemesMapping[cue.value];
        if (!target) return;
        applied.push(target);

        // ✅ pojačaj reakciju usta
        lerpMorphTarget(target, 1, 0.35);
      }
    });

    // ✅ brži reset (da deluje življe)
    Object.values(visemesMapping).forEach((key) => {
      if (!applied.includes(key)) lerpMorphTarget(key, 0, 0.15);
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

      <skinnedMesh
        geometry={nodes.Wolf3D_Glasses.geometry}
        material={materials.Wolf3D_Glasses}
        skeleton={nodes.Wolf3D_Glasses.skeleton}
      />
      <skinnedMesh
        geometry={nodes.Wolf3D_Headwear.geometry}
        material={materials.Wolf3D_Headwear}
        skeleton={nodes.Wolf3D_Headwear.skeleton}
      />
      <skinnedMesh
        geometry={nodes.Wolf3D_Body.geometry}
        material={materials.Wolf3D_Body}
        skeleton={nodes.Wolf3D_Body.skeleton}
      />
      <skinnedMesh
        geometry={nodes.Wolf3D_Outfit_Bottom.geometry}
        material={materials.Wolf3D_Outfit_Bottom}
        skeleton={nodes.Wolf3D_Outfit_Bottom.skeleton}
      />
      <skinnedMesh
        geometry={nodes.Wolf3D_Outfit_Footwear.geometry}
        material={materials.Wolf3D_Outfit_Footwear}
        skeleton={nodes.Wolf3D_Outfit_Footwear.skeleton}
      />
      <skinnedMesh
        geometry={nodes.Wolf3D_Outfit_Top.geometry}
        material={materials.Wolf3D_Outfit_Top}
        skeleton={nodes.Wolf3D_Outfit_Top.skeleton}
      />
    </group>
  );
}

useGLTF.preload("/models/avatar.glb");
useGLTF.preload("/models/animations.glb");