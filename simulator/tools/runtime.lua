-- ECMAScript semantics used by the offline battle rules. No network or filesystem.
local AM={}; local OM={}; local SM={}
local JNULL={__isNull=true}
local function Jarr(n,...) local a=setmetatable({_n=n},AM);for i=1,n do a[i-1]=select(i,...) end;return a end
local function Jobj(o,keys) if not keys then keys={};for k in pairs(o) do keys[#keys+1]=k end end;o.__keys=keys;return setmetatable(o,OM) end
local function Jtruth(x) return x~=nil and x~=JNULL and x~=false and x~=0 and x~='' and x==x end
local function Jstr(x) if x==nil then return 'undefined' end;if x==JNULL then return 'null' end;if type(x)=='number' and x==math.floor(x) then return string.format('%.0f',x) end;return tostring(x) end
local function Jnum(x) if x==nil then return 0 end;if type(x)=='boolean' then return x and 1 or 0 end;return tonumber(x) or 0 end
local function Jtypeof(x) if x==nil then return 'undefined' end;return type(x)=='table' and 'object' or type(x) end
local function Jadd(a,b) if type(a)=='string' or type(b)=='string' then return Jstr(a)..Jstr(b) end;return Jnum(a)+Jnum(b) end
local function Jand(a,b) if Jtruth(a) then return b() end;return a end
local function Jor(a,b) if Jtruth(a) then return a end;return b() end
local function Jnull(a,b) if a==nil or a==JNULL then return b() end;return a end
local function Jcond(a,b,c) if Jtruth(a) then return b() end;return c() end
local function Jinvoke(f,...) return (f(nil,...)) end
local function Jclass() return {__proto={},__getters={}} end
local function Jget(o,k)
 if o==nil then error('Cannot read '..tostring(k)..' of nil') end
 if type(o)=='string' then if k=='length' then return #o end;return SM[k] end
 if getmetatable(o)==AM then if k=='length' then return o._n end;local n=tonumber(k);if n then return rawget(o,n) end;return AM[k] end
 k=tostring(k);local v=rawget(o,k);if v~=nil then return v end
 local c=rawget(o,'__class');if c then if c.__getters[k] then return c.__getters[k](o) end;return c.__proto[k] end
end
local function Jopt(o,k) if o==nil or o==JNULL then return nil end;return Jget(o,k) end
local function Jset(o,k,v) if getmetatable(o)==AM then k=tonumber(k) or k;if k=='length' then for i=v,o._n-1 do o[i]=nil end;o._n=v;return v end;if type(k)=='number' and k>=o._n then o._n=k+1 end;else k=tostring(k);local keys=o.__keys;if keys then if o[k]==nil and v~=nil then keys[#keys+1]=k elseif v==nil then for i,x in ipairs(keys) do if x==k then table.remove(keys,i);break end end end end end;o[k]=v;return v end
local function Jcall(o,k,...) local f=Jget(o,k);if not f then error('Missing JS method '..tostring(k)) end;return (f(o,...)) end
local function JoptionalCall(o,k,...) local f=Jget(o,k);if f then return (f(o,...)) end end
local function Jnew(c,...) if c.__new then return c.__new(...) end;local o=Jobj({__class=c});c.__ctor(o,...);return o end
local function Jiter(a) local i=-1;return function() i=i+1;if i<a._n then return i,a[i] end end end
local function Jclone(o) if type(o)~='table' or o==JNULL then return o end;local out=setmetatable({},getmetatable(o));for k,v in pairs(o) do if k~='__class' and k~='__keys' then out[k]=Jclone(v) end end;if o.__keys then local keys={};for i,k in ipairs(o.__keys) do keys[i]=k end;out.__keys=keys end;return out end
local function Jmerge(...) local out=Jobj({});for i=1,select('#',...) do local o=select(i,...);if o.__keys then for _,k in ipairs(o.__keys) do Jset(out,k,o[k]) end else for k,v in pairs(o) do if k~='__class' and k~='__keys' then Jset(out,k,v) end end end end;return out end
local function Jconcat(...) local out=Jarr(0);for i=1,select('#',...) do local a=select(i,...);if a.__set then a=a.values end;for _,v in Jiter(a) do out[out._n]=v;out._n=out._n+1 end end;return out end
function AM:push(...) for i=1,select('#',...) do self[self._n]=select(i,...);self._n=self._n+1 end;return self._n end
function AM:pop() if self._n==0 then return nil end;self._n=self._n-1;local v=self[self._n];self[self._n]=nil;return v end
function AM:slice(a,b) local n=self._n;a=a or 0;b=b or n;if a<0 then a=math.max(0,n+a) end;if b<0 then b=math.max(0,n+b) end;local out=Jarr(0);for i=a,math.min(n,b)-1 do AM.push(out,self[i]) end;return out end
function AM:shift() local v=self[0];for i=1,self._n-1 do self[i-1]=self[i] end;AM.pop(self);return v end
function AM:splice(at,count,...) if at<0 then at=math.max(0,self._n+at) end;count=count or self._n-at;local removed=AM.slice(self,at,at+count);local rest=AM.slice(self,at+count);for i=at,self._n-1 do self[i]=nil end;self._n=at;AM.push(self,...);for _,v in Jiter(rest) do AM.push(self,v) end;return removed end
function AM:map(f) local out=Jarr(0);for i=0,self._n-1 do AM.push(out,f(nil,self[i],i,self)) end;return out end
function AM:filter(f) local out=Jarr(0);for i=0,self._n-1 do if Jtruth(f(nil,self[i],i,self)) then AM.push(out,self[i]) end end;return out end
function AM:find(f) for i=0,self._n-1 do if Jtruth(f(nil,self[i],i,self)) then return self[i] end end end
function AM:findIndex(f) for i=0,self._n-1 do if Jtruth(f(nil,self[i],i,self)) then return i end end;return -1 end
function AM:some(f) for i=0,self._n-1 do if Jtruth(f(nil,self[i],i,self)) then return true end end;return false end
function AM:every(f) for i=0,self._n-1 do if not Jtruth(f(nil,self[i],i,self)) then return false end end;return true end
function AM:reduce(f,acc) local i=0;if acc==nil then acc=self[0];i=1 end;while i<self._n do acc=f(nil,acc,self[i],i,self);i=i+1 end;return acc end
function AM:indexOf(v) for i=0,self._n-1 do if self[i]==v then return i end end;return -1 end
function AM:includes(v) return AM.indexOf(self,v)>=0 end
function AM:at(i) if i<0 then i=self._n+i end;return self[i] end
function AM:reverse() for i=0,math.floor(self._n/2)-1 do local j=self._n-1-i;self[i],self[j]=self[j],self[i] end;return self end
function AM:sort(f) -- stable insertion sort; preserves JS tie order.
 for i=1,self._n-1 do local v=self[i];local j=i-1;while j>=0 and f(nil,self[j],v)>0 do self[j+1]=self[j];j=j-1 end;self[j+1]=v end;return self
end
function AM:flatMap(f) local out=Jarr(0);for i=0,self._n-1 do local a=f(nil,self[i],i,self);for _,v in Jiter(a) do AM.push(out,v) end end;return out end
function AM:forEach(f) for i=0,self._n-1 do f(nil,self[i],i,self) end end
function SM:includes(s) return string.find(self,s,1,true)~=nil end
function SM:endsWith(s) return string.sub(self,-#s)==s end
local v_Math=Jobj({floor=function(_,x)return math.floor(x)end,abs=function(_,x)return math.abs(x)end,min=function(_,...)return math.min(...)end,max=function(_,...)return math.max(...)end,round=function(_,x)return math.floor(x+0.5)end})
local v_Number=setmetatable({isInteger=function(_,x)return type(x)=='number' and x==math.floor(x)end,isFinite=function(_,x)return type(x)=='number' and x==x and x~=math.huge and x~=-math.huge end},{__call=function(_,__,x)return Jnum(x)end})
local v_Object=Jobj({keys=function(_,o)local a=Jarr(0);if o.__keys then for _,k in ipairs(o.__keys) do if o[k]~=nil and k~='__class' and k~='__keys' then AM.push(a,k) end end else for k in pairs(o) do if k~='__class' and k~='__keys' then AM.push(a,k) end end end;return a end})
v_Object.values=function(_,o)return AM.map(v_Object.keys(nil,o),function(_,k)return o[k]end)end
v_Object.entries=function(_,o)return AM.map(v_Object.keys(nil,o),function(_,k)return Jarr(2,k,o[k])end)end
v_Object.assign=function(_,target,...)for i=1,select('#',...) do for k,v in pairs(select(i,...)) do if k~='__class' and k~='__keys' then Jset(target,k,v) end end end;return target end
local v_Array=Jobj({from=function(_,o,f)local a=Jarr(0);for i=0,Jget(o,'length')-1 do AM.push(a,f(nil,nil,i)) end;return a end})
local v_Set={__new=function(a)local out=Jobj({__set=true,values=Jarr(0),size=0});out.add=function(self,v)if not AM.includes(self.values,v) then AM.push(self.values,v);self.size=self.values._n end;return self end;if a then for _,v in Jiter(a) do out:add(v) end end;out.has=function(self,v)return AM.includes(self.values,v)end;return out end}
local v_Error=function(_,message)return message end
local v_structuredClone=function(_,x)return Jclone(x)end
