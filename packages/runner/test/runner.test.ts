import { describe, it, expect } from "vitest";
import { SandboxRunner } from "../src/runner.js";

describe("SandboxRunner", () => {
  it("executes a passing command and captures output", async () => {
    const runner = new SandboxRunner();
    const result = await runner.executeCheck({
      label: "echo test",
      command: `node -e "console.log(\\"runner is working\\")"`,
      cwd: process.cwd(),
    });

    expect(result.status).toBe("PASSED");
    expect(result.exitCode).toBe(0);
    expect(result.logSummary).toContain("runner is working");
  });

  it("captures failure exit code and output", async () => {
    const runner = new SandboxRunner();
    const result = await runner.executeCheck({
      label: "failing command",
      command: `node -e "console.error(\\"fatal error\\"); process.exit(42)"`,
      cwd: process.cwd(),
    });

    expect(result.status).toBe("FAILED");
    expect(result.exitCode).toBe(42);
    expect(result.logSummary).toContain("fatal error");
  });

  it("terminates hung processes on timeout", async () => {
    const runner = new SandboxRunner({ defaultTimeoutMs: 1500 });
    const result = await runner.executeCheck({
      label: "hang command",
      command: `node -e "setInterval(() => {}, 1000)"`,
      cwd: process.cwd(),
      timeoutMs: 1000,
    });

    expect(result.status).toBe("TIMED_OUT");
    expect(result.logSummary).toContain("timed out");
  });

  it("redacts secrets emitted in process output", async () => {
    const runner = new SandboxRunner();
    const result = await runner.executeCheck({
      label: "secret output",
      command: `node -e "console.log(\\"token: ghp_123456789012345678901234567890123456\\")"`,
      cwd: process.cwd(),
    });

    expect(result.status).toBe("PASSED");
    expect(result.logSummary).not.toContain("ghp_123456789012345678901234567890123456");
    expect(result.logSummary).toContain("[REDACTED");
  });
});

