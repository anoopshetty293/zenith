import { useEffect, useRef } from 'react';
import { useSimStore } from '../../store/simulationStore';
import clsx from 'clsx';

const CANVAS_SIZE = 250;
const CX = CANVAS_SIZE / 2;
const CY = CANVAS_SIZE / 2;
const FOV_RADIUS = CANVAS_SIZE * 0.44;

export default function SpacePATView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      const { patState, primaryLink } = useSimStore.getState().d2;
      const { beaconX, beaconY, cameraCenterX, cameraCenterY, pointingErrorUrad, trackingStatus, detectionConfidence } = patState;

      ctx!.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Background
      ctx!.fillStyle = '#030811';
      ctx!.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Grid
      ctx!.strokeStyle = '#0a1628';
      ctx!.lineWidth = 0.5;
      for (let i = 1; i < 8; i++) {
        const x = (i / 8) * CANVAS_SIZE;
        const y = (i / 8) * CANVAS_SIZE;
        ctx!.beginPath(); ctx!.moveTo(x, 0); ctx!.lineTo(x, CANVAS_SIZE); ctx!.stroke();
        ctx!.beginPath(); ctx!.moveTo(0, y); ctx!.lineTo(CANVAS_SIZE, y); ctx!.stroke();
      }

      // FOV boundary circle
      const fovColor = trackingStatus === 'LOCKED' ? '#00ff88' :
        trackingStatus === 'ACQUIRING' ? '#4488ff' :
        trackingStatus === 'DEGRADED' ? '#ffb300' : '#ff3333';

      ctx!.strokeStyle = fovColor;
      ctx!.lineWidth = 1.5;
      ctx!.globalAlpha = 0.4;
      ctx!.setLineDash([4, 4]);
      ctx!.beginPath();
      ctx!.arc(CX, CY, FOV_RADIUS, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.setLineDash([]);
      ctx!.globalAlpha = 1;

      // Convert normalized [-1,1] coords to canvas coords
      function toCanvasX(nx: number) { return CX + nx * FOV_RADIUS; }
      function toCanvasY(ny: number) { return CY + ny * FOV_RADIUS; }

      const camPx = toCanvasX(cameraCenterX);
      const camPy = toCanvasY(cameraCenterY);
      const beaconPx = toCanvasX(beaconX);
      const beaconPy = toCanvasY(beaconY);

      // Crosshair at camera center
      ctx!.strokeStyle = '#1a3a5a';
      ctx!.lineWidth = 0.75;
      ctx!.beginPath(); ctx!.moveTo(camPx - 20, camPy); ctx!.lineTo(camPx + 20, camPy); ctx!.stroke();
      ctx!.beginPath(); ctx!.moveTo(camPx, camPy - 20); ctx!.lineTo(camPx, camPy + 20); ctx!.stroke();

      // Pointing error line
      ctx!.strokeStyle = '#ff6600';
      ctx!.lineWidth = 1;
      ctx!.globalAlpha = 0.7;
      ctx!.setLineDash([3, 3]);
      ctx!.beginPath();
      ctx!.moveTo(camPx, camPy);
      ctx!.lineTo(beaconPx, beaconPy);
      ctx!.stroke();
      ctx!.setLineDash([]);
      ctx!.globalAlpha = 1;

      // Beacon glow
      const beaconAlpha = detectionConfidence;
      if (beaconAlpha > 0.05) {
        const beaconGrad = ctx!.createRadialGradient(beaconPx, beaconPy, 1, beaconPx, beaconPy, 12);
        beaconGrad.addColorStop(0, `rgba(0, 212, 255, ${beaconAlpha})`);
        beaconGrad.addColorStop(1, 'rgba(0, 212, 255, 0)');
        ctx!.fillStyle = beaconGrad;
        ctx!.beginPath();
        ctx!.arc(beaconPx, beaconPy, 12, 0, Math.PI * 2);
        ctx!.fill();

        ctx!.fillStyle = `rgba(0, 212, 255, ${Math.min(1, beaconAlpha + 0.3)})`;
        ctx!.beginPath();
        ctx!.arc(beaconPx, beaconPy, 3, 0, Math.PI * 2);
        ctx!.fill();
      }

      // Camera center marker
      ctx!.strokeStyle = fovColor;
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      ctx!.moveTo(camPx - 8, camPy); ctx!.lineTo(camPx + 8, camPy);
      ctx!.moveTo(camPx, camPy - 8); ctx!.lineTo(camPx, camPy + 8);
      ctx!.stroke();

      // Overlays
      ctx!.fillStyle = fovColor;
      ctx!.font = 'bold 9px monospace';
      ctx!.fillText(trackingStatus, 6, 16);

      ctx!.fillStyle = '#8899aa';
      ctx!.font = '8px monospace';
      ctx!.fillText(`${pointingErrorUrad.toFixed(1)} μrad`, 6, 27);
      ctx!.fillText(`Conf: ${(detectionConfidence * 100).toFixed(0)}%`, 6, 38);

      // Elevation angle
      const el = primaryLink?.elevationDeg;
      if (el !== null && el !== undefined) {
        ctx!.fillText(`El: ${el.toFixed(1)}°`, 6, CANVAS_SIZE - 8);
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="flex-shrink-0">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="rounded border border-fsoc-border"
        style={{ background: '#030811' }}
      />
    </div>
  );
}
