/**
 * SANDBOX — the attack-simulation and antivirus-design bench
 * (operator order 2026-11-21: "open a sandbox simulation with a
 * graphical interface showing how an attack/virus works and what it
 * is, trace the path stage by stage, and from that figure out exactly
 * how to create an antivirus").
 *
 * ABSOLUTE SAFETY LINE: everything here is MODELED DATA. A scenario is
 * a list of stage descriptions — names, explanations, the log line a
 * defender would see — rendered as a diagram. No real malware, no live
 * samples, no executable payloads, nothing that could be repurposed
 * as an attack tool. The bench exists so the DEFENSE can be designed:
 * every stage names the countermeasure that hooks it, and stepping a
 * scenario to the end derives its antivirus blueprint — the layered
 * defense (prevention / detection / response) the traced path implies.
 *
 * Pure data + pure functions — no DOM, no network, no eval — so the
 * scenario integrity, the stepper state machine, and the blueprint
 * derivation are all unit-testable (see src/test/sandbox.test.ts).
 * Scenarios are data: a new one drops into SANDBOX_SCENARIOS and the
 * window renders it with no UI changes.
 *
 * Stage language follows MITRE ATT&CK tactics and technique names so
 * the vocabulary learned here is the vocabulary the field uses.
 */

/** The three layers every defense is built from, in order. */
export type DefenseLayer = "prevention" | "detection" | "response";

export const DEFENSE_LAYERS: readonly DefenseLayer[] = [
  "prevention",
  "detection",
  "response",
];

/** How a countermeasure hooks its stage. */
export type CountermeasureKind =
  | "signature"
  | "behavior"
  | "heuristic"
  | "detonation"
  | "quarantine"
  | "network-cut"
  | "credential-reset"
  | "policy";

export const COUNTERMEASURE_KINDS: readonly CountermeasureKind[] = [
  "signature",
  "behavior",
  "heuristic",
  "detonation",
  "quarantine",
  "network-cut",
  "credential-reset",
  "policy",
];

/** Plain-language label for each countermeasure kind (UI + tests). */
export const COUNTERMEASURE_KIND_LABELS: Record<CountermeasureKind, string> = {
  signature: "Signature match",
  behavior: "Behavior block",
  heuristic: "Heuristic trip",
  detonation: "Sandbox detonation",
  quarantine: "Quarantine",
  "network-cut": "Network cut",
  "credential-reset": "Credential reset",
  policy: "Policy & hardening",
};

/** One place in the drawn environment (a machine, a service, outside). */
export type SandboxNode = {
  id: string;
  label: string;
  /** One plain line: what this place is. */
  detail: string;
  /** Position in the diagram's 660×320 view box. */
  x: number;
  y: number;
};

/** The antivirus hook for one stage. */
export type SandboxCountermeasure = {
  kind: CountermeasureKind;
  layer: DefenseLayer;
  title: string;
  /** What the defense does here, and why it works at THIS stage. */
  detail: string;
};

/** One step of the attack's path. */
export type SandboxStage = {
  id: string;
  /** Short stage name. */
  name: string;
  /** MITRE ATT&CK tactic + technique flavor, e.g. "Initial Access — Phishing". */
  tactic: string;
  /** Node the attack moves FROM at this stage. */
  from: string;
  /** Node the attack arrives AT (may equal `from` — the attack digs in). */
  to: string;
  /** What the attack does here. */
  action: string;
  /** What touches what — the contact that carries the attack. */
  touches: string;
  /** What the defender sees: the telemetry or log line that betrays it. */
  telemetry: string;
  countermeasure: SandboxCountermeasure;
};

export type SandboxScenario = {
  id: string;
  title: string;
  subtitle: string;
  /** The whole story in two or three plain sentences. */
  summary: string;
  nodes: readonly SandboxNode[];
  stages: readonly SandboxStage[];
};

export const SANDBOX_SCENARIOS: readonly SandboxScenario[] = [
  {
    id: "phishing-takeover",
    title: "Phishing Takeover",
    subtitle: "A fake sign-in page steals a password, then the mailbox",
    summary:
      "The most common break-in there is. A message dressed as an IT notice leads to a sign-in page that looks real and is not. The password typed there is used within minutes — the attacker signs in as the victim and quietly turns the mailbox into a listening post.",
    nodes: [
      { id: "internet", label: "Outside Sender", detail: "A look-alike domain registered days ago", x: 70, y: 70 },
      { id: "inbox", label: "Inbox", detail: "The victim's mail, where the lure lands", x: 250, y: 70 },
      { id: "workstation", label: "Workstation", detail: "The victim's computer and browser", x: 430, y: 70 },
      { id: "fake-page", label: "Fake Sign-in Page", detail: "A pixel-perfect copy of the real login", x: 590, y: 200 },
      { id: "account", label: "Company Account", detail: "The real mailbox and cloud sign-in", x: 250, y: 230 },
      { id: "attacker", label: "Attacker", detail: "Signs in as the victim, from abroad", x: 70, y: 230 },
    ],
    stages: [
      {
        id: "delivery",
        name: "The lure is delivered",
        tactic: "Initial Access — Phishing (T1566)",
        from: "internet",
        to: "inbox",
        action:
          "An email arrives dressed as a password-expiry notice from “IT Support”. The sender's domain is two letters off the real one, and the link leads to a sign-in page that copies the real one exactly.",
        touches: "The attacker's mail server delivers to the company inbox — the first and cheapest place to stop it.",
        telemetry:
          "Mail gateway log: first-seen sender domain, registered 2 days ago; SPF/DMARC alignment FAIL.",
        countermeasure: {
          kind: "policy",
          layer: "prevention",
          title: "Stop it at the gate",
          detail:
            "Enforce DMARC so mail pretending to be the company is rejected outright, filter first-seen look-alike domains, and banner every external message. Most lures should never reach a human eye.",
        },
      },
      {
        id: "click",
        name: "The click",
        tactic: "User Execution — Malicious Link (T1204.001)",
        from: "inbox",
        to: "workstation",
        action:
          "The victim clicks. The browser leaves the real company's world and opens the fake page — nothing on the screen says so.",
        touches: "The browser resolves a domain the company has never used before.",
        telemetry:
          "DNS/proxy log: workstation resolved a brand-new domain, categorized as uncategorized, seconds after the email was opened.",
        countermeasure: {
          kind: "detonation",
          layer: "prevention",
          title: "Open the link somewhere safe first",
          detail:
            "At click time the link is detonated — opened in a disposable remote browser and inspected before the real browser is allowed near it. A page that asks for a password on a two-day-old domain is blocked on sight.",
        },
      },
      {
        id: "harvest",
        name: "The password is harvested",
        tactic: "Credential Access — Web Portal Capture (T1056.003)",
        from: "workstation",
        to: "fake-page",
        action:
          "The victim types their real password into the fake form. The form sends it straight to the attacker, then helpfully redirects to the real site so nothing looks wrong.",
        touches: "A form POST from the victim's browser to the fake page's server.",
        telemetry:
          "Proxy log: a form submission (POST) to the never-before-seen domain. On the workstation itself — silence. The theft happened off the machine.",
        countermeasure: {
          kind: "heuristic",
          layer: "prevention",
          title: "Let the password manager check the address",
          detail:
            "A password manager only offers the saved password on the exact domain it was saved from. On the fake page it stays silent — that empty autofill is the loudest warning there is. Teach it: no autofill, no typing.",
        },
      },
      {
        id: "valid-signin",
        name: "The attacker signs in as the victim",
        tactic: "Initial Access — Valid Accounts (T1078)",
        from: "attacker",
        to: "account",
        action:
          "Minutes later, from another country, the attacker signs in with the stolen password. To the sign-in page it looks completely legitimate — it is the right password.",
        touches: "The identity provider accepts a valid credential from an impossible place.",
        telemetry:
          "Identity log: IMPOSSIBLE TRAVEL — the same account signed in from two countries eleven minutes apart.",
        countermeasure: {
          kind: "behavior",
          layer: "detection",
          title: "Watch for impossible travel",
          detail:
            "The identity system compares every sign-in with the last one. Two sign-ins an ocean apart, minutes apart, cannot both be the human — the second is challenged or blocked and the operator is alerted. A second factor (MFA) makes the stolen password alone worthless here.",
        },
      },
      {
        id: "forwarding-rule",
        name: "The hidden forwarding rule",
        tactic: "Collection — Email Forwarding Rule (T1114.003)",
        from: "account",
        to: "account",
        action:
          "Inside the mailbox, the attacker creates a rule the victim never sees: every message mentioning invoices or payments is silently forwarded out. Then they sign out. The listening post stays.",
        touches: "A mailbox rule — created inside the account, invisible in the normal inbox view.",
        telemetry:
          "Audit log: new inbox rule created at 03:12 from the foreign session, forwarding to an external address.",
        countermeasure: {
          kind: "behavior",
          layer: "detection",
          title: "Audit the mailbox rules",
          detail:
            "Rule creation is rare and loud in the audit log. Alert on any new forwarding rule, and block forwarding to outside addresses by default — a rule like this should be impossible to hide.",
        },
      },
      {
        id: "takeover-used",
        name: "The takeover is used",
        tactic: "Collection & Impairment — the account speaks as the victim",
        from: "account",
        to: "attacker",
        action:
          "Days later the access pays out: payment-diversion emails go to finance from the victim's real account (“our bank details have changed”), and forwarded mail keeps flowing to the attacker.",
        touches: "The company's own account, trusted by everyone, now works for the attacker.",
        telemetry:
          "Finance reports a bank-detail change from a genuine internal account — the first human-visible sign, long after the technical ones.",
        countermeasure: {
          kind: "credential-reset",
          layer: "response",
          title: "Reset, revoke, and sweep",
          detail:
            "Reset the password, revoke every signed-in session (the password alone does not evict the attacker), delete the forwarding rules, and review what the account touched. Then trace back: the gateway, DNS, and identity logs already told this whole story — they are where the next one gets caught early.",
        },
      },
    ],
  },
  {
    id: "ransomware",
    title: "Ransomware",
    subtitle: "One opened attachment encrypts the whole office",
    summary:
      "A booby-trapped invoice is opened, a small dropper runs, and the ransomware it fetches does the damage in a strict order: dig in, delete the safety copies, then encrypt — first the machine, then every shared folder it can reach. Speed is the whole defense: each stage is a chance to cut it off.",
    nodes: [
      { id: "outside", label: "Outside", detail: "The sender and the attacker's server", x: 70, y: 70 },
      { id: "workstation", label: "Workstation", detail: "Where the attachment is opened", x: 250, y: 70 },
      { id: "file-server", label: "File Server", detail: "Every shared folder the office lives on", x: 450, y: 70 },
      { id: "backups", label: "Backup Store", detail: "The copies everything can be rebuilt from", x: 450, y: 230 },
      { id: "network", label: "Other Machines", detail: "The rest of the office network", x: 180, y: 230 },
    ],
    stages: [
      {
        id: "entry",
        name: "The trapped attachment arrives",
        tactic: "Initial Access — Phishing Attachment (T1566.001)",
        from: "outside",
        to: "workstation",
        action:
          "An “invoice” arrives as a document with a hidden dropper inside. It is a known criminal tool, repacked often — but its core matches files the antivirus industry has catalogued.",
        touches: "The mail server hands the attachment to the workstation's mail client.",
        telemetry:
          "Mail scan log: attachment hash queried against the signature database the moment it arrived.",
        countermeasure: {
          kind: "signature",
          layer: "prevention",
          title: "Match it against the catalogue",
          detail:
            "Signature scanning hashes the file and compares it against a catalogue of known-bad files. A match is deleted before anyone can open it. This is the oldest antivirus layer — it only knows yesterday's criminals, which is why it is never the only layer.",
        },
      },
      {
        id: "execution",
        name: "The dropper runs",
        tactic: "Execution — Malicious File (T1204.002)",
        from: "workstation",
        to: "workstation",
        action:
          "The document is opened and “Enable Content” is clicked. The document spawns a script interpreter, which unpacks the real ransomware in memory and fetches the rest from outside.",
        touches: "A word processor launching a script host — a parent-child relationship that should never exist.",
        telemetry:
          "Endpoint log: WINWORD.EXE spawned powershell.exe — a document just started a command shell.",
        countermeasure: {
          kind: "behavior",
          layer: "prevention",
          title: "Block the impossible behavior",
          detail:
            "Behavior rules do not care what the file is called: a document may never launch a script interpreter, full stop. The endpoint agent kills the child process and the attack ends here — this single rule stops most document droppers ever written.",
        },
      },
      {
        id: "kill-copies",
        name: "The safety copies are deleted",
        tactic: "Defense Evasion — Inhibit System Recovery (T1490)",
        from: "workstation",
        to: "backups",
        action:
          "Before encrypting anything, the ransomware deletes the workstation's shadow copies — the built-in undo. It does this first, on purpose: no quiet recovery later.",
        touches: "A system utility (vssadmin) is driven by the intruder's process to erase restore points.",
        telemetry:
          "Process log: vssadmin Delete Shadows ran under a user process at 14:03 — an event that almost never happens in normal work.",
        countermeasure: {
          kind: "behavior",
          layer: "detection",
          title: "Guard the copies",
          detail:
            "Alert the instant shadow copies are deleted — it is one of the most reliable ransomware alarms in existence. And keep the real backups offline or immutable, where no process on the network can reach them to delete them.",
        },
      },
      {
        id: "encryption-spread",
        name: "Encryption reaches the shared folders",
        tactic: "Impact — Data Encrypted for Impact (T1486)",
        from: "workstation",
        to: "file-server",
        action:
          "The ransomware walks every drive the workstation can see — including the mapped shared folders — encrypting files and dropping a ransom note in each folder. Thousands of files change in minutes.",
        touches: "The workstation's own network access writes encrypted files onto the file server.",
        telemetry:
          "File server log: 4,000 renames and writes in one minute from a single workstation — a rate no human produces.",
        countermeasure: {
          kind: "heuristic",
          layer: "detection",
          title: "Trip on the canary file",
          detail:
            "Decoy files (canaries) sit in every share, alphabetically first. Nothing legitimate ever touches them — the moment one is renamed or encrypted, the alarm fires. A rename-rate heuristic backs it up: no human renames 4,000 files a minute.",
        },
      },
      {
        id: "lateral",
        name: "It reaches for the other machines",
        tactic: "Lateral Movement — Remote Services (T1021)",
        from: "workstation",
        to: "network",
        action:
          "Using credentials it finds on the first machine, the ransomware tries the same trick everywhere: admin shares, remote services, every reachable computer.",
        touches: "One workstation suddenly opens administrative connections to every machine on the network.",
        telemetry:
          "Network log: a single host fanning out to admin shares on 30 machines in under a minute.",
        countermeasure: {
          kind: "network-cut",
          layer: "response",
          title: "Cut the wire — in software",
          detail:
            "The moment the canary trips, the endpoint agent isolates that workstation from the network (the switch port or the machine's own firewall does it automatically). The ransomware keeps its one machine and loses the office. Seconds decide whether this is an incident or a disaster.",
        },
      },
      {
        id: "ransom-note",
        name: "The ransom note",
        tactic: "Impact — the demand arrives",
        from: "file-server",
        to: "outside",
        action:
          "Encrypted shares display the note: pay in cryptocurrency, or the files — and copies sent to the attacker — are gone for good. The beacon home confirms the haul.",
        touches: "An outbound connection from the file server to the attacker's address, carrying the confirmation.",
        telemetry:
          "Egress log: the file server, which should never browse the internet, opened a connection to a known-bad address.",
        countermeasure: {
          kind: "quarantine",
          layer: "response",
          title: "Quarantine and rebuild clean",
          detail:
            "Quarantine the encrypted shares so nothing else touches them, keep one infected machine untouched for the investigators, and rebuild from the clean, offline backups. Payment is not a recovery plan — the backups are. Every earlier stage in this trace was a cheaper ending.",
        },
      },
    ],
  },
  {
    id: "worm",
    title: "Worm Propagation",
    subtitle: "One unpatched laptop infects the building by itself",
    summary:
      "A worm needs no clicks after the first infection. It finds one machine with an unpatched network service, copies itself to the next, and the next — each new victim becomes a new attacker. The pattern to learn is the fan-out: one machine suddenly talking to everybody.",
    nodes: [
      { id: "outside", label: "Outside Network", detail: "A café or hotel network, where it starts", x: 70, y: 70 },
      { id: "machine-a", label: "Machine A", detail: "Patient zero — the traveling laptop", x: 240, y: 70 },
      { id: "machine-b", label: "Machine B", detail: "The next unpatched machine", x: 420, y: 70 },
      { id: "machine-c", label: "Machine C", detail: "And the next — each one joins the spread", x: 580, y: 160 },
      { id: "server", label: "File Server", detail: "Unpatched services make it a target too", x: 240, y: 230 },
    ],
    stages: [
      {
        id: "patient-zero",
        name: "Patient zero",
        tactic: "Initial Access — Exploitation of Remote Services (T1210)",
        from: "outside",
        to: "machine-a",
        action:
          "On a public network, the worm finds the laptop's old, unpatched file-sharing service and walks straight in through the known hole. No email, no click — the service itself is the door.",
        touches: "An inbound network connection to a service port that should never have been exposed.",
        telemetry:
          "Firewall log: an inbound connection to the file-sharing port from the public network — the laptop accepted a stranger's knock.",
        countermeasure: {
          kind: "policy",
          layer: "prevention",
          title: "Patch the hole, close the port",
          detail:
            "The hole this worm uses was patched by the vendor long ago — unpatched is the whole vulnerability. Automatic updates, and a host firewall that denies inbound connections by default, close this door completely.",
        },
      },
      {
        id: "self-copy",
        name: "It copies itself onward",
        tactic: "Lateral Movement — SMB / Admin Shares (T1021.002)",
        from: "machine-a",
        to: "machine-b",
        action:
          "Back on the office network, the worm writes a copy of itself into Machine B's administrative share. The file that lands is the same worm — byte for byte.",
        touches: "A network write of an executable file from one workstation into another's admin share.",
        telemetry:
          "Network monitor: Machine A wrote an .exe into Machine B's ADMIN$ share — workstations do not install software on each other.",
        countermeasure: {
          kind: "signature",
          layer: "prevention",
          title: "Scan on write, kill on match",
          detail:
            "Machine B's antivirus scans every file the moment it is written. The worm's bytes match the catalogue, and the copy is quarantined before it can ever run. The chain breaks at link two.",
        },
      },
      {
        id: "execution-b",
        name: "It starts itself on Machine B",
        tactic: "Persistence — Scheduled Task / Service (T1053 / T1569)",
        from: "machine-b",
        to: "machine-b",
        action:
          "Where the copy survives, the worm registers a service and a scheduled task so it starts with the machine and restarts if killed. Machine B is now a spreader too.",
        touches: "A new system service created from a file that lives in a network share.",
        telemetry:
          "System log: new service installed at 02:47, binary path pointing into a shared folder.",
        countermeasure: {
          kind: "behavior",
          layer: "detection",
          title: "Alert on impossible installations",
          detail:
            "Legitimate software is installed by the operator, from local media, in working hours. A service born from a network path at 2 a.m. is announced and blocked — behavior, not bytes, gives it away.",
        },
      },
      {
        id: "scanning",
        name: "It scans for the next hundred",
        tactic: "Discovery — Network Service Discovery (T1046)",
        from: "machine-b",
        to: "server",
        action:
          "Machine B sweeps the whole subnet, knocking on the file-sharing port of every address, hunting the same unpatched hole — the server included.",
        touches: "One host touching the same port on hundreds of addresses in a minute.",
        telemetry:
          "IDS log: port-scan fan-out — one internal host probed 212 addresses on port 445 in 60 seconds.",
        countermeasure: {
          kind: "heuristic",
          layer: "detection",
          title: "See the fan-out",
          detail:
            "No honest program scans its own network like this. A scan-rate heuristic at the network sensor flags the shape of the traffic — one-to-hundreds — and raises the alarm while the worm is still knocking, before it finds the next hole.",
        },
      },
      {
        id: "saturation",
        name: "Saturation",
        tactic: "Impact — the network drowns in copies of the worm",
        from: "machine-b",
        to: "machine-c",
        action:
          "Every unpatched machine falls in turn — C, then the next, then the next. Scanning and copying traffic floods the network, machines slow to a crawl, and the worm is now coming from everywhere at once.",
        touches: "Dozens of infected hosts all scanning and copying at full speed, all at once.",
        telemetry:
          "Network log: the subnet's traffic is 90% port-445 scanning. The infection is no longer a machine — it is a segment.",
        countermeasure: {
          kind: "network-cut",
          layer: "response",
          title: "Compartment the ship",
          detail:
            "A network built in segments (one per floor or department, with walls between) lets the operator cut the infected segment off at the switch while the rest of the building keeps working. Flat networks sink whole; compartmented ones flood one room at a time.",
        },
      },
      {
        id: "cleanup",
        name: "The clean-up",
        tactic: "Response — eradication and recovery",
        from: "server",
        to: "server",
        action:
          "With the segment isolated, the work is mechanical: find patient zero in the logs, patch every machine, reimage the infected ones from clean images, and only then reconnect the segment.",
        touches: "The logs — firewall, network, system — read in order, tell the whole path of the worm.",
        telemetry:
          "The same logs that betrayed each stage now prove the clean-up: no fan-out, no new services, no admin-share writes for a full watch period.",
        countermeasure: {
          kind: "quarantine",
          layer: "response",
          title: "Reimage and patch the fleet",
          detail:
            "A wormed machine is never trusted clean by scrubbing — it is reimaged from a known-good image and patched before it rejoins. Quarantine first, questions answered from the logs, reconnect last.",
        },
      },
    ],
  },
  {
    id: "usb-drop",
    title: "USB Drop",
    subtitle: "A found flash drive becomes a spy inside the building",
    summary:
      "The oldest trick in the building: a flash drive labeled “Payroll Q3” left where staff will find it. Curiosity carries it past every locked door. What runs from it does not smash anything — it settles in, phones home on a metronome, and reads what the user can read.",
    nodes: [
      { id: "lot", label: "Parking Lot", detail: "Where the drive is found", x: 70, y: 70 },
      { id: "workstation", label: "Workstation", detail: "Where curiosity plugs it in", x: 260, y: 70 },
      { id: "server", label: "File Server", detail: "Everything the user's account can open", x: 480, y: 70 },
      { id: "attacker", label: "Attacker", detail: "Listening for the metronome beacon", x: 480, y: 230 },
      { id: "network", label: "Internal Network", detail: "The wire the beacon travels out on", x: 180, y: 230 },
    ],
    stages: [
      {
        id: "the-drop",
        name: "The drop",
        tactic: "Initial Access — Replication Through Removable Media (T1091)",
        from: "lot",
        to: "workstation",
        action:
          "A flash drive with a handwritten label — “Payroll Q3” — is left by the staff entrance. Someone picks it up, carries it inside, and plugs it in to see whose it is. The building's locks never come into it.",
        touches: "A human hand carries the attack past the perimeter — the only stage with no log at all.",
        telemetry:
          "Nothing on any computer. The only record is the camera over the staff entrance — which is why this stage belongs to policy, not software.",
        countermeasure: {
          kind: "policy",
          layer: "prevention",
          title: "Found media is never plugged in",
          detail:
            "One rule, taught to everyone: a found drive goes to IT, never into a computer. Device-control policy backs the rule up — unknown USB storage is refused by the machines themselves, so even curiosity cannot get past it.",
        },
      },
      {
        id: "the-lure",
        name: "The lure file runs",
        tactic: "User Execution — Malicious File (T1204.002)",
        from: "workstation",
        to: "workstation",
        action:
          "The drive holds one tempting file, “Payroll Q3”, dressed as a spreadsheet. Opening it runs a hidden script instead — the implant installs itself in a temporary folder.",
        touches: "A document on removable media spawning a script host on the workstation.",
        telemetry:
          "Endpoint log: a file from a removable drive launched a script interpreter seconds after the drive was inserted.",
        countermeasure: {
          kind: "detonation",
          layer: "prevention",
          title: "Open it in the sandbox first",
          detail:
            "Files from removable media are detonated before they are trusted: opened inside an isolated throwaway machine (described here, never on the real one) and watched. A “spreadsheet” that installs software and reaches for the network is condemned by its own behavior.",
        },
      },
      {
        id: "persistence",
        name: "It makes itself at home",
        tactic: "Persistence — Registry Run Key / Scheduled Task (T1547.001 / T1053.005)",
        from: "workstation",
        to: "workstation",
        action:
          "The implant writes a run key and a scheduled task so it restarts with every reboot and every sign-in. Unplugging the drive changes nothing now — the spy lives on the machine.",
        touches: "The registry's autostart locations and the task scheduler — the doorways every program uses to come back.",
        telemetry:
          "Autoruns diff: a new run key appeared, pointing at an executable in a temporary folder.",
        countermeasure: {
          kind: "behavior",
          layer: "detection",
          title: "Watch the doorways that reopen",
          detail:
            "The list of things allowed to auto-start is short and known. Any new entry — above all one pointing into a temp folder — is flagged the moment it is written. Persistence is where quiet malware must eventually show its hand.",
        },
      },
      {
        id: "beaconing",
        name: "The metronome beacon",
        tactic: "Command & Control — Web Protocols (T1071.001)",
        from: "workstation",
        to: "attacker",
        action:
          "Every sixty seconds the implant checks in over ordinary web traffic: a tiny request to a brand-new domain, asking for instructions. Between beacons it sleeps, doing nothing a casual look would catch.",
        touches: "Regular outbound web requests from the workstation, through the network, to the attacker's server.",
        telemetry:
          "Proxy log: one host requesting the same new domain every 60.0 seconds, all night — a metronome no human browsing produces.",
        countermeasure: {
          kind: "heuristic",
          layer: "detection",
          title: "Hear the metronome",
          detail:
            "Human traffic is irregular; beacons are clockwork. The egress filter's periodicity heuristic measures the rhythm of each host's requests — a perfect 60-second pulse to a domain registered last week lights up on the board.",
        },
      },
      {
        id: "collection",
        name: "It reads with the user's own hands",
        tactic: "Collection — Data from Network Shared Drive (T1039)",
        from: "workstation",
        to: "server",
        action:
          "Tasked by its beacon, the implant browses the file server using the signed-in user's own permissions — opening folders the user has never opened, reading a little at a time to stay quiet.",
        touches: "The user's own account, reading the server — every request individually “allowed”.",
        telemetry:
          "File server audit: the account read 40 folders it had never touched, at 2 a.m., in alphabetical order.",
        countermeasure: {
          kind: "policy",
          layer: "prevention",
          title: "Give accounts only what the job needs",
          detail:
            "Least privilege is the quiet hero: if the account could only open its own department's folders, the implant's reading list shrinks to what the user legitimately touches — and the strange 2 a.m. pattern stands out even sooner.",
        },
      },
      {
        id: "exfiltration",
        name: "The quiet upload — and the catch",
        tactic: "Exfiltration — Over the C2 Channel (T1041)",
        from: "server",
        to: "attacker",
        action:
          "What it read is bundled and sent out through the same beacon channel, a little per check-in. Unstopped, the server's contents walk out the front door in web traffic.",
        touches: "Outbound web traffic from the workstation — now carrying far more up than a check-in ever should.",
        telemetry:
          "Proxy log: the metronome host's uploads grew from bytes to megabytes. Volume, not just rhythm, breaks the pattern.",
        countermeasure: {
          kind: "quarantine",
          layer: "response",
          title: "Isolate, reset, sweep",
          detail:
            "Isolate the workstation from the network, reset the user's credentials (the implant acted as them), and sweep every machine for the same implant and the same beacon domain. The found drive, the autoruns diff, and the proxy log together reconstruct the whole visit.",
        },
      },
    ],
  },
];

/** Look up a scenario by id; unknown ids fall back to the first scenario. */
export function getScenario(id: string): SandboxScenario {
  return SANDBOX_SCENARIOS.find((s) => s.id === id) ?? SANDBOX_SCENARIOS[0]!;
}

/** Node lookup inside a scenario (undefined when the id is not a node). */
export function getNode(scenario: SandboxScenario, nodeId: string): SandboxNode | undefined {
  return scenario.nodes.find((n) => n.id === nodeId);
}

/**
 * SIMULATION STATE — the stepper. `step` counts how many stages have
 * happened: 0 = nothing yet (the environment at rest), k = stages
 * 0..k-1 have occurred and stage k-1 is the current one, and
 * stages.length = the trace is complete.
 */
export type SimState = {
  scenarioId: string;
  step: number;
  playing: boolean;
};

export function createSimState(scenarioId: string = SANDBOX_SCENARIOS[0]!.id): SimState {
  return { scenarioId, step: 0, playing: false };
}

/** Switching scenarios always restarts the trace. */
export function selectScenario(_state: SimState, scenarioId: string): SimState {
  return createSimState(scenarioId);
}

export function stepForward(state: SimState): SimState {
  const scenario = getScenario(state.scenarioId);
  const step = Math.min(state.step + 1, scenario.stages.length);
  return { ...state, step, playing: state.playing && step < scenario.stages.length };
}

export function stepBack(state: SimState): SimState {
  return { ...state, step: Math.max(state.step - 1, 0), playing: false };
}

export function resetSim(state: SimState): SimState {
  return { ...state, step: 0, playing: false };
}

export function setPlaying(state: SimState, playing: boolean): SimState {
  const scenario = getScenario(state.scenarioId);
  // Nothing to play once the trace is complete.
  return { ...state, playing: playing && state.step < scenario.stages.length };
}

/** The stage the simulation currently sits on, or null before stage 1. */
export function currentStage(state: SimState): SandboxStage | null {
  if (state.step <= 0) return null;
  const scenario = getScenario(state.scenarioId);
  return scenario.stages[state.step - 1] ?? null;
}

export function isComplete(state: SimState): boolean {
  const scenario = getScenario(state.scenarioId);
  return state.step >= scenario.stages.length;
}

/** Node ids the attack has reached after `state.step` stages. */
export function visitedNodeIds(state: SimState): string[] {
  const scenario = getScenario(state.scenarioId);
  const seen: string[] = [];
  for (let i = 0; i < state.step && i < scenario.stages.length; i++) {
    const stage = scenario.stages[i]!;
    if (!seen.includes(stage.from)) seen.push(stage.from);
    if (!seen.includes(stage.to)) seen.push(stage.to);
  }
  return seen;
}

/** The node the attack is on right now (the current stage's target). */
export function currentNodeId(state: SimState): string | null {
  return currentStage(state)?.to ?? null;
}

/**
 * THE ANTIVIRUS BLUEPRINT — derived from the trace: every stage's
 * countermeasure, grouped by defense layer in order. This is the
 * deliverable of the bench: step an attack to the end and the layered
 * defense it implies is listed stage by stage.
 */
export type BlueprintEntry = {
  stageIndex: number;
  stageName: string;
  layer: DefenseLayer;
  kind: CountermeasureKind;
  title: string;
};

export type AntivirusBlueprint = {
  scenarioId: string;
  /** Every stage's hook, in trace order. */
  entries: BlueprintEntry[];
  /** The same entries grouped by layer (all three keys always present). */
  byLayer: Record<DefenseLayer, BlueprintEntry[]>;
};

export function deriveBlueprint(scenario: SandboxScenario): AntivirusBlueprint {
  const entries: BlueprintEntry[] = scenario.stages.map((stage, i) => ({
    stageIndex: i,
    stageName: stage.name,
    layer: stage.countermeasure.layer,
    kind: stage.countermeasure.kind,
    title: stage.countermeasure.title,
  }));
  const byLayer: Record<DefenseLayer, BlueprintEntry[]> = {
    prevention: [],
    detection: [],
    response: [],
  };
  for (const entry of entries) byLayer[entry.layer].push(entry);
  return { scenarioId: scenario.id, entries, byLayer };
}
