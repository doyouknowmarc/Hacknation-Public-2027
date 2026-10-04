// The knowledge model behind a Work Map: seven dimensions an expert's
// decision is broken into, with the invoice demo mapped onto them.
// Example values come from the scripted demo (Sabine's capture and debrief),
// not from a real company; anything the story never states is "missing".

export type Status = "confirmed" | "stated" | "derived" | "missing";
export const STATUS_LABEL: Record<Status, string> = {
  confirmed: "Confirmed",
  stated: "Stated",
  derived: "Derived",
  missing: "Not captured",
};
export const STATUS_HINT: Record<Status, string> = {
  confirmed: "The expert confirmed it in the debrief",
  stated: "The expert said it or it is visible in the case",
  derived: "Calculated from stated facts",
  missing: "Not part of the demo yet",
};

export type Field = { label: string; value?: string; status: Status };
export type Dimension = {
  id: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  name: string;
  short: string; // question shown on the diagram
  ask: string; // what Sensei asks the expert
  capture: string; // information to capture
  example: Field[]; // Claude exception (INV 2042, Project Atlas)
  note?: string;
};

export const GROUPS = [
  { title: "Understand the case", ids: ["A", "B"] },
  { title: "Make the judgment explicit", ids: ["C", "D"] },
  { title: "Define the response", ids: ["E", "F"] },
] as const;

export const dimensions: Dimension[] = [
  {
    id: "A",
    name: "Business context",
    short: "What does it belong to?",
    ask: "What does this expense belong to?",
    capture: "Entity, supplier, expense category, cost centre or project, amount, currency and service period.",
    example: [
      { label: "Entity", value: "Nordwerk Software", status: "stated" },
      { label: "Supplier", value: "Anthropic", status: "stated" },
      { label: "Category", value: "Software / AI tooling", status: "stated" },
      { label: "Project", value: "Project Atlas", status: "stated" },
      { label: "Invoice amount", value: "€180 net", status: "stated" },
      { label: "Currency", value: "EUR", status: "stated" },
      { label: "Service period", value: "December 2026", status: "stated" },
      { label: "Cost centre", status: "missing" },
    ],
  },
  {
    id: "B",
    name: "Expected baseline",
    short: "What would normal look like?",
    ask: "What would normal look like?",
    capture: "Approved budget, contract or purchase order, recurring amount, frequency and permitted tolerance.",
    example: [
      { label: "Limit amount", value: "€100", status: "stated" },
      { label: "Limit basis", value: "Total Claude spend per project", status: "confirmed" },
      { label: "Limit period", value: "Per calendar month, including earlier invoices", status: "confirmed" },
      { label: "Net / gross basis", value: "Net amounts", status: "stated" },
      { label: "Spend so far this month", value: "€0 (no earlier invoices)", status: "stated" },
      { label: "Tolerance", status: "missing" },
    ],
  },
  {
    id: "C",
    name: "Decision condition",
    short: "What changes the route?",
    ask: "What specifically changes the route?",
    capture: "The exact comparison: amount exceeds a limit, missing evidence, unexpected frequency or contract mismatch.",
    example: [
      { label: "Comparison field", value: "Project’s Claude spend this month", status: "confirmed" },
      { label: "Operator", value: "Greater than limit", status: "stated" },
      { label: "Comparison value", value: "€100", status: "stated" },
      { label: "Condition", value: "Category is AI tooling AND monthly project total > €100", status: "confirmed" },
      { label: "Actual difference", value: "€80 over the allowance", status: "derived" },
    ],
  },
  {
    id: "D",
    name: "Business rationale",
    short: "Why a different response?",
    ask: "Why does this require a different response?",
    capture: "The purpose of the rule and the acceptable grounds for an exception.",
    example: [
      { label: "Control purpose", value: "Spend above the allowance needs a checked business reason", status: "stated" },
      { label: "Exception reason", value: "Urgent development before the Helios customer release", status: "stated" },
      { label: "Exception criteria", value: "Urgency supports a request. It does not replace approval.", status: "confirmed" },
    ],
  },
  {
    id: "E",
    name: "Action and authority",
    short: "Who decides what happens?",
    ask: "Who decides, and what can they authorise?",
    capture: "Continue, hold, request information or escalate; the responsible role and the approval sequence.",
    example: [
      { label: "Observed action", value: "Request approval, routed to the project lead", status: "stated" },
      { label: "Responsible role", value: "Accounts payable (Sabine)", status: "stated" },
      { label: "Approver", value: "Project lead (M. Weber, Atlas)", status: "stated" },
      { label: "Approval sequence", value: "AP requests → project lead approves → payment run", status: "derived" },
      { label: "If rejected or no reply", value: "Payment stays pending; Finance follows up", status: "confirmed" },
    ],
  },
  {
    id: "F",
    name: "Release criteria",
    short: "What must be true to continue?",
    ask: "What must be true to continue?",
    capture: "The evidence or approval required before work resumes, and the next process step.",
    example: [
      { label: "Required evidence", value: "The project and why the extra usage was necessary", status: "stated" },
      { label: "Required approval", value: "The project lead’s explicit approval", status: "stated" },
      { label: "Next step", value: "Release for the next payment run", status: "derived" },
    ],
  },
  {
    id: "G",
    name: "Evidence and validity",
    short: "What supports this knowledge, and who has confirmed it?",
    ask: "Is this an observation, a proposed rule or an authorised rule?",
    capture: "Observed case, expert explanation, policy reference, scope, verifier and effective date.",
    example: [
      { label: "Observed case", value: "INV 2042, recorded screen moment during capture", status: "stated" },
      { label: "Expert explanation", value: "“The monthly total per project. Earlier invoices count.”", status: "confirmed" },
      { label: "Verifier", value: "Sabine, accounts payable expert", status: "confirmed" },
      { label: "Validation status", value: "Expert-confirmed, not yet a written policy", status: "derived" },
      { label: "Rule scope", value: "Claude / AI tooling spend, per project", status: "confirmed" },
      { label: "Policy reference", status: "missing" },
      { label: "Effective date", status: "missing" },
      { label: "Rule owner", status: "missing" },
    ],
    note: "Keep observed actions, proposed interpretations and authorised rules apart. A rule becomes authorised only with a policy reference or confirmation from an accountable verifier within its scope.",
  },
];

export type Case = {
  id: string;
  title: string;
  tag: string;
  situation: string;
  condition: string;
  response: string;
  reason: string;
  resume: string;
  quote: string;
};
export const cases: Case[] = [
  {
    id: "claude",
    title: "Claude exception",
    tag: "Above the software limit",
    situation: "€180 of Claude usage for Project Atlas against a €100 monthly allowance. The extra usage supported urgent development before a customer release.",
    condition: "The project’s Claude spend this month exceeds €100",
    response: "Request approval from the project lead; keep payment pending",
    reason: "Urgency supports an exception request. It does not replace approval.",
    resume: "The project lead explicitly approves, with the reason documented",
    quote: "Why the extra usage was needed, and the project lead's approval. Urgent isn't enough.",
  },
  {
    id: "supplies",
    title: "Quarterly supplies",
    tag: "Recurring purchase",
    situation: "€700 of office supplies, the quarterly replenishment. It matches the approved purchasing schedule, and delivery is confirmed.",
    condition: "The invoice matches an existing authorisation (PO) and a confirmed delivery",
    response: "Approve for payment, with no further sign-off",
    reason: "A larger amount can be routine when it matches an authorisation. Recurrence alone is not enough.",
    resume: "Not applicable: released directly",
    quote: "It matches our authorized quarterly order, and delivery is confirmed.",
  },
  {
    id: "rent",
    title: "Fixed-cost anomaly",
    tag: "Above the usual charge",
    situation: "€3,000 office rent against the usual €2,400 (+€600, 25%). The invoice mentions a rent adjustment, but no updated agreement is attached.",
    condition: "A fixed cost rises above its contractual amount without supporting evidence",
    response: "Hold and route to Workplace / Facilities for clarification",
    reason: "A known supplier and a recurring expense don’t justify an unexplained increase.",
    resume: "Facilities confirms an updated agreement, then Finance approves the new amount",
    quote: "Facilities must confirm the increase against an updated agreement.",
  },
];

export type Rule = {
  id: string;
  name: string;
  kind: "Business rule" | "Practice guidance";
  scope: string;
  action: string;
  owner: string;
  status: string;
};
export const rules: Rule[] = [
  { id: "R1", name: "Software spend limit", kind: "Business rule", scope: "AI tooling · monthly project total above €100, including earlier invoices", action: "Request the project lead’s approval; payment stays pending", owner: "Project lead", status: "Expert-confirmed" },
  { id: "R2", name: "Recurring purchase baseline", kind: "Business rule", scope: "Recurring purchase · matches an approved PO and a confirmed delivery", action: "Approve for payment", owner: "Accounts payable", status: "Expert-confirmed" },
  { id: "R3", name: "Fixed-cost deviation", kind: "Business rule", scope: "Fixed cost · above the contractual amount without an updated agreement", action: "Hold and route to Workplace / Facilities", owner: "Workplace / Facilities", status: "Expert-confirmed" },
  { id: "G1", name: "Look for the cause of an increase", kind: "Practice guidance", scope: "A recurring or fixed charge rises", action: "Check contract, usage or billing first", owner: "—", status: "Advisory" },
  { id: "G2", name: "Urgency as a reason", kind: "Practice guidance", scope: "Above-limit software request", action: "Name the project and the urgency in the request", owner: "—", status: "Advisory" },
];

export const valueChain = {
  primary: ["Inbound logistics", "Operations", "Outbound logistics", "Marketing & sales", "Service"],
  support: ["Firm infrastructure", "Human resources", "Technology development", "Procurement"],
  finance: [
    { name: "Invoice processing & expense management", mapped: true },
    { name: "Order-to-cash", mapped: false },
    { name: "Record-to-report", mapped: false },
    { name: "Treasury & cash", mapped: false },
    { name: "Tax", mapped: false },
    { name: "Financial planning & analysis", mapped: false },
  ],
};
