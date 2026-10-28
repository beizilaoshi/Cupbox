'use strict';
window.CupboxPalettes=(()=>{
  const catalog={
    rainbow:{name:'星虹流彩',caption:'彩虹循环 · 缓慢流动'},
    inkgreen:{name:'墨染绿',caption:'松墨 × 翡翠 × 淡金'},
    mistpurple:{name:'雾紫青岚',caption:'鸢尾紫 × 雾青'},
    peachmilk:{name:'桃雾奶杏',caption:'蜜桃 × 奶杏'},
    oceanblue:{name:'海盐蓝',caption:'海蓝 × 薄荷'},
    sunset:{name:'日落莓橙',caption:'莓红 × 落日杏'},
    moongold:{name:'月白鎏金',caption:'月白 × 烟蓝 × 金砂'},
    forestrose:{name:'森野蔷薇',caption:'森林绿 × 干枯玫瑰'}
  };
  function mount(){const root=document.getElementById('swatches');if(!root||root.dataset.expanded)return;root.dataset.expanded='true';root.setAttribute('aria-label','界面混合配色');for(const [key,row]of Object.entries(catalog)){const button=document.createElement('button');button.type='button';button.className='swatch palette-swatch';button.dataset.accent=key;button.setAttribute('aria-pressed','false');button.title=row.caption;const art=document.createElement('i');art.setAttribute('aria-hidden','true');const copy=document.createElement('span'),name=document.createElement('b'),caption=document.createElement('small');name.textContent=row.name;caption.textContent=row.caption;copy.append(name,caption);button.append(art,copy);root.append(button);}}
  return{mount,catalog};
})();

window.CupboxPalettes.mount();
