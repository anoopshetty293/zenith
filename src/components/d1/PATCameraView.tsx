import React, { useRef, useEffect, useCallback } from 'react';
import { useSimStore } from '../../store/simulationStore';
import { TrackingStatus } from '../../types/links';

const CANVAS_W = 280;
const CANVAS_H = 280;
const CENTER_X = CANVAS_W / 2;
const CENTER_Y = CANVAS_H / 2;
const FOV_RADIUS = 110;

function fovToCanvas(n: number, size: number): number {
  return size / 2 + n * (size / 2 - 20);
}

interface StatusStyle {
  color: string;
  glow: string;
  label: string;
}

function statusStyle(s: TrackingStatus): StatusStyle {
  switch (s) {
    case 'LOCKED': return { color: '#22c55e', glow: 'rgba(34,197,94,0.6)', label: 'LOCKED' };
    case 'ACQUIRING': return { color: '#06b6d4', glow: 'rgba(6,182,212,0.6)', label: 'ACQUIRING' };
    case 'DEGRADED': return { color: '#fbbf24', glow: 'rgba(251,191,36,0.6)', label: 'DEGRADED' };
    case 'LOST': return { color: '#ef4444', glow: 'rgba(239,68,68,0.6)', label: 'LOST' };
  }
}

function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = 'rgba(6,182,212,0.055)';
  ctx.lineWidth = 0.5;
  const step = 20;
  for (let x = 0; x <= CANVAS_W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke(); }
  for (let y = 0; y <= CANVAS_H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke(); }
}


interface Box { x: number; y: number; w: number; h: number }
const hit = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Pick the first label position around an anchor that stays in-canvas and clear of `avoid`. */
function placeLabel(ctx: CanvasRenderingContext2D, text: string, ax: number, ay: number, r: number, avoid: Box[]): Box {
  const w = ctx.measureText(text).width + 6;
  const h = 11;
  const clamp = (b: Box): Box => ({ ...b, x: Math.max(4, Math.min(CANVAS_W - w - 4, b.x)), y: Math.max(4, Math.min(CANVAS_H - h - 4, b.y)) });
  const candidates: Box[] = [
    { x: ax + r, y: ay - r - h, w, h },          // up-right
    { x: ax + r, y: ay + r, w, h },              // down-right
    { x: ax - r - w, y: ay - r - h, w, h },      // up-left
    { x: ax - r - w, y: ay + r, w, h },          // down-left
    { x: ax - w / 2, y: ay - r - h - 2, w, h },  // above
    { x: ax - w / 2, y: ay + r + 2, w, h },      // below
  ].map(clamp);
  return candidates.find(c => !avoid.some(a => hit(c, a))) ?? candidates[0];
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, b: Box, color: string) {
  ctx.fillStyle = 'rgba(8,13,24,0.78)';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = color;
  ctx.fillText(text, b.x + 3, b.y + 8.5);
}

const PATCameraView: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const patState = useSimStore(s => s.d1.patState);
  const patStateRef = useRef(patState);
  const beaconTrailRef = useRef<Array<{ x: number; y: number }>>([]);

  useEffect(() => { patStateRef.current = patState; }, [patState]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pat = patStateRef.current;
    const ss = statusStyle(pat.trackingStatus);
    const camX = fovToCanvas(pat.cameraCenterX, CANVAS_W);
    const camY = fovToCanvas(pat.cameraCenterY, CANVAS_H);
    const beaconX = fovToCanvas(pat.beaconX, CANVAS_W);
    const beaconY = fovToCanvas(pat.beaconY, CANVAS_H);

    const last = beaconTrailRef.current[beaconTrailRef.current.length - 1];
    if (!last || Math.hypot(last.x - beaconX, last.y - beaconY) > 0.6) beaconTrailRef.current.push({ x: beaconX, y: beaconY });
    if (beaconTrailRef.current.length > 10) beaconTrailRef.current.shift();

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (canvas.width !== CANVAS_W * dpr) { canvas.width = CANVAS_W * dpr; canvas.height = CANVAS_H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#080d18';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawGrid(ctx);

    // FOV boundary and center rings
    ctx.beginPath(); ctx.arc(CENTER_X, CENTER_Y, FOV_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(6,182,212,0.22)'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(CENTER_X, CENTER_Y, FOV_RADIUS * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(6,182,212,0.07)'; ctx.lineWidth = 0.7; ctx.stroke();

    // Small beacon motion trail: enough to show motion without turning the view into a mesh.
    if (beaconTrailRef.current.length > 1 && pat.acquisitionMode === 'MOVING_BEACON') {
      ctx.beginPath();
      beaconTrailRef.current.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = 'rgba(34,197,94,0.28)'; ctx.lineWidth = 1.2; ctx.stroke();
    }

    // Pointing error vector — the most important visual relationship.
    if (pat.trackingStatus !== 'LOST') {
      ctx.beginPath(); ctx.moveTo(camX, camY); ctx.lineTo(beaconX, beaconY);
      ctx.strokeStyle = ss.color + 'aa'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
      const angle = Math.atan2(beaconY - camY, beaconX - camX);
      const ah = 6;
      ctx.beginPath();
      ctx.moveTo(beaconX, beaconY);
      ctx.lineTo(beaconX - ah * Math.cos(angle - 0.5), beaconY - ah * Math.sin(angle - 0.5));
      ctx.lineTo(beaconX - ah * Math.cos(angle + 0.5), beaconY - ah * Math.sin(angle + 0.5));
      ctx.closePath(); ctx.fillStyle = ss.color; ctx.fill();
    }

    // Camera center and current gimbal orientation.
    ctx.save();
    ctx.translate(camX, camY);
    ctx.rotate((pat.cameraAngleDeg * Math.PI) / 180);
    ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(13, 0); ctx.moveTo(0, -13); ctx.lineTo(0, 13); ctx.stroke();
    ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(29, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(29, 0); ctx.lineTo(22, -4); ctx.lineTo(22, 4); ctx.closePath(); ctx.fillStyle = '#a78bfa'; ctx.fill();
    // Narrow optical cone: direction, not lens focus.
    ctx.beginPath(); ctx.moveTo(5, 0); ctx.arc(5, 0, 54, -0.19, 0.19); ctx.closePath();
    ctx.fillStyle = 'rgba(167,139,250,0.055)'; ctx.fill();
    ctx.restore();

    // Camera center marker.
    ctx.beginPath(); ctx.arc(camX, camY, 18, 0, Math.PI * 2);
    ctx.strokeStyle = pat.gimbalRateDegS > 4 ? '#a78bfa' : 'rgba(167,139,250,0.3)';
    ctx.lineWidth = pat.gimbalRateDegS > 4 ? 2 : 1; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(camX, camY, 3, 0, Math.PI * 2); ctx.fillStyle = '#06b6d4'; ctx.fill();

    // Beacon.
    if (pat.trackingStatus !== 'LOST') {
      const beaconGrad = ctx.createRadialGradient(beaconX, beaconY, 0, beaconX, beaconY, 18);
      beaconGrad.addColorStop(0, ss.glow); beaconGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = beaconGrad; ctx.beginPath(); ctx.arc(beaconX, beaconY, 18, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(beaconX, beaconY, 5, 0, Math.PI * 2);
      ctx.fillStyle = ss.color; ctx.shadowColor = ss.glow; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
    } else {
      const now = Date.now();
      if (Math.floor(now / 400) % 2 === 0) {
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(beaconX - 7, beaconY - 7); ctx.lineTo(beaconX + 7, beaconY + 7); ctx.moveTo(beaconX + 7, beaconY - 7); ctx.lineTo(beaconX - 7, beaconY + 7); ctx.stroke();
      }
    }

    // Direct labels, placed so they never sit on each other, on the markers or on the corner chips.
    ctx.font = '8px monospace';
    const chips: Box[] = [
      { x: 7, y: 7, w: 84, h: 19 },
      { x: 7, y: CANVAS_H - 28, w: 112, h: 19 },
    ];
    const beaconBox: Box = { x: beaconX - 14, y: beaconY - 14, w: 28, h: 28 };
    const camLabel = placeLabel(ctx, 'CAMERA AXIS', camX, camY, 22, [...chips, beaconBox]);
    const beaconText = pat.trackingStatus === 'LOST' ? 'LAST BEACON' : 'BEACON';
    const beaconLabel = placeLabel(ctx, beaconText, beaconX, beaconY, 14, [...chips, camLabel]);
    drawLabel(ctx, 'CAMERA AXIS', camLabel, '#67e8f9');
    drawLabel(ctx, beaconText, beaconLabel, ss.color);
    ctx.fillStyle = 'rgba(148,163,184,0.6)'; ctx.fillText('FOV', CENTER_X + FOV_RADIUS + 4, CENTER_Y + 3);

    // Compact status chip.
    ctx.fillStyle = 'rgba(8,13,24,0.88)'; ctx.fillRect(7, 7, 84, 19);
    ctx.fillStyle = ss.color; ctx.font = 'bold 10px monospace'; ctx.fillText(`● ${ss.label}`, 11, 20);

    // Only the two visual cues that matter most inside the canvas.
    ctx.fillStyle = 'rgba(8,13,24,0.88)'; ctx.fillRect(7, CANVAS_H - 28, 112, 19);
    ctx.fillStyle = '#cbd5e1'; ctx.font = '9px monospace'; ctx.fillText(`ERROR ${pat.pointingErrorUrad.toFixed(0)} μrad`, 11, CANVAS_H - 15);

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <div className="w-full min-w-0 bg-fsoc-panel border border-fsoc-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-fsoc-cyan uppercase tracking-widest">PAT Camera View</span>
        <span className="text-[9px] font-mono text-fsoc-dim">Live optical tracking</span>
      </div>
      <div className="h-px bg-fsoc-border/60" />
      <div className="flex justify-center">
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="block h-auto w-full max-w-[280px] rounded border border-fsoc-border/40" style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }} />
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-[9px] font-mono text-fsoc-dim">
        <div className="flex items-center gap-1 whitespace-nowrap"><span className="text-fsoc-cyan">✛</span> Camera axis</div>
        <div className="flex items-center gap-1 whitespace-nowrap"><span className="text-fsoc-green">●</span> Beacon</div>
        <div className="flex items-center gap-1 whitespace-nowrap"><span className="text-fsoc-cyan">↝</span> Pointing error</div>
      </div>
    </div>
  );
};

export default PATCameraView;
