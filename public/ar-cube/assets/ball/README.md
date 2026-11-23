# Rainbow Ball target — photo slot

This folder is the target slot for Domenick's **Rainbow Ball** (his own
round puzzle ball — the marker he chose on 2026-11-22 to work alongside
the MERGE cube, and to replace it long-term).

The AR page (`../../index.html`) already has Ball mode built in: pick
**Marker → Rainbow Ball** and the session runs on
`../ball-targets.mind`, with the chosen model standing on the tracked
patch of the ball. That file does not exist yet, on purpose: a MindAR
target is compiled from photographs of the real object, and no pattern
is ever invented and passed off as his ball.

## The photos needed (exactly these)

Six straight-on photos of the ball, one per side:

1. front
2. back
3. left
4. right
5. top
6. bottom

Each photo: the ball filling the frame, sharp focus, good even light
(no harsh shadow across it), shot straight at that side — not at an
angle — with no hands or fingers in the way. Save them in this folder
as `ball-1-front.png`, `ball-2-back.png`, `ball-3-left.png`,
`ball-4-right.png`, `ball-5-top.png`, `ball-6-bottom.png`
(JPG is fine too — keep the same names).

## Compiling the target

Same MindAR compiler (mind-ar 1.2.5) and the same pattern as the cube
faces (`tools/compile-targets.js` in the standalone augie-ar-cube
project): load the photos into `MINDAR.IMAGE.Compiler`, compile, and
export the result to `../ball-targets.mind`. Target order = the photo
order above. The page carries an anchor for each of the six views (all
named "Rainbow Ball", one tracked at a time): the strongest, most
distinctive view is target 0, and compiling the remaining views in as
targets 1–5 lets a turn of the ball keep a lockable face toward the
camera. A file with only target 0 works too — the other anchors
simply never fire.

Once `../ball-targets.mind` exists, Ball mode lights up with no code
change: the page probes for the file at load and enables the mode
only when the server actually serves it.
