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

// Convert to array format with "values" object
const colorArray = Object.entries(colorGroups).map(([name, values]) => ({
  name,
  values,
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
const basicColors = Object.entries(basicHexColors).map(([name, hex]) => {
  const oklch = resolveOklchForBaseName(name);
  const rgba = hexToRgbaString(hex);
  return {
    name,
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
