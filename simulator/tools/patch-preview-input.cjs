// Send gamepads through the preview's serialized transport to actual Lua keys.
const fs=require('node:fs'),path=require('node:path');
function client(source){
 const marker='play.bindInput(stage, { keysOn: window })';
 if(!source.includes(marker))throw Error('Preview input binding changed');
 const shared=fs.readFileSync(path.resolve(__dirname,'../../web/src/input/input-device.js'),'utf8');
 return shared+'\n'+source.replace(marker,marker+`\n      FactoryInput.attachGamepads(key => {
        if (!play.running || play.snapshot?.paused || closing || document.activeElement?.matches('input,select,textarea')) return
        const names = {a:'ControllerJumpKeyDown', b:'ControllerNormalAttackKeyDown', details:'ControllerInteractKeyDown', menu:'ControllerCharacterSkill2KeyDown', up:'ControllerCharacterSkill3KeyDown', right:'ControllerCharacterSkill4KeyDown', left:'ControllerCraftspersonKey1Down', down:'ControllerCraftspersonKey2Down'}
        void play.act('key', {key:names[key]})
      }, () => {})`);
}
function session(source){
 return source.replace('pollSoon(30)','pollSoon(0)')
 .replace('PLAY_MOVE_THROTTLE_MS = 60','PLAY_MOVE_THROTTLE_MS = 24')
 .replace("const onKeyDown = (event) => {", "const onKeyDown = (event) => {\n      if(event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target?.matches('input,select,textarea,button')) return")
 .replace("const onKeyUp = (event) => {", "const onKeyUp = (event) => {\n      if(event.ctrlKey || event.metaKey || event.altKey || event.target?.matches('input,select,textarea,button')) return");
}
function runtime(source){
 const marker="if (type === 'wheel') {\n    const hit = hitPlayControl(session, px, py)";
 if(!source.includes(marker))throw Error('Wheel adapter anchor missing');
 return source.replace(marker,marker+`\n    // The game's pixel transcript uses official CursorDrag events. Forward
    // desktop wheel input only over its tagged viewport, not over battle UI.
    if(hit?.name==='action-history-scroll'||hit?.name==='action-history-bar') {
      if(deltaY)injectPlayKey(session,deltaY>0?'KeyboardCraftspersonKey37Down':'KeyboardCraftspersonKey36Down');return hit;
    }`);
}
module.exports={client,session,runtime};
