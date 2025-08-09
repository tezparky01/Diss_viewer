import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { db } from "./itp-db";

export async function repaintForStep(
  components: OBC.Components,
  stepId: string,
) {
  const highlighter = components.get(OBF.Highlighter);

  // Use the same quality styles as defined in QualityPanel
  if (!highlighter.styles.get("quality-pass")) {
    highlighter.styles.set("quality-pass", {
      color: new THREE.Color("#4CAF50"), // Green
      opacity: 0.8,
      transparent: true,
      renderedFaces: 1,
    });
  }
  if (!highlighter.styles.get("quality-fail")) {
    highlighter.styles.set("quality-fail", {
      color: new THREE.Color("#F44336"), // Red
      opacity: 0.8,
      transparent: true,
      renderedFaces: 1,
    });
  }
  if (!highlighter.styles.get("quality-open")) {
    highlighter.styles.set("quality-open", {
      color: new THREE.Color("#0080FF"), // Modern electric blue
      opacity: 0.6,
      transparent: true,
      renderedFaces: 1,
    });
  }
  if (!highlighter.styles.get("quality-na")) {
    highlighter.styles.set("quality-na", {
      color: new THREE.Color("#9E9E9E"), // Gray
      opacity: 0.6,
      transparent: true,
      renderedFaces: 1,
    });
  }

  const rows = await db.inspections.where({ stepId }).toArray();

  // Build four ModelIdMaps (pass + fail + open + na)
  const passMap: Record<string, Set<number>> = {};
  const failMap: Record<string, Set<number>> = {};
  const openMap: Record<string, Set<number>> = {};
  const naMap: Record<string, Set<number>> = {};

  for (const r of rows) {
    let target: Record<string, Set<number>> | null = null;
    switch (r.status) {
      case "Pass":
        target = passMap;
        break;
      case "Fail":
        target = failMap;
        break;
      case "Ready for Inspection":
        target = openMap;
        break;
      case "NA":
        target = naMap;
        break;
      default:
        continue;
    }

    if (target && r.modelId) {
      target[r.modelId] ??= new Set<number>();
      target[r.modelId].add(r.expressID!);
    }
  }

  // Clear, then apply all selections in batches
  await highlighter.clear("quality-pass");
  await highlighter.clear("quality-fail");
  await highlighter.clear("quality-open");
  await highlighter.clear("quality-na");

  await highlighter.highlightByID("quality-pass", passMap as any, false);
  await highlighter.highlightByID("quality-fail", failMap as any, false);
  await highlighter.highlightByID("quality-open", openMap as any, false);
  await highlighter.highlightByID("quality-na", naMap as any, false);
}

export async function clearAllHighlighting(components: OBC.Components) {
  const highlighter = components.get(OBF.Highlighter);
  await highlighter.clear("quality-pass");
  await highlighter.clear("quality-fail");
  await highlighter.clear("quality-open");
  await highlighter.clear("quality-na");
}
