export type Artwork = { id: string; title: string; description: string; image: string; position: [number,number,number]; rotation: number; zone: string }
export const artworks: Artwork[] = [
  {id:'01', title:'오후의 바람', description:'멀리 떠나지 않아도 만날 수 있는 풍경.', image:'/artworks/01.svg', position:[-23.75,2.1,-3.8],rotation:Math.PI/2,zone:'A'},
  {id:'02', title:'천천히 걷는 날', description:'어느 골목에서 발견한 작은 평온.', image:'/artworks/02.svg', position:[-23.75,2.1,0],rotation:Math.PI/2,zone:'A'},
  {id:'03', title:'푸른 오후', description:'하늘이 오래 머물렀던 시간.', image:'/artworks/03.svg', position:[-23.75,2.1,4],rotation:Math.PI/2,zone:'A'},
  {id:'04', title:'빛의 조각', description:'익숙한 풍경에도 새로운 표정이 있다.', image:'/artworks/04.svg', position:[-23.75,2.1,7.8],rotation:Math.PI/2,zone:'A'},
  {id:'05', title:'수평선', description:'어디까지가 바다고 어디부터가 하늘일까.', image:'/artworks/05.svg', position:[-5.7,2.1,-21.75],rotation:0,zone:'B'},
  {id:'06', title:'여름의 온도', description:'빛과 온도로 남은 기억.', image:'/artworks/06.svg', position:[-1.9,2.1,-21.75],rotation:0,zone:'B'},
  {id:'07', title:'고요한 거리', description:'아무도 없는 길을 걷던 순간.', image:'/artworks/07.svg', position:[1.9,2.1,-21.75],rotation:0,zone:'B'},
  {id:'08', title:'마지막 노을', description:'하루의 끝이 가장 아름답던 날.', image:'/artworks/08.svg', position:[5.7,2.1,-21.75],rotation:0,zone:'B'},
  {id:'09', title:'느린 계절', description:'천천히 달라지는 색을 바라보며.', image:'/artworks/09.svg', position:[23.75,2.1,-3.8],rotation:-Math.PI/2,zone:'C'},
  {id:'10', title:'낯선 풍경', description:'처음이었지만 어딘가 익숙했던 곳.', image:'/artworks/10.svg', position:[23.75,2.1,0],rotation:-Math.PI/2,zone:'C'},
  {id:'11', title:'조용한 파도', description:'걷다가 잠깐 멈춰 서기로 했다.', image:'/artworks/11.svg', position:[23.75,2.1,4],rotation:-Math.PI/2,zone:'C'},
  {id:'12', title:'다시 봄', description:'끝나고 나면 새롭게 시작되는 것들.', image:'/artworks/12.svg', position:[23.75,2.1,7.8],rotation:-Math.PI/2,zone:'C'},
]
