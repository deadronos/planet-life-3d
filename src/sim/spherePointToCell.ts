import * as THREE from 'three';

export function spherePointToCell(
  point: THREE.Vector3,
  latCells: number,
  lonCells: number,
): { lat: number; lon: number } {
  const n = point.clone().normalize();
  const latRad = Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)); // [-pi/2..pi/2]
  const lonRad = Math.atan2(n.z, n.x); // [-pi..pi]
  const latT = (latRad + Math.PI / 2) / Math.PI;
  const lonT = (lonRad + Math.PI) / (Math.PI * 2);

  const lat = Math.round(latT * (latCells - 1));
  const lon = ((Math.round(lonT * lonCells) % lonCells) + lonCells) % lonCells;
  return { lat, lon };
}
