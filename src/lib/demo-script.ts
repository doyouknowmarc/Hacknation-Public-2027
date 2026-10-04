// Presenter cheat-sheet shown on the home page. Proposed demo assumptions:
// net amounts throughout; the Claude limit is €100 per project per month.
export const demoScript = {
  title: "Three invoices. Three different decisions. One expert’s judgment captured and taught.",
  steps: [
    {
      title: "1 · Capture: process three invoices",
      intro:
        "Opening line: “I’m clearing three invoices before the payment run. They all look familiar, but each needs a different decision.”",
      lines: [
        {
          cue: "INV 2041 · €700 office supplies → Approve for payment",
          q: "What lets you approve €700 without another approval?",
          a: "It matches our authorized quarterly order, and delivery is confirmed.",
        },
        {
          cue: "INV 2042 · €180 Claude, Project Atlas → Request approval · Project lead",
          q: "What must be documented before this can be released?",
          a: "The project, why the extra usage was necessary, and the project lead’s explicit approval. ‘Urgent’ on its own isn’t enough.",
        },
        {
          cue: "INV 2043 · €3,000 rent (usually €2,400) → Hold · Workplace / Facilities",
          q: "What would let you release this invoice?",
          a: "Facilities must confirm the increase against an updated agreement. If it’s incorrect, we need a corrected invoice.",
        },
      ],
    },
    {
      title: "2 · Debrief: answer what the screen didn’t show",
      intro: "Then confirm the apprentice’s one-minute teach-back.",
      lines: [
        {
          cue: "Limit scope",
          q: "Does the €100 Claude limit cover each invoice or the total monthly spend per project?",
          a: "Total monthly spend per project, including earlier invoices.",
        },
        {
          cue: "Exception rejected",
          q: "What happens if the project lead rejects the exception or does not respond?",
          a: "Payment stays pending; Finance follows up.",
        },
        {
          cue: "Valid increase",
          q: "What if Facilities confirms that the rent increase is valid?",
          a: "Attach the evidence, obtain Finance approval for the revised amount, then release.",
        },
      ],
    },
    {
      title: "3 · Work Map: check the evidence",
      intro:
        "Each decision keeps its screen moment, the expert’s words, the rule, the responsible person and the release condition.",
      lines: [],
    },
    {
      title: "4 · Teach: an unseen case",
      intro:
        "New hire opens INV 2051: €90 Claude for Project Orion. €40 was already spent this month, so Orion reaches €130, €30 over the allowance.",
      lines: [
        {
          cue: "Learner clicks Approve for payment (the invoice alone is below €100)",
          q: "Pause — the expert explained that the limit applies to monthly project spend. This invoice brings Orion to €130. What needs to happen before release?",
          a: "Learner adds the business reason and requests approval from the Project lead → tutor review passes → saved as Awaiting approval.",
        },
      ],
    },
  ],
};
