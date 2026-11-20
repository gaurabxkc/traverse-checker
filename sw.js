const C="trav-v3",F=["./","index.html","manifest.json","icon.svg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
// cache first (works offline), refresh cache in background when online
self.addEventListener("fetch",e=>{e.respondWith(caches.open(C).then(c=>c.match(e.request,{ignoreSearch:true}).then(r=>{
  const net=fetch(e.request).then(n=>{if(n.ok&&e.request.method==="GET")c.put(e.request,n.clone());return n}).catch(()=>r);return r||net})))});
