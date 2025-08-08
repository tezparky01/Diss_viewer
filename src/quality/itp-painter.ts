import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { db } from "./itp-db";

export async function repaintForStep(
  components: OBC.Components,
  stepId: string,
) {
  const highlighter = components.get(OBF.Highlighter);

  // make sure styles exist once:
  if (!highlighter.styles.get("itp-pass")) {
    highlighter.styles.set("itp-pass", {
      color: new THREE.Color(0x00aa00),
      opacity: 0.6,
      renderedFaces: 1,
      transparent: true,
    });
  }
  if (!highlighter.styles.get("itp-fail")) {
    highlighter.styles.set("itp-fail", {
      color: new THREE.Color(0xaa0000),
      opacity: 0.6,
      renderedFaces: 1,
      transparent: true,
    });
  }
  if (!highlighter.styles.get("itp-na")) {
    highlighter.styles.set("itp-na", {
      color: new THREE.Color(0xffaa00),
      opacity: 0.6,
      renderedFaces: 1,
      transparent: true,
    });
  }

  const rows = await db.inspections.where({ stepId }).toArray();

  // Build three ModelIdMaps (pass + fail + na)
  const passMap: Record<string, Set<number>> = {};
  const failMap: Record<string, Set<number>> = {};
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
      case "NA":
        target = naMap;
        break;
      default:
        // Skip "Open" status - no coloring
        continue;
    }

    if (target) {
      target[r.modelId] ??= new Set<number>();
      target[r.modelId].add(r.expressID);
    }
  }

  // Clear, then apply all selections in batches
  await highlighter.clear("itp-pass");
  await highlighter.clear("itp-fail");
  await highlighter.clear("itp-na");

  await highlighter.highlightByID("itp-pass", passMap as any, false);
  await highlighter.highlightByID("itp-fail", failMap as any, false);
  await highlighter.highlightByID("itp-na", naMap as any, false);
}

export async function clearAllHighlighting(components: OBC.Components) {
  const highlighter = components.get(OBF.Highlighter);
  await highlighter.clear("itp-pass");
  await highlighter.clear("itp-fail");
  await highlighter.clear("itp-na");
}
