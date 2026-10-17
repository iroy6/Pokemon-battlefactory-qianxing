(function(root){
const names=root.FactoryData.types;
const maps={"ball":["0011111100","0112222110","1122222211","1222222221","1111331111","1113003111","1001331001","1100000011","0110000110","0011111100"],"physical":["0001100000","1001100010","1101100110","0111111100","0011111000","1111111111","0011111000","0111111100","1101100110","1001100010"],"status":["0000110000","0001111000","0010110100","1110110111","0001111000","0001111000","1110110111","0010110100","0001111000","0000110000"],"info":["0011110000","0110011000","1100001100","1101101100","1101101100","0110011000","0011111000","0000001100","0000000110","0000000011"],"log":["1111111100","1000000100","1011110100","1000000100","1011110100","1000000100","1011100100","1000000100","1111111100","0000000000"],"switch":["0000001000","0111111100","0000001000","0000000000","0000000000","0001000000","0011111110","0001000000","0000000000","0000000000"]};
const pixelIcon=function(name){const rows=maps[name]||maps[name==='special'?'status':name==='arrow'?'switch':'ball'];let cells='';for(let y=0;y<rows.length;y++)for(let x=0;x<rows[y].length;x++){const c=rows[y][x];if(c!=='0')cells+=`<rect x="${x+1}" y="${y+1}" width="1" height="1" fill="${c==='2'?'#dc5949':c==='3'?'#fff8d6':'currentColor'}"/>`}return `<svg class="ui-icon pixel-icon" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">${cells}</svg>`};
const type=function(type){const zh=names[type]?.[0]||type;return `<span class="move-type original-type" title="${zh}"><img src="assets/types/${type}.png" alt="${zh}" width="48" height="16"><span>${zh}</span></span>`};
const category=function(value){const zh=value==='Physical'?'物理':value==='Special'?'特殊':'变化';return `<span class="move-category original-category"><img src="assets/categories/${value}.png" alt="${zh}" width="32" height="14"><span>${zh}</span></span>`};
function icon(name){if(names[name])return `<img class="ui-icon original-type-icon" src="assets/types/${name}.png" alt="${names[name][0]}" width="48" height="16">`;return pixelIcon(name)}
function narration(){let headline='',outcome='',lastSide=null;return{
 push(e){if(e.kind==='turn')return null;if(e.kind==='move'){headline=e.text;outcome='';lastSide=e.side}
 else if(['effective','resisted'].includes(e.kind)){const target=e.visual?.[1-e.side]?.name||'对手';outcome=`对${target}${e.kind==='resisted'?'效果不太好……':'效果绝佳！'}`}
 else if(e.kind==='damage'){outcome=e.text}
 else if(['critical','multihit'].includes(e.kind)){outcome=e.text}
 else if(['item','eat','ability','heal','cure'].includes(e.kind)){headline=e.text;outcome='';lastSide=e.side}
 else if(['miss','immune','blocked','fail','cant','status','confusion','boost','heal','item','ability','charge','seed','yawn','protect','grudge','lock','field','weather','trap','release','cure','endure','eat','knockoff','redirect','identify','end','magnitude'].includes(e.kind)){if(!headline)headline=e.text;else outcome=e.text}
 else if(['switch','faint','battle_end','force'].includes(e.kind)){headline=e.text;outcome='';lastSide=e.side}
 else return null;
 return {headline,outcome,side:lastSide};
 }};}
root.FactoryControls={icon,type,category,narration};
})(window);
