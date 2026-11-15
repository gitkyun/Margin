import { describe, expect, it } from "vitest";
import {
  AGENT_INSTRUCTIONS_MAX,
  agentPreferencePatch,
  readAgentProfile,
  sameAgentProfile,
} from "./research-agent";

describe("research agent preferences", () => {
  it("falls back to defaults for missing or unknown values", () => {
    expect(readAgentProfile(undefined)).toEqual({
      name: "",
      instructions: "",
      tone: "default",
    });
    // 예전에 저장된 봇 모양 값(agentBotType)은 읽지 않아요.
    const unknown = readAgentProfile({
      agentTone: "shout",
      agentBotType: "clover",
    });
    expect(unknown.tone).toBe("default");
    expect(unknown).not.toHaveProperty("botType");
  });

  it("removes control characters and limits lengths", () => {
    const profile = readAgentProfile({
      agentName: " 콩\u0000이  봇 ",
      agentInstructions: `${"가".repeat(1200)}`,
      agentTone: "friendly",
    });
    expect(profile.name).toBe("콩이 봇");
    expect(profile.instructions).toHaveLength(AGENT_INSTRUCTIONS_MAX);
    expect(profile.tone).toBe("friendly");
  });

  it("saves every key so cleared values replace old ones", () => {
    const patch = agentPreferencePatch({
      name: "",
      instructions: " 짧게 ",
      tone: "concise",
    });
    expect(patch).toEqual({
      agentName: "",
      agentInstructions: "짧게",
      agentTone: "concise",
    });
    expect(
      sameAgentProfile(readAgentProfile(patch), readAgentProfile(patch)),
    ).toBe(true);
  });
});
