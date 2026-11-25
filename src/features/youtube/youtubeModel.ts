export function youtubeVideoId(value: string): string {
  let url: URL
  try { url=new URL(value.trim()) } catch { throw new Error('올바른 유튜브 영상 링크를 입력해 주세요.') }
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port)
    throw new Error('올바른 유튜브 영상 링크를 입력해 주세요.')
  const host=url.hostname.toLowerCase()
  const parts=url.pathname.split('/').filter(Boolean)
  let id:string|null=null
  if(host==='youtu.be'&&parts.length===1)id=parts[0]
  else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','www.youtube-nocookie.com'].includes(host)){
    if(url.pathname==='/watch')id=url.searchParams.get('v')
    else if(parts.length===2&&['embed','shorts','live'].includes(parts[0]))id=parts[1]
  }
  if(!id||!/^[A-Za-z0-9_-]{11}$/.test(id))throw new Error('유튜브의 개별 영상 링크를 입력해 주세요. 재생목록 링크는 지원하지 않습니다.')
  return id
}
export function normalizeYoutubeUrl(value: string) {
  return `https://www.youtube.com/watch?v=${youtubeVideoId(value)}`
}
export function youtubeThumbnail(id: string) {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
}
