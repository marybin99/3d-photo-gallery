import { useEffect, useRef, useState } from 'react'
import { loadYoutubeApi, type YoutubePlayerInstance } from '../youtubeApi'

const ENDED = 0
const PLAYING = 1

export default function YouTubePlayer({
  artworkId, videoId, title, positions, controls = true,
}: {
  artworkId: string
  videoId: string
  title: string
  positions: Map<string, number>
  controls?: boolean
}) {
  const host=useRef<HTMLDivElement>(null)
  const [error,setError]=useState('')
  useEffect(()=>{
    const key = `${artworkId}:${videoId}`
    let disposed=false
    let player:YoutubePlayerInstance|undefined
    let ready=false
    let startRequested=false
    let hasPlayed=false
    setError('')
    const visibility = () => {
      if (!ready || !player) return
      if (document.hidden) {
        player.pauseVideo()
        return
      }
      player.mute()
      const startSeconds = startRequested ? 0 : positions.get(key) ?? 0
      startRequested = true
      if (startSeconds > 0) player.loadVideoById({ videoId, startSeconds })
      else player.playVideo()
    }
    document.addEventListener('visibilitychange',visibility)
    void loadYoutubeApi().then(api=>{
      if(disposed||!host.current)return
      const element=document.createElement('div');host.current.replaceChildren(element)
      player=new api.Player(element,{
        videoId,width:'100%',height:'100%',
        playerVars:{autoplay:0,controls:controls?1:0,disablekb:controls?0:1,fs:controls?1:0,playsinline:1,rel:0,origin:window.location.origin},
        events:{
          onReady:({target})=>{
            if(disposed)return
            ready=true
            const iframe=target.getIframe()
            iframe.title=title
            if(!controls)iframe.tabIndex=-1
            iframe.allow='autoplay; encrypted-media; picture-in-picture; fullscreen'
            iframe.referrerPolicy='strict-origin-when-cross-origin'
            visibility()
          },
          onStateChange:({data})=>{if(data===PLAYING)hasPlayed=true},
          onError:()=>{if(!disposed)setError('이 영상은 여기서 재생할 수 없습니다. YouTube에서 확인해 주세요.')},
        },
      })
    }).catch(()=>{if(!disposed)setError('유튜브에 연결하지 못했습니다. YouTube에서 확인해 주세요.')})
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', visibility)
      if (!player) return
      // Opening and leaving before playback begins must preserve the previous position.
      if (hasPlayed) {
        const position = player.getCurrentTime()
        if (player.getPlayerState() === ENDED) positions.delete(key)
        else if (Number.isFinite(position) && position >= 0) positions.set(key, position)
      }
      player.destroy()
    }
  },[artworkId,videoId,title,positions,controls])
  return <div className="youtube-player">
    <div className="youtube-player-host" ref={host} hidden={!!error}/>
    {error&&<div className="youtube-error"><p>{error}</p><a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer">YouTube에서 영상 보기 ↗</a></div>}
  </div>
}
