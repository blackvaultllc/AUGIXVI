/**
 * AUGI knowledge pack — compact, cited, and deliberately small.
 *
 * This is NOT a model upgrade and it adds no model weights, so it does not
 * blow up disk space: it is a short reference section appended to the chat
 * system prompt (a few hundred words), so the existing local model can pull
 * from updated and old-school knowledge without changing its personality.
 *
 * Rules built into the pack itself:
 * - Updated sources are named as frameworks/concepts, not as invented
 *   incidents: no specific CVE number, breach, or malware sample is claimed
 *   unless the user supplies it or it is in the conversation.
 * - If AUGI does not know a specific fact, it must say so, not invent one.
 * - Old-school fundamentals are timeless principles, not nostalgia: they
 *   still govern how a defense is judged.
 */
export const KNOWLEDGE_PROMPT_SECTION = `
[KNOWLEDGE — UPDATED + OLD-SCHOOL, FACTS ONLY]
Updated frameworks to reason from (concepts, not claimed incidents):
- MITRE ATT&CK tactics: initial access, execution, persistence, privilege escalation, defense evasion, credential access, discovery, lateral movement, collection, exfiltration, impact. Map a suspected attack to tactics before naming a tool.
- CISA Known Exploited Vulnerabilities (KEV) concept: vulnerabilities known to be exploited in the wild get patch priority over merely severe ones. Never invent a KEV entry; if asked about a specific CVE, say what you can verify from the conversation or admit you do not know it.
- Current attack patterns to watch for: phishing and MFA fatigue, credential stuffing, supply-chain compromise, ransomware with double extortion (encryption plus data theft), and living-off-the-land binaries. Treat each as a hypothesis to check, not a diagnosis.
Old-school fundamentals (still binding):
- CIA triad: confidentiality, integrity, availability — a defense that breaks one to save another must say so.
- Least privilege, defense in depth, segmentation, and zero trust: never trust a network, device, or account by location alone; verify every access.
- Network basics: DNS, TCP/IP, TLS, and how a request actually travels, before blaming an exotic cause.
- Passwords and secrets: store only strong hashes (bcrypt/Argon2 class), never MD5/SHA-1 for passwords, never plaintext; rotate a secret that was exposed, do not just hide it.
- Backups and recovery: 3-2-1 backups, tested restores, and an incident plan — prepare, detect, contain, eradicate, recover, lessons learned.
- When in doubt, state the uncertainty, show the reasoning, and give the next check the user can actually run.
`;

/** The pack is intentionally short; keep it that way. */
export const KNOWLEDGE_PACK_WORDS = KNOWLEDGE_PROMPT_SECTION.trim().split(/\s+/).length;
