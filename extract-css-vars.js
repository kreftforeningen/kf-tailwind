import fs from "fs";
import path from "path";

const cssFile = path.resolve("index.css");
const jsonDir = path.resolve("json");
const extendedColorsFile = path.join(jsonDir, "extended-colors.json");

const css = fs.readFileSync(cssFile, "utf8");

// Find the @theme { ... } block
const themeBlockRegex = /@theme\s*\{([\s\S]*?)\}/g;
const colorVarRegex = /--color-([a-zA-Z0-9]+)-([0-9]{2,3}):\s*([^;]+);/g;

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

// Ensure the json directory exists
fs.mkdirSync(jsonDir, { recursive: true });

fs.writeFileSync(extendedColorsFile, JSON.stringify(colorArray, null, 2));
console.log(
  `Extracted ${colorArray.length} extended colors to ${extendedColorsFile}`
);
