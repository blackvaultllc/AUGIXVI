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

// Server-only brain keys (never shipped to the client bundle).
interface NodeProcessEnvAugi {
  GROQ_API_KEY?: string;
  GROQ_API_BASE_URL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_API_BASE_URL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_API_BASE_URL?: string;
  OLLAMA_API_BASE_URL?: string;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_API_BASE_URL?: string;
  AUGI_OPERATOR_TOKEN?: string;
  OSIRIS_OPERATOR_NAME?: string;
}
