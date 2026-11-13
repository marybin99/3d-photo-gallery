import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createRoomRepository } from './roomRepository'
import { namesFromRecords, type RoomRecord } from './roomModel'

export function useRoomNames(client:SupabaseClient|null) {
  const repository=useMemo(()=>client?createRoomRepository(client):null,[client])
  const [records,setRecords]=useState<RoomRecord[]>([])
  const [loading,setLoading]=useState(!!client),[error,setError]=useState('')
  const generation=useRef(0),mounted=useRef(true),writing=useRef(false)
  const reload=useCallback(async()=>{
    if(!repository||writing.current)return
    const id=++generation.current
    setLoading(true);setError('')
    try{
      const next=await repository.list()
      if(mounted.current&&id===generation.current)setRecords(next)
    }catch(reason){if(mounted.current&&id===generation.current)setError(reason instanceof Error?reason.message:'전시실 정보를 불러오지 못했습니다.')}
    finally{if(mounted.current&&id===generation.current)setLoading(false)}
  },[repository])
  useEffect(()=>{
    mounted.current=true;void reload()
    const refresh=()=>{if(document.visibilityState==='visible')void reload()}
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh)
    const timer=window.setInterval(()=>void reload(),5*60*1000)
    return()=>{mounted.current=false;++generation.current;window.clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)}
  },[reload])
  const save=async(record:RoomRecord,name:string)=>{
    if(!repository)throw new Error('Supabase 연결이 필요합니다.')
    if(writing.current)throw new Error('다른 전시실 이름을 저장 중입니다. 잠시 후 다시 시도해 주세요.')
    writing.current=true;++generation.current;setLoading(false)
    try{
      const next=await repository.rename(record,name)
      if(mounted.current){setRecords(items=>items.map(item=>item.id===next.id?next:item));setError('')}
      return next
    }finally{writing.current=false}
  }
  return {records,names:namesFromRecords(records),loading,error,reload,save}
}
