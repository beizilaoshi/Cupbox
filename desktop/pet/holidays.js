// Local calendar only: no network, location or user data is sent anywhere.
import lunar from 'lunar-javascript';
export const FESTIVAL_OUTFITS=Object.freeze(['spring','christmas','lantern','halloween','midautumn','april','labor','dragonboat','qixi','national','winter']);
const names={spring:'春节',christmas:'圣诞节',lantern:'元宵节',halloween:'万圣节',midautumn:'中秋节',april:'愚人节',labor:'劳动节',dragonboat:'端午节',qixi:'七夕',national:'国庆节',winter:'冬至'};
export function petHoliday(date=new Date()){
 if(!(date instanceof Date)||!Number.isFinite(date.getTime()))return null;
 const month=date.getMonth()+1,day=date.getDate();
 let id=month===12&&[24,25].includes(day)?'christmas':month===10&&day===31?'halloween':month===10&&day>=1&&day<=7?'national':month===4&&day===1?'april':month===5&&day===1?'labor':null;
 const chinese=lunar.Solar.fromYmd(date.getFullYear(),month,day).getLunar(),lunarMonth=chinese.getMonth(),lunarDay=chinese.getDay();
 // Leap months are negative in this library and must not repeat annual festivals.
 if(lunarMonth===1&&lunarDay>=1&&lunarDay<=7)id='spring';
 else if(lunarMonth===1&&lunarDay===15)id='lantern';
 else if(lunarMonth===8&&lunarDay===15)id='midautumn';
 else if(lunarMonth===5&&lunarDay===5)id='dragonboat';
 else if(lunarMonth===7&&lunarDay===7)id='qixi';
 else if(chinese.getJieQi()==='冬至')id='winter';
 return id?{id,name:names[id]}:null;
}
export function petWardrobe(config,date=new Date()){
 const holiday=petHoliday(date),automatic=Boolean(config.holidayAuto&&holiday);
 return{outfit:automatic?holiday.id:config.outfit,holiday,automatic};
}
