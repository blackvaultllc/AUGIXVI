import { useEffect, useRef, useState } from "react";
import type { AvatarState } from "./AvatarBridge";
import {
  MILESTONE_FLASH_MS,
  PRESENCE_ASSETS,
  PRESENCE_POSTER,
  presenceKindFor,
} from "./presenceState";

/**
 * OSIRIS IN THE PANEL (owner orders 2026-11-22): the chat panel's
 * round face is OSIRIS — the construct — shown at a size the Captain
 * can actually SEE working (76px, captioned OSIRIS), not a tiny
 * icon. The clip is chosen by presenceKindFor from the stage's real
 * signals, and the milestone face appears only in the brief window
 * after a thinking cycle actually completes (THINKING leaving the
 * bridge state). The construct's full presence stands on the stage
 * in his own box; this is his face in the panel, at the head of the
 * rail, working.
 */
export function AugiePresence({
  ready,
  avatarState,
  voiceListening,
  acting,
}: {
  ready: boolean;
  avatarState: AvatarState;
  voiceListening: boolean;
  acting: boolean;
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
    acting,
    milestone,
  });
  const asset = PRESENCE_ASSETS[kind];

  return (
    <div className="osiris-presence">
      <div
        className="augie-presence"
        data-presence={kind}
        role="img"
        aria-label={`Osiris — the construct, ${asset.label}`}
        title={`Osiris — the construct, ${asset.label}`}
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
      <span className="osiris-presence__caption" aria-hidden="true">
        Osiris
      </span>
    </div>
  );
}
