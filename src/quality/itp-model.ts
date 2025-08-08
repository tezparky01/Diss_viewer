// ITP steps (seeded list; can also be loaded from CSV)
export const ITP_STEPS = [
  { id: "SP-01", name: "Commence of Piling" },
  { id: "SP-02", name: "Drill bit length and diameter" },
  { id: "SP-03", name: "Check Casing Dimension (Each Casing / Each Batch)" },
  { id: "SP-04", name: "Check Rock Head Samples and Levels (Each Pile)" },
  { id: "SP-05", name: "Check Founding Samples and Levels (Each Pile)" },
  {
    id: "SP-06",
    name: "Pile Base Level identification and rock sample inspection (Each Pile)",
  },
  { id: "SP-07", name: "Bell-out Formation (Each Pile)" },
  { id: "SP-08", name: "Koden Test (Each Pile)" },
  { id: "SP-09", name: "1st Air lifting, level and water sample (Each Pile)" },
  { id: "SP-10", name: "Installation of reinforcement Cage (Each Pile)" },
  {
    id: "SP-11",
    name: "Reinforcement Cage lapping and installation (Each Pile)",
  },
  { id: "SP-12", name: "2nd Air lifting... cage top level (Each Pile)" },
  { id: "SP-13", name: "Pre-concrete Checking of Bored Pile (Each Pile)" },
  { id: "SP-14", name: "As-built Concrete Top Level Checking (Each Pile)" },
  { id: "SP-15", name: "Sonic Logging Test (Each Pile)" },
  { id: "SP-16", name: "Interfacing Coring (Each Pile)" },
  {
    id: "SP-17",
    name: "Test of cement grout for reservation tubs backfilling",
  },
] as const;

export type Status = "Open" | "Pass" | "Fail" | "NA";

export type InspectionRow = {
  // one row = one element in one step
  pk: string; // `${stepId}#${modelId}:${expressID}`
  stepId: string;
  modelId: string;
  expressID: number;
  ifcGuid?: string;
  status: Status;
  notes?: string;
  inspector?: string;
  inspectedAt: string; // ISO
  modelKey: string; // `${modelId}:${expressID}` (index convenience)
};

// Helper type for element selection
export type ElementSelection = {
  modelId: string;
  expressID: number;
  ifcGuid?: string;
};

// Statistics type for step counts
export type StepStatistics = {
  stepId: string;
  stepName: string;
  open: number;
  pass: number;
  fail: number;
  na: number;
  total: number;
};
