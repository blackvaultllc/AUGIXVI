import type { AvatarBridge } from "./AvatarBridge";
import { requestElevenLabsAudio } from "./elevenlabs.server";
import {
  configureSpeechUtterance,
  loadSpeechVolume,
  speechAudioGain,
  warmSpeechVoices,
  type SpeechGender,
} from "./speechVoice";

export type VoiceProvider = {
  speak(text: string, onEnded: () => void): Promise<void>;
  stop(): void;
};

type VoiceOptions = {
  voiceId?: string;
  /**
   * THE GODS ARE MEN (owner order 2026-11-22): the provider speaks
   * for the gods, so its browser voice is the deeper British man's
   * voice by default (speechVoice.ts). A provider speaking for a
   * woman passes "female" and gets a woman's voice — never the
   * reverse.
   */
  speakerGender?: SpeechGender;
};

export function createVoiceProvider(
  bridge: AvatarBridge,
  options: VoiceOptions = {},
): VoiceProvider {
  const voiceId = options.voiceId ?? import.meta.env["VITE_ELEVENLABS_VOICE_ID"];
  const speakerGender = options.speakerGender ?? "male";
  // Engines publish their voice lists late; warm the cache now so
  // the first spoken line already carries the gods' voice.
  warmSpeechVoices();
  // AUTOPLAY UNLOCK (owner defect 2026-11-22 — lines printed but
  // never heard): browsers start every AudioContext suspended until
  // the operator interacts with the page. His first click or
  // keypress warms one up and throws it away, which unlocks audio
  // for the page — so a line spoken after any interaction (a typed
  // command, a tap) is heard instead of dying in a suspended graph.
  try {
    const unlock = () => {
      try {
        const warm = new AudioContext();
        void warm
          .resume()
          .catch(() => undefined)
          .finally(() => void warm.close().catch(() => undefined));
      } catch {
        /* no WebAudio here — the plain element path still applies */
      }
      warmSpeechVoices();
    };
    globalThis.addEventListener?.("pointerdown", unlock, { once: true });
    globalThis.addEventListener?.("keydown", unlock, { once: true });
  } catch {
    /* listener registration must never break the provider */
  }
  let audio: HTMLAudioElement | null = null;
  let audioContext: AudioContext | null = null;
  let objectUrl: string | null = null;
  let utterance: SpeechSynthesisUtterance | null = null;
  let animationFrame = 0;
  let generation = 0;

  const clearAudio = () => {
    bridge.disconnectAudioSource();
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio = null;
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    if (audioContext) {
      void audioContext.close();
      audioContext = null;
    }
  };

  const speakWithBrowser = (text: string, onEnded: () => void) => {
    try {
      utterance = new SpeechSynthesisUtterance(text);
      // The gods' voice (owner order 2026-11-22): the deeper
      // British man's voice, his volume level at full by default —
      // never the browser's out-of-the-box default voice.
      configureSpeechUtterance(utterance, {
        gender: speakerGender,
        volume: loadSpeechVolume(),
      });
      globalThis.speechSynthesis?.speak(utterance);
    } catch (error) {
      console.error("Browser speech synthesis failed.", error);
      bridge.setSpeechLevel(0);
      onEnded();
      return;
    }

    const duration = 600 + text.length * 55;
    const startedAt = performance.now();
    const animate = () => {
      const elapsed = performance.now() - startedAt;
      if (elapsed > duration) {
        animationFrame = 0;
        utterance = null;
        bridge.setSpeechLevel(0);
        onEnded();
        return;
      }
      const syllable = Math.abs(Math.sin(elapsed / 95)) * (0.5 + 0.5 * Math.sin(elapsed / 410));
      bridge.setSpeechLevel(0.25 + syllable * 0.75);
      animationFrame = requestAnimationFrame(animate);
    };
    animate();
  };

  /**
   * Route generated audio through the stage at his level (owner
   * order 2026-11-22 — louder on the phone): the element itself at
   * full, then a gain stage turned up past unity feeds the bridge's
   * analyser chain, so app-generated speech lands clearly louder
   * than the raw file on phone speakers.
   *
   * SUSPENDED-CONTEXT GUARD (owner defect 2026-11-22): before the
   * operator's first interaction the browser holds every new
   * AudioContext "suspended", and resume() can stay pending forever
   * without a gesture. The old code awaited resume() with no bound —
   * a line spoken before any click could hang the whole speak()
   * before play() was ever reached — and once an element is wired
   * into a suspended graph it outputs silence even while "playing".
   * So: try to resume with a short bound; only wire the element
   * into the graph when the context is actually running. When it
   * isn't, close the context untouched and return false — the
   * caller plays the element directly, at full volume, through its
   * own output. Returns true when the staged graph carries it.
   */
  const stageAudio = async (element: HTMLAudioElement): Promise<boolean> => {
    element.volume = 1;
    let context: AudioContext;
    try {
      context = new AudioContext();
    } catch {
      return false;
    }
    try {
      await Promise.race([
        context.resume(),
        new Promise((resolve) => setTimeout(resolve, 300)),
      ]);
    } catch {
      /* a rejected resume lands in the state check below */
    }
    if (context.state !== "running") {
      void context.close().catch(() => undefined);
      return false;
    }
    audioContext = context;
    const source = context.createMediaElementSource(element);
    const gain = context.createGain();
    gain.gain.value = speechAudioGain();
    source.connect(gain);
    bridge.connectAudioSource(gain);
    return true;
  };

  /**
   * Piper (owner item 2026-11-21): Augie's LOCAL voice, generated by
   * Piper on this machine via /api/say — no cloud, works grid-down.
   * Throws when Piper isn't installed/answering so the caller falls
   * back to the browser voice; the fallback is honest (the Logs/Test
   * Area can check /api/say directly).
   */
  const speakWithPiper = async (text: string, onEnded: () => void, gen: number) => {
    const response = await fetch("/api/say", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error(`Piper route answered ${response.status}`);
    const blob = await response.blob();
    if (gen !== generation) return;
    objectUrl = URL.createObjectURL(blob);
    audio = new Audio(objectUrl);
    await stageAudio(audio);
    audio.onended = () => {
      if (gen !== generation) return;
      clearAudio();
      bridge.setSpeechLevel(0);
      onEnded();
    };
    audio.onerror = () => {
      if (gen !== generation) return;
      clearAudio();
      bridge.setSpeechLevel(0);
      speakWithBrowser(text, onEnded);
    };
    await audio.play();
  };

  return {
    async speak(text, onEnded) {
      const currentGeneration = ++generation;
      if (!voiceId) {
        // No cloud voice configured: Piper (local) first, browser as
        // the honest fallback when Piper isn't on this host.
        try {
          await speakWithPiper(text, onEnded, currentGeneration);
        } catch {
          if (currentGeneration !== generation) return;
          clearAudio();
          speakWithBrowser(text, onEnded);
        }
        return;
      }

      try {
        const { audioBase64, contentType } = await requestElevenLabsAudio({
          data: { text, voiceId },
        });
        if (currentGeneration !== generation) return;
        const binary = atob(audioBase64);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: contentType }));
        audio = new Audio(objectUrl);
        await stageAudio(audio);
        audio.onended = () => {
          if (currentGeneration !== generation) return;
          clearAudio();
          bridge.setSpeechLevel(0);
          onEnded();
        };
        audio.onerror = () => {
          if (currentGeneration !== generation) return;
          clearAudio();
          bridge.setSpeechLevel(0);
          speakWithBrowser(text, onEnded);
        };
        await audio.play();
      } catch (error) {
        if (currentGeneration !== generation) return;
        clearAudio();
        console.error("ElevenLabs speech failed; using browser speech.", error);
        speakWithBrowser(text, onEnded);
      }
    },
    stop() {
      generation += 1;
      globalThis.speechSynthesis?.cancel();
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      utterance = null;
      clearAudio();
    },
  };
}
