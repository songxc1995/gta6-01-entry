// Draws the world on a 1280x720 canvas with a camera that follows the player, plus the HUD,
// minimap, and the title / paused / game-over screens.
import { CITY, FONT, PALETTE, ROADS_X, ROADS_Y, ROAD_W, VIEW, WANTED } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW.width; canvas.height = VIEW.height;

  function drawCar(x, y, angle, color, police) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-28, -14 + 4, 56, 30);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(-27, -14, 54, 28, 7); ctx.fill();
    ctx.fillStyle = '#222a33';
    ctx.beginPath(); ctx.roundRect(-8, -11, 18, 22, 4); ctx.fill();
    ctx.fillStyle = '#bcd8ef';
    ctx.fillRect(8, -10, 8, 20);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(25, -11, 3, 6); ctx.fillRect(25, 5, 3, 6);
    if (police) {
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(-24, -14, 12, 28);
      ctx.fillStyle = Math.floor(performance.now() / 250) % 2 === 0 ? PALETTE.policeLight : PALETTE.policeLight2;
      ctx.beginPath(); ctx.arc(-2, -8, 4, 0, Math.PI * 2); ctx.arc(-2, 8, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawCity(state, camX, camY) {
    // Grass base with a subtle checker.
    ctx.fillStyle = PALETTE.grass; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.grass2;
    const gs = 160;
    const x0 = Math.floor(camX / gs) * gs, y0 = Math.floor(camY / gs) * gs;
    for (let x = x0; x < camX + VIEW.width + gs; x += gs) {
      for (let y = y0; y < camY + VIEW.height + gs; y += gs) {
        if (((x + y) / gs) % 2 === 0) ctx.fillRect(x - camX, y - camY, gs, gs);
      }
    }
    // Water: the east river and a south bay.
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(2440 - camX, -camY, CITY.width - 2440, CITY.height);
    ctx.fillRect(-camX, 1820 - camY, 700, CITY.height - 1820);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (let y = 0; y < CITY.height; y += 90) ctx.fillRect(2460 - camX, y - camY + ((y / 90) % 2) * 30, 60, 4);
    // Parks.
    for (const p of state.parks) {
      ctx.fillStyle = PALETTE.park; ctx.fillRect(p.x - camX, p.y - camY, p.w, p.h);
      ctx.fillStyle = '#2a7a3a';
      for (let i = 0; i < 6; i += 1) {
        const tx = p.x + 20 + ((i * 53) % Math.max(20, p.w - 40));
        const ty = p.y + 20 + ((i * 37) % Math.max(20, p.h - 40));
        ctx.beginPath(); ctx.arc(tx - camX, ty - camY, 14, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Roads: sidewalks, asphalt, centre dashes.
    for (const rx of ROADS_X) {
      ctx.fillStyle = PALETTE.sidewalk; ctx.fillRect(rx - ROAD_W / 2 - 8 - camX, -camY, ROAD_W + 16, CITY.height);
      ctx.fillStyle = PALETTE.road; ctx.fillRect(rx - ROAD_W / 2 - camX, -camY, ROAD_W, CITY.height);
      ctx.fillStyle = PALETTE.lane;
      for (let y = 0; y < CITY.height; y += 64) ctx.fillRect(rx - 3 - camX, y - camY, 6, 30);
    }
    for (const ry of ROADS_Y) {
      ctx.fillStyle = PALETTE.sidewalk; ctx.fillRect(-camX, ry - ROAD_W / 2 - 8 - camY, CITY.width, ROAD_W + 16);
      ctx.fillStyle = PALETTE.road; ctx.fillRect(-camX, ry - ROAD_W / 2 - camY, CITY.width, ROAD_W);
      ctx.fillStyle = PALETTE.lane;
      for (let x = 0; x < CITY.width; x += 64) ctx.fillRect(x - camX, ry - 3 - camY, 30, 6);
    }
    // Buildings with roof shading and windows.
    for (const b of state.buildings) {
      if (b.x > camX + VIEW.width || b.x + b.w < camX || b.y > camY + VIEW.height || b.y + b.h < camY) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x - camX + 5, b.y - camY + 6, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - camX, b.y - camY, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(b.x - camX, b.y - camY, b.w, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let wx = b.x + 14; wx < b.x + b.w - 10; wx += 26) {
        for (let wy = b.y + 22; wy < b.y + b.h - 10; wy += 26) ctx.fillRect(wx - camX, wy - camY, 12, 14);
      }
    }
  }

  function drawMarker(x, y, camX, camY, label, t) {
    const pulse = 1 + Math.sin(t * 4) * 0.12;
    ctx.save();
    ctx.translate(x - camX, y - camY);
    ctx.strokeStyle = PALETTE.marker; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(10, -14); ctx.lineTo(-10, -14); ctx.closePath(); ctx.fill();
    ctx.font = `bold 15px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillStyle = '#111'; ctx.fillText(label, 1, -41); ctx.fillStyle = PALETTE.marker; ctx.fillText(label, 0, -42);
    ctx.restore();
  }

  function drawMinimap(state) {
    const mw = 200, mh = 150, mx = VIEW.width - mw - 16, my = 16;
    const sx = mw / CITY.width, sy = mh / CITY.height;
    ctx.fillStyle = 'rgba(10,14,20,0.85)';
    ctx.beginPath(); ctx.roundRect(mx - 6, my - 6, mw + 12, mh + 12, 8); ctx.fill();
    ctx.fillStyle = '#2f6b33'; ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#2b6cb0'; ctx.fillRect(mx + 2440 * sx, my, (CITY.width - 2440) * sx, mh);
    ctx.strokeStyle = '#555a63'; ctx.lineWidth = 3;
    for (const rx of ROADS_X) { ctx.beginPath(); ctx.moveTo(mx + rx * sx, my); ctx.lineTo(mx + rx * sx, my + mh); ctx.stroke(); }
    for (const ry of ROADS_Y) { ctx.beginPath(); ctx.moveTo(mx, my + ry * sy); ctx.lineTo(mx + mw, my + ry * sy); ctx.stroke(); }
    const m = state.mission;
    if (m) {
      const t = m.type === 'deliver' ? (m.stage === 0 ? m.pickup : m.target) : m.target;
      if (t) {
        ctx.fillStyle = PALETTE.marker;
        ctx.beginPath(); ctx.arc(mx + t.x * sx, my + t.y * sy, 6, 0, Math.PI * 2); ctx.fill();
      }
      for (const p of m.pickups || []) if (!p.taken) {
        ctx.fillStyle = PALETTE.cash; ctx.beginPath(); ctx.arc(mx + p.x * sx, my + p.y * sy, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const p of state.police) if (p.active) {
      ctx.fillStyle = '#4d9fff'; ctx.beginPath(); ctx.arc(mx + p.x * sx, my + p.y * sy, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath(); ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `bold 12px ${FONT}`; ctx.textAlign = 'left';
    ctx.fillText('LEONIDA CITY', mx, my + mh + 18);
  }

  function drawHUD(state, best) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // Top-left panel: money, score, level.
    ctx.fillStyle = 'rgba(10,14,20,0.82)';
    ctx.beginPath(); ctx.roundRect(14, 14, 250, 92, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold 26px ${FONT}`;
    ctx.fillText(`$${state.money.toLocaleString()}`, 28, 46);
    ctx.font = `16px ${FONT}`; ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Score ${state.score}   Level ${state.level}   Best ${best}`, 28, 72);
    ctx.fillStyle = PALETTE.muted; ctx.font = `13px ${FONT}`;
    ctx.fillText(state.player.inCar ? 'E — get out    WASD / arrows — drive' : 'E — enter car    WASD / arrows — walk', 28, 94);
    // Wanted stars top centre.
    const wanted = Math.ceil(state.wanted);
    ctx.font = '30px sans-serif'; ctx.textAlign = 'center';
    for (let i = 0; i < WANTED.max; i += 1) {
      ctx.fillStyle = i < wanted ? PALETTE.star : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', VIEW.width / 2 - 60 + i * 30, 48);
    }
    if (state.bustTimer > 0.3) {
      ctx.fillStyle = '#ff5a5a'; ctx.font = `bold 18px ${FONT}`;
      ctx.fillText('THE COPS ARE ON YOU — RUN!', VIEW.width / 2, 76);
    }
    // Health bar bottom-left.
    ctx.fillStyle = 'rgba(10,14,20,0.82)';
    ctx.beginPath(); ctx.roundRect(14, VIEW.height - 46, 250, 32, 8); ctx.fill();
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.roundRect(24, VIEW.height - 36, 180, 12, 6); ctx.fill();
    ctx.fillStyle = state.player.health > 30 ? PALETTE.health : PALETTE.danger;
    ctx.beginPath(); ctx.roundRect(24, VIEW.height - 36, 180 * Math.max(0, state.player.health) / 100, 12, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold 14px ${FONT}`; ctx.textAlign = 'left';
    ctx.fillText(`HP ${Math.ceil(state.player.health)}`, 212, VIEW.height - 24);
    // Mission panel bottom-centre.
    const m = state.mission;
    if (m) {
      const w = 430;
      ctx.fillStyle = 'rgba(10,14,20,0.82)';
      ctx.beginPath(); ctx.roundRect((VIEW.width - w) / 2, VIEW.height - 84, w, 62, 10); ctx.fill();
      ctx.fillStyle = '#ffd23f'; ctx.font = `bold 17px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText(m.type === 'deliver' ? '📦 DELIVERY JOB' : '💵 CASH COLLECTION', VIEW.width / 2, VIEW.height - 58);
      ctx.fillStyle = '#fff'; ctx.font = `15px ${FONT}`;
      ctx.fillText(`${m.text}   •   ${Math.max(0, Math.ceil(m.timeLeft))}s left`, VIEW.width / 2, VIEW.height - 34);
    }
    if (state.flashTimer > 0) {
      ctx.fillStyle = '#7dff9b'; ctx.font = `bold 24px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText(state.flash, VIEW.width / 2, 110);
    }
    drawMinimap(state);
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(8,10,16,0.72)'; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent; ctx.font = `bold 64px ${FONT}`;
    ctx.fillText(title, VIEW.width / 2, 250);
    ctx.fillStyle = '#fff'; ctx.font = `20px ${FONT}`;
    lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 310 + i * 34));
  }

  function draw(state, screen, best) {
    const camX = clamp(state.player.x - VIEW.width / 2, 0, CITY.width - VIEW.width);
    const camY = clamp(state.player.y - VIEW.height / 2, 0, CITY.height - VIEW.height);
    const t = state.elapsed;
    drawCity(state, camX, camY);
    // Parked cars.
    for (const c of state.parked) drawCar(c.x - camX, c.y - camY, c.angle, c.color, false);
    // Mission markers.
    const m = state.mission;
    if (m && screen === SCREEN_PLAY) {
      if (m.type === 'deliver') {
        const tgt = m.stage === 0 ? m.pickup : m.target;
        drawMarker(tgt.x, tgt.y, camX, camY, m.stage === 0 ? 'PICK UP' : 'DELIVER', t);
      } else {
        for (const p of m.pickups) if (!p.taken) {
          ctx.save(); ctx.translate(p.x - camX, p.y - camY);
          ctx.fillStyle = PALETTE.cash; ctx.beginPath(); ctx.arc(0, 0, 12 + Math.sin(t * 5) * 2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#083'; ctx.font = `bold 13px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('$', 0, 5);
          ctx.restore();
        }
        if (m.target) drawMarker(m.target.x, m.target.y, camX, camY, 'CASH', t);
      }
    }
    // Police.
    for (const p of state.police) if (p.active) drawCar(p.x - camX, p.y - camY, p.angle, PALETTE.police, true);
    // Player car or player on foot.
    if (state.player.inCar && state.car) {
      drawCar(state.car.x - camX, state.car.y - camY, state.car.angle, state.car.color, false);
    } else {
      const px = state.player.x - camX, py = state.player.y - camY;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(px, py + 10, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath(); ctx.arc(px, py, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(px + Math.cos(state.player.angle) * 5, py + Math.sin(state.player.angle) * 5, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `bold 11px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText('YOU', px, py - 20);
    }
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHUD(state, best);
    if (screen === SCREEN_TITLE) {
      overlay('LEONIDA NIGHTS', [
        'A top-down open-world crime game in the spirit of GTA',
        'Walk, steal a car, run jobs, earn cash — and dodge the LCPD.',
        '',
        'WASD / arrows — move & drive      E — enter / exit car',
        'P — pause      Missions pay cash      Wanted stars bring the cops',
        '',
        'Press SPACE or click to start',
      ], '#ffd23f');
    } else if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['Press P or SPACE to keep playing'], '#fff');
    } else if (screen === SCREEN_OVER) {
      overlay(state.overReason || 'WASTED', [
        `You made $${state.money.toLocaleString()}   •   Score ${state.score}   •   Level ${state.level}`,
        `Best score: ${best}`,
        '',
        'Press SPACE or click to play again',
      ], '#ff5a5a');
    }
  }

  return { draw };
}
