interface ImportMetaEnv {
  readonly ["VITE_AVATAR_NAME"]?: string;
  readonly ["VITE_OLLAMA_BASE_URL"]?: string;
  readonly ["VITE_OLLAMA_MODEL"]?: string;
  readonly ["VITE_OLLAMA_VISION_MODEL"]?: string;
  readonly ["VITE_ELEVENLABS_VOICE_ID"]?: string;
  readonly ["VITE_MEDIAPIPE_WASM_ROOT"]?: string;
  readonly ["VITE_MEDIAPIPE_HAND_MODEL_URL"]?: string;
  readonly ["VITE_SUPABASE_URL"]?: string;
  readonly ["VITE_SUPABASE_PUBLISHABLE_KEY"]?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
