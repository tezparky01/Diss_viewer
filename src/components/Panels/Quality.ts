// src/components/Panels/Quality.ts
import * as OBC from "@thatopen/components";
import QualityPanel from "../../quality/QualityPanel";

export default function createQualityPanel(components: OBC.Components) {
  const panel = QualityPanel(components);
  return panel;
}