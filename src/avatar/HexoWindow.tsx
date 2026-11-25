/**
 * HEXO WINDOW — the Captain's cube, back in his area (his order
 * 2026-11-25: "I haven't seen my Hexel cube for a while... it's
 * making me upset").
 *
 * HEXO is the hidden, operator-only Rubik's-cube core: an 11x11x11
 * cube whose four layers peel back Binary → Hex → HEXO → Knowledge,
 * with binary rain over it. It was built as a standalone artifact
 * ("HEXO — AUGI Core"); its app port sat as a local commit that was
 * never pushed, which is why it vanished from his area. This window
 * restores the artifact itself, whole, inside the signed-in stage:
 *
 * - The artifact's page is bundled INTO the app bundle (imported as
 *   text) and rendered through an iframe srcDoc — it has NO public
 *   path of its own, exactly as HEXO was always meant to live:
 *   hidden, operator-only, inside his area.
 * - The artifact pulled three.js from a CDN. Here the same three.js
 *   build (r149, the version the artifact was written against) is
 *   bundled and inlined into the document, so the cube turns on the
 *   Parrot with no internet at all (local-first law). The Google
 *   Fonts links stay as decoration only — offline they fall back to
 *   system fonts and nothing breaks.
 * - Nothing about the artifact's insides was rewritten: the cube,
 *   the layer bar, the HEXO balance engine, the periodic table in
 *   the cube, and the visual/mental hunt (letters scattered, found
 *   with eyes and mind only — no spelled-out list, no tracking) are
 *   the artifact's own, word for word.
 */
import { useMemo } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import hexoHtml from "./hexo/hexo.html?raw";
import threeSource from "./hexo/three.min.js?raw";

const THREE_CDN_TAG =
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/0.149.0/three.min.js"></script>';

/**
 * The artifact page with its three.js CDN tag swapped for the same
 * build inlined — one self-contained document, no network needed.
 * Exported for tests.
 */
export function buildHexoDocument(): string {
  if (!hexoHtml.includes(THREE_CDN_TAG)) return hexoHtml;
  const inline = `<script>${threeSource.replace(/<\/script/gi, "<\\/script")}</script>`;
  return hexoHtml.replace(THREE_CDN_TAG, inline);
}

export function HexoWindow({ onClose }: { onClose: () => void }) {
  const document_ = useMemo(buildHexoDocument, []);
  return (
    <FloatingWindow
      id="hexo"
      title="HEXO — the Core"
      onClose={onClose}
      initialWidth={560}
      initialHeight={640}
    >
      <div className="window-hexo">
        <iframe srcDoc={document_} title="HEXO — AUGI Core" />
        <p className="window-hexo__note">
          Operator only — no public path. The cube and its four layers: Binary, Hex, HEXO,
          Knowledge.
        </p>
      </div>
    </FloatingWindow>
  );
}
