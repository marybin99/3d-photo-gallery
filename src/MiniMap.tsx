import { useEffect, useMemo, useRef } from 'react'
import { areaAt, BOOK, type GalleryLayout } from './layout'
import { minimapGeometry } from './minimapModel'
import { roomName, mapNameLines, type RoomNames } from './roomModel'
import type { Pose } from './Gallery'

export default function MiniMap({pose,names,layout}:{pose:Pose;names:RoomNames;layout:GalleryLayout}) {
  const viewport=useRef<HTMLDivElement>(null)
  const map=useMemo(()=>minimapGeometry(layout),[layout])
  const {mapX,mapY,scale}=map
  const current=areaAt(pose.x,pose.z,layout)
  useEffect(()=>{
    const element=viewport.current
    if(!element)return
    const y=map.mapY(pose.z)*element.clientWidth/map.width
    if(y<element.scrollTop+16||y>element.scrollTop+element.clientHeight-16)
      element.scrollTop=Math.max(0,y-element.clientHeight/2)
  },[pose.z,map])
  return <div className="minimap" aria-label="전시관 미니맵">
    <div className="minimap-heading"><span>GALLERY MAP</span><span className="live-dot"/></div>
    <div className="minimap-viewport" ref={viewport} tabIndex={0} role="region" aria-label="전시관 전체 지도, 위아래로 스크롤">
      <svg viewBox={`0 0 ${map.width} ${map.height}`} role="img" aria-label={`현재 위치: ${roomName(current.id,names)}`}>
        {layout.areas.map(area=><g key={area.id} data-map-area={area.id}>
          <rect x={mapX(area.x-area.width/2)} y={mapY(area.z-area.depth/2)} width={area.width*scale} height={area.depth*scale} fill={area.color} stroke="#8b7c6b" strokeWidth="2"/>
          {area.id==='CORRIDOR'?<text x={mapX(area.x)} y={mapY(12)} textAnchor="middle" fill="#54483c" fontSize="7">통로</text>:
            <text x={mapX(area.x)} y={mapY(area.z)-7} textAnchor="middle" fill="#54483c" fontSize="7">
              {mapNameLines(roomName(area.id,names)).map((line,index)=><tspan key={index} x={mapX(area.x)} dy={index===0?0:9}>{line}</tspan>)}
            </text>}
        </g>)}
        {layout.doorways.map(door=><path key={door.zone} data-map-door={door.zone}
          d={Math.abs(Math.cos(door.rotation))>.5?`M${mapX(door.x-2)} ${mapY(door.z)}h${4*scale}`:`M${mapX(door.x)} ${mapY(door.z-2)}v${4*scale}`}
          stroke="#c7b49b" strokeWidth="4"/>)}
        <g aria-label="로비 방명록" transform={`translate(${mapX(BOOK.x)} ${mapY(BOOK.z)})`}>
          <rect x="-5" y="-3" width="10" height="6" fill="#fff8e5" stroke="#80684f"/><path d="M0 -3V3" stroke="#80684f"/>
        </g>
        <g transform={`translate(${mapX(pose.x)} ${mapY(pose.z)}) rotate(${(-pose.yaw*180)/Math.PI})`}>
          <circle r="4" fill="#7e637d" stroke="white" strokeWidth="1.5"/><path d="M0 -9L-3 -3L3 -3Z" fill="#7e637d"/>
        </g>
      </svg>
    </div>
  </div>
}
