# RF/IR library — how it is built

The Captain's knowledge load (2026-11-24): Augie holds the public
remote-code corpora locally, so the Remote Codes window works with
the internet unplugged.

## Sources (all public, nothing hand-typed)

| Source | What it is | Get it |
| --- | --- | --- |
| Flipper IRDB | Community IR database (Flipper Zero `.ir` files) | `git clone --depth 1 https://github.com/Lucaslhm/Flipper-IRDB` |
| irdb | IR codes as protocol/device/function CSVs | `git clone --depth 1 https://github.com/probonopd/irdb` |
| LIRC remotes | The LIRC remote configuration library | `git clone --depth 1 https://git.code.sf.net/p/lirc-remotes/code` |
| SMPL code list | Printed setup numbers for SMPL universal remotes (PDF, 2019-1) | smpltec.com — "Device FULL Code List" |
| DISH code list | Printed setup numbers from the DISH 6.3/6.4 remote guide (PDF) | DISH Network remote equipment codes guide |

## Rebuild

```sh
mkdir -p ~/workspace/rf-sources   # lay the sources out as below
#   flipper-irdb/  irdb/  lirc-remotes/  smpl-codes.pdf  dish-codes.pdf
RF_SOURCES_DIR=~/workspace/rf-sources node tools/rf-library/ingest.mjs
```

Output lands in `public/rf-library/` (generated — git-ignored, like
the other big local payloads):

- `index.json` — sources with read counts, totals, the shelves
  (categories) with their brand lists, a global brand index, and the
  setup-list directory.
- `devices-<category>--<brand>.json` — one shard per brand per shelf;
  the window fetches only the brand the Captain picks.
- `setup-<list>.json` — setup numbers by kind of device and brand.

Rules the ingest keeps:

- A code enters only if a source file carries it. Every device and
  every code keeps its source names.
- Dedupe by brand + model + shelf; buttons merge by function name;
  identical codes from several sources merge into one code carrying
  all its sources. Different codes for the same button stay as
  variants — the window shows them all.
- Pronto hex is never stored. It is a format for raw timings and is
  converted at display time (`src/avatar/remoteCodes.ts`,
  `rawToPronto`), so it can never drift from the source numbers.
- Flipper's `Universal_TV_Remotes` folder is skipped: those are dumps
  *of* universal remotes, not codes *for* devices. Its `_Converted_`
  shelf (conversions of Pronto and other code sets, organised by
  brand only) is loaded under its own "converted" shelf.
