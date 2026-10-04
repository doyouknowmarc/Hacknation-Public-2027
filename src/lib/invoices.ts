// Demo storyline: three expert invoices, three different decisions, and one
// unseen learner invoice. Supporting documents are facts only; the policies
// behind the decisions come from the expert during capture, never from here.
export const STATUSES = {
  ready: "Ready for review",
  approval: "Awaiting approval",
  hold: "On hold",
  approved: "Approved for payment",
} as const;
export type Status = (typeof STATUSES)[keyof typeof STATUSES];
// Which completed status each confirmed action produces.
export const ACTION_STATUS: Record<string, Status> = {
  approve: STATUSES.approved,
  approval: STATUSES.approval,
  hold: STATUSES.hold,
};
export const COMPLETED = /^(Approved for payment|Awaiting approval|On hold)$/i;
export const APPROVERS = [
  "Project lead",
  "Workplace / Facilities",
  "Finance",
] as const;
export type Doc = { label: string; value: string; flag?: boolean };
export type Invoice = {
  id: string;
  supplier: string;
  description: string;
  category: string;
  net: number;
  date: string;
  remark: string;
  project: string;
  docs: Doc[];
  history: string[];
  status: Status;
  approver: string;
  note: string;
};
const invoice = (
  p: Omit<Invoice, "status" | "approver" | "note" | "date" | "remark" | "project"> &
    Partial<Invoice>,
): Invoice => ({
  date: "2026-12-04",
  remark: "",
  project: "",
  status: STATUSES.ready,
  approver: "",
  note: "",
  ...p,
});
export const cases = {
  expert: [
    invoice({
      id: "2041",
      supplier: "Bürobedarf Schäfer GmbH",
      description: "Office supplies — quarterly replenishment Q1",
      category: "Office supplies",
      net: 700,
      docs: [
        {
          label: "Purchase order",
          value: "PO-26-0412 · Quarterly office supplies schedule · €700 · approved by Office Management",
        },
        { label: "Delivery", value: "Goods receipt GR-8841 · delivered 2 Dec 2026 · complete" },
      ],
      history: [
        "Sep 2026 · Quarterly replenishment Q4 · €680 · Paid",
        "Jun 2026 · Quarterly replenishment Q3 · €655 · Paid",
      ],
    }),
    invoice({
      id: "2042",
      supplier: "Anthropic",
      description: "Claude usage — December 2026",
      category: "Software / AI tooling",
      net: 180,
      project: "Project Atlas",
      remark: "Extra usage: urgent development before the Helios customer release (9 Dec).",
      docs: [
        { label: "Project budget", value: "Project Atlas · Claude allowance €100 per month" },
        { label: "Spend this month", value: "Project Atlas · no earlier Claude invoices in December" },
        { label: "Project lead", value: "M. Weber (Project Atlas)" },
      ],
      history: [
        "Nov 2026 · Claude usage · €95 · Paid",
        "Oct 2026 · Claude usage · €88 · Paid",
      ],
    }),
    invoice({
      id: "2043",
      supplier: "Westpark Immobilien GmbH",
      description: "Office rent — December 2026",
      category: "Rent",
      net: 3000,
      remark: "Includes rent adjustment as of December 2026.",
      docs: [
        { label: "Rental agreement", value: "Lease WP-2019-07 · monthly rent €2,400" },
        { label: "Attachments", value: "No updated agreement attached", flag: true },
      ],
      history: [
        "Nov 2026 · Office rent · €2,400 · Paid",
        "Oct 2026 · Office rent · €2,400 · Paid",
        "Sep 2026 · Office rent · €2,400 · Paid",
      ],
    }),
  ],
  newhire: [
    invoice({
      id: "2051",
      supplier: "Anthropic",
      description: "Claude usage — December 2026 (top-up)",
      category: "Software / AI tooling",
      net: 90,
      project: "Project Orion",
      remark: "Additional usage for Orion data migration.",
      docs: [
        { label: "Project budget", value: "Project Orion · Claude allowance €100 per month" },
        { label: "Spend this month", value: "1 Dec 2026 · Claude usage · €40 · Approved for payment" },
        { label: "Project lead", value: "J. Krämer (Project Orion)" },
      ],
      history: [
        "Dec 2026 · Claude usage · €40 · Approved for payment",
        "Nov 2026 · Claude usage · €70 · Paid",
      ],
    }),
  ],
};
export const euro = (n: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(
    n,
  );
