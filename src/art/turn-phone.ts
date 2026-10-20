// The Turn card's art: a pixel phone turning a quarter turn upright (sideways → upright in 4 frames), with the Emberhollow bell on its
// screen and a brass arrow around it. Integer pixels only (each pixel is tested against the rotated phone), so it stays crisp under
// `image-rendering: pixelated` and is the same on every device.

/** One frame's size (scene px); the strip is TURN_FRAMES frames wide. */
export const TURN_SIZE = 48;
export const TURN_FRAMES = 4;
/** The phone's turn per frame (degrees from upright): sideways first, upright last. */
const ANGLES = [-90, -60, -30, 0];
const C = { ink: '#07120f', body: '#3d5648', rim: '#5b7966', screen: '#12231e', glow: '#1b6d68', bell: '#dcab44', bellHi: '#ffd978', arrow: '#b89d5c', arrowHi: '#f5deaa' };
// The phone in its own coordinates (upright, centred on 0,0): body 18×30, screen 14×22, the bell 6×7 in the middle of the screen.
const W = 9, H = 15, SW = 7, SH = 10;
const bell = (x: number, y: number) => {
  // a 6-wide bell: crown, shoulders, skirt, lip and clapper
  const rows: [number, number][] = [[-1, 1], [-2, 2], [-2, 2], [-3, 3], [-3, 3], [-4, 4]];
  const row = Math.floor(y + 4);
  if (row >= 0 && row < rows.length && x >= rows[row][0] && x < rows[row][1]) return row === 5 ? C.bellHi : x < 0 ? C.bellHi : C.bell;
  if (row === 6 && x >= -1 && x < 1) return C.bell;
  return undefined;
};
function phonePixel(lx: number, ly: number) {
  const ax = Math.abs(lx), ay = Math.abs(ly);
  if (ax > W || ay > H) return undefined;
  if (ax > W - 1 || ay > H - 1) return C.ink;
  if (ax > SW || ay > SH) return ly > SH + 1.5 && ax < 2 ? C.rim : ax > W - 2 || ay > H - 2 ? C.rim : C.body;
  return bell(lx, ly) ?? (ly < -SH + 3 ? C.glow : C.screen);
}
/** A quarter-circle arrow from the phone's top-right corner sweeping down to its right side (the way it turns), tip at the end. */
function arrowPixel(x: number, y: number) {
  const d = Math.hypot(x, y), a = Math.atan2(y, x) * 180 / Math.PI;
  if (d >= 19.5 && d < 21.5 && a > -80 && a < -12) return d < 20.5 ? C.arrowHi : C.arrow;
  return undefined;
}
/** The arrow's head under the arc's end (px from the frame's centre), pointing down. */
const TIP: [number, number][] = [[18, -4], [19, -4], [20, -4], [21, -4], [22, -4], [19, -3], [20, -3], [21, -3], [20, -2]];

/** The 4-frame strip (TURN_SIZE·4 × TURN_SIZE) as a canvas: frame f shows the phone turned ANGLES[f] degrees from upright. */
export function turnPhoneCanvas(): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = TURN_SIZE * TURN_FRAMES; el.height = TURN_SIZE;
  const c = el.getContext('2d', { willReadFrequently: true })!;
  c.imageSmoothingEnabled = false;
  const half = TURN_SIZE / 2;
  ANGLES.forEach((deg, f) => {
    const r = deg * Math.PI / 180, cos = Math.cos(r), sin = Math.sin(r);
    for (let py = 0; py < TURN_SIZE; py++) for (let px = 0; px < TURN_SIZE; px++) {
      const x = px - half + .5, y = py - half + .5;
      // inverse rotation: screen → the phone's own coordinates (frame 0: the phone lying on its left side, turning clockwise)
      const lx = x * cos + y * sin, ly = -x * sin + y * cos;
      const color = phonePixel(lx, ly) ?? (f === TURN_FRAMES - 1 ? undefined : arrowPixel(x, y));
      if (color) { c.fillStyle = color; c.fillRect(f * TURN_SIZE + px, py, 1, 1); }
    }
    if (f < TURN_FRAMES - 1) for (const [x, y] of TIP) { c.fillStyle = C.arrowHi; c.fillRect(f * TURN_SIZE + half + x, half + y, 1, 1); }
  });
  return el;
}
let stripURL = '';
/** The strip as a data URL, drawn once. */
export const turnPhoneURL = () => stripURL ||= turnPhoneCanvas().toDataURL();
