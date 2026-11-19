export type YoutubePlayerInstance = {
  mute:()=>void; playVideo:()=>void; pauseVideo:()=>void; destroy:()=>void;
  getIframe:()=>HTMLIFrameElement;
}
type YoutubeApi = { Player:new(element:HTMLElement,options:{
  videoId:string; width:string; height:string;
  playerVars:Record<string,string|number>;
  events:{onReady:(event:{target:YoutubePlayerInstance})=>void;onError:(event:{data:number})=>void};
})=>YoutubePlayerInstance }
let pending:Promise<YoutubeApi>|null=null

export function loadYoutubeApi():Promise<YoutubeApi> {
  const target=window as unknown as {YT?:YoutubeApi;onYouTubeIframeAPIReady?:()=>void}
  if(target.YT?.Player)return Promise.resolve(target.YT)
  if(pending)return pending
  pending=new Promise((resolve,reject)=>{
    const previous=target.onYouTubeIframeAPIReady
    const script=document.createElement('script')
    const fail=()=>{pending=null;script.remove();reject(new Error('유튜브에 연결하지 못했습니다.'))}
    const timer=window.setTimeout(fail,15000)
    target.onYouTubeIframeAPIReady=()=>{
      window.clearTimeout(timer)
      try{previous?.()}finally{if(target.YT?.Player)resolve(target.YT);else fail()}
    }
    script.src='https://www.youtube.com/iframe_api'
    script.async=true
    script.onerror=()=>{window.clearTimeout(timer);fail()}
    document.head.append(script)
  })
  return pending
}
