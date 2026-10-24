import {describe,it,expect} from 'vitest';import {createPetReplies} from '../desktop/pet/replies.js';
import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';
describe('筑梦喵 local feedback',()=>{
 it('varies touch responses without repeating the immediately preceding lines',()=>{
  let stamp=new Date(2026,9,22,12).getTime();const replies=createPetReplies({random:()=>0,now:()=>new Date(stamp+=2000)}),seen=new Set<string>();
  for(const zone of ['head','face','body']){let previous='';for(let i=0;i<10;i++){const text=replies.tap(zone);expect(text).not.toBe(previous);expect(text.length).toBeLessThanOrEqual(40);previous=text;seen.add(text);}}
  expect(seen.size).toBeGreaterThanOrEqual(24);
 });
 it('uses different responses when busy or sleeping and keeps rapid clicks playful',()=>{
  const make=()=>createPetReplies({random:()=>0,now:()=>new Date(2026,9,22,12)});
  expect(make().tap('head','working')).not.toBe(make().tap('head','sleep'));
  const replies=make();const first=replies.tap();expect(replies.tap()).not.toBe(first);expect(replies.action('heart')).toContain('心');
 });
 it('gives new actions their own nonrepeating dialogue and mentions the selected holiday clothes',()=>{
  const replies=createPetReplies({random:()=>0,now:()=>new Date(2026,9,24,12)}),seen=new Set<string>();
  for(const pose of ['nod','headtilt','eartwitch','peek','pawwave','thankyou','yawn','proud'])for(let i=0;i<5;i++)seen.add(replies.action(pose));
  expect(seen.size).toBe(40);expect(replies.tap('body','idle','dragonboat')).toContain('粽');
 });
 it('plays the default recording once at 2x with bounded volume and no synthetic fallback',async()=>{
  const players:any[]=[];const window:any={Audio:class{volume=1;playbackRate=1;onended:any;constructor(){players.push(this);}play(){return Promise.resolve();}pause(){}}};runInNewContext(readFileSync(new URL('../desktop/pet/feedback.js',import.meta.url),'utf8'),{window,performance:{now:()=>1000},setTimeout,clearTimeout});
  window.CupboxPetFeedback.setLoader(async()=>({press:{data:'recording',playbackRate:2},release:null}));const playback=window.CupboxPetFeedback.play();await new Promise(r=>setTimeout(r,0));expect(players[0].playbackRate).toBe(2);expect(players[0].volume).toBeLessThanOrEqual(.5);players[0].onended();expect(await playback).toBe(true);expect(players).toHaveLength(1);
 });
 it('does not create audio when sound is disabled',async()=>{
  let created=0;const window:any={Audio:class{constructor(){created++;}}};runInNewContext(readFileSync(new URL('../desktop/pet/feedback.js',import.meta.url),'utf8'),{window,performance:{now:()=>1000}});
  expect(await window.CupboxPetFeedback.play(false)).toBe(false);expect(created).toBe(0);
 });
 it('plays imported press/release in order, and stopping prevents the queued release',async()=>{
  const players:any[]=[];let clock=1000;
  const window:any={Audio:class{volume=1;onended:any;onerror:any;src:string;constructor(src:string){this.src=src;players.push(this);}play(){return Promise.resolve();}pause(){}}};
  runInNewContext(readFileSync(new URL('../desktop/pet/feedback.js',import.meta.url),'utf8'),{window,performance:{now:()=>clock},setTimeout,clearTimeout});
  const feedback=window.CupboxPetFeedback;feedback.setLoader(async()=>({press:{data:'press'},release:{data:'release'}}));
   const first=feedback.play();await new Promise(r=>setTimeout(r,0));expect(players[0].src).toBe('press');players[0].onended();await new Promise(r=>setTimeout(r,0));expect(players[1].src).toBe('release');players[1].onended();expect(await first).toBe(true);
  clock+=1000;const second=feedback.play();await Promise.resolve();expect(players[2].src).toBe('press');feedback.stop();expect(await second).toBe(null);expect(players).toHaveLength(3);
 });
 it('does not start audio after muting while its local data is still loading',async()=>{
  let finish:any,created=0;const window:any={Audio:class{constructor(){created++;}}};
  runInNewContext(readFileSync(new URL('../desktop/pet/feedback.js',import.meta.url),'utf8'),{window,performance:{now:()=>1000},setTimeout,clearTimeout});
  const feedback=window.CupboxPetFeedback;feedback.setLoader(()=>new Promise(r=>{finish=r;}));const playing=feedback.play();feedback.stop();finish({press:{data:'press'},release:{data:'release'}});expect(await playing).toBe(null);expect(created).toBe(0);
 });
 it('does not restore stale custom audio when resetting during an in-flight load',async()=>{
  let finish:any,clock=1000,created=0,loads=0;const window:any={Audio:class{constructor(){created++;}}};
  runInNewContext(readFileSync(new URL('../desktop/pet/feedback.js',import.meta.url),'utf8'),{window,performance:{now:()=>clock},setTimeout,clearTimeout});
  const feedback=window.CupboxPetFeedback;feedback.setLoader(()=>{loads++;return loads===1?new Promise(r=>{finish=r;}):null;});const old=feedback.play();feedback.reset();finish({press:{data:'old'},release:{data:'old'}});expect(await old).toBe(null);clock+=1000;await feedback.play();expect(loads).toBe(2);expect(created).toBe(0);
 });
});
