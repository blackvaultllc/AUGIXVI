import type { AvatarBridge } from "./AvatarBridge";
import { requestElevenLabsAudio } from "./elevenlabs.server";

export type VoiceProvider = {
  speak(text: string, onEnded: () => void): Promise<void>;
  stop(): void;
};

type VoiceOptions = {
  voiceId?: string;
};

export function createVoiceProvider(
  bridge: AvatarBridge,
  options: VoiceOptions = {},
): VoiceProvider {
  const voiceId = options.voiceId ?? import.meta.env["VITE_ELEVENLABS_VOICE_ID"];
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
      utterance.rate = 0.95;
      utterance.pitch = 0.8;
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

  return {
    async speak(text, onEnded) {
      const currentGeneration = ++generation;
      if (!voiceId) {
        speakWithBrowser(text, onEnded);
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
        audioContext = new AudioContext();
        const source = audioContext.createMediaElementSource(audio);
        bridge.connectAudioSource(source);
        await audioContext.resume();
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
