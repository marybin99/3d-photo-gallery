import type { GalleryLayout } from './types.ts'

// Keep rooms and labels at a readable scale; a long wing scrolls vertically.
export function minimapGeometry(layout: GalleryLayout) {
  const minX=Math.min(...layout.areas.map(area=>area.x-area.width/2))
  const maxX=Math.max(...layout.areas.map(area=>area.x+area.width/2))
  const minZ=Math.min(...layout.areas.map(area=>area.z-area.depth/2))
  const maxZ=Math.max(...layout.areas.map(area=>area.z+area.depth/2))
  const scale=196/(maxX-minX)
  return {width:220,height:Math.max(152,(maxZ-minZ)*scale+24),scale,
    mapX:(x:number)=>12+(x-minX)*scale,mapY:(z:number)=>12+(z-minZ)*scale}
}
