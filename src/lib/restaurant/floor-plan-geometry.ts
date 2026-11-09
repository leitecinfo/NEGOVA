import type { Point2D, RoomShapePreset } from "./types";

/**
 * Distancia euclidiana entre dos puntos.
 */
export function distance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Distancia perpendicular de un punto a un segmento de recta.
 */
function perpendicularDistance(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lineLenSq = dx * dx + dy * dy;

  if (lineLenSq === 0) {
    return distance(point, lineStart);
  }

  // Proyección escalar
  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLenSq));
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  return distance(point, { x: projX, y: projY });
}

/**
 * Algoritmo Ramer-Douglas-Peucker (RDP) para simplificar trazos a mano alzada.
 * Elimina las pequeñas irregularidades y jitter del trazo del usuario.
 */
export function ramerDouglasPeucker(points: Point2D[], epsilon: number = 3.5): Point2D[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = ramerDouglasPeucker(points.slice(0, index + 1), epsilon);
    const right = ramerDouglasPeucker(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  } else {
    return [points[0], points[end]];
  }
}

/**
 * Ajusta un punto para que el segmento forme una línea perfectamente recta:
 * - Horizontal (0° o 180°)
 * - Vertical (90° o 270°)
 * - Diagonal (45°, 135°, etc.) si el ángulo es cercano
 */
export function snapToOrthogonalAngle(origin: Point2D, target: Point2D, snapAngleToleranceDeg: number = 22.5): Point2D {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1) return target;

  let angleRad = Math.atan2(dy, dx);
  let angleDeg = (angleRad * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;

  // Snaps preferentes: 0, 90, 180, 270 (horizontal / vertical)
  const cardinalAngles = [0, 90, 180, 270, 360];
  for (const card of cardinalAngles) {
    const diff = Math.abs(angleDeg - card);
    if (diff <= snapAngleToleranceDeg || Math.abs(diff - 360) <= snapAngleToleranceDeg) {
      const snappedRad = (card * Math.PI) / 180;
      return {
        x: Math.round((origin.x + dist * Math.cos(snappedRad)) * 10) / 10,
        y: Math.round((origin.y + dist * Math.sin(snappedRad)) * 10) / 10,
      };
    }
  }

  // Snaps secundarios diagonales (45, 135, 225, 315)
  const diagonalAngles = [45, 135, 225, 315];
  for (const diag of diagonalAngles) {
    if (Math.abs(angleDeg - diag) <= snapAngleToleranceDeg * 0.7) {
      const snappedRad = (diag * Math.PI) / 180;
      return {
        x: Math.round((origin.x + dist * Math.cos(snappedRad)) * 10) / 10,
        y: Math.round((origin.y + dist * Math.sin(snappedRad)) * 10) / 10,
      };
    }
  }

  return target;
}

/**
 * Ajuste a cuadrícula (Grid Snap).
 */
export function snapToGrid(point: Point2D, gridSize: number = 2.5): Point2D {
  return {
    x: Math.max(4, Math.min(96, Math.round(point.x / gridSize) * gridSize)),
    y: Math.max(4, Math.min(96, Math.round(point.y / gridSize) * gridSize)),
  };
}

/**
 * Toma una serie de puntos trazados a mano alzada por el usuario y los convierte
 * en un polígono arquitectónico de paredes rectas perfectamente alineadas.
 */
export function processHandDrawnStroke(
  rawPoints: Point2D[],
  closeThreshold: number = 7.5
): Point2D[] {
  if (rawPoints.length < 3) return rawPoints;

  // 1. Simplificación con Douglas-Peucker
  const simplified = ramerDouglasPeucker(rawPoints, 3.5);
  if (simplified.length < 3) return simplified;

  // 2. Si el inicio y el fin están cerca, cerrar el polígono
  const isNearStart = distance(simplified[0], simplified[simplified.length - 1]) <= closeThreshold;
  const working = [...simplified];
  if (isNearStart) {
    working[working.length - 1] = { ...working[0] };
  }

  // 3. Rectificar cada arista para que sea ortogonal (líneas rectas)
  const result: Point2D[] = [snapToGrid(working[0])];

  for (let i = 1; i < working.length; i++) {
    const prev = result[i - 1];
    let curr = working[i];

    if (isNearStart && i === working.length - 1) {
      // El último punto se une al primero
      result.push({ ...result[0] });
    } else {
      const ortho = snapToOrthogonalAngle(prev, curr);
      result.push(snapToGrid(ortho));
    }
  }

  // 4. Limpiar vértices redundantes que estén en la misma línea
  const cleaned: Point2D[] = [];
  for (let i = 0; i < result.length; i++) {
    const prev = cleaned[cleaned.length - 1];
    const curr = result[i];
    const next = result[(i + 1) % result.length];

    if (!prev) {
      cleaned.push(curr);
      continue;
    }

    if (distance(prev, curr) < 1.5) {
      continue; // Muy cerca
    }

    cleaned.push(curr);
  }

  return cleaned.length >= 3 ? cleaned : working;
}

/**
 * Obtiene el polígono predeterminado de un preset de sala.
 */
export function getPresetPolygon(preset: RoomShapePreset): Point2D[] {
  switch (preset) {
    case "square":
      return [
        { x: 18, y: 12 },
        { x: 82, y: 12 },
        { x: 82, y: 88 },
        { x: 18, y: 88 },
      ];
    case "l_shape":
      return [
        { x: 10, y: 10 },
        { x: 55, y: 10 },
        { x: 55, y: 52 },
        { x: 90, y: 52 },
        { x: 90, y: 90 },
        { x: 10, y: 90 },
      ];
    case "terrace":
      return [
        { x: 8, y: 10 },
        { x: 92, y: 10 },
        { x: 92, y: 90 },
        { x: 8, y: 90 },
      ];
    case "rectangle":
    default:
      return [
        { x: 8, y: 10 },
        { x: 92, y: 10 },
        { x: 92, y: 90 },
        { x: 8, y: 90 },
      ];
  }
}

/**
 * Convierte un arreglo de vértices en un string path SVG (d="M x y L x y Z").
 */
export function polygonToSvgPath(points: Point2D[], width: number, height: number): string {
  if (!points || points.length === 0) return "";
  const toPx = (p: Point2D) => `${(p.x * width) / 100},${(p.y * height) / 100}`;

  return `M ${toPx(points[0])} ` + points.slice(1).map((p) => `L ${toPx(p)}`).join(" ") + " Z";
}
