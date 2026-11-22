import { useCallback, useEffect, useState } from "react";
import { fetchTrustedDevices, getOperatorAccessToken, revokeDevice } from "./trustedDevice";
import type { TrustedDeviceView } from "./trustedDevices.server";

/**
 * TRUSTED DEVICES — Settings panel (Part 8). Lists the devices the
 * operator's fully verified sign-ins have confirmed (device + IP),
 * and lets him revoke any of them. Revoking never touches the
 * account itself — the device simply goes back to full verification
 * on its next sign-in. Every call re-verifies his operator session
 * server-side; an unverified caller sees an empty list.
 */
const operatorAccessToken = getOperatorAccessToken;

export function TrustedDevicesPanel() {
  const [devices, setDevices] = useState<TrustedDeviceView[] | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const token = await operatorAccessToken();
    if (!token) {
      setDevices([]);
      return;
    }
    const result = await fetchTrustedDevices(token);
    setDevices(result.authorized ? result.devices : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(id: string) {
    const token = await operatorAccessToken();
    if (!token) return;
    const result = await revokeDevice(token, id);
    setMessage(
      result.revoked
        ? "Device forgotten. It will need full verification next sign-in."
        : "That device could not be forgotten. Try again.",
    );
    void load();
  }

  return (
    <div className="trusted-devices">
      <p>
        Devices confirmed by a full sign-in (password + authenticator) on this installation. A
        confirmed device skips extra steps — never the password or the code.
      </p>
      {devices === null ? (
        <p role="status">Loading devices…</p>
      ) : devices.length === 0 ? (
        <p role="status">No confirmed devices yet.</p>
      ) : (
        <ul className="trusted-devices__list">
          {devices.map((device) => (
            <li key={device.id} className="trusted-devices__row">
              <span>
                IP {device.ip} · last seen{" "}
                {new Date(device.lastSeen).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <button type="button" onClick={() => void revoke(device.id)}>
                Forget this device
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
