// Keep authoring text proportional to its controls when the canvas is fitted
// into a smaller editor panel. Parent transforms are applied separately.
module.exports=function patchEditorLayout(source){
 return source.replace('function renderControl(item, snap, canvasWidth, canvasHeight)', 'function renderControl(item, snap, canvasWidth, canvasHeight, displayScale=1)')
 .replace('fontSize: Math.max(8, Math.min(40, Number(item.fontSize || 12)))','fontSize: Math.max(1, Number(item.fontSize || 12)*displayScale)')
 .replace('renderControl(item, snap, canvasWidth, canvasHeight)', 'renderControl(item, snap, canvasWidth, canvasHeight, effectiveZoom)')
 .replace("kind !== 'container' && kind !== 'image' ? e('span'", "kind !== 'container' && kind !== 'image' && (kind !== 'cursor' || selected) ? e('span'");
};
