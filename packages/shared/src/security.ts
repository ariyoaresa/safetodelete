/**
 * Common patterns of credentials, tokens, and secrets to scrub from output and logs.
 */
const TOKEN_PATTERNS: RegExp[] = [
  /bearer\s+[a-zA-Z0-9_\-\.=:_+/]{15,}/gi,
  /ghp_[a-zA-Z0-9]{36}/g,
  /gho_[a-zA-Z0-9]{36}/g,
  /github_pat_[a-zA-Z0-9_]{40,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g,
  /npm_[a-zA-Z0-9]{36}/g,
];

const KEY_VALUE_QUOTED =
  /((?:api[_\-]?key|access[_\-]?token|secret|password|passwd|auth[_\-]?token)\s*[:=]\s*["'])([^"'\r\n]+)(["'])/gi;

const KEY_VALUE_UNQUOTED =
  /((?:api[_\-]?key|access[_\-]?token|secret|password|passwd|auth[_\-]?token)\s*[:=]\s*)([^\s"';,]+)/gi;

/**
 * Redacts known sensitive patterns and credentials from command logs and reports.
 */
export function redactSecrets(content: string): string {
  let redacted = content;

  // 1. Redact quoted key-value pairs (e.g. password="...", api_key='...')
  redacted = redacted.replace(KEY_VALUE_QUOTED, "$1[REDACTED]$3");

  // 2. Redact unquoted key-value pairs (e.g. password=secret123)
  redacted = redacted.replace(KEY_VALUE_UNQUOTED, "$1[REDACTED]");

  // 3. Redact token patterns
  for (const pattern of TOKEN_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED_SECRET]");
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
