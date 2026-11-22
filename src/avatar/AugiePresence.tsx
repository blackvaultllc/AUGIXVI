import { useEffect, useRef, useState } from "react";
import type { AvatarState } from "./AvatarBridge";
import {
  MILESTONE_FLASH_MS,
  PRESENCE_ASSETS,
  PRESENCE_POSTER,
  presenceKindFor,
} from "./presenceState";

/**
 * Augie's living presence: a small circular video face in the Command
 * box grip (owner order 2026-11-22). Contained by design — a 38px
 * circle that never takes over the screen — and honest: the clip is
 * chosen by presenceKindFor from the stage's real signals, and the
 * milestone face appears only in the brief window after a thinking
 * cycle actually completes (THINKING leaving the bridge state).
 */
export function AugiePresence({
  ready,
  avatarState,
  voiceListening,
  actingLocally,
}: {
  ready: boolean;
  avatarState: AvatarState;
  voiceListening: boolean;
  actingLocally: boolean;
}) {
  const [milestone, setMilestone] = useState(false);
  const previousState = useRef<AvatarState>(avatarState);

  useEffect(() => {
    const was = previousState.current;
    previousState.current = avatarState;
    if (was !== "THINKING" || avatarState === "THINKING") return;
    // A thinking cycle just completed — flash the milestone face,
    // then fall back to whatever Augie is doing now.
    setMilestone(true);
    const timer = window.setTimeout(() => setMilestone(false), MILESTONE_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [avatarState]);

  const kind = presenceKindFor({
    ready,
    avatarState,
    voiceListening,
    actingLocally,
    milestone,
  });
  const asset = PRESENCE_ASSETS[kind];

  return (
    <div
      className="augie-presence"
      data-presence={kind}
      role="img"
      aria-label={`Augie — ${asset.label}`}
      title={`Augie — ${asset.label}`}
    >
      <video
        key={asset.video}
        className="augie-presence__video"
        src={asset.video}
        poster={PRESENCE_POSTER}
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      />
    </div>
  );
}
