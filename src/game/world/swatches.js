// The Kenney packs colour every model from one shared 512x512 "colormap"
// image made of swatches (8 columns x 4 rows). A model's paint is just the
// swatch its UVs point at, so recolouring = moving UVs to another swatch.
// No new textures, and every car still shares one material (fast on phones).
//
// Cells are [column, row]. Measured from the car-kit GLBs:
//   van paint [7,1] blue · taxi [4,1] · sedan [6,1] · truck [3,1]
//   police paint [6,2] white · shared trim [3,2] grey · windows/tyres [2,2]

export const ATLAS_GRID = { cols: 8, rows: 4 }

export const SWATCHES = {
  'car-kit': {
    danfoYellow: [1, 3],
    yellow: [4, 1],
    orange: [5, 1],
    red: [6, 1],
    blue: [7, 1],
    green: [3, 1],
    teal: [4, 3],
    white: [6, 2],
    grey: [3, 2],
    black: [1, 2],
    brown: [0, 1],
  },
}

/** Resolves "danfoYellow" or [col,row] to a cell. */
export function swatchCell(pack, nameOrCell) {
  if (Array.isArray(nameOrCell)) return nameOrCell
  const cell = SWATCHES[pack]?.[nameOrCell]
  if (!cell) throw new Error(`Unknown swatch "${nameOrCell}" for ${pack}`)
  return cell
}
