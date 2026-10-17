// Local image IDs are reused by the packer. The URL must identify the actual
// asset build so a cached old sheet can never be sliced using a new index.
function catalog(source,revision) {
 const check="imageSourceName(source)==='StaticReference' && Number.isSafeInteger(id) && id>=1900000000 && id<2000000000";
 for(const signature of ['export function isRemoteImage(id, source) {','export function imageAssetUrl(id, revision = 0, source) {'])if(!source.includes(signature))throw Error('Asset catalog signature changed: '+signature);
 return source.replace('export function isRemoteImage(id, source) {',`export function isRemoteImage(id, source) {\n if(${check})return true;`)
 .replace('export function imageAssetUrl(id, revision = 0, source) {',`export function imageAssetUrl(id, revision = 0, source) {\n if(${check})return IMAGE_ASSET_PREFIX+IMAGE_CACHE_VERSION+'/'+id+'.png?factory='+${JSON.stringify(revision)}+(revision?'&refresh='+revision:'');`);
}
module.exports={catalog};
