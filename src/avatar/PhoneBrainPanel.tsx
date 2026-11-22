import { useCallback, useEffect, useState } from "react";
import {
  PHONE_BRAIN_MODELS,
  PHONE_BRAIN_PROVIDER,
  deletePhoneBrain,
  derivePhoneBrainStatus,
  downloadPhoneBrain,
  phoneBrainDownloaded,
  phoneBrainSupport,
  recommendedModel,
  type PhoneBrainModel,
  type PhoneBrainStatus,
  type PhoneBrainSupport,
} from "./phoneBrain";

/**
 * ON-PHONE BRAIN — Settings panel (owner order 2026-11-22).
 *
 * The download is an explicit operator action: the size is on the
 * button before anything moves, progress shows while it lands, and a
 * downloaded model can be deleted. Nothing downloads from anywhere
 * else in the app. When this brain is the one that answers, the reply
 * is labeled "On-phone brain (small)" — stated here, in the HUD, and
 * in the response path itself.
 */
export function PhoneBrainPanel({
  onStatusChange,
}: {
  onStatusChange?: (status: PhoneBrainStatus) => void;
}) {
  const [support, setSupport] = useState<PhoneBrainSupport | null>(null);
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ text: string; value: number } | null>(null);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const facts = await phoneBrainSupport();
    setSupport(facts);
    const states: Record<string, boolean> = {};
    for (const model of PHONE_BRAIN_MODELS) {
      states[model.id] = await phoneBrainDownloaded(model.id);
    }
    setDownloaded(states);
    onStatusChange?.(
      derivePhoneBrainStatus({
        webgpu: facts.webgpu,
        anyCached: Object.values(states).some(Boolean),
      }),
    );
  }, [onStatusChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function download(model: PhoneBrainModel) {
    setBusy(model.id);
    setProgress({ text: "Starting the download…", value: 0 });
    setMessage("");
    try {
      await downloadPhoneBrain(model.id, (text, value) => setProgress({ text, value }));
      setMessage(
        `Downloaded. This device now carries its own brain — with no network at all it answers as "${PHONE_BRAIN_PROVIDER}".`,
      );
    } catch (error) {
      setMessage(
        `The download did not finish: ${error instanceof Error ? error.message : String(error)}. Nothing partial is kept — run it again when the connection is steady.`,
      );
    } finally {
      setBusy(null);
      setProgress(null);
      void refresh();
    }
  }

  async function remove(model: PhoneBrainModel) {
    setBusy(model.id);
    setMessage("");
    try {
      await deletePhoneBrain(model.id);
      setMessage(`${model.label} removed from this device.`);
    } catch (error) {
      setMessage(
        `That model could not be removed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setBusy(null);
      void refresh();
    }
  }

  const recommended = support ? recommendedModel(support) : null;

  return (
    <div className="phone-brain">
      <p>
        A real brain that lives in Augie on THIS device — for the day every other brain is out of
        reach. Download it once while you have internet; after that it answers with the network
        fully off. It is smaller than the brain on your computer, and it never pretends otherwise:
        when it answers, the reply is labeled “{PHONE_BRAIN_PROVIDER}”.
      </p>
      {support === null ? (
        <p role="status">Checking what this device can run…</p>
      ) : !support.webgpu ? (
        <p role="status">
          This browser reports no WebGPU, so the on-phone brain cannot live here. On your phone it
          reports its own result — Chrome on Android carries WebGPU.
        </p>
      ) : (
        <ul className="phone-brain__list">
          {PHONE_BRAIN_MODELS.map((model) => {
            const isDown = downloaded[model.id] === true;
            const blocked = model.needsF16 && !support.f16;
            return (
              <li key={model.id} className="phone-brain__row">
                <span>
                  <strong>{model.label}</strong>
                  {recommended?.id === model.id ? " — the pick for this device" : ""}
                  <br />
                  {model.blurb}
                  <br />
                  {isDown
                    ? "Downloaded on this device — ready offline."
                    : blocked
                      ? "Needs a GPU feature (shader-f16) this device does not report — the other build is your pick."
                      : `Not downloaded — about ${(model.sizeMB / 1000).toFixed(1)} GB, one time.`}
                </span>
                {isDown ? (
                  <button
                    type="button"
                    className="avatar-command-box__action"
                    disabled={busy !== null}
                    onClick={() => void remove(model)}
                  >
                    {busy === model.id ? "Removing…" : "Delete"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="avatar-command-box__action"
                    disabled={busy !== null || blocked}
                    onClick={() => void download(model)}
                  >
                    {busy === model.id
                      ? "Downloading…"
                      : `Download (${(model.sizeMB / 1000).toFixed(1)} GB)`}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {progress && (
        <div role="status">
          <p>{progress.text}</p>
          <div className="phone-brain__bar">
            <div
              className="phone-brain__bar-fill"
              style={{ width: `${Math.round(progress.value * 100)}%` }}
            />
          </div>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
