# AUGIXVI to Voicewave Command Deck merge map

This map compares the tracked AUGIXVI files with the read-only file tree of
`blackvaultllc/voicewave-command-deck` at `HEAD` on 2026-11-10. No files in the
deck repository were changed. “Move as-is” means the source is standalone; it
does not mean its imports, route registration, environment, or dependencies can
be copied without wiring them into the deck.

## Integration summary

- The deck has no `src/avatar/` module. That directory is the self-contained
  feature boundary; preserve its module names and `AvatarBridge` as the only
  AI-to-renderer interface.
- `AvatarStage` is not a deck component name. Mount it as a panel or secondary
  route from the deck's existing `src/components/CommandDeck.tsx` flow. The
  deck home is its office, not a redirect to `/avatar`; do not replace the
  security-gated `src/routes/index.tsx`.
- AUGIXVI's `src/routes/avatar.tsx`, `src/routes/index.tsx`,
  `src/routes/__root.tsx`, `src/router.tsx`, and generated
  `src/routeTree.gen.ts` must not overwrite deck routing. Register an adapted
  route through the deck's router conventions and regenerate its route tree.
- Merge the avatar CSS from `src/styles.css` into the deck stylesheet. The
  avatar selectors are now scoped and renamed to avoid the deck's existing
  `.hud-panel`, `.hud-btn`, and `.hud-input` rules. Do not copy AUGIXVI's
  complete global stylesheet over the deck's.
- `AvatarBridge`, `AvatarRenderer`, `ARM`, `solveArm`, `armPose`,
  `handDirection`, `makeProp`, `handPoints`, `filePoints`, and `limbPoints` do
  not collide with deck exports at the inspected tree. The deck's `HoloStage`
  and `CoreState` are distinct implementations and should be composed with,
  not overwritten by, the avatar.
- The current AUGIXVI tree has no authorized Lovable AI gateway/cloud-key
  adapter. The current build uses Ollama plus truthful device-local memory
  when it is offline; it does not invent simulated answers or add direct
  Groq, Gemini, or OpenRouter calls.
- Provider-priority cloud AI fallback and Protocol One delivery/7-day
  scheduling are not implemented. Do not treat the local UI, device storage,
  or a local browser timer as a secure delivery service or a persistent
  scheduler.
- `src/components/ui/avatar.tsx` already exists in the deck and exports the
  generic UI symbols `Avatar`, `AvatarImage`, and `AvatarFallback`; it is not
  the 3D `AvatarStage` and should not be replaced by it.
- The deck already has `SettingsPanel`, `CommandOversight`, `src/lib/ollama.ts`,
  and a radar cloud-key interface (`src/lib/radar-keys.ts`). `attachOllamaAI`
  is a separate adapter, not an export replacement for `streamChat`. Connect
  commands/replies to deck state deliberately. If a future provider requires
  an API key, resolve it through the deck's cloud-keys panel/server interface;
  do not add a browser-side key or overload Ollama's URL/model settings.
- The deck has exact-path counterparts for the project/configuration, shared
  UI, routing, global styles, and selected test files listed below. These are
  conflicts, not candidates for wholesale replacement. Merge only the
  required behavior and retain deck-specific dependencies, auth, gate, and
  settings.

## API-key and environment audit

The Ollama adapter makes an unauthenticated chat request, and camera/hand
tracking downloads public model assets; neither uses an API key. ElevenLabs
TTS uses `ELEVENLABS_API_KEY` from the server runtime in
`src/avatar/elevenlabs.server.ts`. It must never be renamed to a `VITE_`
variable or sent to the browser. `VITE_ELEVENLABS_VOICE_ID` is a public voice
identifier, not a credential. `ELEVENLABS_API_BASE_URL` is server-only
endpoint configuration. The `.env.example` values are empty placeholders; no
credential value is stored in the repository.
The hidden cube's `AUGI_OPERATOR_TOKEN` is a server-only access secret.
`OSIRIS_OPERATOR_NAME` is an optional server-only operator configuration value;
the server returns it only after that token is verified, and the browser holds
it in memory for the active assistant session. Neither variable is a Vite
client variable, and `.env.example` contains only empty placeholders.
The `/avatar` gate uses Supabase Auth with email/password and TOTP MFA. The
server verifies sessions through the Supabase Auth user endpoint and requires
an `aal2` session before the first verified account can atomically claim the
Cloudflare Durable Object operator registry. No user-ID allowlist or Supabase
service key is required. The initial first-claim flow intentionally means the
first account to complete MFA after deployment becomes the operator.
Camera vision captures a single frame only after an explicit request and sends
it to the configured local Ollama vision model; AUGIXVI does not save it or
identify people.

`AGENTS.md` mentions `LOVABLE_API_KEY` only as a Lovable-managed secret for an
optional connector/gateway; no AUGIXVI runtime source reads that variable or
embeds its value. Keep that secret in Lovable's managed secrets, not in source
or a `VITE_` variable. The deck's `src/lib/radar-keys.ts` is the existing
user-managed radar-key panel/storage interface; do not copy credentials into
avatar environment configuration.

The following non-secret settings are read from runtime/build environment:

| Variable                        | Consumer                                                                                           | Purpose                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `VITE_AVATAR_NAME`              | `src/avatar/AvatarStage.tsx`                                                                       | Optional display label                                                 |
| `VITE_OLLAMA_BASE_URL`          | `src/avatar/ollamaAI.ts`                                                                           | Ollama server origin                                                   |
| `VITE_OLLAMA_MODEL`             | `src/avatar/ollamaAI.ts`                                                                           | Ollama model identifier                                                |
| `VITE_OLLAMA_VISION_MODEL`      | `src/avatar/vision.ts`                                                                             | Local Ollama image model                                               |
| `VITE_ELEVENLABS_VOICE_ID`      | `src/avatar/voice.ts`                                                                              | Public ElevenLabs voice ID                                             |
| `VITE_MEDIAPIPE_WASM_ROOT`      | `src/avatar/AvatarStage.tsx`, `src/avatar/sensors.ts`                                              | Vision runtime asset location                                          |
| `VITE_MEDIAPIPE_HAND_MODEL_URL` | `src/avatar/AvatarStage.tsx`, `src/avatar/sensors.ts`                                              | Hand model asset location                                              |
| `VITE_SUPABASE_URL`             | `src/lib/supabase-readonly.ts`                                                                     | Supabase project URL                                                   |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `src/lib/supabase-readonly.ts`, `src/avatar/OperatorGate.tsx`, `src/avatar/operatorAuth.server.ts` | Public Supabase client key for read-only access and Auth; not a secret |

The server-only `ELEVENLABS_API_KEY` and `ELEVENLABS_API_BASE_URL` are read per
request by the TTS server function. All `VITE_` values are public
build-time configuration, never secrets. Do not place an API key in them. For
deck integration, resolve the credential through the deck's cloud-key panel
and server-side credential flow, and add authentication/rate limiting to any
public TTS endpoint. Local `.env` files are ignored; only the empty
`.env.example` is tracked. Local development loads the two server-only
ElevenLabs settings from `.env.local`; production must receive them through
server runtime secrets rather than build-time variables.
Supabase access is a browser-side, GET-only client using only the public URL
and publishable key. It reports connectivity and provides a `select` method;
it has no insert/update/upsert/delete operations and performs no migration or
schema changes.

## File-by-file map

| AUGIXVI file                                                          | Disposition | Deck destination / collision                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.gitignore`                                                          | Adapt       | Exact-path conflict. Merge ignore patterns; retain deck rules.                                                                                                                                                                                                                       |
| `.github/instructions/typescript-security-guidelines.instructions.md` | Adapt       | New TypeScript credential-handling guidance. Merge into the deck's existing instruction set; preserve its security policies.                                                                                                                                                         |
| `.github/instructions/typescript-test-guidelines.instructions.md`     | Adapt       | New TypeScript testing guidance. Merge into the deck's existing instruction set and test conventions.                                                                                                                                                                                |
| `.github/instructions/update-activity-workflow.instructions.md`       | Adapt       | New activity-workflow guidance; review applicability before adding it to the deck.                                                                                                                                                                                                   |
| `.github/skills/typescript-conventions/SKILL.md`                      | Adapt       | New TypeScript conventions skill. Merge only if the deck wants workspace-local skills; do not overwrite existing customization.                                                                                                                                                      |
| `.lovable/project.json`                                               | Do not move | Exact-path conflict; Lovable project metadata belongs to the target project.                                                                                                                                                                                                         |
| `.prettierignore`                                                     | Adapt       | Exact-path conflict. Preserve deck-specific generated-file exclusions.                                                                                                                                                                                                               |
| `.prettierrc`                                                         | Adapt       | Exact-path conflict. Keep the deck formatter policy.                                                                                                                                                                                                                                 |
| `AGENTS.md`                                                           | Adapt       | Exact-path conflict. Carry only applicable avatar-specific instructions; preserve deck guidance.                                                                                                                                                                                     |
| `README.md`                                                           | Adapt       | Exact-path conflict. Add an avatar integration section instead of replacing deck docs.                                                                                                                                                                                               |
| `bun.lock`                                                            | Do not move | AUGIXVI dependency lock; merge dependency declarations into the deck's package manager and regenerate its lock.                                                                                                                                                                      |
| `bunfig.toml`                                                         | Adapt       | Exact-path conflict. Retain the deck package-manager settings.                                                                                                                                                                                                                       |
| `components.json`                                                     | Adapt       | Exact-path conflict; shadcn aliases/style choices may differ.                                                                                                                                                                                                                        |
| `eslint.config.js`                                                    | Adapt       | Exact-path conflict; retain deck lint plugins/rules and include avatar-specific checks.                                                                                                                                                                                              |
| `package.json`                                                        | Adapt       | Exact-path conflict. Merge only required dependencies/scripts; do not replace the deck manifest.                                                                                                                                                                                     |
| `public/favicon.ico`                                                  | Do not move | Exact-path conflict; keep the deck's brand asset.                                                                                                                                                                                                                                    |
| `public/robots.txt`                                                   | Adapt       | Exact-path conflict; preserve target deployment policy.                                                                                                                                                                                                                              |
| `src/avatar/AvatarBridge.ts`                                          | Move as-is  | New `src/avatar/AvatarBridge.ts`; no same-path deck module.                                                                                                                                                                                                                          |
| `src/avatar/env.d.ts`                                                 | Adapt       | Merge the public `ImportMetaEnv` properties with the deck's existing Vite environment type declarations; do not overwrite them.                                                                                                                                                      |
| `src/avatar/elevenlabs.server.ts`                                     | Adapt       | New server-function module; keep the API key server-only, use the deck's cloud-key/server credential flow, and apply auth/rate limits before exposing paid TTS.                                                                                                                      |
| `src/avatar/AvatarRenderer.ts`                                        | Adapt       | New module path; full 360-degree particle body and Superman-style flight/cape extend the renderer. Legs share the torso geometry, shader, theme, and draw budget. Mount beside deck `HoloStage`; reconcile Three.js version and lifecycle.                                           |
| `src/avatar/AvatarStage.tsx`                                          | Adapt       | New module path; compose from `src/components/CommandDeck.tsx` or a deck-approved route. Adds focus mode, wake/silence controls, local memory, source labels, camera vision, and world commands; retain deck settings, oversight, routes, and auth.                                  |
| `src/avatar/CubePanel.tsx`                                            | Adapt       | New hidden, in-panel reference UI shown only by the explicit “pull up the cube” command; no route or visible link. Access uses a server-verified operator token; optional identity reaches the assistant only after server authorization. Keep calculations local and non-executing. |
| `src/avatar/cubeReference.ts`                                         | Adapt       | New pure module for bounded unsigned 32-bit conversions, bitwise calculations, cube-layer notes, cubie bits, and the exact reveal phrase. No command execution or external requests.                                                                                                 |
| `src/avatar/CityView.tsx`                                             | Adapt       | New placeholder component/slot; replace its child with the real deck City after merge. Preserve the deck office home and do not invent city data here.                                                                                                                               |
| `src/avatar/KnowledgePanel.tsx`                                       | Adapt       | New local document-import and sourced knowledge panel; merge its UI into the deck knowledge surface and retain its local-only/no-Supabase-write behavior. Adds `.avatar-hud__knowledge*` styles.                                                                                     |
| `src/avatar/armIK.ts`                                                 | Move as-is  | New `src/avatar/armIK.ts`; exports `V3`, `ARM`, `ArmSolution`, `solveArm`, `ArmPose`, `armPose`, `flightArmPose`, `handDirection`. No matching deck module/export found.                                                                                                             |
| `src/avatar/coreCityState.ts`                                         | Adapt       | New state-machine module for `CORE_FULL` and `CORE_SMALL + CITY`; compose with the deck's route/panel state rather than replacing it.                                                                                                                                                |
| `src/avatar/interactionControls.ts`                                   | Adapt       | New pure focus/wake/silence parser and device-local preference helpers. Integrate with the deck's wake-word state; no server or route collision.                                                                                                                                     |
| `src/avatar/knowledgeBase.ts`                                         | Adapt       | New structured martial-arts, defensive-security, curriculum-topic, state-directory, and official-source catalog. Preserve its explicit coverage gaps; do not represent the index as a complete curriculum or state-facts database.                                                   |
| `src/avatar/locomotion.ts`                                            | Move/adapt  | New world-space avatar movement and ground-contact controller; its route follows the local town, forest, and hot-zone layout. Keep its local Three.js transform logic with the renderer.                                                                                             |
| `src/avatar/localMemory.ts`                                           | Adapt       | New bounded device-local highlight/document store with text matching; replace only through a deck-approved persistence contract. Do not invent a Supabase schema or add browser writes.                                                                                              |
| `src/avatar/ollamaAI.ts`                                              | Adapt       | New module path; defaults to localhost Ollama and `llama3.1:8b`, then uses saved local matches/curated knowledge or an explicit offline-unknown reply. Adds mute state, verified identity context, and response-source events. No direct cloud-provider adapter exists.              |
| `src/avatar/OperatorGate.tsx`                                         | Adapt       | Auth-only orbital landing with email/password, first-account setup, TOTP enrollment/challenge, persisted Supabase session, and a delayed transition; preserve the deck's existing auth boundary and keep avatar content hidden until server authorization.                           |
| `src/avatar/OperatorRegistry.ts`                                      | Adapt       | Cloudflare Durable Object that atomically records the first TOTP-verified Supabase user as the operator; requires explicit owner bootstrap policy when adapting to another deployment.                                                                                               |
| `src/avatar/operatorAuth.server.ts`                                   | Adapt       | Verifies Supabase sessions server-side, requires MFA `aal2`, and delegates first-owner claim/authorization to the Durable Object. Keep all verification server-side and never move token handling into browser code.                                                                 |
| `exports.cloudflare.ts`                                               | Adapt       | Exports the operator registry class for the Cloudflare Worker runtime; merge into the deck's existing Cloudflare exports rather than replacing them.                                                                                                                                 |
| `wrangler.jsonc`                                                      | Adapt       | Adds the Durable Object binding and initial SQLite-class migration to the existing Worker configuration; merge bindings and migration tags without replacing deck settings.                                                                                                          |
| `src/avatar/particleLegs.ts`                                          | Adapt       | Samples thigh, knee, tapered shin, ankle, and forward-facing foot particle surfaces and provides alternating hip-swing angles; no separate prop material.                                                                                                                            |
| `src/avatar/particleSource.ts`                                        | Move/adapt  | Combines full-circumference torso/core and articulated leg points into one shuffled particle dataset so the renderer applies one body shader, theme, and adaptive particle budget. Environment mountains remain separate `SceneManager` objects.                                     |
| `src/avatar/props.ts`                                                 | Move as-is  | New `src/avatar/props.ts`; exports `makeProp`, `handPoints`, `filePoints`, `limbPoints`; no matching deck module found.                                                                                                                                                              |
| `src/avatar/sceneManager.ts`                                          | Adapt       | New Three.js scene manager with a ground plane, mountains, editable objects, and a lightweight local world layout showing safe/outer zones, a walk route, trainer, and encounter marker. This is not a combat or multiplayer system.                                                 |
| `src/avatar/sensors.ts`                                               | Adapt       | New module path; requests browser camera/mic permission and tries configured public vision URLs before MediaPipe defaults. Camera frame description is opt-in and transient. Compose with deck permissions/lifecycle.                                                                |
| `src/avatar/simulatedAI.ts`                                           | Adapt       | Existing standalone demo adapter; it is no longer used as an offline knowledge fallback. Do not substitute for deck's `streamChat` or its key resolution.                                                                                                                            |
| `src/avatar/snapDetector.ts`                                          | Move as-is  | New `src/avatar/snapDetector.ts`; plain logic module, no path/export collision found.                                                                                                                                                                                                |
| `src/avatar/stateParams.ts`                                           | Move as-is  | New `src/avatar/stateParams.ts`; exports state animation helpers. Map deck state through an adapter, not by renaming deck state types.                                                                                                                                               |
| `src/avatar/themes.ts`                                                | Adapt       | New module path; named and custom avatar palettes persist in browser localStorage only. Integrate with deck `SceneColors` from `src/lib/settings.ts`; avoid replacing deck presets.                                                                                                  |
| `src/avatar/voice.ts`                                                 | Adapt       | New browser-side TTS provider; compose through `AvatarBridge`, use browser speech when unconfigured, and call the server function for ElevenLabs without exposing credentials.                                                                                                       |
| `src/avatar/vision.ts`                                                | Adapt       | New explicit-request camera description helper; sends one transient frame to a configured local Ollama vision model, retains no frame, and does not identify people. Keep camera permission and model configuration explicit.                                                        |
| `src/avatar/worldCommands.ts`                                         | Move as-is  | New pure command parser for locomotion, object creation, transform, removal, and unsupported-object replies; no deck parser export conflict found.                                                                                                                                   |
| `src/avatar/worldRules.ts`                                            | Adapt       | New data-only world-rule schema for a safe town center, forest/hot regions outside it, local encounter/trainer markers, and the avatar's walk route. Safe-zone checks are local layout behavior, not authoritative protection.                                                       |
| `src/components/ui/accordion.tsx`                                     | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/alert-dialog.tsx`                                  | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/alert.tsx`                                         | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/aspect-ratio.tsx`                                  | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/avatar.tsx`                                        | Do not move | Exact-path conflict. Deck exports UI `Avatar`, `AvatarImage`, `AvatarFallback`; not the 3D avatar.                                                                                                                                                                                   |
| `src/components/ui/badge.tsx`                                         | Do not move | Exact-path conflict; retain deck variants and imports.                                                                                                                                                                                                                               |
| `src/components/ui/breadcrumb.tsx`                                    | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/button.tsx`                                        | Do not move | Exact-path conflict; retain deck variants and imports.                                                                                                                                                                                                                               |
| `src/components/ui/calendar.tsx`                                      | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/card.tsx`                                          | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/carousel.tsx`                                      | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/chart.tsx`                                         | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/checkbox.tsx`                                      | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/collapsible.tsx`                                   | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/command.tsx`                                       | Do not move | Exact-path conflict; deck uses this command-menu primitive; distinct from typed avatar commands.                                                                                                                                                                                     |
| `src/components/ui/context-menu.tsx`                                  | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/dialog.tsx`                                        | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/drawer.tsx`                                        | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/dropdown-menu.tsx`                                 | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/form.tsx`                                          | Do not move | Exact-path conflict; preserve deck form integration.                                                                                                                                                                                                                                 |
| `src/components/ui/hover-card.tsx`                                    | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/input-otp.tsx`                                     | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/input.tsx`                                         | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/label.tsx`                                         | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/menubar.tsx`                                       | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/navigation-menu.tsx`                               | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/pagination.tsx`                                    | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/popover.tsx`                                       | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/progress.tsx`                                      | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/radio-group.tsx`                                   | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/resizable.tsx`                                     | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/scroll-area.tsx`                                   | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/select.tsx`                                        | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/separator.tsx`                                     | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/sheet.tsx`                                         | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/sidebar.tsx`                                       | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/skeleton.tsx`                                      | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/slider.tsx`                                        | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/sonner.tsx`                                        | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/switch.tsx`                                        | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/table.tsx`                                         | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/tabs.tsx`                                          | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/textarea.tsx`                                      | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/toggle-group.tsx`                                  | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/toggle.tsx`                                        | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/components/ui/tooltip.tsx`                                       | Do not move | Exact-path conflict; keep deck UI primitive.                                                                                                                                                                                                                                         |
| `src/hooks/use-mobile.tsx`                                            | Do not move | Exact-path conflict; keep deck responsive hook.                                                                                                                                                                                                                                      |
| `src/lib/error-capture.ts`                                            | Do not move | Exact-path conflict; retain deck error instrumentation.                                                                                                                                                                                                                              |
| `src/lib/error-page.ts`                                               | Do not move | Exact-path conflict; retain deck error presentation.                                                                                                                                                                                                                                 |
| `src/lib/lovable-error-reporting.ts`                                  | Do not move | Exact-path conflict; retain target-platform reporting.                                                                                                                                                                                                                               |
| `src/lib/utils.ts`                                                    | Do not move | Exact-path conflict; preserve deck utility behavior.                                                                                                                                                                                                                                 |
| `src/lib/supabase-readonly.ts`                                        | Adapt       | New GET-only REST client using `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; no service key, writes, deletes, or migrations. Integrate with the deck's auth/RLS policy after its schema is available.                                                                     |
| `src/routeTree.gen.ts`                                                | Do not move | Generated route tree conflicts; regenerate from deck routes after adding an adapted route.                                                                                                                                                                                           |
| `src/router.tsx`                                                      | Do not move | Exact-path conflict; retain deck router configuration.                                                                                                                                                                                                                               |
| `src/routes/README.md`                                                | Adapt       | Exact-path conflict; merge route-generation guidance if still applicable.                                                                                                                                                                                                            |
| `src/routes/__root.tsx`                                               | Do not move | Exact-path conflict; preserve deck shell/providers.                                                                                                                                                                                                                                  |
| `src/routes/avatar.tsx`                                               | Adapt       | New route path at inspected tree; only register if the deck product flow calls for a dedicated route. Keep deck security gates and route conventions.                                                                                                                                |
| `src/routes/index.tsx`                                                | Do not move | Exact-path conflict; retain deck auth/AAL2/allowlist gate and lazy `CommandDeck` mount.                                                                                                                                                                                              |
| `src/server.ts`                                                       | Do not move | Exact-path conflict; preserve deck server entry/middleware.                                                                                                                                                                                                                          |
| `src/start.ts`                                                        | Do not move | Exact-path conflict; preserve deck CSRF/auth/error middleware.                                                                                                                                                                                                                       |
| `src/styles.css`                                                      | Adapt       | Exact-path conflict. Cherry-pick only `.avatar-stage`, scoped `.avatar-hud*`, and the hidden cube-panel rules; preserve deck global styles and `.hud-panel`, `.hud-btn`, `.hud-input`.                                                                                               |
| `src/test/app-routing.test.tsx`                                       | Do not move | Exact-path conflict; extend deck route tests rather than replacing security-gate coverage.                                                                                                                                                                                           |
| `src/test/arm-ik.test.ts`                                             | Move as-is  | Tests fixed-bone arm IK, speech gestures, and reachable forward flight targets; no same-path deck test.                                                                                                                                                                              |
| `src/test/scene-manager.test.ts`                                      | Move/adapt  | Rendered-object tests now account for the local world-layout layer and its cleanup; add only with the avatar Three.js runtime.                                                                                                                                                       |
| `src/test/themes.test.ts`                                             | Move/adapt  | New named/custom theme and local preference tests.                                                                                                                                                                                                                                   |
| `src/test/vision.test.ts`                                             | Move/adapt  | New camera-off and explicit local-vision request tests; frame contents are transient and no credentials are used.                                                                                                                                                                    |
| `src/test/city-view.test.tsx`                                         | Add         | Tests the local placeholder city and its zone/route markers; retain only as an adapted avatar panel test.                                                                                                                                                                            |
| `src/test/world-commands.test.ts`                                     | Move/adapt  | Unit tests for voice/text world-command parsing and explicit vision triggers.                                                                                                                                                                                                        |
| `src/test/cube-panel.test.tsx`                                        | Add         | Tests the hidden panel's server-verified access state, local conversion/layer display, and close action; does not add a route.                                                                                                                                                       |
| `src/test/cube-reference.test.ts`                                     | Add         | Unit tests for safe numeric conversion, bitwise calculations, cubie mapping, and the explicit phrase.                                                                                                                                                                                |
| `src/test/interaction-controls.test.ts`                               | Add         | Tests focus, show-screen, wake/silence parsing, and device-local preference persistence.                                                                                                                                                                                             |
| `src/test/knowledge-base.test.ts`                                     | Add         | Tests catalog coverage claims, official source links, state directory size, and non-invention on missing facts.                                                                                                                                                                      |
| `src/test/local-memory.test.ts`                                       | Add         | Tests device-local highlights, sourced text segmentation, limits, and corrupt-storage reporting.                                                                                                                                                                                     |
| `src/test/avatar-rules.test.ts`                                       | Adapt       | New test path at inspected tree; retain tests that apply, and align mocked bridge/provider behavior to deck integration.                                                                                                                                                             |
| `src/test/ollama-ai.test.ts`                                          | Move/adapt  | Tests Ollama, saved-answer fallback, explicit offline unknowns, muted speech, and generic operator-only prompt; no simulated knowledge claims.                                                                                                                                       |
| `src/test/core-city-state.test.ts`                                    | Move/adapt  | New Core/City reducer and voice-command parsing tests; retain deck state integration tests.                                                                                                                                                                                          |
| `src/test/locomotion.test.ts`                                         | Move/adapt  | Tests world-space walking, ground contact, returning home, growth, and full-size flight posture.                                                                                                                                                                                     |
| `src/test/particle-legs.test.ts`                                      | Add         | Verifies articulated legs, forward feet, one 120K particle dataset, gait, and particle coverage on both front and back of the torso.                                                                                                                                                 |
| `src/test/world-rules.test.ts`                                        | Add         | Tests town-safe and outer-region classification, route coverage, and the local encounter/trainer marker relationships.                                                                                                                                                               |
| `src/test/sensors-config.test.ts`                                     | Move/adapt  | New test path for configured MediaPipe assets and defaults.                                                                                                                                                                                                                          |
| `src/test/supabase-readonly.test.ts`                                  | Move/adapt  | New test path verifying public-key GET-only connectivity and row reads; no database setup is required.                                                                                                                                                                               |
| `src/test/voice.test.ts`                                              | Move/adapt  | New voice fallback test; retain deck test setup and mock the server function without embedding credentials.                                                                                                                                                                          |
| `src/test/setup.ts`                                                   | Do not move | Exact-path conflict; preserve deck's test environment.                                                                                                                                                                                                                               |
| `tsconfig.json`                                                       | Adapt       | Exact-path conflict; merge only necessary type aliases/types and compiler settings.                                                                                                                                                                                                  |
| `vite.config.ts`                                                      | Adapt       | Exact-path conflict; preserve deck plugins, server preset, and deployment config.                                                                                                                                                                                                    |
| `vitest.config.ts`                                                    | Adapt       | Exact-path conflict; merge test discovery/setup only.                                                                                                                                                                                                                                |
| `.env.example`                                                        | Adapt       | Exact-path conflict; merge empty non-secret config, including `VITE_OLLAMA_VISION_MODEL` and `OSIRIS_OPERATOR_NAME`, plus server-only secret variable names. No `OSIRIS_OPERATOR_USER_ID` is required. Never copy credential values or expose secrets via `VITE_`.                   |
| `docs/merge-map.md`                                                   | Move as-is  | New documentation path; retain or update after the deck integration is completed.                                                                                                                                                                                                    |

## Dependency and integration conflicts

- AUGIXVI declares `three` `^0.187.0`; the deck uses `three` `0.170.0`.
  Reconcile API compatibility and types before merging the renderer; do not
  upgrade or replace the deck dependency implicitly.
- AUGIXVI depends on `@mediapipe/tasks-vision` `^1.2.2`, which the deck does
  not currently include. Add it only if the adapted sensor experience is kept.
- Keep the deck's existing `CommandDeck`, `HoloStage`, `SettingsPanel`,
  `CommandOversight`, route/auth shell, and `src/styles.css` as the host.
  Compose `AvatarStage` as a panel or secondary route; preserve the office home.
- The avatar exports `AvatarStage`, `AvatarBridge`, `AvatarRenderer`,
  `solveArm`, `armPose`, `flightArmPose`, `makeProp`, `handPoints`, `filePoints`, `limbPoints`,
  `attachOllamaAI`, `createVoiceProvider`, `requestElevenLabsAudio`,
  `reduceCoreCityState`, `parseCoreCommand`, `CityView`, and
  `createReadOnlySupabaseClient`, `KnowledgePanel`, `createLocalMemory`,
  `findLocalAnswer`, `splitDocument`, `parseInteractionCommand`, and
  `lookupKnowledge`.
  No same-named deck exports were identified. Do not replace the deck's
  `Avatar`, `AvatarImage`, `AvatarFallback`, `streamChat`, `CoreState`, or
  `SceneColors`.
- The avatar stylesheet's conflicting global file is `src/styles.css`.
  Preserve deck styles and merge only the `.avatar-stage`-scoped classes
  enumerated below; in particular, do not overwrite deck `.hud-panel`,
  `.hud-btn`, or `.hud-input`.

## Export and style-name collision checklist

### AUGIXVI public exports to retain or adapt

- `AvatarBridge.ts`: `AvatarState`, `Gesture`, `AvatarBridge`.
- `AvatarRenderer.ts`: `RenderSettings`, `Inputs`, `AvatarRenderer`.
- `AvatarStage.tsx`: `AvatarStage`; currently the UI route component, not a deck
  stage primitive.
- `CubePanel.tsx`: `CubePanel`; an in-panel component, deliberately not a
  route or visible-link destination.
- `cubeReference.ts`: `CUBE_LAYERS`, `parseCubeValue`, `convertCubeValue`,
  `calculateBitwise`, `getCubieBits`, and `isCubePanelCommand`.
- `armIK.ts`: `V3`, `ARM`, `ArmSolution`, `solveArm`, `ArmPose`, `armPose`,
  `flightArmPose`, `handDirection`.
- `KnowledgePanel.tsx`: `KnowledgePanel`.
- `localMemory.ts`: `LocalMemoryRecord`, `createLocalMemory`,
  `createHighlight`, `splitDocument`, `findLocalAnswer`.
- `interactionControls.ts`: `InteractionCommand`, `parseInteractionCommand`,
  and clear/silent preference helpers.
- `knowledgeBase.ts`: `KnowledgeSource`, `MartialArtEntry`,
  `KNOWLEDGE_SOURCES`, `CURRICULUM_PACKS`, `MARTIAL_ARTS`,
  `DEFENSIVE_CYBERSECURITY_TOPICS`, `PRACTICAL_SKILL_TOPICS`, `US_STATES`,
  `lookupKnowledge`.
- `ollamaAI.ts`: `OllamaAIOptions`, `OllamaAI`, `attachOllamaAI`.
- `voice.ts`: `VoiceProvider`, `createVoiceProvider`.
- `elevenlabs.server.ts`: `requestElevenLabsAudio` (server function; adapt
  credential access and security middleware to the deck).
- `particleSource.ts`: `ParticleData`, `ParticleSource`, `proceduralBust`.
- `props.ts`: `makeProp`, `handPoints`, `filePoints`, `limbPoints`.
- `sensors.ts`: `SensorCallbacks`, `SensorStatus`, `SensorOptions`, `Sensors`.
- `simulatedAI.ts`: `attachSimulatedAI`, `isPresentCommand`.
- `snapDetector.ts`: `SnapOptions`, `SnapDetector`, `OnsetDetector`.
- `stateParams.ts`: `Params`, `targetParams`, `spring`, `intensityLabel`.
- `sceneManager.ts`: `SceneManager`.
- `worldCommands.ts`: `MaterialKind`, `WorldCommand`, `parseWorldCommand`,
  `isCameraVisionRequest`.
- `worldRules.ts`: `WORLD_RULES`, `getWorldZoneAt`, `isSafeZone`; local
  layout data only, not server-authoritative game state.
- `locomotion.ts`: `AvatarLocomotion`.
- `particleLegs.ts`: `ParticleLegData`, `createParticleLegData`,
  `getLegGaitAngle`.
- `vision.ts`: `describeCameraFrame`.
- `themes.ts`: `THEMES`, `ThemeName`, `ThemeChoice`, `ThemePalette`,
  `ThemePreference`, `getThemePalette`, `getThemeAccent`,
  `loadThemePreference`, `saveThemePreference`.

No same-named export was found for these in the deck file tree. The deck symbols
to avoid replacing are `CommandDeck`, `HoloStage`, `CoreState`, `SettingsPanel`,
`CommandOversight`, `Avatar`, `AvatarImage`, `AvatarFallback`, `streamChat`,
`HudSettings`, `SceneColors`, and the `RadarKeys`/`RADAR_KEY_NAMES` API-key
helpers. Adapt at composition boundaries; do not alias one implementation over
another.

### Avatar CSS classes

The avatar's unique component classes are `avatar-stage`, `avatar-hud`,
`avatar-hud--tr`, `avatar-hud--tl`, `avatar-hud--commands`,
`avatar-hud__value`, `avatar-hud__warning`, `avatar-hud__bar`,
`avatar-hud__button`, `avatar-hud__button--primary`,
`avatar-hud__last-words`, `avatar-hud__last-words-label`,
`avatar-hud__command-row`, `avatar-hud__input`, `avatar-hud__send`,
`avatar-hud__panel`, `avatar-hud__row`, `avatar-hud__range`, and
`avatar-hud__select`, `avatar-hud__color`, `avatar-hud__offline`, and
`avatar-hud__retry`, `avatar-hud__response-source`,
`avatar-hud__save-highlight`, `avatar-hud__listening-flash`,
`avatar-hud__knowledge*`, and `avatar-stage--clear-screen`. They are
scoped beneath `.avatar-stage`. The Core/City layout adds
`.avatar-stage--city`, `.city-view`, and `.city-view__slot`; these must also be
composed rather than replacing deck global styles. `sr-only` and
`absolute inset-0` are generic utility classes, not avatar-owned global rules.
The hidden cube panel adds `.avatar-cube-backdrop`, `.avatar-cube-panel`,
`.avatar-cube-header`, `.avatar-cube-eyebrow`, `.avatar-cube-close`,
`.avatar-cube-note`, `.avatar-cube-unlock`, `.avatar-cube-error`,
`.avatar-cube-section`, `.avatar-cube-input-row`, `.avatar-cube-values`,
`.avatar-cube-layers`, `.avatar-cube-subtitle`, `.avatar-cube-bits`,
`.avatar-cube-calc-row`, and `.avatar-cube-result`; keep these scoped to the
avatar panel when adapting styles.

The earlier short names `.hud`, `.hud-tr`, `.hud-tl`, `.hud-val`, `.hud-warn`,
`.hud-bar`, `.hud-btn`, `.hud-btn-primary`, `.hud-br`, `.hud-last-words`,
`.hud-last-words-label`, `.hud-command-row`, `.hud-input`, `.hud-send`,
`.hud-panel`, `.hud-row`, `.hud-range`, and `.hud-select` are not used by the
current avatar UI. This matters because the deck already styles `.hud-panel`,
`.hud-btn`, and `.hud-input` globally.
