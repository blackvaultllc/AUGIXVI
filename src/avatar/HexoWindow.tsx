/**
 * HEXO — the Captain's cube (his order 2026-11-25: "I haven't
 * seen my Hexel cube for a while... it's making me upset"), and
 * THE CUBE ALONE (his order 2026-11-27, phone fix pass 6):
 * opening HEXO from the Tools grid no longer opens the whole
 * HEXO website inside a window. The cube is pulled OUT of the
 * page — the cube alone, spinning, standing over his gold
 * binary Matrix Wall, his own Cerebro centerpiece. No topbar,
 * no creed strip, no page nav, no HUD boxes, no layer bar, no
 * tables around it, and the artifact's own green rain is off:
 * HIS rain surrounds the cube now. One Back button returns
 * him to the stage.
 *
 * HEXO is the hidden, operator-only Rubik's-cube core: an
 * 11x11x11 cube whose four layers peel back Binary → Hex →
 * HEXO → Knowledge. It was built as a standalone artifact
 * ("HEXO — AUGI Core"); its app port sat as a local commit
 * that was never pushed, which is why it vanished from his
 * area. The artifact itself is unchanged and still whole in
 * the bundle:
 *
 * - The artifact's page is bundled INTO the app bundle
 *   (imported as text) and rendered through an iframe srcDoc —
 *   it has NO public path of its own, exactly as HEXO was
 *   always meant to live: hidden, operator-only, inside his
 *   area.
 * - The artifact pulled three.js from a CDN. Here the same
 *   three.js build (r149, the version the artifact was written
 *   against) is bundled and inlined into the document, so the
 *   cube turns on the Parrot with no internet at all
 *   (local-first law). The Google Fonts links stay as
 *   decoration only — offline they fall back to system fonts
 *   and nothing breaks.
 * - The cube-only document is the SAME artifact document with
 *   one override sheet laid over it (buildHexoCubeDocument):
 *   every part of the page except the core stage's viewport is
 *   hidden, the page ground goes transparent, and the viewport
 *   fills the frame. The cube's own renderers already clear
 *   transparent (the WebGL renderer is built with alpha:true;
 *   the 2D fallback clears with clearRect), so the Matrix Wall
 *   behind the frame shows through around the spinning cube.
 *   Nothing inside the artifact was rewritten — the cube, the
 *   HEXO balance engine behind it, and the visual/mental hunt
 *   (letters scattered, found with eyes and mind only) all run
 *   exactly as the artifact runs them; they are simply not
 *   dressed in the page anymore.
 */
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { MatrixWall } from "./MatrixWall";
import hexoHtml from "./hexo/hexo.html?raw";
import threeSource from "./hexo/three.min.js?raw";

const THREE_CDN_TAG =
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/0.149.0/three.min.js"></script>';

/**
 * The artifact page with its three.js CDN tag swapped for the
 * same build inlined — one self-contained document, no network
 * needed. Exported for tests.
 */
export function buildHexoDocument(): string {
  if (!hexoHtml.includes(THREE_CDN_TAG)) return hexoHtml;
  const inline = `<script>${threeSource.replace(/<\/script/gi, "<\\/script")}</script>`;
  return hexoHtml.replace(THREE_CDN_TAG, inline);
}

/**
 * THE CUBE-ONLY SHEET (owner order 2026-11-27, pass 6): laid
 * over the artifact's own styles, it strips the page down to
 * the cube. Everything in the wrap except the core stage is
 * hidden; inside the stage, the HUD and the layer bar go too;
 * inside the viewport, the artifact's own rain canvas and the
 * CHAOS badge go — what remains is the cube's two canvases and
 * the WebGL holder, over a transparent ground, filling the
 * whole frame.
 */
const CUBE_ONLY_STYLE = `<style>
/* HEXO — CUBE ONLY (owner order 2026-11-27, phone fix pass 6) */
html,body{height:100%;background:transparent !important}
body{overflow:hidden}
.wrap{max-width:none;width:100%;height:100%;margin:0;padding:0}
.wrap>*:not(.stage){display:none !important}
.stage{height:100%;margin:0;border:none !important;border-radius:0;background:transparent !important}
.viewport{height:100%}
.hud,.layerbar{display:none !important}
#rain,.chaos-badge{display:none !important}
</style>`;

/**
 * The cube-only document: the full artifact document (three.js
 * inlined by buildHexoDocument) with the cube-only sheet laid
 * into its head. Exported for tests.
 */
export function buildHexoCubeDocument(): string {
  const doc = buildHexoDocument();
  if (!doc.includes("</head>")) return doc;
  return doc.replace("</head>", `${CUBE_ONLY_STYLE}</head>`);
}

/**
 * THE CUBE VIEW — a stage screen, not a window: the Matrix
 * Wall stands as the ground (the same wall the stage itself
 * rests on, role owner), the cube-only frame fills the screen
 * over it, and one Back pill at the top-left returns him to
 * the stage. The frame is transparent, so the rain he sees
 * around the cube is his own wall, live behind it.
 */
export function HexoCubeView({ onClose }: { onClose: () => void }) {
  const document_ = useMemo(buildHexoCubeDocument, []);
  return (
    <div
      className="hexo-cube-view"
      role="dialog"
      aria-label="HEXO — the Core: the cube alone over the Matrix Wall"
    >
      <MatrixWall role="owner" />
      <iframe srcDoc={document_} title="HEXO — AUGI Core" />
      <button
        type="button"
        className="hexo-cube-view__back"
        onClick={onClose}
        aria-label="Back to the stage — close HEXO"
      >
        <ArrowLeft aria-hidden="true" size={15} />
        <span>Back</span>
      </button>
    </div>
  );
}
