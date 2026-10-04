import { readFile, writeFile } from "node:fs/promises";
import { eleven } from "../src/lib/elevenlabs";
import { STYLES } from "../src/lib/voice";
async function saveEnv(name: string, value: string) {
  let env = await readFile(".env.local", "utf8");
  const re = new RegExp(`^${name}=.*$`, "m");
  env = re.test(env)
    ? env.replace(re, `${name}=${value}`)
    : env.trimEnd() + `\n${name}=${value}\n`;
  await writeFile(".env.local", env);
  process.env[name] = value;
}
const string = (description: string) => ({ type: "string", description });
const tools = [
  {
    name: "show_moment",
    description: "Show the captured frame for a supplied moment ID",
    properties: {
      id: string("The exact momentId from the open question or draft step"),
    },
  },
  {
    name: "record_answer",
    description: "Persist an open-question answer with an exact expert quote",
    properties: {
      question_id: string("Exact open-question ID"),
      answer_summary: string("Concise answer summary"),
      expert_quote: string(
        "Verbatim substring of the expert's actual latest utterance",
      ),
    },
  },
  {
    name: "start_teachback",
    description:
      "Start teach-back only after all open questions have saved answers",
    properties: {},
  },
  {
    name: "record_correction",
    description: "Save a correction the expert made during teach-back",
    properties: {
      what_i_said: string("The apprentice claim being corrected"),
      correction: string("Corrected interpretation"),
      expert_quote: string("Verbatim expert correction"),
    },
  },
  {
    name: "confirm_teachback",
    description:
      "Record a fresh explicit affirmative confirmation after teach-back and corrections",
    properties: {
      expert_quote: string("Verbatim latest expert affirmative response"),
    },
  },
];
const tutorTools = [
  {
    name: "show_expert_moment",
    description:
      "Replay the exact expert evidence for a step or guardrail from the active Work Map",
    properties: { step_id: string("Exact active-map step or guardrail ID") },
  },
  {
    name: "lookup_guardrails",
    description:
      "Search only the active Work Map for learned rules, including its limitations",
    properties: {
      query: string("Keywords describing the decision or exception"),
    },
  },
  {
    name: "record_outcome",
    description:
      "Record an outcome only when supported by the latest observed screen check. Correct means independently safe; corrected requires an earlier risk and a later safe check. Never claim unobserved mastery.",
    properties: {
      ref_id: string("Exact active-map step or guardrail ID"),
      result: {
        type: "string",
        enum: ["correct", "corrected", "missed"],
        description: "Evidence-supported outcome",
      },
      note: string("Concise observation, not invented learner behavior"),
    },
  },
];
async function setup(role: "capture" | "debrief" | "tutor") {
  const prompt = await readFile(`agents/${role}.md`, "utf8");
  const toolIds: string[] = [];
  if (role === "debrief" || role === "tutor")
    for (const tool of role === "tutor" ? tutorTools : tools) {
      const key = `ELEVENLABS_TOOL_${tool.name.toUpperCase()}_ID`;
      const config = {
        tool_config: {
          type: "client",
          name: tool.name,
          description: tool.description,
          expects_response: true,
          response_timeout_secs: 20,
          parameters: {
            type: "object",
            properties: tool.properties,
            required: Object.keys(tool.properties),
          },
        },
      };
      let id = process.env[key];
      if (id)
        await eleven(`/convai/tools/${id}`, {
          method: "PATCH",
          body: JSON.stringify(config),
        });
      else {
        id = (
          await eleven("/convai/tools", {
            method: "POST",
            body: JSON.stringify(config),
          })
        ).id;
        await saveEnv(key, id!);
      }
      toolIds.push(id!);
    }
  const placeholders = {
    interview_style: STYLES.concise.text,
    ...(role === "capture"
      ? { expert_name: "Sabine" }
      : role === "debrief"
        ? { expert_name: "Sabine", work_map_draft: "{}", open_questions: "{}" }
        : { expert_name: "Sabine", learner_name: "Lena", work_map: "{}" }),
  };
  const body = {
    name: `Sensei · ${role[0].toUpperCase() + role.slice(1)}`,
    conversation_config: {
      agent: {
        first_message:
          role === "capture"
            ? "Work as usual, I'll ask when you pause."
            : role === "debrief"
              ? "Let's review the decisions behind your work. I'll bring up a few moments."
              : "Let's practice with the expert's Work Map.",
        language: "en",
        dynamic_variables: { dynamic_variable_placeholders: placeholders },
        prompt: {
          prompt,
          llm: "claude-sonnet-5-5",
          reasoning_effort: "low",
          tool_ids: toolIds,
          built_in_tools: {
            skip_turn: {
              type: "system",
              name: "skip_turn",
              description: "Wait silently when appropriate.",
            },
            end_call: {
              type: "system",
              name: "end_call",
              description:
                role === "debrief"
                  ? "End only after confirm_teachback succeeds, or the expert explicitly asks to stop."
                  : "End only when explicitly requested.",
            },
          },
        },
      },
      tts: {
        voice_id: process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL",
        model_id: "eleven_v4_turbo",
      },
      turn: { turn_eagerness: "patient", turn_timeout: 30 },
      conversation: { max_duration_seconds: 1800 },
    },
    platform_settings: {
      privacy: { record_voice: false },
      // Lets the app pick the voice and speaking speed per conversation.
      overrides: {
        conversation_config_override: {
          tts: { voice_id: true, speed: true },
        },
      },
    },
  };
  const key = `ELEVENLABS_${role.toUpperCase()}_AGENT_ID`;
  let id = process.env[key];
  if (id) {
    if (role === "tutor") {
      const existing = await eleven(`/convai/agents/${id}`);
      const oldPrompt = existing.conversation_config?.agent?.prompt;
      Object.assign(body.conversation_config.agent.prompt, {
        ...oldPrompt,
        ...body.conversation_config.agent.prompt,
        knowledge_base: oldPrompt?.knowledge_base || [],
        built_in_tools: {
          ...oldPrompt?.built_in_tools,
          ...body.conversation_config.agent.prompt.built_in_tools,
        },
      });
      delete (body.conversation_config.agent.prompt as Record<string, unknown>)
        .tools;
    }
    await eleven(`/convai/agents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  } else {
    id = (
      await eleven("/convai/agents/create", {
        method: "POST",
        body: JSON.stringify(body),
      })
    ).agent_id;
    await saveEnv(key, id!);
  }
  console.log(`${role} configured:`, id);
}
async function main() {
  const role =
    process.argv.find((s) => s.startsWith("--role="))?.split("=")[1] || "all";
  if (!["all", "capture", "debrief", "tutor"].includes(role))
    throw new Error("Unknown role");
  for (const r of ["capture", "debrief", "tutor"] as const)
    if (role === "all" || role === r) await setup(r);
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
