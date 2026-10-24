import {describe,it,expect} from 'vitest';
import {petHoliday,petWardrobe,FESTIVAL_OUTFITS} from '../desktop/pet/holidays.js';
import {PET_DEFAULTS,normalizePet} from '../desktop/pet/model.js';
const date=(value:string)=>new Date(value+'T12:00:00');
describe('local festival wardrobe',()=>{
 it('uses lunar dates across years rather than fixed Gregorian guesses',()=>{
  for(const [value,id] of [['2026-02-17','spring'],['2026-02-23','spring'],['2026-03-03','lantern'],['2026-09-25','midautumn'],['2027-02-06','spring'],['2027-02-20','lantern'],['2027-09-15','midautumn']])expect(petHoliday(date(value))?.id).toBe(id);
  expect(petHoliday(date('2026-02-24'))).toBeNull();
 });
 it('selects fixed holidays from the computer local calendar',()=>{
  for(const [value,id] of [['2026-12-24','christmas'],['2026-12-25','christmas'],['2026-10-31','halloween'],['2026-04-01','april'],['2026-05-01','labor']])expect(petHoliday(date(value))?.id).toBe(id);
  expect(petHoliday(date('2026-12-26'))).toBeNull();expect(petHoliday(new Date(NaN))).toBeNull();
 });
 it('never overwrites the manual outfit and restores it after holidays',()=>{
  const config=normalizePet({outfit:'academy'});
  expect(petWardrobe(config,date('2026-12-25')).outfit).toBe('christmas');expect(config.outfit).toBe('academy');
  expect(petWardrobe(config,date('2026-12-26')).outfit).toBe('academy');
  expect(petWardrobe({...config,holidayAuto:false},date('2026-12-25'))).toMatchObject({outfit:'academy',automatic:false});
 });
 it('supports new lunar, national and solar-term outfits across years',()=>{
  for(const [value,id]of [['2026-06-19','dragonboat'],['2027-06-09','dragonboat'],['2026-08-19','qixi'],['2027-08-08','qixi'],['2026-10-01','national'],['2026-10-07','national'],['2026-12-22','winter'],['2027-12-22','winter']])expect(petHoliday(date(value))?.id).toBe(id);
  expect(petHoliday(date('2026-10-08'))).toBeNull();expect(petHoliday(date('2026-12-23'))).toBeNull();
 });
 it('upgrades old preferences and validates every holiday outfit',()=>{
  expect(normalizePet({outfit:'cozy'}).holidayAuto).toBe(true);
  expect(PET_DEFAULTS.holidayAuto).toBe(true);
  for(const outfit of FESTIVAL_OUTFITS)expect(normalizePet({outfit}).outfit).toBe(outfit);
  expect(()=>normalizePet({holidayAuto:'yes'})).toThrow();
 });
});
