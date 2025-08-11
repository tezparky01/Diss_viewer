import Dexie, { Table } from "dexie";
import type { InspectionRow } from "./itp-model";

export type ItpStep = { stepId: string; name: string };

export class ItpDB extends Dexie {
  itp_steps!: Table<ItpStep, string>;

  inspections!: Table<InspectionRow, string>;

  constructor() {
    super("itp-db");
    this.version(2).stores({
      itp_steps: "&stepId, name",
      inspections:
        "&pk, stepId, status, guid, inspectedAt, [stepId+status], [stepId+guid]",
    });
  }
}

export const db = new ItpDB();
