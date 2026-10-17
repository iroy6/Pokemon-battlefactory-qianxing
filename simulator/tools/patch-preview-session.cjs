// A late pagehide request from a reloaded play page must not stop its successor.
// Instance IDs identify a page lifetime, not an authorization boundary.
function client(source){
 if(!source.includes('const sessionId = decodeURIComponent(location.hash.slice(1))'))throw Error('Play client signature changed');
 return source.replace('AbortSignal.timeout(15_000)',"AbortSignal.timeout(action === 'start' || action === 'device' ? 35_000 : 15_000)")
  .replace('const sessionId = decodeURIComponent(location.hash.slice(1))',"const sessionId = decodeURIComponent(location.hash.slice(1)); const playClientId = crypto.randomUUID()")
  .replaceAll('JSON.stringify({ sessionId, action, args })','JSON.stringify({ sessionId, playClientId, action, args })')
  .replaceAll("JSON.stringify({ sessionId, action: 'stop', args: {} })","JSON.stringify({ sessionId, playClientId, action: 'stop', args: {} })");
}
function server(source){
 const marker="if (action === 'play') return controller.play(body.action, body.args || {}, signal)";
 if(!source.includes(marker))throw Error('Editor session signature changed');
 return source.replace(marker,`if (action === 'play') {
        const page = typeof body.playClientId === 'string' ? body.playClientId : ''
        if (body.action === 'start') row.playClientId = page
        else if (page && row.playClientId && page !== row.playClientId) {
          if (body.action === 'stop') return { running: false, tree: [], logs: [] }
          throw new Error('This play page has been replaced by a newer preview')
        }
        return controller.play(body.action, body.args || {}, signal)
      }`);
}
function controller(source){return source.replace('timeoutMs = PLAY_TIMEOUT_MS)',"timeoutMs = (action === 'start' ? Math.max(PLAY_TIMEOUT_MS, 30_000) : PLAY_TIMEOUT_MS))")}
module.exports={client,server,controller};
