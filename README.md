# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Living AI Avatar (`/avatar`)

All AI integration goes through `src/avatar/AvatarBridge.ts`:

| Method | Purpose |
| --- | --- |
| `setState("IDLE"\|"LISTENING"\|"THINKING"\|"SPEAKING"\|"GLITCH")` | Drive the avatar state (HUD reflects it). |
| `setSpeechLevel(0..1)` | Manual mouth/wing amplitude. |
| `connectAudioSource(node)` | Pipe real TTS audio (e.g. `MediaElementSourceNode`); RMS drives speech level. |
| `onSummon(cb)` | Fired on finger snap (hand velocity spike + mic transient), button, or `S` key. |
| `onGesture(cb)` | `snap` events (wave adjusts wing sweep). |
| `onUserSpeechStart/End(cb)` | Mic voice activity while LISTENING. |

`src/avatar/simulatedAI.ts` is the stand-in AI; replace it by calling the same bridge methods from your real STT/LLM/TTS. Swap the particle shape by passing another `ParticleSource` to `AvatarRenderer`.
