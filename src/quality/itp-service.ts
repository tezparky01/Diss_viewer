import { db } from "./itp-db";
import type { Status, InspectionRow, ElementSelection } from "./itp-model";

// selection → array of { modelId, expressID, ifcGuid? }
export async function linkToStep(
  stepId: string,
  selection: ElementSelection[],
) {
  const now = new Date().toISOString();
  await db.transaction("rw", db.inspections, async () => {
    for (const { modelId, expressID, ifcGuid } of selection) {
      const modelKey = `${modelId}:${expressID}`;
      const pk = `${stepId}#${modelKey}`;
      const row: InspectionRow = {
        pk,
        stepId,
        modelId,
        expressID,
        ifcGuid,
        status: "Open",
        inspectedAt: now,
        modelKey,
      };
      await db.inspections.put(row);
    }
  });
}

export async function setStatus(
  stepId: string,
  selection: ElementSelection[],
  status: Status,
  notes?: string,
) {
  const now = new Date().toISOString();
  await db.transaction("rw", db.inspections, async () => {
    for (const e of selection) {
      const pk = `${stepId}#${e.modelId}:${e.expressID}`;
      await db.inspections.update(pk, { status, inspectedAt: now, notes });
    }
  });
}

export async function exportJSON() {
  const [steps, inspections] = await Promise.all([
    db.itp_steps.toArray(),
    db.inspections.toArray(),
  ]);
  return { steps, inspections };
}

// Simple CSV export (header + rows). Replace with Papa Parse for richer quoting if needed.
export async function exportCSV(): Promise<{
  stepsCsv: string;
  inspectionsCsv: string;
}> {
  const [steps, inspections] = await Promise.all([
    db.itp_steps.toArray(),
    db.inspections.toArray(),
  ]);
  const stepsCsv = [
    "stepId,name",
    ...steps.map((s) => `${s.stepId},"${s.name.replace(/"/g, '""')}"`),
  ].join("\n");
  const head =
    "stepId,modelId,expressID,ifcGuid,status,inspectedAt,inspector,notes";
  const rows = inspections.map((r) =>
    [
      r.stepId,
      r.modelId,
      r.expressID,
      r.ifcGuid ?? "",
      r.status,
      r.inspectedAt,
      r.inspector ?? "",
      (r.notes ?? "").replace(/"/g, '""'),
    ]
      .map((v) => (typeof v === "string" ? `"${v}"` : String(v)))
      .join(","),
  );
  return { stepsCsv, inspectionsCsv: [head, ...rows].join("\n") };
}

// Get statistics for a step
export async function getStepStatistics(stepId: string) {
  const rows = await db.inspections.where({ stepId }).toArray();
  const stats = {
    open: 0,
    pass: 0,
    fail: 0,
    na: 0,
    total: rows.length,
  };

  for (const row of rows) {
    switch (row.status) {
      case "Open":
        stats.open++;
        break;
      case "Pass":
        stats.pass++;
        break;
      case "Fail":
        stats.fail++;
        break;
      case "NA":
        stats.na++;
        break;
      default:
        break;
    }
  }

  return stats;
}

// Get all inspections for a step
export async function getInspectionsForStep(stepId: string) {
  return db.inspections.where({ stepId }).toArray();
}
