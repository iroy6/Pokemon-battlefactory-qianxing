(function(root){
 const text=root.FactoryFeedbackData.text;
 function duration(e,animation=0){
  if(e.kind==='turn')return text.turn;
  if(e.kind==='damage')return Math.max(animation,text.damage);
  const length=Array.from(e.text||'').filter(c=>!/\s/.test(c)).length;
  return Math.max(animation,Math.min(text.max,Math.max(text.min,text.base+length*text.perChar)));
 }
 root.FactoryPresentationTiming={duration};
})(window);
