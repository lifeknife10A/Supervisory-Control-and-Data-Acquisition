import * as THREE from 'three';

export interface WireRoutingOptions {
  wireId?: string;
  cornerRadius?: number;
  isFromBreadboard?: boolean;
  isToBreadboard?: boolean;
  fromType?: string;
  toType?: string;
  fromPinId?: string;
  toPinId?: string;
}

/**
 * Deterministic hash from string for wire layering
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Builds masterwork breadboard 3D orthogonal wiring (Manhattan routing).
 * Features:
 * - Low-profile routing laying FLAT against the breadboard surface.
 * - Zero sag: strictly dead-straight Cartesian segments (parallel to X, Y, or Z).
 * - Strictly 90-degree bends with tight wire-plier filleted elbows (7mm radius).
 * - Layered clearance tiers (8mm steps) for neat bridge-over crossings.
 * - Pin clearance fan-out: leaves multi-pin headers perpendicular to avoid slicing through neighboring pins.
 * - Clean direct hole insertion on breadboards without bulky Dupont sleeves.
 */
export function buildOrthogonalWireCurve(
  pA: THREE.Vector3,
  pB: THREE.Vector3,
  options: WireRoutingOptions = {}
): { curve: THREE.Curve<THREE.Vector3>; midPoint: THREE.Vector3 } {
  const cornerRadius = options.cornerRadius ?? 0.012;

  // Breadboard surface elevation is at Y = 0.105
  // For breadboard holes, wire starts/ends directly at surface hole
  // For external modules (ESP32, sensors), wire emerges from Dupont collar (+0.042 above pin)
  const isFromBB = options.isFromBreadboard ?? (Math.abs(pA.y - 0.105) < 0.015);
  const isToBB = options.isToBreadboard ?? (Math.abs(pB.y - 0.105) < 0.015);

  const startPt = isFromBB
    ? new THREE.Vector3(pA.x, 0.105, pA.z)
    : pA.clone().add(new THREE.Vector3(0, 0.042, 0));

  const endPt = isToBB
    ? new THREE.Vector3(pB.x, 0.105, pB.z)
    : pB.clone().add(new THREE.Vector3(0, 0.042, 0));

  const dx = endPt.x - startPt.x;
  const dz = endPt.z - startPt.z;

  // Deterministic layer tier (0 to 4) for neat bridge-over crossing clearance
  const wireHash = hashString(options.wireId || `${startPt.x},${startPt.z}->${endPt.x},${endPt.z}`);
  const tier = wireHash % 5;
  const tierOffset = tier * 0.008; // 8mm steps between bridge layers

  // Flat low-profile routing elevation:
  // Base wire sits just 11mm above breadboard face (Y = 0.116m)
  const baseElevation = Math.max(startPt.y, endPt.y, 0.108) + 0.008;
  const yRoute = baseElevation + tierOffset;

  // Build raw orthogonal waypoints (strictly 90 degrees in X, Y, Z)
  const waypoints: THREE.Vector3[] = [startPt];

  // Determine pin row escape requirements:
  // Modules with pins aligned along X (like DS18B20 or MQ2) must escape along Z
  // to avoid slicing through adjacent pins on the same header row.
  const startNeedsZEscape =
    options.fromType === 'ds18b20' ||
    options.fromType === 'mq2' ||
    options.fromType === 'hc_sr04' ||
    (!isFromBB && Math.abs(dx) >= Math.abs(dz) && Math.abs(dz) > 0.03 && Math.abs(dx) > 0.02);

  const endNeedsXEscape =
    options.toType === 'esp32' ||
    options.toType === 'acs712';

  if (startNeedsZEscape) {
    // Step perpendicular along Z into clearance corridor immediately from collar
    // so the vertical rise happens in the corridor, keeping sensor leads completely unobstructed
    const zDir = dz >= 0 ? 1 : -1;
    const zClearStart = startPt.z + zDir * Math.min(Math.abs(dz), 0.042);
    waypoints.push(new THREE.Vector3(startPt.x, startPt.y, zClearStart));
    waypoints.push(new THREE.Vector3(startPt.x, yRoute, zClearStart));

    if (endNeedsXEscape) {
      // Approach ESP32 / module pin perpendicular along X
      const xClearEnd = endPt.x + (startPt.x >= endPt.x ? 0.038 : -0.038);
      waypoints.push(new THREE.Vector3(xClearEnd, yRoute, zClearStart));
      waypoints.push(new THREE.Vector3(xClearEnd, yRoute, endPt.z));
      waypoints.push(new THREE.Vector3(endPt.x, yRoute, endPt.z));
    } else {
      // Traverse laterally along X at zClearStart corridor, then turn into endPt.z
      waypoints.push(new THREE.Vector3(endPt.x, yRoute, zClearStart));
      waypoints.push(new THREE.Vector3(endPt.x, yRoute, endPt.z));
    }
  } else {
    // Standard orthogonal routing
    waypoints.push(new THREE.Vector3(startPt.x, yRoute, startPt.z));

    if (Math.abs(dx) >= Math.abs(dz)) {
      if (Math.abs(dx) > 0.003) {
        waypoints.push(new THREE.Vector3(endPt.x, yRoute, startPt.z));
      }
      if (Math.abs(dz) > 0.003) {
        waypoints.push(new THREE.Vector3(endPt.x, yRoute, endPt.z));
      }
    } else {
      if (Math.abs(dz) > 0.003) {
        waypoints.push(new THREE.Vector3(startPt.x, yRoute, endPt.z));
      }
      if (Math.abs(dx) > 0.003) {
        waypoints.push(new THREE.Vector3(endPt.x, yRoute, endPt.z));
      }
    }
  }

  // Ensure waypoint directly above destination pin before vertical drop
  waypoints.push(new THREE.Vector3(endPt.x, yRoute, endPt.z));
  // Pure vertical descent along -Y into destination pin/hole
  waypoints.push(endPt);

  // Deduplicate consecutive collinear/identical waypoints
  const cleanWaypoints: THREE.Vector3[] = [waypoints[0]];
  for (let i = 1; i < waypoints.length; i++) {
    if (waypoints[i].distanceTo(cleanWaypoints[cleanWaypoints.length - 1]) > 0.002) {
      cleanWaypoints.push(waypoints[i]);
    }
  }

  // Fallback for extremely close points
  if (cleanWaypoints.length < 2) {
    const directLine = new THREE.LineCurve3(startPt, endPt);
    return {
      curve: directLine,
      midPoint: new THREE.Vector3().addVectors(startPt, endPt).multiplyScalar(0.5),
    };
  }

  // Build 3D CurvePath with straight segments and tight 90-degree filleted corners
  const path = new THREE.CurvePath<THREE.Vector3>();
  let currentPos = cleanWaypoints[0];

  for (let i = 1; i < cleanWaypoints.length - 1; i++) {
    const prev = cleanWaypoints[i - 1];
    const curr = cleanWaypoints[i];
    const next = cleanWaypoints[i + 1];

    const dIn = new THREE.Vector3().subVectors(curr, prev);
    const dOut = new THREE.Vector3().subVectors(next, curr);
    const lIn = dIn.length();
    const lOut = dOut.length();

    dIn.normalize();
    dOut.normalize();

    // Corner radius clamped to 42% of adjacent segment lengths
    const r = Math.min(cornerRadius, lIn * 0.42, lOut * 0.42);
    const cStart = curr.clone().sub(dIn.clone().multiplyScalar(r));
    const cEnd = curr.clone().add(dOut.clone().multiplyScalar(r));

    if (currentPos.distanceTo(cStart) > 0.0005) {
      path.add(new THREE.LineCurve3(currentPos, cStart));
    }
    // Crisp 90-degree filleted bend
    path.add(new THREE.QuadraticBezierCurve3(cStart, curr, cEnd));
    currentPos = cEnd;
  }

  // Final straight segment descending vertically into endPt
  const lastPoint = cleanWaypoints[cleanWaypoints.length - 1];
  if (currentPos.distanceTo(lastPoint) > 0.0005) {
    path.add(new THREE.LineCurve3(currentPos, lastPoint));
  }

  // Midpoint for hover tooltip (centered on the horizontal run)
  const midPoint = new THREE.Vector3(
    (startPt.x + endPt.x) * 0.5,
    yRoute,
    (startPt.z + endPt.z) * 0.5
  );

  return { curve: path, midPoint };
}

/**
 * Universal wire curve builder (100% strict orthogonal Manhattan routing, zero sag)
 */
export function buildWireCurve(
  pA: THREE.Vector3,
  pB: THREE.Vector3,
  options: WireRoutingOptions = {}
): { curve: THREE.Curve<THREE.Vector3>; midPoint: THREE.Vector3 } {
  return buildOrthogonalWireCurve(pA, pB, options);
}
