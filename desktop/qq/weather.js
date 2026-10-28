export const WEATHER_DEFAULTS={weatherEnabled:false,weatherDefaultCity:''};
export function validateWeather(c){if(typeof c.weatherDefaultCity!=='string'||c.weatherDefaultCity.length>60||c.weatherDefaultCity&&!/^[\p{L}\p{N}\s.,'’-]+$/u.test(c.weatherDefaultCity))throw Error('默认天气地点需为有效城市名，最多60字');}
export const WEATHER_TOOL={name:'qq_weather',description:'查询真实天气服务的当前数据及未来三天预报，不猜测天气。城市需来自本轮原话或本机默认城市；地点歧义时先澄清。返回来源、时间、单位，不代表已设置天气提醒。',parameters:{type:'object',properties:{city:{type:'string',maxLength:60}},additionalProperties:false}};
const labels={0:'晴',1:'大致晴朗',2:'局部多云',3:'阴',45:'雾',48:'雾凇',51:'小毛毛雨',53:'毛毛雨',55:'强毛毛雨',56:'冻毛毛雨',57:'冻毛毛雨',61:'小雨',63:'中雨',65:'大雨',66:'冻雨',67:'强冻雨',71:'小雪',73:'中雪',75:'大雪',77:'雪粒',80:'小阵雨',81:'阵雨',82:'强阵雨',85:'阵雪',86:'强阵雪',95:'雷雨',96:'雷雨伴冰雹',99:'强雷雨伴冰雹'};
export class WeatherClient{
 constructor({fetcher=fetch,clock=Date.now}={}){this.fetcher=fetcher;this.clock=clock;this.cache=new Map();}
 async json(url,signal){const response=await this.fetcher(url,{signal,redirect:'error'});if(!response.ok){await response.body?.cancel();throw Error('天气服务暂不可用（HTTP '+response.status+'）');}const parts=[];let size=0;for await(const part of response.body){signal.throwIfAborted();size+=part.length;if(size>65536)throw Error('天气结果超过限制');parts.push(part);}try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw Error('天气服务返回了无效数据');}}
 async query(city,{signal}={}){
  const name=String(city||'').trim();if(!name||name.length>60||!/^[\p{L}\p{N}\s.,'’-]+$/u.test(name))throw Error('请指定城市名，不接受网址、完整地址或任意接口参数');
  const key=name.normalize('NFKC').toLowerCase(),cached=this.cache.get(key);if(cached&&this.clock()-cached.at<600000)return{...cached.data,cached:true};
  signal=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(15000)]);signal.throwIfAborted();
  const geo=await this.json('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(name)+'&count=5&language=zh&format=json',signal);
  const choices=(geo.results||[]).filter(r=>Number.isFinite(r.latitude)&&Math.abs(r.latitude)<=90&&Number.isFinite(r.longitude)&&Math.abs(r.longitude)<=180);
  if(!choices.length)throw Error('未找到该城市，请补充城市或省份');
  const normalized=v=>String(v).replace(/[市县区\s]/g,'').toLowerCase(),exact=choices.filter(r=>normalized(r.name)===normalized(name));
  if(exact.length>1)return{needsClarification:true,locations:exact.map(r=>({name:r.name,province:r.admin1,country:r.country})),source:'Open-Meteo / GeoNames'};
  const location=exact[0]||choices[0],url=new URL('https://api.open-meteo.com/v1/forecast');url.searchParams.set('latitude',String(location.latitude));url.searchParams.set('longitude',String(location.longitude));url.searchParams.set('current','temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m');url.searchParams.set('daily','temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code');url.searchParams.set('forecast_days','3');url.searchParams.set('timezone','auto');
  const result=await this.json(url.href,signal);if(!result.current||!Array.isArray(result.daily?.time))throw Error('天气数据缺少当前或预报信息');
  const current=result.current,number=v=>Number.isFinite(v)?v:null,data={source:'Open-Meteo（天气模型数据） / GeoNames',url:'https://open-meteo.com/',location:{name:location.name,province:location.admin1,country:location.country},timezone:result.timezone,updated:current.time,units:{temperature:'°C',wind:'km/h',probability:'%'},current:{temperature:number(current.temperature_2m),feelsLike:number(current.apparent_temperature),humidity:number(current.relative_humidity_2m),wind:number(current.wind_speed_10m),weather:labels[current.weather_code]||'天气代码 '+current.weather_code},forecast:result.daily.time.slice(0,3).map((date,i)=>({date,high:number(result.daily.temperature_2m_max?.[i]),low:number(result.daily.temperature_2m_min?.[i]),rainProbability:number(result.daily.precipitation_probability_max?.[i]),weather:labels[result.daily.weather_code?.[i]]||'未提供'}))};
  this.cache.set(key,{at:this.clock(),data});while(this.cache.size>100)this.cache.delete(this.cache.keys().next().value);return data;
 }
}
