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

// Extract basic hex colors into a flat object
const basicColors = {};
let hexMatch;
while ((hexMatch = hexColorVarRegex.exec(css)) !== null) {
  const [, name, value] = hexMatch;
  basicColors[name] = value.toLowerCase();
}

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
  `Extracted ${
    Object.keys(basicColors).length
  } basic colors to ${basicColorsFile}`
);
console.log(
  `Extracted ${vippsArray.length} vipps colors to ${vippsColorsFile}`
);
console.log(
  `Extracted ${pinkRibbonArray.length} pink-ribbon colors to ${pinkRibbonColorsFile}`
);
