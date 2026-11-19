import { PlaneGeometry } from 'three'

export function createCurtainGeometry() {
  const geometry=new PlaneGeometry(4.08,4.08,96,32)
  const positions=geometry.attributes.position
  for(let index=0;index<positions.count;index++){
    const x=positions.getX(index)
    const y=positions.getY(index)
    const length=(2.04-y)/4.08
    // Narrow hanging pleats broaden slightly toward the weighted hem.
    const fold=Math.cos((x+2.04)/4.08*Math.PI*20)
    positions.setZ(index,.06+fold*(.075+.035*length))
    positions.setY(index,y-.035*length*Math.sin(x*4)**2)
  }
  positions.needsUpdate=true
  geometry.computeVertexNormals()
  return geometry
}
