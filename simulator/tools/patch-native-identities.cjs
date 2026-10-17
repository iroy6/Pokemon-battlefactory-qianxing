// Observed in real level 1073741830: control and script GUID namespaces overlap.
// Preserve an existing script mapping when loading; only duplicate script IDs
// need allocation. New mappings may still choose unused numbers across assets.
module.exports=function patch(source){
 const before='const guid = allocateScriptGuid(entry.guid)';
 const after='const guid = isValidGuid(entry.guid) && !scripts.some(s => Number(s.guid) === Number(entry.guid)) ? Number(entry.guid) : allocateScriptGuid(entry.guid)';
 if(source.includes(after))return source;
 if(!source.includes(before))throw Error('Native identity patch no longer matches studio source');
 return source.replace(before,after);
};
