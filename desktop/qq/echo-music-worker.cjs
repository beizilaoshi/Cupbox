// Run EchoMusic's pinned MIT API backend in an isolated, cancellable worker.
const {parentPort,workerData}=require('node:worker_threads');
const {createRequire}=require('node:module');
const {randomBytes}=require('node:crypto');
const request=createRequire(require.resolve('echomusic-api/package.json'));
const axios=request('axios');
axios.defaults.timeout=10000;
axios.defaults.maxContentLength=1024*1024;
axios.defaults.maxBodyLength=1024*1024;
axios.defaults.maxRedirects=0;
// OAuth modules perform a few direct axios requests as well as signed Kugou calls.
const trustedURL=value=>{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port||!['kugou.com','qq.com','weixin.qq.com'].some(d=>u.hostname===d||u.hostname.endsWith('.'+d)))throw Error('Invalid login destination');u.protocol='https:';return u;};
axios.interceptors.request.use(config=>{const u=trustedURL(new URL(config.url,config.baseURL||'https://gateway.kugou.com').href);config.url=u.href;config.baseURL=undefined;config.beforeRedirect=options=>{trustedURL(options.protocol+'//'+options.hostname+(options.port&&String(options.port)!=='443'?':'+options.port:'')+options.path);if(options.protocol!=='https:')throw Error('Invalid login redirect');};return config;});
const routes={playlists:'./module/user_playlist.js',playlistTracks:'./module/playlist_track_all_new.js',playlistPublicTracks:'./module/playlist_track_all.js',search:'./module/search.js',url:'./module/song_url.js',qrKey:'./module/login_qr_key.js',qrCheck:'./module/login_qr_check.js',profile:'./module/user_detail.js',smsSend:'./module/captcha_sent.js',smsLogin:'./module/login_cellphone.js',passwordLogin:'./module/login.js',qqCreate:'./module/login_qq_qr_create.js',qqCheck:'./module/login_qq_qr_check.js',wxCreate:'./module/login_wx_create.js',wxCheck:'./module/login_wx_check.js',wxLogin:'./module/login_openplat.js'};
void(async()=>{try{
 const route=routes[workerData.action];if(!route)throw Error('Unknown music operation');
 const api=request(route),{createRequest}=request('./util/request.js');
 const oauthCookie=workerData.action==='qqCheck'&&typeof workerData.params.cookie==='string'?Object.fromEntries(workerData.params.cookie.split(';').map(s=>{const i=s.indexOf('=');return i>0?[s.slice(0,i).trim(),s.slice(i+1).trim()]:null;}).filter(Boolean)):{};
 const cookie={KUGOU_API_MID:randomBytes(16).toString('hex'),...workerData.cookie,...oauthCookie};
 if(workerData.action==='qqCreate')axios.defaults.maxRedirects=5;if(workerData.action==='wxCheck')axios.defaults.timeout=25000;
 // The pinned upstream has some HTTP defaults. Credentials only travel over HTTPS.
 const send=options=>{const base=new URL(options.baseURL||'https://gateway.kugou.com');if(!/(^|\.)kugou\.com$/.test(base.hostname)||base.username||base.password||base.port)throw Error('Invalid music destination');base.protocol='https:';return createRequest({...options,cookie:{...cookie,...options.cookie},baseURL:base.href});};
 let result;
 if(workerData.action==='url'&&cookie.token&&cookie.userid){
  const verify=await request('./module/user_verify.js')({cookie},send),auth=verify.body?.data?.auth;
  if(typeof auth!=='string'||!auth)throw Error('Music authorization unavailable');
  const grant=await request('./module/song_auth.js')({...workerData.params,cookie,auth},send),data=grant.body?.data;
  if(!data?.auth&&!data?.open_time)throw Error('Song authorization unavailable');
  result=await request('./module/song_url_auth.js')({...workerData.params,cookie,auth:data.auth,open_time:data.open_time},send);
 }else result=await api({...workerData.params,cookie},send);
 if(result.headers?.['ssa-code']||result.body?.ssaCode)throw Error('Music verification required');
 parentPort.postMessage({ok:true,body:result.body});
}catch(error){if(Number(error?.body?.error_code)===34175){parentPort.postMessage({ok:true,body:{status:0,error_code:34175,data:{info_list:(Array.isArray(error.body.data?.info_list)?error.body.data.info_list:[]).slice(0,20).map(r=>({userid:r.userid,nickname:typeof r.nickname==='string'?r.nickname.slice(0,80):''}))}}});}else parentPort.postMessage({ok:false,errorCode:Number.isInteger(error?.body?.error_code)?error.body.error_code:0});}})();
