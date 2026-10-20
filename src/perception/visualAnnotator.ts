import sharp from "sharp";
import { BoundingBox } from "../mcp/schemas.js";

export interface AnnotationItem {
  box: BoundingBox;
  label?: string;
  color?: string; // e.g. '#ef4444' for red, '#3b82f6' for blue
}

export class VisualAnnotator {
  /**
   * Overlays bounding boxes and badge labels onto a PNG base64 image
   */
  public static async annotateImage(
    base64Png: string,
    annotations: AnnotationItem[]
  ): Promise<string> {
    if (!annotations || annotations.length === 0) {
      return base64Png;
    }

    const imageBuffer = Buffer.from(base64Png, "base64");
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width ?? 1280;
    const height = metadata.height ?? 800;

    // Build SVG elements for bounding boxes and labels
    const svgElements: string[] = [];

    annotations.forEach((item) => {
      const { box, label } = item;
      const color = item.color || "#ef4444"; // Default warning red

      // Bounding box rectangle with stroke and soft fill
      svgElements.push(
        `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" ` +
          `fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="3" stroke-dasharray="6 3" />`
      );

      // Label badge
      if (label) {
        const badgeHeight = 24;
        const textPadding = 12;
        const estimatedTextWidth = Math.max(80, label.length * 8 + textPadding);
        const badgeY = Math.max(0, box.y - badgeHeight);

        svgElements.push(
          `<rect x="${box.x}" y="${badgeY}" width="${estimatedTextWidth}" height="${badgeHeight}" ` +
            `fill="${color}" rx="4" />` +
          `<text x="${box.x + 6}" y="${badgeY + 16}" fill="#ffffff" font-family="Segoe UI, sans-serif" ` +
            `font-size="12" font-weight="bold">${escapeXml(label)}</text>`
        );
      }
    });

    const svgOverlay = Buffer.from(
      `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${svgElements.join("\n")}
      </svg>`
    );

    const compositedBuffer = await sharp(imageBuffer)
      .composite([{ input: svgOverlay, top: 0, left: 0 }])
      .png()
      .toBuffer();

    return compositedBuffer.toString("base64");
  }
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
