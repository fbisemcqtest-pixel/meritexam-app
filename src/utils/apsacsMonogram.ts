export const APSACS_MONOGRAM_STORAGE_KEY = 'meritexam_apsacs_monogram_v1';

export const APSACS_MONOGRAM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 185" width="240" height="185">
  <defs>
    <path id="apsacs-top-arc" d="M 32 108 A 88 88 0 0 1 208 108" />
    <path id="apsacs-bottom-arc" d="M 68 153 Q 120 171 172 153" />
  </defs>

  <!-- Outer Arched System Name -->
  <text
    font-family="Arial, Helvetica, sans-serif"
    font-size="12.2"
    font-weight="900"
    fill="#0f172a"
    letter-spacing="0.35"
  >
    <textPath href="#apsacs-top-arc" startOffset="50%" text-anchor="middle">
      ARMY PUBLIC SCHOOLS &amp; COLLEGES
    </textPath>
  </text>

  <!-- Inner System Sub-label -->
  <text
    x="120"
    y="50"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="11"
    font-weight="900"
    fill="#0f172a"
    letter-spacing="1.6"
  >
    SYSTEM
  </text>

  <!-- Subtle Inner Laurel / Frame Arcs -->
  <path
    d="M 41 112 C 39 131 51 146 72 153"
    fill="none"
    stroke="#0f172a"
    stroke-width="2.4"
    stroke-linecap="round"
  />
  <path
    d="M 199 112 C 201 131 189 146 168 153"
    fill="none"
    stroke="#0f172a"
    stroke-width="2.4"
    stroke-linecap="round"
  />

  <!-- Central Crest Nib / Flame -->
  <path d="M 120 57 L 125 66 L 120 73 L 115 66 Z" fill="#0f172a" />

  <!-- Iconic APSACS Fanned Open Book — Left Wing (5 bold wedge pages) -->
  <path d="M 118 134 L 112 75 L 105 74 L 114 134 Z" fill="#0f172a" />
  <path d="M 112 134 L 99 75 L 91 77 L 107 135 Z" fill="#0f172a" />
  <path d="M 105 135 L 84 80 L 76 84 L 99 136 Z" fill="#0f172a" />
  <path d="M 97 137 L 69 89 L 62 95 L 91 138 Z" fill="#0f172a" />
  <path d="M 89 139 L 55 102 L 50 109 L 84 142 Z" fill="#0f172a" />

  <!-- Iconic APSACS Fanned Open Book — Right Wing (5 symmetrical bold wedge pages) -->
  <path d="M 122 134 L 128 75 L 135 74 L 126 134 Z" fill="#0f172a" />
  <path d="M 128 134 L 141 75 L 149 77 L 133 135 Z" fill="#0f172a" />
  <path d="M 135 135 L 156 80 L 164 84 L 141 136 Z" fill="#0f172a" />
  <path d="M 143 137 L 171 89 L 178 95 L 149 138 Z" fill="#0f172a" />
  <path d="M 151 139 L 185 102 L 190 109 L 156 142 Z" fill="#0f172a" />

  <!-- Book Spine Cradle Base -->
  <path
    d="M 82 144 Q 120 135 158 144 Q 120 151 82 144 Z"
    fill="#0f172a"
  />

  <!-- Bottom Motto Curve -->
  <text
    font-family="Arial, Helvetica, sans-serif"
    font-size="9.5"
    font-weight="800"
    fill="#0f172a"
    letter-spacing="1.5"
  >
    <textPath href="#apsacs-bottom-arc" startOffset="50%" text-anchor="middle">
      APSACS · IQRA
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
    const result = await renderImageToPngBytes(blobUrl, 480, 370);
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
      const res = await renderImageToPngBytes(customDataUrl.trim(), 360, 280);
      return { bytes: res.bytes, width: res.width, height: res.height };
    }
    const pngDataUrl = await getApsacsMonogramPngDataUrl();
    const res = await renderImageToPngBytes(pngDataUrl, 480, 370);
    return { bytes: res.bytes, width: res.width, height: res.height };
  } catch {
    return null;
  }
}

export async function normalizeUploadedMonogramFile(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const res = await renderImageToPngBytes(objectUrl, 360, 280);
    return res.dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
