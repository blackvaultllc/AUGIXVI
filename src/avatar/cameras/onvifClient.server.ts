/**
 * ONVIF CLIENT — node-only, server-side. Just enough ONVIF to run
 * his cameras: device information (the fingerprint), media
 * profiles + stream URIs, and PTZ continuous move / stop.
 *
 * Auth is the ONVIF standard WS-UsernameToken password digest:
 *   PasswordDigest = Base64( SHA1( nonce + created + password ) )
 * The username on the O-KAM family is "admin" and the password is
 * the device password he sets in the camera's app — the value that
 * switches ONVIF on for that whole platform. The password arrives
 * here from the server store only; it is never logged and never
 * appears in an error this module returns.
 *
 * Every call is time-bounded and reports an honest state: answered,
 * auth-refused, or unreachable — the caller (probe / PTZ pad)
 * shows him exactly which one happened.
 */
import { createHash, randomBytes } from "node:crypto";

/** The ONVIF password digest, per the WS-Security UsernameToken profile. */
export function onvifPasswordDigest(nonceBase64: string, created: string, password: string): string {
  const nonce = Buffer.from(nonceBase64, "base64");
  const hash = createHash("sha1");
  hash.update(nonce);
  hash.update(created, "utf8");
  hash.update(password, "utf8");
  return hash.digest("base64");
}

function securityHeader(username: string, password: string): string {
  const nonce = randomBytes(16).toString("base64");
  const created = new Date().toISOString();
  const digest = onvifPasswordDigest(nonce, created, password);
  return (
    `<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">` +
    `<wsse:UsernameToken><wsse:Username>${escapeXml(username)}</wsse:Username>` +
    `<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${digest}</wsse:Password>` +
    `<wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce}</wsse:Nonce>` +
    `<wsu:Created>${created}</wsu:Created></wsse:UsernameToken></wsse:Security>`
  );
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function envelope(username: string, password: string, body: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tt="http://www.onvif.org/ver10/schema" xmlns:tds="http://www.onvif.org/ver10/device/wsdl" xmlns:trt="http://www.onvif.org/ver10/media/wsdl" xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">` +
    `<s:Header>${securityHeader(username, password)}</s:Header><s:Body>${body}</s:Body></s:Envelope>`
  );
}

export type OnvifResult<T> =
  | { state: "ok"; value: T }
  | { state: "auth-refused" }
  | { state: "unreachable"; detail: string }
  | { state: "bad-response"; detail: string };

async function soap<T>(
  url: string,
  username: string,
  password: string,
  body: string,
  parse: (xml: string) => T | null,
  timeoutMs = 6000,
): Promise<OnvifResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/soap+xml; charset=utf-8" },
      body: envelope(username, password, body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return {
      state: "unreachable",
      detail: error instanceof Error ? error.name : "network error",
    };
  }
  const text = await response.text().catch(() => "");
  if (response.status === 401 || response.status === 403 || /NotAuthorized|Sender.*Security|FailedAuthentication/i.test(text)) {
    return { state: "auth-refused" };
  }
  if (!response.ok) {
    return { state: "bad-response", detail: `HTTP ${response.status}` };
  }
  const value = parse(text);
  if (value === null) {
    if (/Fault/i.test(text)) return { state: "auth-refused" };
    return { state: "bad-response", detail: "unparseable ONVIF reply" };
  }
  return { state: "ok", value };
}

function tag(xml: string, name: string): string | null {
  const match = new RegExp(`<(?:[a-zA-Z0-9]+:)?${name}>([^<]*)</(?:[a-zA-Z0-9]+:)?${name}>`).exec(xml);
  return match?.[1] ? match[1].trim() : null;
}

function allTags(xml: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${name}>([^<]*)</(?:[a-zA-Z0-9]+:)?${name}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m[1] !== undefined) out.push(m[1].trim());
  }
  return out;
}

export type OnvifDeviceInfo = {
  manufacturer: string | null;
  model: string | null;
  firmware: string | null;
  serial: string | null;
  mediaUrl: string | null;
  ptzUrl: string | null;
};

export function deviceServiceUrl(host: string, onvifPort: number): string {
  return `http://${host}:${onvifPort}/onvif/device_service`;
}

/** GetDeviceInformation + GetServices (the fingerprint + service map). */
export async function onvifDeviceInfo(
  host: string,
  onvifPort: number,
  username: string,
  password: string,
): Promise<OnvifResult<OnvifDeviceInfo>> {
  const base = deviceServiceUrl(host, onvifPort);
  const info = await soap(
    base,
    username,
    password,
    `<tds:GetDeviceInformation/>`,
    (xml) => ({
      manufacturer: tag(xml, "Manufacturer"),
      model: tag(xml, "Model"),
      firmware: tag(xml, "FirmwareVersion"),
      serial: tag(xml, "SerialNumber"),
    }),
  );
  if (info.state !== "ok") return info;
  const services = await soap(
    base,
    username,
    password,
    `<tds:GetServices><tds:IncludeCapability>false</tds:IncludeCapability></tds:GetServices>`,
    (xml) => xml,
  );
  let mediaUrl: string | null = null;
  let ptzUrl: string | null = null;
  if (services.state === "ok") {
    const blocks = services.value.split(/Service>/);
    for (const block of blocks) {
      const ns = tag(block, "Namespace");
      const addr = tag(block, "XAddr");
      if (!addr) continue;
      if (ns?.includes("/media/")) mediaUrl = addr;
      if (ns?.includes("/ptz/")) ptzUrl = addr;
    }
  }
  return { state: "ok", value: { ...info.value, mediaUrl, ptzUrl } };
}

export type OnvifProfile = { token: string; name: string | null; hasPtz: boolean };

/** Media profiles (one per lens on dual units) + their stream URIs. */
export async function onvifProfiles(
  mediaUrl: string,
  username: string,
  password: string,
): Promise<OnvifResult<OnvifProfile[]>> {
  return soap(mediaUrl, username, password, `<trt:GetProfiles/>`, (xml) => {
    const tokens = [...xml.matchAll(/Profiles[^>]*token="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((t): t is string => typeof t === "string" && t.length > 0);
    if (!tokens.length) return null;
    return tokens.map((token) => ({
      token,
      name: null,
      hasPtz: /PTZConfiguration/i.test(xml),
    }));
  });
}

export async function onvifStreamUri(
  mediaUrl: string,
  username: string,
  password: string,
  profileToken: string,
): Promise<OnvifResult<string>> {
  return soap(
    mediaUrl,
    username,
    password,
    `<trt:GetStreamUri><trt:StreamSetup><tt:Stream>RTP-Unicast</tt:Stream><tt:Transport><tt:Protocol>RTSP</tt:Protocol></tt:Transport></trt:StreamSetup><trt:ProfileToken>${escapeXml(profileToken)}</trt:ProfileToken></trt:GetStreamUri>`,
    (xml) => tag(xml, "Uri"),
  );
}

/** Continuous PTZ move; velocity components are -1..1. Pair with ptzStop. */
export async function onvifPtzMove(
  ptzUrl: string,
  username: string,
  password: string,
  profileToken: string,
  velocity: { pan: number; tilt: number; zoom: number },
): Promise<OnvifResult<true>> {
  const clamp = (n: number) => Math.max(-1, Math.min(1, n));
  return soap(
    ptzUrl,
    username,
    password,
    `<tptz:ContinuousMove><tptz:ProfileToken>${escapeXml(profileToken)}</tptz:ProfileToken>` +
      `<tptz:Velocity><tt:PanTilt x="${clamp(velocity.pan)}" y="${clamp(velocity.tilt)}"/><tt:Zoom x="${clamp(velocity.zoom)}"/></tptz:Velocity></tptz:ContinuousMove>`,
    (xml) => (/ContinuousMoveResponse/.test(xml) ? true : null),
  );
}

export async function onvifPtzStop(
  ptzUrl: string,
  username: string,
  password: string,
  profileToken: string,
): Promise<OnvifResult<true>> {
  return soap(
    ptzUrl,
    username,
    password,
    `<tptz:Stop><tptz:ProfileToken>${escapeXml(profileToken)}</tptz:ProfileToken><tptz:PanTilt>true</tptz:PanTilt><tptz:Zoom>true</tptz:Zoom></tptz:Stop>`,
    (xml) => (/StopResponse/.test(xml) ? true : null),
  );
}

export { allTags };

/* ------------------------------------------------------------------ */
/* Camera Presence doors (2026-11-26): services map, imaging,          */
/* PTZ capabilities + auxiliary, video analytics. Raw-XML returns:     */
/* the READING of what a unit exposes lives in the pure module         */
/* (cameraPresence.ts) so it is testable against fixtures; this        */
/* client only dials and reports honest states.                        */
/* ------------------------------------------------------------------ */

export type OnvifService = { namespace: string; xaddr: string };

/** The full service map (GetServices) — media, PTZ, imaging, analytics… */
export async function onvifServices(
  host: string,
  onvifPort: number,
  username: string,
  password: string,
): Promise<OnvifResult<OnvifService[]>> {
  return soap(
    deviceServiceUrl(host, onvifPort),
    username,
    password,
    `<tds:GetServices><tds:IncludeCapability>false</tds:IncludeCapability></tds:GetServices>`,
    (xml) => {
      const out: OnvifService[] = [];
      for (const block of xml.split(/Service>/)) {
        const ns = tag(block, "Namespace");
        const addr = tag(block, "XAddr");
        if (ns && addr) out.push({ namespace: ns, xaddr: addr });
      }
      return out.length ? out : null;
    },
  );
}

/** PTZ service capabilities, raw — the pure reader looks for aux doors. */
export async function onvifPtzCapabilities(
  ptzUrl: string,
  username: string,
  password: string,
): Promise<OnvifResult<string>> {
  return soap(ptzUrl, username, password, `<tptz:GetServiceCapabilities/>`, (xml) => xml);
}

/** Send one PTZ auxiliary command (e.g. a lamp door the unit advertises). */
export async function onvifPtzAuxiliary(
  ptzUrl: string,
  username: string,
  password: string,
  profileToken: string,
  data: string,
): Promise<OnvifResult<true>> {
  return soap(
    ptzUrl,
    username,
    password,
    `<tptz:SendAuxiliaryCommand><tptz:ProfileToken>${escapeXml(profileToken)}</tptz:ProfileToken><tptz:AuxiliaryData>${escapeXml(data)}</tptz:AuxiliaryData></tptz:SendAuxiliaryCommand>`,
    (xml) => (/SendAuxiliaryCommandResponse/.test(xml) ? true : null),
  );
}

/** Media profiles, raw XML — carries the analytics configuration token. */
export async function onvifProfilesXml(
  mediaUrl: string,
  username: string,
  password: string,
): Promise<OnvifResult<string>> {
  return soap(mediaUrl, username, password, `<trt:GetProfiles/>`, (xml) => xml);
}

/** Video source tokens (imaging settings are addressed per source). */
export async function onvifVideoSources(
  mediaUrl: string,
  username: string,
  password: string,
): Promise<OnvifResult<string[]>> {
  return soap(mediaUrl, username, password, `<trt:GetVideoSources/>`, (xml) => {
    const tokens = [...xml.matchAll(/VideoSources[^>]*token="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((t): t is string => typeof t === "string" && t.length > 0);
    return tokens.length ? tokens : null;
  });
}

/** Imaging settings for one video source, raw XML. */
export async function onvifImagingSettings(
  imagingUrl: string,
  username: string,
  password: string,
  videoSourceToken: string,
): Promise<OnvifResult<string>> {
  return soap(
    imagingUrl,
    username,
    password,
    `<timg:GetImagingSettings xmlns:timg="http://www.onvif.org/ver20/imaging/wsdl"><timg:VideoSourceToken>${escapeXml(videoSourceToken)}</timg:VideoSourceToken></timg:GetImagingSettings>`,
    (xml) => xml,
  );
}

/** Write imaging settings for one video source (the whole settings block). */
export async function onvifSetImagingSettings(
  imagingUrl: string,
  username: string,
  password: string,
  videoSourceToken: string,
  imagingSettingsInnerXml: string,
): Promise<OnvifResult<true>> {
  return soap(
    imagingUrl,
    username,
    password,
    `<timg:SetImagingSettings xmlns:timg="http://www.onvif.org/ver20/imaging/wsdl"><timg:VideoSourceToken>${escapeXml(videoSourceToken)}</timg:VideoSourceToken><timg:ImagingSettings>${imagingSettingsInnerXml}</timg:ImagingSettings><timg:ForcePersistence>true</timg:ForcePersistence></timg:SetImagingSettings>`,
    (xml) => (/SetImagingSettingsResponse/.test(xml) ? true : null),
  );
}

/** One video-analytics configuration, raw XML. */
export async function onvifAnalyticsConfiguration(
  analyticsUrl: string,
  username: string,
  password: string,
  configurationToken: string,
): Promise<OnvifResult<string>> {
  return soap(
    analyticsUrl,
    username,
    password,
    `<tan:GetVideoAnalyticsConfiguration xmlns:tan="http://www.onvif.org/ver20/analytics/wsdl"><tan:ConfigurationToken>${escapeXml(configurationToken)}</tan:ConfigurationToken></tan:GetVideoAnalyticsConfiguration>`,
    (xml) => xml,
  );
}

/** Write back one video-analytics configuration (the whole block). */
export async function onvifSetAnalyticsConfiguration(
  analyticsUrl: string,
  username: string,
  password: string,
  configurationInnerXml: string,
): Promise<OnvifResult<true>> {
  return soap(
    analyticsUrl,
    username,
    password,
    `<tan:SetVideoAnalyticsConfiguration xmlns:tan="http://www.onvif.org/ver20/analytics/wsdl">${configurationInnerXml}<tan:ForcePersistence>true</tan:ForcePersistence></tan:SetVideoAnalyticsConfiguration>`,
    (xml) => (/SetVideoAnalyticsConfigurationResponse/.test(xml) ? true : null),
  );
}
