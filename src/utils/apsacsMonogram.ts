export const APSACS_MONOGRAM_STORAGE_KEY = 'meritexam_apsacs_monogram_v1';

export const APSACS_MONOGRAM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 410" width="400" height="410">
  <defs>
    <path id="apsacs-top-arc" d="M 28 258 A 178 178 0 1 1 372 258" />
    <path id="apsacs-motto-arc" d="M 62 342 Q 200 434 338 342" />
  </defs>

  <!-- Outer Circular System Title: ARMY PUBLIC SCHOOLS & COLLEGES SYSTEM -->
  <text
    font-family="Arial, Helvetica, sans-serif"
    font-size="24.5"
    font-weight="900"
    fill="#1e1b18"
    letter-spacing="0.2"
  >
    <textPath href="#apsacs-top-arc" startOffset="50%" text-anchor="middle">
      ARMY PUBLIC SCHOOLS &amp; COLLEGES SYSTEM
    </textPath>
  </text>

  <!-- Centered Bold APSACS Label -->
  <text
    x="200"
    y="63"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="28"
    font-weight="900"
    fill="#1e1b18"
    letter-spacing="1"
  >
    APSACS
  </text>

  <!-- Iconic Deep Emerald Green (#006737) Fountain-Pen & Open Book Emblem -->
  <!-- Outer Left Book Page -->
  <path
    d="M 64 104 Q 95 95 126 112 L 126 226 C 142 252 168 282 186 312 C 150 278 106 258 59 256 Z"
    fill="#006737"
  />
  <!-- Inner Left Nib Wing -->
  <path
    d="M 134 72 C 168 98 194 136 194 176 L 194 304 C 176 268 148 242 136 222 Z"
    fill="#006737"
  />
  <!-- Inner Right Nib Wing -->
  <path
    d="M 266 72 C 232 98 206 136 206 176 L 206 304 C 224 268 252 242 264 222 Z"
    fill="#006737"
  />
  <!-- Outer Right Book Page -->
  <path
    d="M 336 104 Q 305 95 274 112 L 274 226 C 258 252 232 282 214 312 C 250 278 294 258 341 256 Z"
    fill="#006737"
  />

  <!-- Central Nib Breath-Hole Oval -->
  <ellipse
    cx="200"
    cy="211"
    rx="14"
    ry="10"
    fill="#ffffff"
    stroke="#1e1b18"
    stroke-width="1.2"
  />

  <!-- Bottom Banner Ribbon: I SHALL RISE AND SHINE -->
  <!-- Left Swallowtail Wing & Fold -->
  <path
    d="M 85 290 L 41 257 L 29 281 L 9 280 L 49 336 L 78 320 Z"
    fill="#ffffff"
    stroke="#1e1b18"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <path
    d="M 56 308 L 85 290 L 76 320 Z"
    fill="#ffffff"
    stroke="#1e1b18"
    stroke-width="2"
    stroke-linejoin="round"
  />

  <!-- Right Swallowtail Wing & Fold -->
  <path
    d="M 315 290 L 359 257 L 371 281 L 391 280 L 351 336 L 322 320 Z"
    fill="#ffffff"
    stroke="#1e1b18"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <path
    d="M 344 308 L 315 290 L 324 320 Z"
    fill="#ffffff"
    stroke="#1e1b18"
    stroke-width="2"
    stroke-linejoin="round"
  />

  <!-- Front Curved Scroll Banner -->
  <path
    d="M 56 308 Q 200 398 344 308 L 358 352 Q 200 452 42 352 Z"
    fill="#ffffff"
    stroke="#1e1b18"
    stroke-width="2.2"
    stroke-linejoin="round"
  />

  <!-- Ribbon Motto Text -->
  <text
    font-family="Arial, Helvetica, sans-serif"
    font-size="19.5"
    font-weight="900"
    fill="#1e1b18"
    letter-spacing="0.4"
  >
    <textPath href="#apsacs-motto-arc" startOffset="50%" text-anchor="middle">
      I SHALL RISE AND SHINE
    </textPath>
  </text>
</svg>`;

let cachedDefaultPngDataUrl: string | null = null;

function renderImageToPngBytes(
  src: string,
  targetWidth: number,
  targetHeight: number,
): Promise<{ dataUrl: string; bytes: Uint8Array; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const naturalW = img.naturalWidth || targetWidth;
      const naturalH = img.naturalHeight || targetHeight;
      const scale = Math.min(targetWidth / naturalW, targetHeight / naturalH);
      const drawW = Math.max(1, Math.round(naturalW * scale));
      const drawH = Math.max(1, Math.round(naturalH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = drawW;
      canvas.height = drawH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable for monogram rendering.'));
        return;
      }
      ctx.clearRect(0, 0, drawW, drawH);
      ctx.drawImage(img, 0, 0, drawW, drawH);

      const dataUrl = canvas.toDataURL('image/png');
      canvas.toBlob(async (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode monogram PNG.'));
          return;
        }
        const buffer = await blob.arrayBuffer();
        resolve({
          dataUrl,
          bytes: new Uint8Array(buffer),
          width: drawW,
          height: drawH,
        });
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Failed to load monogram image.'));
    img.src = src;
  });
}

export async function getApsacsMonogramPngDataUrl(): Promise<string> {
  if (cachedDefaultPngDataUrl) return cachedDefaultPngDataUrl;
  const svgBlob = new Blob([APSACS_MONOGRAM_SVG], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(svgBlob);
  try {
    const result = await renderImageToPngBytes(blobUrl, 480, 492);
    cachedDefaultPngDataUrl = result.dataUrl;
    return result.dataUrl;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export async function getMonogramForWordExport(
  customDataUrl?: string,
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  try {
    if (customDataUrl && customDataUrl.trim()) {
      const res = await renderImageToPngBytes(customDataUrl.trim(), 360, 370);
      return { bytes: res.bytes, width: res.width, height: res.height };
    }
    const pngDataUrl = await getApsacsMonogramPngDataUrl();
    const res = await renderImageToPngBytes(pngDataUrl, 480, 492);
    return { bytes: res.bytes, width: res.width, height: res.height };
  } catch {
    return null;
  }
}

export async function normalizeUploadedMonogramFile(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const res = await renderImageToPngBytes(objectUrl, 360, 370);
    return res.dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
