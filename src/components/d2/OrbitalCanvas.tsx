/** Dashboard 2 orbital scene: stylized 3D Earth, visible orbital tracks, objects and live disturbance overlays. */
import { useEffect, useRef } from 'react';
import { useSimStore } from '../../store/simulationStore';

const W = 760, H = 500, CX = W / 2, CY = H / 2 + 8, ER = 112;
const STARS = Array.from({ length: 190 }, (_, i) => {
  const n = (i * 2654435761) >>> 0;
  return { x: n % W, y: ((n * 1234567) >>> 0) % H, r: .45 + (i % 4) * .3, a: .25 + (i % 6) * .1 };
});
const orbitR = (altitude: number) => ER + 24 + Math.max(0, altitude) * .075;
/**
 * Per-object squash factor: a stylized stand-in for the orbital-plane tilt so
 * different inclinations read as visibly different ellipses rather than one
 * generic squash for every orbit. Equatorial (0°) reads flatter/edge-on;
 * polar (90°) reads rounder/more face-on.
 */
const inclinationSquash = (inclinationDeg: number) => 0.32 + 0.46 * Math.sin(Math.min(90, Math.abs(inclinationDeg)) * Math.PI / 180);
const point = (angle: number, radius: number, squash = .72) => ({ x: CX + Math.cos(angle) * radius, y: CY + Math.sin(angle) * radius * squash });

interface LabelBox { x: number; y: number; w: number; h: number; text: string; color: string; sub?: string }

/** Greedy label-collision pass: nudges a label down until it clears everything placed before it. */
function placeLabel(placed: LabelBox[], x: number, y: number, text: string, color: string, sub?: string): LabelBox {
  const w = Math.max(text.length, (sub?.length ?? 0)) * 5.6 + 8;
  const h = sub ? 24 : 12;
  let ly = y;
  for (let iter = 0; iter < 6; iter++) {
    const box = { x, y: ly, w, h, text, color, sub };
    const overlap = placed.some(p => Math.abs(p.x - box.x) < (p.w + box.w) / 2.1 && Math.abs(p.y - box.y) < (p.h + box.h) / 1.6);
    if (!overlap) return box;
    ly += 15;
  }
  return { x, y: ly, w, h, text, color, sub };
}

export default function OrbitalCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const dashRef = useRef(0);
  const rotationRef = useRef(0);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const draw = () => {
      const { d2 } = useSimStore.getState();
      const { satellites, debris, groundStations, primaryLink, activeDisturbances, linkType, activeRoute } = d2;
      rotationRef.current += 0.003;
      const rotation = rotationRef.current;
      const landShift = Math.sin(rotation) * 42;
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#050b18'); bg.addColorStop(1, '#020611');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      for (const s of STARS) { ctx.globalAlpha = s.a; ctx.fillStyle = '#e4f4ff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;

      // Orbital trajectories, each squashed per its own inclination so distinct
      // orbital planes are visually distinguishable rather than identical rings.
      const satSquash = satellites.map(sat => inclinationSquash(sat.inclinationDeg));
      satellites.forEach((sat, i) => {
        const r = orbitR(sat.altitudeKm) + i * 8;
        ctx.save(); ctx.strokeStyle = i === 0 ? '#167ce8' : '#19b6d2'; ctx.globalAlpha = .48; ctx.lineWidth = 1.2; ctx.setLineDash([5, 7]);
        ctx.beginPath(); ctx.ellipse(CX, CY, r, r * satSquash[i], 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      });
      debris.forEach((d, i) => {
        const r = orbitR(d.altitudeKm) + 12 + i * 4;
        ctx.save(); ctx.strokeStyle = d.riskLevel === 'high' ? '#ff5757' : d.riskLevel === 'medium' ? '#ffb43b' : '#8492a6'; ctx.globalAlpha = .22; ctx.setLineDash([3, 8]);
        ctx.beginPath(); ctx.ellipse(CX, CY, r, r * .68, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      });

      // Atmosphere halo and dimensional globe shading.
      const halo = ctx.createRadialGradient(CX, CY, ER * .88, CX, CY, ER + 30);
      halo.addColorStop(0, 'rgba(27,156,255,.34)'); halo.addColorStop(.72, 'rgba(20,126,235,.18)'); halo.addColorStop(1, 'rgba(0,80,180,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(CX, CY, ER + 30, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(CX, CY, ER, 0, Math.PI * 2); ctx.clip();
      const globe = ctx.createRadialGradient(CX - 42, CY - 48, 8, CX + 25, CY + 18, ER * 1.2);
      globe.addColorStop(0, '#3c9ee0'); globe.addColorStop(.35, '#15558b'); globe.addColorStop(.72, '#082747'); globe.addColorStop(1, '#020915');
      ctx.fillStyle = globe; ctx.fillRect(CX - ER, CY - ER, ER * 2, ER * 2);
      // More recognizable, softly shaded continent silhouettes; clipped to the spherical globe.
      const landGradient = ctx.createLinearGradient(CX - ER, CY - ER, CX + ER, CY + ER);
      landGradient.addColorStop(0, '#72a878'); landGradient.addColorStop(.55, '#397c63'); landGradient.addColorStop(1, '#1e514b');
      ctx.fillStyle = landGradient; ctx.globalAlpha = .94;
      const land = [
        // North America
        [[-92,-62],[-73,-76],[-52,-67],[-38,-48],[-48,-31],[-62,-27],[-67,-8],[-82,4],[-91,-16],[-103,-33]],
        // South America
        [[-62,4],[-42,12],[-35,34],[-45,61],[-55,88],[-67,61],[-73,31]],
        // Europe and northern Africa
        [[-20,-52],[-3,-62],[16,-55],[25,-39],[12,-27],[-2,-30],[-8,-14],[-19,-19]],
        [[-13,-12],[13,-18],[32,-4],[27,24],[16,55],[3,72],[-8,43],[-18,12]],
        // Asia
        [[20,-61],[48,-73],[79,-58],[101,-35],[91,-16],[72,-11],[59,3],[39,-8],[27,-28]],
        // India and Southeast Asia
        [[36,-7],[54,-1],[62,19],[50,39],[40,18]],
        // Australia
        [[63,45],[87,39],[98,54],[88,72],[68,67],[58,55]],
        // Greenland
        [[-55,-94],[-36,-86],[-39,-68],[-54,-61],[-66,-76]],
      ];
      const spin = rotation * .32;
      land.forEach(poly => {
        ctx.beginPath();
        poly.forEach(([x,y],j) => {
          const rotatedX = x * Math.cos(spin) - y * Math.sin(spin) * .12 + landShift * .35;
          const px = CX + rotatedX;
          const py = CY + y;
          j ? ctx.lineTo(px,py) : ctx.moveTo(px,py);
        });
        ctx.closePath(); ctx.fill();
      });
      // Fine ocean texture and drifting cloud bands add depth without obscuring map detail.
      ctx.globalAlpha = .16; ctx.fillStyle = '#9bdcff';
      for (let i = 0; i < 95; i++) {
        const nx = ((i * 47) % 210) - 105, ny = ((i * 83) % 210) - 105;
        if (nx * nx + ny * ny < ER * ER) { ctx.beginPath(); ctx.arc(CX + nx, CY + ny, .45 + (i % 3) * .35, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.globalAlpha = .12; ctx.strokeStyle = '#d6efff'; ctx.lineWidth = 4;
      for (let i = 0; i < 5; i++) {
        const yy = CY - 74 + i * 37;
        ctx.beginPath(); ctx.ellipse(CX - 12 + Math.sin(rotation * 1.3 + i) * 18, yy, ER * (.48 + (i % 2) * .12), 7, -.12, .15, Math.PI - .15); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(135,213,255,.22)'; ctx.lineWidth = 1;
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(CX, CY + k * 28, ER * Math.sqrt(Math.max(.08, 1 - (k * .2) ** 2)), 10 + Math.abs(k) * 3, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(CX + Math.sin(rotation) * ER * .32, CY, Math.max(5, ER * .45 * Math.abs(Math.cos(rotation))), ER, 0, 0, Math.PI * 2); ctx.stroke();
      // Shadow on the right edge gives the globe a spherical terminator.
      const shade = ctx.createLinearGradient(CX - ER, CY, CX + ER, CY); shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(.55, 'rgba(0,0,0,.08)'); shade.addColorStop(1, 'rgba(0,0,0,.78)'); ctx.fillStyle = shade; ctx.fillRect(CX-ER,CY-ER,ER*2,ER*2);
      ctx.restore();
      ctx.strokeStyle = 'rgba(67,177,255,.72)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(CX,CY,ER,0,Math.PI*2); ctx.stroke();
      // Polar axis tick + equatorial reference line — a fixed frame of reference
      // so orbital tilts read against something, instead of floating in space.
      ctx.save(); ctx.strokeStyle = 'rgba(180,220,255,.28)'; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(CX - ER - 14, CY); ctx.lineTo(CX + ER + 14, CY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(CX, CY - ER - 10); ctx.lineTo(CX, CY + ER + 10); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(180,220,255,.55)'; ctx.font = '8px monospace'; ctx.fillText('N', CX - 3, CY - ER - 14);

      const gs = groundStations[0];
      const gsAngle = (gs?.lonDeg ?? 0) * Math.PI / 180;
      const gsPos = point(gsAngle, ER - 2);
      const satPositions = satellites.map((sat, i) => point(sat.trueAnomalyRad, orbitR(sat.altitudeKm) + i * 8, satSquash[i]));
      const isDisturbed = activeDisturbances.length > 0;
      const disturbanceNames = activeDisturbances.map(d => d.type);
      // Ground-space visibility cone or inter-satellite link beam.
      if (gs && linkType === 'ground_sat' && satPositions[0]) {
        ctx.save(); ctx.fillStyle = isDisturbed ? 'rgba(255,160,40,.11)' : 'rgba(0,212,255,.09)';
        ctx.beginPath(); ctx.moveTo(gsPos.x,gsPos.y); ctx.lineTo(satPositions[0].x-35,satPositions[0].y-70); ctx.lineTo(satPositions[0].x+45,satPositions[0].y+55); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      const linkStart = linkType === 'ground_sat' ? gsPos : satPositions[0];
      const linkEnd = linkType === 'ground_sat' ? satPositions[0] : satPositions[1];
      if (linkStart && linkEnd) {
        const color = isDisturbed || primaryLink?.status === 'DEGRADED' ? '#ffb43b' : primaryLink?.hasLOS === false ? '#ff4d67' : '#00d9ef';
        ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha = .22; ctx.lineWidth = isDisturbed ? 9 : 5; ctx.beginPath(); ctx.moveTo(linkStart.x,linkStart.y); ctx.lineTo(linkEnd.x,linkEnd.y); ctx.stroke();
        ctx.globalAlpha = .95; ctx.lineWidth = 1.8; ctx.setLineDash([7,5]); ctx.lineDashOffset = dashRef.current; ctx.beginPath(); ctx.moveTo(linkStart.x,linkStart.y); ctx.lineTo(linkEnd.x,linkEnd.y); ctx.stroke(); ctx.restore(); dashRef.current -= 1.3;
        if (isDisturbed) { ctx.save(); ctx.strokeStyle = '#ff9d35'; ctx.globalAlpha = .7; ctx.setLineDash([2,5]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(linkStart.x,linkStart.y); ctx.lineTo(linkEnd.x,linkEnd.y); ctx.stroke(); ctx.restore(); }
      }
      // Draw the currently selected relay path hop-by-hop so a specific broken
      // segment (debris-blocked, out of range, etc.) is visibly distinct from
      // healthy hops, instead of one uniform line for the whole route.
      const conjunctions: Array<{ x: number; y: number; label: string }> = [];
      if (activeRoute && activeRoute.nodeIds.length >= 2) {
        const posById = (id: string) => {
          if (groundStations[0]?.id === id) return gsPos;
          const satIndex = satellites.findIndex(sat => sat.id === id);
          return satIndex >= 0 ? satPositions[satIndex] : null;
        };
        const positions = activeRoute.nodeIds.map(posById);
        const valid = positions.every(Boolean);
        if (valid) {
          const pts = positions as Array<{ x: number; y: number }>;
          const isRelay = activeRoute.nodeIds.length > 2;
          activeRoute.hops.forEach((hop, i) => {
            const a = pts[i], b = pts[i + 1];
            const blocked = !!hop.blocked;
            const healthyColor = isRelay ? '#5cffb0' : '#00d9ef';
            const color = blocked ? '#ff435f' : healthyColor;
            ctx.save();
            ctx.strokeStyle = color; ctx.globalAlpha = blocked ? .3 : .22; ctx.lineWidth = 12;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            ctx.globalAlpha = .95; ctx.lineWidth = blocked ? 2.6 : 2.2;
            ctx.setLineDash(blocked ? [3, 4] : [10, 6]); ctx.lineDashOffset = dashRef.current * (blocked ? 1 : 1.6);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            ctx.restore();
            if (blocked) {
              const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
              conjunctions.push({ x: mx, y: my, label: 'DEBRIS BLOCKING BEAM' });
            }
          });
          dashRef.current -= 1.3;
          if (!activeRoute.hops.some(h => h.blocked)) {
            const mid = pts[Math.floor(pts.length / 2)];
            ctx.fillStyle = 'rgba(3,15,22,.9)'; ctx.strokeStyle = 'rgba(92,255,176,.65)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(Math.max(12, mid.x - 72), Math.max(68, mid.y - 34), 144, 24, 5); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#78ffc4'; ctx.font = 'bold 9px monospace'; ctx.fillText(isRelay ? 'RELAY ROUTE ACTIVE' : 'DIRECT PATH ACTIVE', Math.max(20, mid.x - 62), Math.max(84, mid.y - 18));
          } else {
            const mid = pts[Math.floor(pts.length / 2)];
            ctx.fillStyle = 'rgba(40,4,8,.92)'; ctx.strokeStyle = 'rgba(255,67,95,.75)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(Math.max(12, mid.x - 76), Math.max(68, mid.y - 34), 152, 24, 5); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#ff9fae'; ctx.font = 'bold 9px monospace'; ctx.fillText('PATH BROKEN — REROUTE NEEDED', Math.max(20, mid.x - 68), Math.max(84, mid.y - 18));
          }
        }
      }
      // Space-weather / optical disturbance visualization around the link and orbital area.
      if (isDisturbed) {
        ctx.save(); ctx.strokeStyle = '#ff9f43'; ctx.fillStyle = 'rgba(255,143,48,.07)'; ctx.lineWidth = 1.2; ctx.setLineDash([4,5]);
        const radius = ER + 38 + Math.min(28, activeDisturbances.length * 7); ctx.beginPath(); ctx.arc(CX,CY,radius,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      // Disturbance-specific visual signatures: atmosphere haze, sensor scan noise,
      // pointing jitter, and debris-crossing marks are rendered in the scene itself.
      if (isDisturbed) {
        const types = new Set(disturbanceNames);
        if (types.has('TURBULENCE') || types.has('SCINTILLATION') || types.has('FOG') || types.has('CLOUD_OBSTRUCTION')) {
          ctx.save();
          ctx.strokeStyle = types.has('FOG') || types.has('CLOUD_OBSTRUCTION') ? 'rgba(190,210,225,.75)' : 'rgba(126,190,255,.8)';
          ctx.fillStyle = types.has('FOG') || types.has('CLOUD_OBSTRUCTION') ? 'rgba(190,210,225,.13)' : 'rgba(75,160,255,.10)';
          ctx.lineWidth = 2; ctx.setLineDash([3, 6]);
          for (let j = 0; j < 4; j++) { const rr = ER + 20 + j * 10 + Math.sin(rotation * 2 + j) * 4; ctx.beginPath(); ctx.ellipse(CX, CY, rr, rr * .72, rotation * .03, 0, Math.PI * 2); ctx.stroke(); }
          ctx.beginPath(); ctx.arc(CX, CY, ER + 18, -1.1, 1.1); ctx.arc(CX, CY, ER + 48, 1.1, -1.1, true); ctx.closePath(); ctx.fill(); ctx.restore();
        }
        if (types.has('SENSOR_NOISE') || types.has('BEACON_INTENSITY_REDUCTION') || types.has('BEACON_LOSS') || types.has('BEACON_OCCLUSION')) {
          ctx.save(); ctx.strokeStyle = 'rgba(255,75,115,.55)'; ctx.lineWidth = 1;
          for (let j = 0; j < 11; j++) { const yy = 70 + j * 31; ctx.beginPath(); ctx.moveTo(0, yy + Math.sin(rotation * 4 + j) * 4); ctx.lineTo(W, yy + Math.cos(rotation * 3 + j) * 4); ctx.stroke(); }
          ctx.restore();
        }
        if (types.has('ATTITUDE_JITTER') || types.has('SUDDEN_POINTING_OFFSET') || types.has('SPACECRAFT_VIBRATION') || types.has('POINTING_OFFSET') || types.has('TERMINAL_JITTER') || types.has('CAMERA_VIBRATION')) {
          ctx.save(); ctx.strokeStyle = '#ffcf69'; ctx.lineWidth = 2; ctx.setLineDash([2, 4]);
          satellites.forEach((sat, i) => { const p = satPositions[i]; if (!p) return; const jx = Math.sin(rotation * 11 + i) * 9, jy = Math.cos(rotation * 13 + i) * 7; ctx.beginPath(); ctx.moveTo(p.x - jx, p.y - jy); ctx.lineTo(p.x + jx, p.y + jy); ctx.stroke(); });
          ctx.restore();
        }
        if (types.has('DEBRIS_INTERFERENCE')) {
          ctx.save(); ctx.strokeStyle = '#ff435f'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(CX - ER - 65, CY - ER * .55); ctx.lineTo(CX + ER + 65, CY + ER * .55); ctx.stroke(); ctx.restore();
        }
      }

      // Debris objects and velocity/trajectory cues.
      const debrisPositions = debris.map((d, i) => point(d.trueAnomalyRad, orbitR(d.altitudeKm) + 12 + i * 4, .68));
      debris.forEach((d, i) => {
        const p = debrisPositions[i];
        const c = d.riskLevel === 'high' ? '#ff4d5d' : d.riskLevel === 'medium' ? '#ffb43b' : '#a5b4c8';
        ctx.strokeStyle = c; ctx.globalAlpha = .65; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x + Math.cos(d.trueAnomalyRad+Math.PI/2)*17,p.y + Math.sin(d.trueAnomalyRad+Math.PI/2)*12); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p.x,p.y,4,0,Math.PI*2); ctx.fill();
      });

      // Conjunction markers: pulse a ring around whichever debris is actually
      // obstructing the active path right now, at the point closest to the beam.
      if (conjunctions.length) {
        const pulse = 3 + Math.sin(rotation * 6) * 2;
        conjunctions.forEach(c => {
          ctx.save(); ctx.strokeStyle = '#ff435f'; ctx.lineWidth = 2; ctx.globalAlpha = .85;
          ctx.beginPath(); ctx.arc(c.x, c.y, 9 + pulse, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(c.x - 5, c.y - 5); ctx.lineTo(c.x + 5, c.y + 5); ctx.moveTo(c.x + 5, c.y - 5); ctx.lineTo(c.x - 5, c.y + 5); ctx.stroke();
          ctx.restore();
        });
      }

      // ── Label layer: greedy collision avoidance so names never stack on top
      // of each other (ground station vs. nearby satellite, in particular).
      const labels: LabelBox[] = [];
      if (gs) labels.push(placeLabel(labels, gsPos.x + 9, gsPos.y - 8, gs.name, '#68ffba'));
      satellites.forEach((sat, i) => {
        const p = satPositions[i]; if (!p) return;
        ctx.fillStyle = 'rgba(0,220,255,.2)'; ctx.beginPath(); ctx.arc(p.x,p.y,13,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#00e5ff'; ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2); ctx.fill();
        labels.push(placeLabel(labels, p.x + 9, p.y - 5, sat.name, '#64f4ff', `${sat.altitudeKm} km · ${sat.inclinationDeg}°`));
      });
      debris.forEach((d, i) => {
        const p = debrisPositions[i];
        const c = d.riskLevel === 'high' ? '#ff4d5d' : d.riskLevel === 'medium' ? '#ffb43b' : '#a5b4c8';
        labels.push(placeLabel(labels, p.x + 7, p.y - 7, d.name, c));
      });
      if (gs) { ctx.fillStyle = '#00ff9d'; ctx.beginPath(); ctx.arc(gsPos.x,gsPos.y,5,0,Math.PI*2); ctx.fill(); }
      labels.forEach(l => {
        ctx.fillStyle = l.color; ctx.font = 'bold 10px monospace'; ctx.fillText(l.text, l.x, l.y);
        if (l.sub) { ctx.fillStyle = '#a8c5d4'; ctx.font = '9px monospace'; ctx.fillText(l.sub, l.x, l.y + 14); }
      });

      // In-scene disturbance legend keeps injected changes visible at a glance.
      if (isDisturbed) {
        ctx.fillStyle = 'rgba(48,22,8,.94)'; ctx.strokeStyle = 'rgba(255,159,67,.9)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.roundRect(14,14,Math.min(440, W-28),50,6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffc078'; ctx.font = 'bold 11px monospace'; ctx.fillText(`DISTURBANCE EFFECTS ACTIVE · ${activeDisturbances.length}`,26,32);
        ctx.fillStyle = '#ffe0b5'; ctx.font = '10px monospace'; ctx.fillText(disturbanceNames.slice(0,4).join(' / '),26,49);
      }
      frameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frameRef.current);
  }, []);
  return <div className="w-full bg-[#030811] p-2"><canvas ref={canvasRef} width={W} height={H} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 5 }} /></div>;
}
