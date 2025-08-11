import { db } from "./itp-db";
import type { Status, InspectionRow, ElementSelection } from "./itp-model";

// selection → array of { modelId, expressID, ifcGuid? }
export async function linkToStep(
  stepId: string,
  selection: ElementSelection[],
) {
  const now = new Date().toISOString();
  await db.transaction("rw", db.inspections, async () => {
    for (const { modelId, expressID, guid } of selection) {
      const modelKey = `${modelId}:${expressID}`;
      const pk = `${stepId}#${modelKey}`;
      const row: InspectionRow = {
        pk,
        stepId,
        guid: guid || "",
        status: "Ready for Inspection",
        inspectedAt: now,
        modelId,
        expressID,
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
  try {
    console.log(
      `🔄 Setting status to "${status}" for ${selection.length} elements in step ${stepId}`,
    );

    const now = new Date().toISOString();
    await db.transaction("rw", db.inspections, async () => {
      for (const e of selection) {
        const pk = `${stepId}#${e.modelId}:${e.expressID}`;
        const result = await db.inspections.update(pk, {
          status,
          inspectedAt: now,
          notes: notes || undefined,
        });

        if (result === 0) {
          console.warn(
            `⚠️ Failed to update status for ${pk} - record may not exist`,
          );
        } else {
          console.log(`✅ Updated status for ${pk} to ${status}`);
        }
      }
    });

    console.log(`✅ Status update completed for step ${stepId}`);
  } catch (error) {
    console.error(`❌ Error setting status for step ${stepId}:`, error);
    throw error;
  }
}

// Combined function to link elements and set status in one operation
export async function linkAndSetStatus(
  stepId: string,
  selection: ElementSelection[],
  status: Status,
  notes?: string,
) {
  try {
    console.log(
      `🔗 Linking and setting status "${status}" for ${selection.length} elements in step ${stepId}`,
    );

    const now = new Date().toISOString();
    
    // Do everything in one transaction to ensure consistency
    await db.transaction("rw", db.inspections, async () => {
      for (const { modelId, expressID, guid } of selection) {
        const modelKey = `${modelId}:${expressID}`;
        const pk = `${stepId}#${modelKey}`;
        
        // Create or update the inspection record with the status
        const row: InspectionRow = {
          pk,
          stepId,
          guid: guid || "",
          status,
          inspectedAt: now,
          modelId,
          expressID,
          modelKey,
          notes: notes || undefined,
        };
        
        // Use put to insert/update the record
        await db.inspections.put(row);
        console.log(`✅ Linked and set status for ${pk} to ${status}`);
      }
    });

    console.log(`✅ Link and status update completed for step ${stepId}`);
  } catch (error) {
    console.error(
      `❌ Error linking and setting status for step ${stepId}:`,
      error,
    );
    throw error;
  }
}

export async function exportJSON() {
  const [steps, inspections] = await Promise.all([
    db.itp_steps.toArray(),
    db.inspections.toArray(),
  ]);
  
  // Convert timestamps to local time for JSON export
  const inspectionsWithLocalTime = inspections.map(inspection => ({
    ...inspection,
    inspectedAt: new Date(inspection.inspectedAt).toLocaleString()
  }));
  
  return { steps, inspections: inspectionsWithLocalTime };
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
    "stepId,modelId,expressID,guid,status,inspectedAt,inspector,notes";
  const rows = inspections.map((r) =>
    [
      r.stepId,
      r.modelId,
      r.expressID,
      r.guid ?? "",
      r.status,
      new Date(r.inspectedAt).toLocaleString(), // Convert to local time
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
      case "Ready for Inspection":
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

// Get step statistics filtered by loaded models only
export async function getStepStatisticsForLoadedModels(stepId: string, loadedModelIds: string[]) {
  if (!loadedModelIds.length) {
    return {
      open: 0,
      pass: 0,
      fail: 0,
      na: 0,
      total: 0,
    };
  }

  const rows = await db.inspections.where({ stepId }).toArray();
  const filteredRows = rows.filter(row => row.modelId && loadedModelIds.includes(row.modelId));
  
  const stats = {
    open: 0,
    pass: 0,
    fail: 0,
    na: 0,
    total: filteredRows.length,
  };

  for (const row of filteredRows) {
    switch (row.status) {
      case "Ready for Inspection":
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
