// Local user-supplied recording and private imported clips. No microphone or network.
window.CupboxPetFeedback=(()=>{
 let loader=null,clips,media=null,pendingEnd=null,lastPlay=-Infinity,revision=0;
 function setLoader(value){stop();loader=value;clips=undefined;}
 function reset(){stop();clips=undefined;}
 async function playClip(clip,ticket){
  if(ticket!==revision)return null;
  const audio=new window.Audio(clip.data);audio.volume=.45;audio.playbackRate=clip.playbackRate===2?2:1;audio.preservesPitch=true;media=audio;
  return new Promise(resolve=>{let timer;const finish=ok=>{clearTimeout(timer);audio.onended=null;audio.onerror=null;if(media===audio)media=null;if(pendingEnd===cancel)pendingEnd=null;resolve(ok);};const cancel=()=>finish(null);pendingEnd=cancel;audio.onended=()=>finish(true);audio.onerror=()=>finish(false);timer=setTimeout(()=>{audio.pause();finish(false);},4000);Promise.resolve(audio.play()).catch(()=>finish(false));});
 }
 async function play(enabled=true){
  if(!enabled)return false;const now=performance.now();if(now-lastPlay<160)return null;lastPlay=now;const ticket=++revision;
  try{
   if(clips===undefined){const loaded=await loader?.()||null;if(ticket!==revision)return null;clips=loaded;}
   if(ticket!==revision)return null;if(!clips?.press)return false;
   stopVoices();const result=await playClip(clips.press,ticket);if(result!==true||!clips.release)return result;
   return playClip(clips.release,ticket);
  }catch{return false;}
 }
 function stopVoices(){media?.pause();media=null;pendingEnd?.();pendingEnd=null;}
 function stop(){revision++;stopVoices();}
 return{play,stop,setLoader,reset,dispose(){stop();loader=null;clips=undefined;}};
})();
