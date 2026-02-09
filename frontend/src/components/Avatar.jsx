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
  if (!r.ok) return null;
  return await r.json(); // { status, lipsync, error }
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
  const sourcesRef = useRef([]); // [{src, analyser, startAt, endAt, msg, duration}]
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  // ✅ viseme keys (da facialExpression ne gazi viseme)
  const VISEME_KEYS = useRef(new Set(Object.values(visemesMapping))).current;

  // ✅ PRO: ne diraj nijedan mouth/jaw morph iz facialExpressions (sprečava konflikt)
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
      if (name === "Idle") {
        return animations.find((a) => a.name === "TalkingOne") ? "TalkingOne" : name;
      }
      return name;
    },
    [animations]
  );

  // ✅ TALK cycle: menja animaciju dok audio traje (da ne vrti jednu)
  const talkCycleRef = useRef({ lastSwitch: 0, current: "TalkingOne" });

  const TALK_ANIMS = useRef(
    ["TalkingOne", "TalkingTwo", "TalkingThree"].filter((n) =>
      animations.some((a) => a.name === n)
    )
  ).current;

  const pickNextTalkAnim = useCallback(() => {
    if (!TALK_ANIMS.length) return "TalkingOne";
    const current = talkCycleRef.current.current;
    // izbegni da ponovi istu 2x zaredom
    const options = TALK_ANIMS.length > 1 ? TALK_ANIMS.filter((a) => a !== current) : TALK_ANIMS;
    const next = options[Math.floor(Math.random() * options.length)];
    talkCycleRef.current.current = next;
    return next;
  }, [TALK_ANIMS]);

  // ✅ RMS analyser fallback (usta rade i bez lipsync)
  const analyserDataRef = useRef(new Uint8Array(1024));
  const rmsRef = useRef(0);

  const computeRmsFromSeg = useCallback((seg) => {
    const analyser = seg?.analyser;
    if (!analyser) return rmsRef.current;

    const arr = analyserDataRef.current;
    if (arr.length !== analyser.fftSize) {
      analyserDataRef.current = new Uint8Array(analyser.fftSize);
    }
    const data = analyserDataRef.current;
    analyser.getByteTimeDomainData(data);

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length); // ~0..0.2
    rmsRef.current = THREE.MathUtils.lerp(rmsRef.current, rms, 0.25);
    return rmsRef.current;
  }, []);

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

        // ✅ ANALYSER chain (RMS fallback)
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.8;

        src.connect(analyser);
        analyser.connect(ctx.destination);

        const startAt = t;
        const endAt = t + buf.duration;

        if (i === buffers.length - 1) {
          src.onended = () => {
            if (mySession !== sessionIdRef.current) return;

            setTimeout(() => {
              if (mySession !== sessionIdRef.current) return;
              setFacialExpression("default");
              setLipsync(null);
              setAnimation("Idle");
              rmsRef.current = 0;
            }, 120);

            onBatchPlayed?.("batch_onended");
          };
        }

        scheduled.push({ src, analyser, startAt, endAt, msg, duration: buf.duration });
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

      // ✅ PRO FIX: odmah primeni PRVU poruku
      activeIndexRef.current = 0;
      setActiveIndex(0);

      // reset talkCycle odmah na start
      talkCycleRef.current.lastSwitch = playbackCtxRef.current?.currentTime || 0;
      talkCycleRef.current.current = pickNextTalkAnim();

      const firstMsg = scheduled?.[0]?.msg || {};
      const desired = pickSpeakingAnimation(firstMsg.animation);
      setAnimation(desired || talkCycleRef.current.current || "TalkingOne");
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
      pickNextTalkAnim,
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
      rmsRef.current = 0;
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

    playBatch.forEach((m) => {
      if (m?.lipsync?.mouthCues?.length) return;

      if (!m?.lipsyncJobId) return;
      if (m.lipsyncIndex === undefined || m.lipsyncIndex === null) return;

      const jobId = m.lipsyncJobId;
      const index = m.lipsyncIndex;

      const controller = new AbortController();
      controllers.push(controller);

      const poll = async () => {
        for (let n = 0; n < 60; n++) {
          if (cancelled) return;
          if (sessionIdRef.current !== mySession) return;

          let data = null;
          try {
            data = await fetchLipsync(jobId, index, controller.signal);
          } catch {
            // ignore transient
          }

          if (data?.status === "ready" && data?.lipsync?.mouthCues?.length) {
            // ✅ ubaci lipsync u msg koji je SCHEDULED na istoj poziciji
            const seg = sourcesRef.current?.[index];
            if (seg?.msg) seg.msg.lipsync = data.lipsync;

            if (activeIndexRef.current === index) setLipsync(data.lipsync);
            return;
          }

          if (data?.status === "error" || data?.status === "missing") return;

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

  // ✅ determine which segment is currently active + talk-cycle
  useFrame(() => {
    const list = sourcesRef.current;
    if (!list.length) return;

    const ctx = playbackCtxRef?.current;
    if (!ctx) return;

    const t = ctx.currentTime;

    let idx = activeIndexRef.current;
    while (idx < list.length - 1 && t >= list[idx].endAt) idx++;

    if (idx !== activeIndexRef.current) {
      activeIndexRef.current = idx;
      setActiveIndex(idx);

      // reset talk switch kad pređe na novu poruku
      talkCycleRef.current.lastSwitch = t;
      talkCycleRef.current.current = pickNextTalkAnim();
    }

    // talk-cycle samo dok audio traje i samo ako backend NIJE eksplicitno poslao animaciju
    const seg = list[activeIndexRef.current];
    const msg = seg?.msg || {};
    const hasExplicitAnim = !!msg.animation && msg.animation !== "Idle";

    if (!hasExplicitAnim && t >= seg.startAt && t <= seg.endAt) {
      if (t - talkCycleRef.current.lastSwitch > 2.5) {
        talkCycleRef.current.lastSwitch = t;
        const next = pickNextTalkAnim();
        setAnimation(next);
      }
    }
  });

  // ✅ when activeIndex changes, apply message animation/face/lipsync
  useEffect(() => {
    const seg = sourcesRef.current?.[activeIndex];
    if (!seg?.msg) return;

    const msg = seg.msg;

    const desired = pickSpeakingAnimation(msg.animation);
    const hasExplicitAnim = !!msg.animation && msg.animation !== "Idle";

    setAnimation(hasExplicitAnim ? desired : (desired || talkCycleRef.current.current || "TalkingOne"));
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

  // 🧠 Face + Lip sync + RMS fallback
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

    if (setupMode) return;

    // seg/time
    const ctx = playbackCtxRef?.current;
    const seg = sourcesRef.current?.[activeIndexRef.current];
    if (!ctx || !seg) return;

    // ✅ RMS fallback uvek radi dok audio traje
    const rms = computeRmsFromSeg(seg);
    const jaw = THREE.MathUtils.clamp(rms * 6.0, 0.02, 0.35);
    lerpMorphTarget("jawOpen", jaw, 0.35);
    // opcionalno ako postoji
    lerpMorphTarget("mouthOpen", THREE.MathUtils.clamp(rms * 5.0, 0, 0.25), 0.25);

    // 3) ako lipsync postoji → viseme “overrides”
    if (!lipsync?.mouthCues?.length) return;

    const localTime = Math.max(0, ctx.currentTime - seg.startAt);

    const applied = [];
    let anyCue = false;

    lipsync.mouthCues.forEach((cue) => {
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

    // ako nema cue u tom frejmu, ostaje RMS jaw (već gore)
    if (!anyCue) {
      // blagi “život” da ne bude statičan
      const wobble = 0.02 * Math.abs(Math.sin((ctx.currentTime || 0) * 10.0));
      lerpMorphTarget("jawOpen", THREE.MathUtils.clamp(jaw + wobble, 0.02, 0.38), 0.18);
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