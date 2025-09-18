import fs from "fs";
import path from "path";

const cssFile = path.resolve("index.css");
const jsonDir = path.resolve("json");
const extendedColorsFile = path.join(jsonDir, "extended-colors.json");
const basicColorsFile = path.join(jsonDir, "basic-colors.json");
const vippsColorsFile = path.join(jsonDir, "vipps-colors.json");
const pinkRibbonColorsFile = path.join(jsonDir, "pink-ribbon-colors.json");

const css = fs.readFileSync(cssFile, "utf8");

// Find the @theme { ... } block for extended colors
const themeBlockRegex = /@theme\s*\{([\s\S]*?)\}/g;
// Allow hyphenated group names like "pink-ribbon"
const colorVarRegex = /--color-([a-zA-Z0-9-]+)-([0-9]{2,3}):\s*([^;]+);/g;
// Match base hex color variables anywhere in the CSS
const hexColorVarRegex =
  /--kf-hex-color-([a-zA-Z0-9_-]+):\s*(#[0-9a-fA-F]{3,8});/g;
// Capture the @theme inline block for base aliases like --color-blue: var(--color-blue-600)
const themeInlineBlockRegex = /@theme\s+inline\s*\{([\s\S]*?)\}/g;
// Match simple color aliases inside the inline block
const baseAliasRegex = /--color-([a-zA-Z0-9-]+):\s*([^;]+);/g;

let themeBlockMatch;
const colorGroups = {};

while ((themeBlockMatch = themeBlockRegex.exec(css)) !== null) {
  const themeBlock = themeBlockMatch[1];
  let colorMatch;
  while ((colorMatch = colorVarRegex.exec(themeBlock)) !== null) {
    const [, name, shade, value] = colorMatch;
    if (!colorGroups[name]) colorGroups[name] = {};
    colorGroups[name][shade] = value.trim();
  }
}

// Utilities to parse OKLCH and convert to RGB/HEX
function parseOklch(oklchString) {
  // Accept forms like: oklch(0.736 0.15 352.18) or oklch(73.6% 0.15 352.18deg)
  const match = /oklch\(\s*([^\s]+)\s+([^\s]+)\s+([^\s\)]+)\s*\)/i.exec(
    oklchString
  );
  if (!match) return null;
  let [_, lStr, cStr, hStr] = match;
  let L = lStr.endsWith("%") ? parseFloat(lStr) / 100 : parseFloat(lStr);
  const C = parseFloat(cStr);
  let h = hStr.endsWith("deg") ? parseFloat(hStr) : parseFloat(hStr);
  if (Number.isNaN(L) || Number.isNaN(h) || Number.isNaN(C)) return null;
  // Clamp L to [0,1]
  L = Math.min(1, Math.max(0, L));
  return { L, C, h };
}

function oklchToRgb({ L, C, h }) {
  const hRad = (h * Math.PI) / 180;
  const aComp = C * Math.cos(hRad);
  const bComp = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * aComp + 0.2158037573 * bComp;
  const m_ = L - 0.1055613458 * aComp - 0.0638541728 * bComp;
  const s_ = L - 0.0894841775 * aComp - 1.291485548 * bComp;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  let rLin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  function linToSrgb(x) {
    return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  }

  let r = Math.round(Math.min(1, Math.max(0, linToSrgb(rLin))) * 255);
  let g = Math.round(Math.min(1, Math.max(0, linToSrgb(gLin))) * 255);
  let blue = Math.round(Math.min(1, Math.max(0, linToSrgb(bLin))) * 255);
  return { r, g, b: blue };
}

function rgbToHex({ r, g, b }) {
  const toHex = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToRgbaString({ r, g, b }) {
  return `rgba(${r}, ${g}, ${b}, 1)`;
}

function enrichValuesWithFormats(values) {
  const enriched = {};
  for (const [shade, oklchValue] of Object.entries(values)) {
    const parsed = parseOklch(oklchValue);
    if (!parsed) {
      enriched[shade] = { oklch: oklchValue, hex: null, rgba: null };
      continue;
    }
    const rgb = oklchToRgb(parsed);
    const hex = rgbToHex(rgb);
    const rgba = rgbToRgbaString(rgb);
    enriched[shade] = { oklch: oklchValue, hex, rgba };
  }
  return enriched;
}

// Convert to array format with formatted values and a CSS variable name
const colorArray = Object.entries(colorGroups).map(([name, values]) => ({
  name,
  variable: `--color-${name}`,
  values: enrichValuesWithFormats(values),
}));

// Split out vipps and pink-ribbon
const vippsArray = colorArray.filter((c) => c.name === "vipps");
const pinkRibbonArray = colorArray.filter((c) => c.name === "pink-ribbon");
const extendedArray = colorArray.filter(
  (c) => c.name !== "vipps" && c.name !== "pink-ribbon"
);

// Extract basic hex colors into a map
const basicHexColors = {};
let hexMatch;
while ((hexMatch = hexColorVarRegex.exec(css)) !== null) {
  const [, name, value] = hexMatch;
  basicHexColors[name] = value.toLowerCase();
}

// Parse @theme inline aliases into a map
const baseAliasMap = {};
let inlineMatch;
while ((inlineMatch = themeInlineBlockRegex.exec(css)) !== null) {
  const inlineBlock = inlineMatch[1];
  let aliasMatch;
  while ((aliasMatch = baseAliasRegex.exec(inlineBlock)) !== null) {
    const [, name, value] = aliasMatch;
    // Skip entries that look like palette entries with numeric suffix just in case
    if (/\-\d{2,3}$/.test(name)) continue;
    baseAliasMap[name] = value.trim();
  }
}

// Helper to compute RGBA from hex
function hexToRgbaString(hex) {
  const h = hex.replace(/^#/, "");
  let r,
    g,
    b,
    a = 255;
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16);
    g = parseInt(h[1] + h[1], 16);
    b = parseInt(h[2] + h[2], 16);
  } else if (h.length === 4) {
    r = parseInt(h[0] + h[0], 16);
    g = parseInt(h[1] + h[1], 16);
    b = parseInt(h[2] + h[2], 16);
    a = parseInt(h[3] + h[3], 16);
  } else if (h.length === 6) {
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  } else if (h.length === 8) {
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
    a = parseInt(h.slice(6, 8), 16);
  } else {
    return `rgba(0, 0, 0, 1)`; // fallback
  }
  const alpha = +(a / 255).toFixed(3);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Resolve an OKLCH string for a base color name
function resolveOklchForBaseName(baseName) {
  const alias = baseAliasMap[baseName];
  if (!alias) return undefined;
  const trimmed = alias.trim();
  if (trimmed.startsWith("oklch")) {
    return trimmed;
  }
  const varRefMatch = /var\(\s*--color-([a-zA-Z0-9-]+)-([0-9]{2,3})\s*\)/.exec(
    trimmed
  );
  if (varRefMatch) {
    const [, group, shade] = varRefMatch;
    const groupValues = colorGroups[group];
    if (groupValues && groupValues[shade]) return groupValues[shade];
  }
  return undefined;
}

// Build the requested array structure with hex, oklch, and rgba
// Use the full variable name as the exported name (e.g., kf-hex-color-black)
const basicColors = Object.entries(basicHexColors).map(([baseName, hex]) => {
  const oklch = resolveOklchForBaseName(baseName);
  const varName = `--kf-hex-color-${baseName}`;
  const rgba = hexToRgbaString(hex);
  return {
    name: varName,
    values: {
      hex,
      oklch: oklch ?? null,
      rgba,
    },
  };
});

// Ensure the json directory exists
fs.mkdirSync(jsonDir, { recursive: true });

fs.writeFileSync(extendedColorsFile, JSON.stringify(extendedArray, null, 2));
fs.writeFileSync(basicColorsFile, JSON.stringify(basicColors, null, 2));
fs.writeFileSync(vippsColorsFile, JSON.stringify(vippsArray, null, 2));
fs.writeFileSync(
  pinkRibbonColorsFile,
  JSON.stringify(pinkRibbonArray, null, 2)
);
console.log(
  `Extracted ${extendedArray.length} extended colors to ${extendedColorsFile}`
);
console.log(
  `Extracted ${basicColors.length} basic colors to ${basicColorsFile}`
);
console.log(
  `Extracted ${vippsArray.length} vipps colors to ${vippsColorsFile}`
);
console.log(
  `Extracted ${pinkRibbonArray.length} pink-ribbon colors to ${pinkRibbonColorsFile}`
);
