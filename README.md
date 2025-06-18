# kf-tailwind

Tailwind CSS styles for Kreftforeningen based on Tailwind 4.

## Installation

- `pnpm add kf-tailwind`
- `@import "kf-tailwind/index.css";` at the top of your main tailwind css file

## Content

### Semantic elements

Basic styling for semantic elements such as:

- Headings
- Blockquote

### Colors

Colors in oklch. Main colors also in hex.

- KF Blue
- KF Green
- KF Orange
- KF Red
- KF Pink
- KF Purple
- Grey
- Black
- White
- Vipps

### Fonts

- IBM Plex Sans
- IBM Plex Condesed
- IBM Plex Serif

### Animations

- Pulsating text
- Fade in / fade out

## Color Extraction

To extract all color variables from the CSS into JSON files, run:

```sh
pnpm run build
```

This will generate:

- `json/colors.json` with all `--kf-hex-color-***` variables
- `json/extended-colors.json` with all `--color-***` variables from the `@theme { ... }` block

## NPM.js

This git is published as a package on https://www.npmjs.com/package/kf-tailwind
