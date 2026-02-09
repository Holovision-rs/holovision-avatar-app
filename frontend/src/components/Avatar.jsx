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
const base64ToArrayBuffer = (input) => {
  if (!input) return new ArrayBuffer(0);
  // ✅ podrži i data URL i čist base64
  const base64 = input.includes("base64,") ? input.split("base64,")[1] : input;

  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

// ✅ polling helper (async lipsync)
async function fetchLipsync(jobId, index, signal) {
  const base = import.meta.env.VITE_BACKEND_URL;
  const r = await fetch(`${base}/lipsync/${jobId}/${index}`, { signal });
  if (!r.ok) return null; // 404 = pending/missing/expired
  return await r.json();  // { status: "pending"|"ready"|"error"|"missing", lipsync, error }
}

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
  const [facialExpression, setFacialExpression] = useState("default");
  const [lipsync, setLipsync] = useState(null);
  const [blink, setBlink] = useState(false);
  const [setupMode, setSetupMode] = useState(false);

  useSessionTimer(true, token);
  useSubscriptionCheck();

  // ✅ Playback session refs
  const sessionIdRef = useRef(0);
  const sourcesRef = useRef([]); // [{src, startAt, endAt, msg}]
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  // ✅ viseme keys (da facialExpression ne gazi viseme)
  const VISEME_KEYS = useRef(new Set(Object.values(visemesMapping))).current;

  // ✅ PRO: ne diraj nijedan mouth/jaw morph iz facialExpressions (sprečava "kez" i konflikt)
  const isMouthOrJawKey = useCallback(
    (key) => {
      const k = String(key || "").toLowerCase();
      if (VISEME_KEYS.has(key)) return true;
      return k.includes("mouth") || k.includes("jaw");
    },
    [VISEME_KEYS]
  );

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

  // ✅ helper: choose safe talking animation
  const pickSpeakingAnimation = useCallback(
    (requested) => {
      const name = requested || "TalkingOne";
      // ako backend pošalje Idle dok audio traje → deluje kao da "stane u sred teksta"
      if (name === "Idle")
        return animations.find((a) => a.name === "TalkingOne") ? "TalkingOne" : name;
      return name;
    },
    [animations]
  );

  // ✅ start a full batch gapless (decode all -> schedule)
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

      const firstWhen = ctx.currentTime + 0.03;

      const scheduled = [];
      let t = firstWhen;

      buffers.forEach((buf, i) => {
        const msg = batch[i];

        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);

        const startAt = t;
        const endAt = t + buf.duration;

        if (i === buffers.length - 1) {
          src.onended = () => {
            if (mySession !== sessionIdRef.current) return;

            // ✅ PRO: posle batch-a vrati neutral + Idle (da ne ostane “kez”)
            setTimeout(() => {
              if (mySession !== sessionIdRef.current) return;
              setFacialExpression("default");
              setLipsync(null);
              setAnimation("Idle");
            }, 120);

            onBatchPlayed?.("batch_onended");
          };
        }

        scheduled.push({ src, startAt, endAt, msg, duration: buf.duration });
        t = endAt;
      });

      // schedule start (gapless)
      for (const s of scheduled) {
        try {
          s.src.start(s.startAt);
        } catch (e) {
          console.warn("❌ start failed", e);
        }
      }

      sourcesRef.current = scheduled;

      // ✅ PRO FIX: odmah primeni PRVU poruku (jer activeIndex već 0 pa effect ne okine)
      activeIndexRef.current = 0;
      setActiveIndex(0);

      const firstMsg = scheduled?.[0]?.msg || {};
      setAnimation(pickSpeakingAnimation(firstMsg.animation));
      setFacialExpression(firstMsg.facialExpression || "default");
      setLipsync(firstMsg.lipsync || null);

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
      pickSpeakingAnimation,
    ]
  );

  // ✅ When new batch arrives → play it
  useEffect(() => {
    sessionIdRef.current++;
    stopAll();

    if (!playBatch?.length) {
      setAnimation("Idle");
      setFacialExpression("default");
      setLipsync(null);
      return;
    }

    playBatchGapless(playBatch);

    return () => {
      sessionIdRef.current++;
      stopAll();
    };
  }, [playBatchId, playBatch, playBatchGapless, stopAll]);

  // ✅ ASYNC lipsync polling (za poruke koje stižu bez lipsync-a)
  useEffect(() => {
    if (!playBatch?.length) return;

    const mySession = sessionIdRef.current; // guard
    let cancelled = false;
    const controllers = [];

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    playBatch.forEach((m, i) => {
      // već ima lipsync
      if (m?.lipsync?.mouthCues?.length) return;

      // nema meta
      if (!m?.lipsyncJobId) return;
      if (m.lipsyncIndex === undefined || m.lipsyncIndex === null) return;

      const jobId = m.lipsyncJobId;
      const index = m.lipsyncIndex;

      const controller = new AbortController();
      controllers.push(controller);

      const poll = async () => {
        for (let n = 0; n < 60; n++) { // 15s max
          if (cancelled) return;
          if (sessionIdRef.current !== mySession) return;

          let data = null;
          try {
            data = await fetchLipsync(jobId, index, controller.signal);
          } catch {
            // ignore transient
          }

          // očekujemo: { status: "ready", lipsync: { mouthCues: [...] } }
          if (data?.status === "ready" && data?.lipsync?.mouthCues?.length) {
            // ✅ ubaci u scheduled seg poruku (da useFrame vidi)
            const seg = sourcesRef.current?.[index];
            if (seg?.msg) seg.msg.lipsync = data.lipsync;

            // ✅ ako je trenutno aktivna poruka, odmah osveži state
            if (activeIndexRef.current === index) setLipsync(data.lipsync);

            return;
          }

          if (data?.status === "error" || data?.status === "missing") {
            return; // prekini za ovu poruku
          }

          await sleep(250);
        }
      };

      poll();
    });

    return () => {
      cancelled = true;
      controllers.forEach((c) => c.abort());
    };
  }, [playBatchId, playBatch]);

  // ✅ determine which segment is currently active (ctx.currentTime based)
  useFrame(() => {
    const list = sourcesRef.current;
    if (!list.length) return;

    const ctx = playbackCtxRef?.current;
    if (!ctx) return;

    const t = ctx.currentTime;

    let idx = activeIndexRef.current;

    // move forward only
    while (idx < list.length - 1 && t >= list[idx].endAt) idx++;

    if (idx !== activeIndexRef.current) {
      activeIndexRef.current = idx;
      setActiveIndex(idx);
    }
  });

  // ✅ when activeIndex changes, apply message animation/face/lipsync
  useEffect(() => {
    const seg = sourcesRef.current?.[activeIndex];
    if (!seg?.msg) return;

    const msg = seg.msg;

    setAnimation(pickSpeakingAnimation(msg.animation));
    setFacialExpression(msg.facialExpression || "default");
    setLipsync(msg.lipsync || null);
  }, [activeIndex, pickSpeakingAnimation]);

  // 🎞️ Animacije
  useEffect(() => {
    if (!actions?.[animation]) return;

    actions[animation]
      .reset()
      .fadeIn(mixer?.stats?.actions?.inUse === 0 ? 0 : 0.25)
      .play();

    return () => {
      actions[animation]?.fadeOut(0.25);
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
        }, 140);
      }, THREE.MathUtils.randInt(1200, 5200));
    };

    nextBlink();
    return () => clearTimeout(blinkTimeout);
  }, []);

  useEffect(() => {
    const head = nodes?.Wolf3D_Head;
    if (head?.morphTargetDictionary) {
      console.log("✅ Head morph targets:", Object.keys(head.morphTargetDictionary));
    }
    console.log("✅ Animation clips:", animations?.map((a) => a.name));
    console.log("✅ Actions:", actions ? Object.keys(actions) : []);
  }, [nodes, animations, actions]);

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

  // ✅ PRO: fallback “jaw” kada cues nema (da usta ne deluju mrtvo)
  const fallbackJawPhaseRef = useRef(0);

  // 🧠 Face + Lip sync (single frame loop)
  useFrame((_, delta) => {
    const dt = Math.min(0.033, Math.max(0.001, delta));

    // 1) facial expression (ALI NE DIRAJ mouth/jaw + ne diraj blink)
    if (!setupMode) {
      const mapping =
        facialExpressions[facialExpression] || facialExpressions["default"] || {};
      morphTargets.forEach((key) => {
        if (key === "eyeBlinkLeft" || key === "eyeBlinkRight") return;
        if (isMouthOrJawKey(key)) return;

        lerpMorphTarget(key, mapping?.[key] || 0, 0.12);
      });
    }

    // 2) blink
    lerpMorphTarget("eyeBlinkLeft", blink ? 1 : 0, 0.55);
    lerpMorphTarget("eyeBlinkRight", blink ? 1 : 0, 0.55);

    // 3) visemes
    if (setupMode || !lipsync) return;

    const ctx = playbackCtxRef?.current;
    const seg = sourcesRef.current?.[activeIndexRef.current];
    if (!ctx || !seg) return;

    const localTime = Math.max(0, ctx.currentTime - seg.startAt);

    const applied = [];
    let anyCue = false;

    lipsync.mouthCues?.forEach((cue) => {
      if (localTime >= cue.start && localTime <= cue.end) {
        const target = visemesMapping[cue.value];
        if (!target) return;
        anyCue = true;
        applied.push(target);
        lerpMorphTarget(target, 1, 0.45);
      }
    });

    Object.values(visemesMapping).forEach((key) => {
      if (!applied.includes(key)) lerpMorphTarget(key, 0, 0.22);
    });

    // fallback jawOpen kad nema cue
    if (!anyCue) {
      fallbackJawPhaseRef.current += dt * 8.0;
      const pulse = 0.08 + 0.06 * Math.abs(Math.sin(fallbackJawPhaseRef.current));
      lerpMorphTarget("jawOpen", pulse, 0.18);
    }
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