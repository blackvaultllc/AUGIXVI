/**
 * EMULATOR WINDOW — Battle Box in a floating box on the Captain's
 * stage (his order 2026-11-25: emulators in his area too, click and
 * play). The panel inside is the same one Khadija's Play cabinet
 * carries — one shelf, one law, two homes.
 */
import { FloatingWindow } from "./windows/FloatingWindow";
import { EmulatorPanel } from "./emulator/EmulatorPanel";

export function EmulatorWindow({ onClose }: { onClose: () => void }) {
  return (
    <FloatingWindow
      id="emulators"
      title="Battle Box — Emulators"
      onClose={onClose}
      initialWidth={640}
      initialHeight={620}
    >
      <EmulatorPanel />
    </FloatingWindow>
  );
}
