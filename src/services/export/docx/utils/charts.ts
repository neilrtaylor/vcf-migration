// DOCX Chart Generation Functions

import { Paragraph, ImageRun, AlignmentType } from 'docx';
import { CHART_COLORS, FONT_FAMILY, type ChartData } from '../types';

// High-DPI scale factor for crisp charts (3x for retina quality)
const CHART_SCALE = 3;

export async function generatePieChart(
  data: ChartData[],
  title: string,
  width: number = 480,
  height: number = 260
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = width * CHART_SCALE;
  canvas.height = height * CHART_SCALE;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  ctx.scale(CHART_SCALE, CHART_SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  // Layout: pie on left, legend on right
  const titleHeight = 36;
  const pieSize = Math.min(width * 0.45, height - titleHeight - 20);
  const radius = pieSize / 2;
  const centerX = radius + 30;
  const centerY = titleHeight + (height - titleHeight) / 2;
  const legendAreaX = centerX + radius + 40;

  // Draw title with IBM Blue underline
  ctx.font = `bold 13px ${FONT_FAMILY}, Arial, sans-serif`;
  ctx.fillStyle = '#161616';
  ctx.textAlign = 'left';
  ctx.fillText(title, 20, 22);

  ctx.strokeStyle = '#0f62fe';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, 28);
  ctx.lineTo(20 + ctx.measureText(title).width, 28);
  ctx.stroke();

  // Draw pie slices
  let currentAngle = -Math.PI / 2;

  data.forEach((item, index) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    const color = item.color || CHART_COLORS[index % CHART_COLORS.length];

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    const labelAngle = currentAngle + sliceAngle / 2;
    const labelRadius = radius * 0.6;
    const labelX = centerX + Math.cos(labelAngle) * labelRadius;
    const labelY = centerY + Math.sin(labelAngle) * labelRadius;

    const percent = Math.round((item.value / total) * 100);
    if (percent >= 10) {
      ctx.font = `bold 11px ${FONT_FAMILY}, Arial, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${percent}%`, labelX, labelY);
    }

    currentAngle += sliceAngle;
  });

  // Draw legend
  const legendItemHeight = 22;
  const legendStartY = titleHeight + (height - titleHeight - data.length * legendItemHeight) / 2;

  data.forEach((item, index) => {
    const color = item.color || CHART_COLORS[index % CHART_COLORS.length];
    const legendY = legendStartY + index * legendItemHeight;

    ctx.fillStyle = color;
    ctx.fillRect(legendAreaX, legendY - 5, 12, 12);

    ctx.font = `11px ${FONT_FAMILY}, Arial, sans-serif`;
    ctx.fillStyle = '#525252';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const percent = Math.round((item.value / total) * 100);
    ctx.fillText(`${item.label}: ${item.value.toLocaleString()} (${percent}%)`, legendAreaX + 18, legendY + 1);
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        blob.arrayBuffer().then((buffer) => {
          resolve(new Uint8Array(buffer));
        });
      } else {
        reject(new Error('Failed to create blob from canvas'));
      }
    }, 'image/png');
  });
}

export function createChartParagraph(imageData: Uint8Array, width: number, height: number): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 240 },
    children: [
      new ImageRun({
        data: imageData,
        transformation: {
          width,
          height,
        },
        type: 'png',
      }),
    ],
  });
}
