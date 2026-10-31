/**
 * Common patterns of credentials, tokens, and secrets to scrub from output and logs.
 */
const SECRET_PATTERNS: RegExp[] = [
  /bearer\s+[a-zA-Z0-9_\-\.=:_+/]{15,}/gi,
  /(?:api[_\-]?key|access[_\-]?token|secret|password|passwd|auth[_\-]?token)\s*[:=]\s*["']?([a-zA-Z0-9_\-\.=:_+/]{8,})["']?/gi,
  /ghp_[a-zA-Z0-9]{36}/g,
  /gho_[a-zA-Z0-9]{36}/g,
  /github_pat_[a-zA-Z0-9_]{40,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g,
  /npm_[a-zA-Z0-9]{36}/g,
];

/**
 * Redacts known sensitive patterns and credentials from command logs and reports.
 */
export function redactSecrets(content: string): string {
  let redacted = content;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, (match, ...args) => {
      // If the regex has capture groups (like api_key="value"), replace the captured value
      if (typeof args[0] === "string" && args[0].length > 0 && match.includes(args[0])) {
        return match.replace(args[0], "[REDACTED]");
      }
      return "[REDACTED_SECRET]";
    });
  }
  return redacted;
}

/**
 * Returns a strictly sanitized minimal environment for sandbox processes.
 */
export function getSanitizedEnvironment(): NodeJS.ProcessEnv {
  const allowedKeys = [
    "PATH",
    "Path",
    "NODE_ENV",
    "HOME",
    "HOMEPATH",
    "HOMEDRIVE",
    "USERPROFILE",
    "SYSTEMROOT",
    "SystemRoot",
    "COMSPEC",
    "TEMP",
    "TMP",
  ];

  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    CI: "true",
  };

  for (const key of allowedKeys) {
    if (process.env[key] !== undefined) {
      env[key] = process.env[key];
    }
  }

  return env;
}

