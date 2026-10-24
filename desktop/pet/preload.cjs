const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('pet',{
 care:(action,sessionId)=>ipcRenderer.invoke('pet:care',{action,sessionId}),
 gesture:kind=>ipcRenderer.invoke('pet:gesture',kind),
 open:tab=>ipcRenderer.invoke('pet:open',tab),
 audio:()=>ipcRenderer.invoke('pet:audio:load'),
 onMotion:fn=>{const listener=(_e,value)=>fn(value);ipcRenderer.on('pet:motion',listener);return()=>ipcRenderer.removeListener('pet:motion',listener);},
 onUpdate:fn=>{const listener=(_e,value)=>fn(value);ipcRenderer.on('pet:update',listener);return()=>ipcRenderer.removeListener('pet:update',listener);}
});
