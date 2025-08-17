import React, { useEffect, useRef, useState } from "react";

/**
 * Roof Color Visualizer — Client-side React app
 *
 * Features
 * - Upload house photo
 * - Draw polygon to mask the roof
 * - Choose Sherwin-Williams Coil Coatings–style colors (sample set; extendable)
 * - Blend strength slider preserves texture via canvas multiply blending
 * - Move/adjust points (drag handles), undo/clear
 * - Download result as PNG
 *
 * How to use
 * 1) Click Upload and pick an image.
 * 2) Click to drop polygon points around the roof. Double‑click (or Close Mask) to finish.
 * 3) Pick a color and adjust Blend.
 * 4) Click Download to save the composited image.
 *
 * Notes
 * - This runs entirely in the browser, no backend needed.
 * - You can embed this on Wix via an iframe (see chat for steps).
 */

// Sample Sherwin-Williams Coil Coatings style palette (add or edit freely)
// Hex values are approximations for on-screen previewing only.
const SW_COIL_COLORS = [
  { name: "Charcoal", hex: "#3D3D3D" },
  { name: "Slate Gray", hex: "#4C4F56" },
  { name: "Burnished Slate", hex: "#6A5E52" },
  { name: "Sandstone", hex: "#C6B49A" },
  { name: "Forest Green", hex: "#2E5339" },
  { name: "Evergreen", hex: "#1F4A38" },
  { name: "Rustic Red", hex: "#8B322C" },
  { name: "Crimson Red", hex: "#7A1D1D" },
  { name: "Copper Penny", hex: "#B87333" },
  { name: "Medium Bronze", hex: "#645648" },
  { name: "Matte Black", hex: "#111111" },
  { name: "Regal White", hex: "#FFFFFF" },
];

export default function App() {
  const [imageURL, setImageURL] = useState<string | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const [color, setColor] = useState<string>(SW_COIL_COLORS[0].hex);
  const [blend, setBlend] = useState<number>(65); // percent
  const [scale, setScale] = useState<number>(1);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Load and fit image to canvas
  useEffect(() => {
    if (!imageURL) return;
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      fitCanvasToImage(img);
      draw();
    };
    img.src = imageURL;
  }, [imageURL]);

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgEl, points, isClosed, color, blend, scale]);

  function fitCanvasToImage(img: HTMLImageElement) {
    const canvas = canvasRef.current!;
    const overlay = overlayRef.current!;
    const maxW = 1100;
    const ratio = img.width / img.height;
    let w = img.width;
    let h = img.height;
    if (w > maxW) {
      w = maxW;
      h = Math.round(maxW / ratio);
    }
    canvas.width = w;
    canvas.height = h;
    overlay.width = w;
    overlay.height = h;
    setScale(w / img.width);
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageURL(url);
    setPoints([]);
    setIsClosed(false);
  }

  function canvasPos(evt: React.MouseEvent) {
    const rect = (evt.target as HTMLCanvasElement).getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!imgEl || isClosed) return;
    const p = canvasPos(e);
    setPoints((pts) => [...pts, p]);
  }

  function handleDoubleClick() {
    if (points.length >= 3) setIsClosed(true);
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!points.length) return;
    const p = canvasPos(e);
    const idx = hitHandle(p.x, p.y);
    if (idx !== null) {
      setActivePoint(idx);
    }
  }
  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (activePoint === null) return;
    const p = canvasPos(e);
    setPoints((pts) => pts.map((pt, i) => (i === activePoint ? { x: p.x, y: p.y } : pt)));
  }
  function handleMouseUp() {
    setActivePoint(null);
  }

  function hitHandle(x: number, y: number) {
    for (let i = 0; i < points.length; i++) {
      const dx = points[i].x - x;
      const dy = points[i].y - y;
      if (dx * dx + dy * dy < 10 * 10) return i;
    }
    return null;
  }

  function drawPolygonPath(ctx: CanvasRenderingContext2D) {
    if (!points.length) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    if (isClosed) ctx.closePath();
  }

  function drawHandles(ctx: CanvasRenderingContext2D) {
    ctx.save();
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = i === activePoint ? "#2563eb" : "#111827"; // blue/near-black
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    ctx.restore();
  }

  function hexToRgb(hex: string) {
    const h = hex.replace("#", "");
    const bigint = parseInt(h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r, g, b };
  }

  function draw() {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const ctx = canvas.getContext("2d")!;
    const octx = overlay.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    octx.clearRect(0, 0, overlay.width, overlay.height);

    if (imgEl) {
      ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
    }

    // Draw polygon preview & handles
    if (points.length) {
      ctx.save();
      drawPolygonPath(ctx);
      ctx.lineWidth = 2;
      ctx.strokeStyle = isClosed ? "#10b981" : "#f59e0b"; // green/orange
      ctx.stroke();
      ctx.restore();
      drawHandles(ctx);
    }

    // If closed, paint color overlay with multiply and alpha blend
    if (imgEl && isClosed && points.length >= 3) {
      // Build mask path on overlay
      octx.save();
      drawPolygonPath(octx);
      octx.clip();

      // Fill with selected color
      const { r, g, b } = hexToRgb(color);
      octx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`;
      octx.fillRect(0, 0, overlay.width, overlay.height);

      // Multiply blend to keep shadows
      octx.globalCompositeOperation = "multiply";
      // Draw original image into overlay to produce multiply effect
      octx.drawImage(imgEl, 0, 0, overlay.width, overlay.height);

      // Now composite back onto base with adjustable alpha
      ctx.save();
      ctx.globalAlpha = Math.min(Math.max(blend / 100, 0), 1);
      ctx.drawImage(overlay, 0, 0);
      ctx.restore();

      octx.restore();
      // reset overlay composite mode
      octx.globalCompositeOperation = "source-over";
    }
  }

  function undoPoint() {
    if (isClosed) return;
    setPoints((pts) => pts.slice(0, -1));
  }

  function clearMask() {
    setPoints([]);
    setIsClosed(false);
  }

  function downloadImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "roof-visualized.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div ref={containerRef} className="min-h-screen w-full bg-gray-50 text-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">🏠 Roof Color Visualizer</h1>
            <p className="text-sm text-gray-600">Upload a house photo, outline the roof, and preview colors.</p>
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center px-4 py-2 rounded-xl bg-white shadow border cursor-pointer hover:shadow-md">
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              <span className="text-sm font-medium">Upload Photo</span>
            </label>
            <button onClick={downloadImage} className="px-4 py-2 rounded-xl bg-black text-white text-sm font-semibold shadow hover:opacity-90 disabled:opacity-40" disabled={!imgEl}>
              Download PNG
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Controls */}
          <aside className="lg:col-span-1 space-y-5">
            <section className="bg-white rounded-2xl shadow p-4">
              <h2 className="font-semibold mb-3">Roof Mask</h2>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setIsClosed(true)} disabled={isClosed || points.length < 3} className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white disabled:opacity-40">Close Mask</button>
                <button onClick={undoPoint} disabled={!points.length || isClosed} className="px-3 py-1.5 text-sm rounded-lg bg-gray-200">Undo Point</button>
                <button onClick={clearMask} disabled={!points.length} className="px-3 py-1.5 text-sm rounded-lg bg-gray-200">Clear Mask</button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Tip: Click to add points. Drag handles to refine. Double‑click to close.</p>
            </section>

            <section className="bg-white rounded-2xl shadow p-4">
              <h2 className="font-semibold mb-3">Color</h2>
              <div className="grid grid-cols-6 gap-2">
                {SW_COIL_COLORS.map((c) => (
                  <button
                    key={c.name}
                    title={c.name}
                    onClick={() => setColor(c.hex)}
                    className={`h-9 rounded-xl border ${color === c.hex ? "ring-2 ring-black" : ""}`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
              <div className="mt-3 text-sm text-gray-600">Selected: <span className="font-medium">{SW_COIL_COLORS.find((c) => c.hex === color)?.name}</span></div>
            </section>

            <section className="bg-white rounded-2xl shadow p-4">
              <h2 className="font-semibold mb-3">Blend</h2>
              <input
                type="range"
                min={0}
                max={100}
                value={blend}
                onChange={(e) => setBlend(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="text-sm text-gray-600">Strength: {blend}%</div>
            </section>

            <section className="bg-white rounded-2xl shadow p-4">
              <h2 className="font-semibold mb-2">Extras</h2>
              <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                <li>Drag points to fine‑tune edges.</li>
                <li>Use higher blend for deeper color, lower to keep more of the roof’s original tone.</li>
                <li>Extend the color list in <code>SW_COIL_COLORS</code>.</li>
              </ul>
            </section>
          </aside>

          {/* Canvas Area */}
          <main className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow p-3 overflow-auto">
              <div className="relative inline-block">
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  onDoubleClick={handleDoubleClick}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  className="max-w-full cursor-crosshair rounded-xl"
                />
                <canvas ref={overlayRef} className="hidden" />
                {!imgEl && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                    Upload an image to begin
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>

        <footer className="mt-8 text-xs text-gray-500">
          On‑screen colors are for visualization only and may not match manufactured finishes exactly.
        </footer>
      </div>
    </div>
  );
}
