import { spawn } from "node:child_process";
import type { CheckResult, CheckStatus } from "@safetodelete/report-schema";
import { getSanitizedEnvironment, redactSecrets } from "@safetodelete/shared";

export interface RunCommandOptions {
  label: string;
  command: string;
  cwd: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  extraEnv?: Record<string, string>;
  allowHostExecution?: boolean;
}

export class SandboxRunner {
  private defaultTimeoutMs: number;
  private defaultMaxOutputBytes: number;
  private allowHostExecution: boolean;

  constructor(options?: {
    defaultTimeoutMs?: number;
    defaultMaxOutputBytes?: number;
    allowHostExecution?: boolean;
  }) {
    this.defaultTimeoutMs = options?.defaultTimeoutMs ?? 60_000;
    this.defaultMaxOutputBytes = options?.defaultMaxOutputBytes ?? 1_000_000; // 1 MB
    this.allowHostExecution = options?.allowHostExecution ?? true;
  }

  public async executeCheck(options: RunCommandOptions): Promise<CheckResult> {
    const isAllowed = options.allowHostExecution ?? this.allowHostExecution;
    if (!isAllowed) {
      return {
        label: options.label,
        command: options.command,
        status: "ERROR",
        durationMs: 0,
        logSummary:
          "Security Policy Violation: Host-level execution of unverified commands requires explicit authorization (--allow-host-exec). Command blocked to prevent untrusted code execution on host.",
      };
    }

    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const maxBytes = options.maxOutputBytes ?? this.defaultMaxOutputBytes;
    const startTime = Date.now();

    const env = {
      ...getSanitizedEnvironment(),
      CI: "true",
      CONTINUOUS_INTEGRATION: "true",
      NON_INTERACTIVE: "true",
      VITEST_MODE: "run",
      JEST_WATCH: "0",
      ...(options.extraEnv || {}),
    };

    return new Promise<CheckResult>((resolve) => {
      let isTimedOut = false;
      let outputBuffer = "";
      let outputTruncated = false;

      const isWin = process.platform === "win32";

      const child = spawn(options.command, {
        cwd: options.cwd,
        env,
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        // Own process group on POSIX so a timeout can kill grandchildren too.
        detached: !isWin,
      });

      let outputBytes = 0;
      const appendOutput = (data: Buffer | string) => {
        const chunk = typeof data === "string" ? Buffer.from(data) : data;
        const remaining = maxBytes - outputBytes;
        if (remaining <= 0) {
          outputTruncated = true;
          return;
        }
        if (chunk.length > remaining) {
          outputTruncated = true;
        }
        // Cap by bytes, not UTF-16 code units, so the limit is honest for multibyte output.
        outputBuffer += chunk.subarray(0, remaining).toString();
        outputBytes += Math.min(chunk.length, remaining);
      };

      child.stdout?.on("data", appendOutput);
      child.stderr?.on("data", appendOutput);

      const timer = setTimeout(() => {
        isTimedOut = true;
        try {
          if (isWin) {
            // Force terminate process tree on Windows
            spawn("taskkill", ["/pid", child.pid!.toString(), "/T", "/F"], {
              stdio: "ignore",
            });
          } else {
            try {
              process.kill(-child.pid!, "SIGKILL");
            } catch {
              child.kill("SIGKILL");
            }
          }
        } catch {
          // Ignore
        }
      }, timeoutMs);

      child.on("error", (err) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;
        resolve({
          label: options.label,
          command: options.command,
          status: "ERROR",
          durationMs,
          logSummary: redactSecrets(
            outputBuffer + `\nExecution Error: ${err.message}`
          ),
        });
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;

        let status: CheckStatus = "PASSED";
        if (isTimedOut) {
          status = "TIMED_OUT";
        } else if (code !== 0) {
          status = "FAILED";
        }

        let summary = redactSecrets(outputBuffer.trim());
        if (outputTruncated) {
          summary += `\n[NOTE: Output was truncated exceeding ${maxBytes} bytes limit]`;
        }
        if (isTimedOut) {
          summary += `\n[NOTE: Process timed out exceeding limit of ${timeoutMs}ms]`;
        }

        resolve({
          label: options.label,
          command: options.command,
          status,
          exitCode: code ?? undefined,
          durationMs,
          logSummary: summary,
        });
      });
    });
  }
}
