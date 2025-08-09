import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { db } from "./itp-db";

export async function repaintForStep(
  components: OBC.Components,
  stepId: string,
) {
  const highlighter = components.get(OBF.Highlighter);

  try {
    console.log(`🎨 Starting repaint for step: ${stepId}`);

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

    // Add a small delay to ensure database writes are complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    const rows = await db.inspections.where({ stepId }).toArray();
    console.log(
      `📊 Found ${rows.length} inspection records for step ${stepId}`,
    );

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
          console.warn(
            `⚠️ Unknown status: ${r.status} for element ${r.modelId}:${r.expressID}`,
          );
          continue;
      }

      if (target && r.modelId) {
        target[r.modelId] ??= new Set<number>();
        target[r.modelId].add(r.expressID!);
      }
    }

    console.log(
      `🟢 Pass elements:`,
      Object.keys(passMap).length > 0 ? passMap : "none",
    );
    console.log(
      `🔴 Fail elements:`,
      Object.keys(failMap).length > 0 ? failMap : "none",
    );
    console.log(
      `🔵 Open elements:`,
      Object.keys(openMap).length > 0 ? openMap : "none",
    );
    console.log(
      `⚪ NA elements:`,
      Object.keys(naMap).length > 0 ? naMap : "none",
    );

    // Clear all quality styles first - do this in parallel for better performance
    await Promise.all([
      highlighter.clear("quality-pass"),
      highlighter.clear("quality-fail"),
      highlighter.clear("quality-open"),
      highlighter.clear("quality-na"),
    ]);

    // Apply all selections in sequence to avoid conflicts
    // Use individual try-catch for each highlighting operation
    const highlights = [
      { name: "quality-pass", map: passMap, color: "green" },
      { name: "quality-fail", map: failMap, color: "red" },
      { name: "quality-open", map: openMap, color: "blue" },
      { name: "quality-na", map: naMap, color: "gray" },
    ];

    for (const { name, map, color } of highlights) {
      try {
        if (Object.keys(map).length > 0) {
          console.log(`🎨 Applying ${color} highlighting for ${name}`);
          await highlighter.highlightByID(name, map as any, false);
        }
      } catch (error) {
        console.error(`❌ Failed to apply ${name} highlighting:`, error);
      }
    }

    console.log(`✅ Repaint completed for step: ${stepId}`);
  } catch (error) {
    console.error(`❌ Error during repaint for step ${stepId}:`, error);
    throw error;
  }
}

export async function clearAllHighlighting(components: OBC.Components) {
  const highlighter = components.get(OBF.Highlighter);
  await highlighter.clear("quality-pass");
  await highlighter.clear("quality-fail");
  await highlighter.clear("quality-open");
  await highlighter.clear("quality-na");
}
