import { useEffect, useRef } from 'react';

/**
 * Theyo Fihaara's sign-in backdrop: an island harbour at night. The shed's canopy lights the jetty, the pump's
 * display counts litres, a dhoni rocks at the jetty and the light trembles on the water. Drawn on a canvas;
 * one still frame when the device asks for reduced motion, and paused while the tab is hidden.
 */
export function HarbourScene({ litresLabel }: { litresLabel: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion');
    const moonCanvas = document.createElement('canvas');
    const logo = new Image();
    logo.src = '/fuel/icon-192.png';

    let w = 0;
    let h = 0;
    let dpr = 1;
    // Fixed random stars and embers so the scene is the same every time.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const stars = Array.from({ length: 140 }, () => ({ x: rnd(), y: rnd(), r: 0.4 + rnd() * 1.1, p: rnd() * 6.28 }));
    const embers = Array.from({ length: 34 }, () => ({ x: rnd() * 2 - 1, s: 0.3 + rnd() * 0.7, p: rnd() }));

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const mobile = w < 1024;
      const hy = mobile ? h * 0.33 : h * 0.6; // horizon
      const sx = mobile ? w * 0.42 : Math.min(w * 0.3, w - 640); // the shed
      const s = mobile ? Math.min(w / 430, 1) * 0.72 : Math.max(0.8, Math.min(h / 900, w / 1500)) * 1.3;

      // Sky: deep night, warm near the horizon where the shed glows.
      const sky = ctx.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, '#03050a');
      sky.addColorStop(0.55, '#08101e');
      sky.addColorStop(1, '#22170b');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, hy);
      for (const st of stars) {
        const y = st.y * hy * 0.85;
        const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.3 + st.p));
        ctx.fillStyle = `rgba(255,248,230,${a})`;
        ctx.beginPath();
        ctx.arc(st.x * w, y, st.r, 0, 6.283);
        ctx.fill();
      }
      // Moon.
      const mx = mobile ? w * 0.84 : Math.min(w * 0.52, w - 560);
      const my = hy * 0.24;
      const mr = 22 * s;
      const mg = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 6);
      mg.addColorStop(0, 'rgba(255,240,210,0.18)');
      mg.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(mx - mr * 6, my - mr * 6, mr * 12, mr * 12);
      // A crescent: the lit disc with the shadow cut out, so the sky shows through.
      const mc = moonCanvas;
      mc.width = mc.height = Math.ceil(mr * 2 * dpr) + 4;
      const m = mc.getContext('2d')!;
      m.setTransform(dpr, 0, 0, dpr, 0, 0);
      m.fillStyle = '#f3ead6';
      m.beginPath();
      m.arc(mr + 1, mr + 1, mr, 0, 6.283);
      m.fill();
      m.globalCompositeOperation = 'destination-out';
      m.beginPath();
      m.arc(mr + 1 + mr * 0.45, mr + 1 - mr * 0.2, mr * 0.9, 0, 6.283);
      m.fill();
      ctx.drawImage(mc, mx - mr - 1, my - mr - 1, mc.width / dpr, mc.height / dpr);
      // Glow of the shed on the low sky.
      const glow = ctx.createRadialGradient(sx, hy, 0, sx, hy, Math.max(w, h) * 0.55);
      glow.addColorStop(0, 'rgba(245,158,11,0.28)');
      glow.addColorStop(0.35, 'rgba(245,120,11,0.08)');
      glow.addColorStop(1, 'rgba(245,120,11,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Far island with palms on the horizon.
      ctx.fillStyle = '#05070b';
      const ix = mobile ? w * 0.86 : Math.min(w * 0.66, w - 420);
      ctx.beginPath();
      ctx.moveTo(ix - 160 * s, hy + 1);
      ctx.quadraticCurveTo(ix, hy - 16 * s, ix + 200 * s, hy + 1);
      ctx.fill();
      for (let i = 0; i < 4; i++) palm(ix - 90 * s + i * 60 * s, hy - 6 * s, 26 * s * (0.8 + (i % 2) * 0.3), t, i, '#05070b');

      // Sea.
      const sea = ctx.createLinearGradient(0, hy, 0, h);
      sea.addColorStop(0, '#0b111b');
      sea.addColorStop(1, '#010204');
      ctx.fillStyle = sea;
      ctx.fillRect(0, hy, w, h - hy);
      // Light on the water: amber under the shed, silver under the moon.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let y = hy + 3, i = 0; y < h; y += 3.2 * s, i++) {
        const d = (y - hy) / (h - hy);
        const width = (40 + 260 * d) * s * (0.6 + 0.4 * Math.sin(i * 1.7 + t * 0.8));
        const off = Math.sin(t * 1.6 + i * 0.55) * 10 * s;
        ctx.fillStyle = `rgba(251,176,59,${0.22 * (1 - d) * (0.5 + 0.5 * Math.sin(i * 2.3 + t * 2.1))})`;
        ctx.fillRect(sx + off - width / 2, y, width, 1.4 * s);
        const mw = (20 + 90 * d) * s;
        ctx.fillStyle = `rgba(230,236,255,${0.07 * (1 - d) * (0.5 + 0.5 * Math.sin(i * 1.9 - t * 1.7))})`;
        ctx.fillRect(mx + off * 0.6 - mw / 2, y, mw, 1.2 * s);
      }
      ctx.restore();

      // Jetty from the left to past the shed.
      const jy = hy + 14 * s;
      ctx.fillStyle = '#07080a';
      for (let x = -10; x < sx + 120 * s; x += 46 * s) ctx.fillRect(x, jy, 5 * s, 46 * s);
      ctx.fillRect(0, jy - 4 * s, sx + 125 * s, 7 * s);
      ctx.fillStyle = 'rgba(251,176,59,0.25)';
      ctx.fillRect(0, jy - 4 * s, sx + 125 * s, 1.2 * s);

      // Palms at the near edge, swaying.
      palm(mobile ? w * 0.06 : w * 0.035, jy, 120 * s, t, 9, '#030405');
      palm(mobile ? w * 0.16 : w * 0.085, jy, 90 * s, t, 3, '#030405');

      // Light cone under the canopy.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const cone = ctx.createLinearGradient(0, hy - 132 * s, 0, jy + 20 * s);
      cone.addColorStop(0, 'rgba(255,214,140,0.38)');
      cone.addColorStop(1, 'rgba(255,170,60,0.02)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(sx - 100 * s, hy - 132 * s);
      ctx.lineTo(sx + 100 * s, hy - 132 * s);
      ctx.lineTo(sx + 150 * s, jy);
      ctx.lineTo(sx - 150 * s, jy);
      ctx.fill();
      ctx.restore();

      // Canopy, light strip and pillars.
      ctx.fillStyle = '#121214';
      ctx.fillRect(sx - 112 * s, hy - 150 * s, 224 * s, 16 * s);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(sx - 112 * s, hy - 150 * s, 224 * s, 2.5 * s);
      ctx.save();
      ctx.shadowColor = 'rgba(255,200,120,0.9)';
      ctx.shadowBlur = 24 * s;
      ctx.fillStyle = '#fff4dc';
      ctx.fillRect(sx - 100 * s, hy - 135 * s, 200 * s, 3 * s);
      ctx.restore();
      ctx.fillStyle = '#0d0d0f';
      ctx.fillRect(sx - 96 * s, hy - 134 * s, 9 * s, jy - hy + 134 * s);
      ctx.fillRect(sx + 87 * s, hy - 134 * s, 9 * s, jy - hy + 134 * s);

      // The pump, its counting display and hose.
      const px = sx - 24 * s;
      const py = jy - 84 * s;
      const pumpG = ctx.createLinearGradient(px, 0, px + 48 * s, 0);
      pumpG.addColorStop(0, '#1b1b1e');
      pumpG.addColorStop(0.45, '#2c2c30');
      pumpG.addColorStop(1, '#141416');
      ctx.fillStyle = pumpG;
      ctx.fillRect(px, py, 48 * s, 84 * s);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(px, py + 30 * s, 48 * s, 3 * s);
      ctx.fillStyle = '#000';
      ctx.fillRect(px + 5 * s, py + 7 * s, 38 * s, 19 * s);
      const litres = still ? 25 : 25 * Math.min(1, ((t % 9) / 6) ** 0.8);
      ctx.save();
      ctx.shadowColor = 'rgba(251,191,36,0.8)';
      ctx.shadowBlur = 8 * s;
      ctx.fillStyle = '#fbbf24';
      ctx.font = `600 ${10.5 * s}px ui-monospace, Menlo, monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(litres.toFixed(2), px + 41 * s, py + 21 * s);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = `600 ${4.5 * s}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(litresLabel.toUpperCase(), px + 7 * s, py + 13 * s);
      ctx.strokeStyle = '#0a0a0b';
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(px + 48 * s, py + 42 * s);
      ctx.bezierCurveTo(px + 78 * s, py + 50 * s, px + 70 * s, jy - 6 * s, px + 96 * s, jy - 10 * s);
      ctx.stroke();

      // Lit sign with the logo.
      const gx = sx + 128 * s;
      ctx.fillStyle = '#0b0b0d';
      ctx.fillRect(gx, hy - 120 * s, 5 * s, jy - hy + 120 * s);
      ctx.save();
      ctx.shadowColor = 'rgba(255,255,255,0.35)';
      ctx.shadowBlur = 20 * s;
      ctx.fillStyle = '#000';
      ctx.fillRect(gx - 20 * s, hy - 168 * s, 46 * s, 46 * s);
      ctx.restore();
      if (logo.complete && logo.naturalWidth) ctx.drawImage(logo, gx - 18 * s, hy - 166 * s, 42 * s, 42 * s);

      // Dhoni at the jetty, rocking.
      const bx = sx + 175 * s;
      const by = jy + 10 * s + Math.sin(t * 1.1) * 2.2 * s;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.sin(t * 0.9) * 0.02);
      ctx.fillStyle = '#06080b';
      ctx.beginPath();
      ctx.moveTo(-10 * s, 0);
      ctx.quadraticCurveTo(70 * s, 22 * s, 160 * s, 0);
      ctx.lineTo(175 * s, -26 * s);
      ctx.quadraticCurveTo(80 * s, -6 * s, -10 * s, -10 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(60 * s, -30 * s, 50 * s, 20 * s);
      ctx.fillRect(30 * s, -88 * s, 2.5 * s, 80 * s);
      ctx.strokeStyle = 'rgba(251,176,59,0.35)';
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.moveTo(-10 * s, -10 * s);
      ctx.quadraticCurveTo(80 * s, -6 * s, 175 * s, -26 * s);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,214,140,0.85)';
      ctx.fillRect(68 * s, -24 * s, 7 * s, 5 * s);
      ctx.fillRect(84 * s, -24 * s, 7 * s, 5 * s);
      ctx.restore();

      // Warm embers drifting up from the light.
      if (!still) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const e of embers) {
          const life = (t * 0.05 * e.s + e.p) % 1;
          const x = sx + e.x * 170 * s + Math.sin(t * e.s + e.p * 9) * 12 * s;
          const y = jy - life * 260 * s;
          ctx.fillStyle = `rgba(255,190,90,${0.5 * Math.sin(life * Math.PI)})`;
          ctx.beginPath();
          ctx.arc(x, y, 1.3 * s, 0, 6.283);
          ctx.fill();
        }
        ctx.restore();
      }

      // Vignette.
      const v = ctx.createRadialGradient(w * 0.45, h * 0.5, Math.min(w, h) * 0.3, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.65)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    };

    function palm(x: number, base: number, size: number, t: number, k: number, color: string) {
      const sway = Math.sin(t * 0.7 + k) * 0.06;
      const topX = x + size * (0.25 + sway);
      const topY = base - size;
      ctx!.strokeStyle = color;
      ctx!.lineWidth = Math.max(2, size * 0.06);
      ctx!.lineCap = 'round';
      ctx!.beginPath();
      ctx!.moveTo(x, base);
      ctx!.quadraticCurveTo(x + size * 0.05, base - size * 0.6, topX, topY);
      ctx!.stroke();
      ctx!.fillStyle = color;
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.5 + sway * 2;
        const len = size * (0.45 + (i % 2) * 0.12);
        ctx!.beginPath();
        ctx!.moveTo(topX, topY);
        ctx!.quadraticCurveTo(topX + Math.cos(a - 0.3) * len * 0.6, topY + Math.sin(a - 0.3) * len * 0.6 - size * 0.06, topX + Math.cos(a) * len, topY + Math.sin(a) * len + size * 0.12);
        ctx!.quadraticCurveTo(topX + Math.cos(a + 0.2) * len * 0.5, topY + Math.sin(a + 0.2) * len * 0.5, topX, topY);
        ctx!.fill();
      }
    }

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (still) draw(4);
    });
    ro.observe(canvas);
    logo.onload = () => still && draw(4);
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      draw((now - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !still) raf = requestAnimationFrame(loop);
    };
    if (still) draw(4);
    else raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [litresLabel]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 size-full" aria-hidden />;
}
