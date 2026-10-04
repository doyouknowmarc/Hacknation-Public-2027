import { eleven } from "./elevenlabs";
import { writeFile } from "./workmap-store";
import type { WorkMap } from "./workmap-types";
export async function publishWorkMap(map: WorkMap) {
  const p = map.publication;
  p.errors = [];
  p.agentId = process.env.ELEVENLABS_TUTOR_AGENT_ID;
  const save = () => writeFile(map.id, "workmap", map);
  if (!p.agentId) {
    p.errors.push("Tutor agent is not configured. Run npm run setup:agents.");
    p.status = "partial";
    await save();
    return map;
  }
  try {
    if (!p.documentId) {
      const doc = await eleven("/convai/knowledge-base/text", {
        method: "POST",
        body: JSON.stringify({
          name: `Work Map · ${map.expert} · ${map.id}`,
          text: JSON.stringify(map),
        }),
      });
      p.documentId = doc.id;
      await save();
    }
    const agent = await eleven(`/convai/agents/${p.agentId}`);
    const branch = agent.main_branch_id;
    if (!branch) throw new Error("Tutor main branch ID unavailable");
    const judgments = map.steps.filter((s) => s.isJudgmentCall);
    for (let index = p.procedureIds.length; index < judgments.length; index++) {
      const step = judgments[index];
      try {
        const result = await eleven(
          `/convai/agents/${p.agentId}/branches/${branch}/procedures`,
          {
            method: "POST",
            body: JSON.stringify({
              name: `${map.id} · ${step.id}`,
              type: "free_form",
              trigger: `Only when the active work_map has id ${map.id} and the learner is deciding: ${step.decision}`,
              content: JSON.stringify({
                decision: step.decision,
                reason: step.reason,
                guardrails: map.guardrails.filter((g) =>
                  step.guardrailIds.includes(g.id),
                ),
                screenMoment: step.screenMoment,
              }),
            }),
          },
        );
        if (!result.procedure_id) throw new Error("Procedure ID missing");
        p.procedureIds.push(result.procedure_id);
        await save();
      } catch (e) {
        p.errors.push(
          `Procedure: ${e instanceof Error ? e.message : "creation failed"}`,
        );
        break;
      }
    }
    await eleven(
      `/convai/agents/${p.agentId}?branch_id=${encodeURIComponent(branch)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          version_description: `Confirmed Work Map ${map.id}`,
          conversation_config: {
            agent: {
              prompt: {
                ...agent.conversation_config.agent.prompt,
                knowledge_base: [
                  {
                    type: "text",
                    id: p.documentId,
                    name: `Work Map ${map.id}`,
                    usage_mode: "auto",
                  },
                ],
              },
            },
          },
        }),
      },
    );
    p.status = p.errors.length ? "partial" : "published";
  } catch (e) {
    p.status = "partial";
    p.errors.push(e instanceof Error ? e.message : "Tutor publication failed");
  }
  await save();
  return map;
}
