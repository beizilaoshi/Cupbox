// Empty workspace uses the existing app-managed file area, never the process cwd.
export function chatWorkspace(prefs,session,sandboxRoot){
  return prefs.executionEnvironment==='native'?(session?.workspace||prefs.workspace||sandboxRoot):sandboxRoot;
}
export const nativeWorkbenchTool=name=>name.startsWith('pty_')||name.startsWith('useit_')||['run','proc','git','pkg','test','clipboard_image'].includes(name);
export function workbenchToolEnabled(name,prefs){
  return !(prefs.disabledTools||[]).includes(name)
    && (prefs.executionEnvironment==='native'||!nativeWorkbenchTool(name))
    && (prefs.filesystemTools!==false||! /^(?:fs_|word_|ppt_|excel_|pdf_|office_)/.test(name));
}
