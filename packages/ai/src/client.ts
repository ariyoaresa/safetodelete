const REQUEST_TIMEOUT_MS = 30_000;

export interface GemmaClientConfig {
  model?: string;
  apiKey?: string;
  endpoint?: string;
  temperature?: number;
}

export interface GemmaResponse {
  content: string;
  model: string;
}

export class Gemma4Client {
  private model: string;
  private apiKey?: string;
  private endpoint?: string;
  private temperature: number;

  constructor(config?: GemmaClientConfig) {
    this.apiKey = config?.apiKey || process.env.GEMMA_API_KEY || process.env.GEMINI_API_KEY;
    this.endpoint = config?.endpoint || process.env.GEMMA_ENDPOINT;
    this.temperature = config?.temperature ?? 0.2;

    if (config?.model) {
      this.model = config.model;
    } else if (process.env.GEMMA_MODEL) {
      this.model = process.env.GEMMA_MODEL;
    } else if (this.apiKey && !this.endpoint) {
      this.model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    } else {
      this.model = "gemma-4";
    }
  }

  public getModelName(): string {
    return this.model;
  }

  /**
   * Generates text using the configured AI endpoint or Google AI API.
   * If no API key or endpoint is configured, operates in offline mode with deterministic synthesis.
   * Throws explicit errors on network/API failure when credentials are provided.
   */
  public async generateText(prompt: string, systemInstruction?: string): Promise<GemmaResponse> {
    // 1. If an explicit endpoint is provided (e.g., Ollama or custom inference server)
    if (this.endpoint) {
      try {
        const response = await fetch(this.endpoint, {
          method: "POST",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: {
            "Content-Type": "application/json",
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: this.model,
            prompt: systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt,
            temperature: this.temperature,
            stream: false,
          }),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          throw new Error(`Inference endpoint returned HTTP ${response.status}: ${errText}`);
        }

        const data = (await response.json()) as any;
        const text = data.response || data.choices?.[0]?.message?.content || data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error("Inference endpoint returned an empty or unparseable response payload.");
        }
        return { content: text.trim(), model: this.model };
      } catch (err) {
        throw new Error(`AI Inference Error: ${(err as Error).message}`);
      }
    }

    // 2. If a Google API key is provided
    if (this.apiKey) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
        const response = await fetch(url, {
          method: "POST",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
            generationConfig: { temperature: this.temperature },
          }),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          throw new Error(`Google AI API returned HTTP ${response.status}: ${errText}`);
        }

        const data = (await response.json()) as any;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error("Google AI API returned no candidate text in response.");
        }
        return { content: text.trim(), model: this.model };
      } catch (err) {
        throw new Error(`AI API Error: ${(err as Error).message}`);
      }
    }

    // 3. Grounded Deterministic Mock Engine (only for unauthenticated offline / local CI environments)
    return {
      content: this.generateGroundedMock(prompt, systemInstruction),
      model: `${this.model}-offline-engine`,
    };
  }

  private generateGroundedMock(prompt: string, system?: string): string {
    const isExplainer = prompt.includes("SIMULATION REPORT") || system?.includes("Risk Explainer");
    const isInvestigator = prompt.includes("FAILED CHECKS") || system?.includes("Failure Investigator");
    const isAdvisor = prompt.includes("CLEANUP") || system?.includes("Advisor");
    const isImpact = prompt.includes("IMPACT") || system?.includes("Impact Summarizer");

    if (isExplainer) {
      return [
        `[OFFLINE DETERMINISTIC SYNTHESIS]`,
        `### Gemma 4 — Risk Analysis & Explanation`,
        `- **Risk Assessment**: The proposed deletion was evaluated against static references and automated verification checks.`,
        `- **Key Factors**:`,
        `  * Breakage was verified in an isolated Git worktree without altering the base working branch.`,
        `  * Active dependants and test execution results determined the overall risk classification.`,
        `- **Guidance**: Review affected call sites before proceeding with manual deletion.`,
      ].join("\n");
    }

    if (isInvestigator) {
      return [
        `[OFFLINE DETERMINISTIC SYNTHESIS]`,
        `### Gemma 4 — Failure Investigation`,
        `- **Root Cause**: The simulated deletion removed symbols or modules that were directly imported by other active files.`,
        `- **Diagnosis**: Verification tests or build compilers failed because referenced files were missing at runtime/compile-time.`,
        `- **Resolution**: Refactor the calling modules to decouple their imports before deleting this target.`,
      ].join("\n");
    }

    if (isAdvisor) {
      return [
        `[OFFLINE DETERMINISTIC SYNTHESIS]`,
        `### Gemma 4 — Cleanup Advice & Safe Refactoring`,
        `1. **Break down the deletion**: Instead of removing the entire module at once, deprecate exports first.`,
        `2. **Decouple consumers**: Redirect callers to alternative implementations.`,
        `3. **Re-simulate**: Run \`safetodelete simulate\` after updating direct dependants.`,
      ].join("\n");
    }

    if (isImpact) {
      return [
        `[OFFLINE DETERMINISTIC SYNTHESIS]`,
        `### Gemma 4 — Impact Summary`,
        `- **Blast Radius**: Changes affect direct importers and downstream transitive dependants.`,
        `- **Verification Coverage**: Automated checks were executed in an isolated detached worktree.`,
        `- **Recommendation**: Ensure integration tests cover downstream consumer modules before merging.`,
      ].join("\n");
    }

    return `[OFFLINE DETERMINISTIC SYNTHESIS] Gemma 4 evaluated the codebase dependency graph: The requested elements have been mapped and analyzed against repository references.`;
  }
}
