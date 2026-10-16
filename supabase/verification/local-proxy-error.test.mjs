import {createServer} from "node:http";
import {once} from "node:events";
import {expect,it} from "vitest";
import {finishLocalProxyError} from "./local-proxy-error.mjs";

it("returns 502 before headers and aborts a partial response without writing headers twice",async()=>{
  const server=createServer((request,response)=>{
    if(request.url==="/partial"){
      response.writeHead(200,{"Content-Type":"text/plain"});
      response.write("partial");
      setTimeout(()=>finishLocalProxyError(response),20);
    }else finishLocalProxyError(response);
  });
  server.listen(0,"127.0.0.1");await once(server,"listening");
  const origin="http://127.0.0.1:"+server.address().port;
  try{
    expect((await fetch(origin)).status).toBe(502);
    const partial=await fetch(origin+"/partial");
    expect(partial.status).toBe(200);
    await expect(partial.text()).rejects.toThrow();
  }finally{await new Promise(resolve=>server.close(resolve));}
});

it("ignores an error after the client response already ended",async()=>{
  const server=createServer((request,response)=>{
    response.end("complete");
    finishLocalProxyError(response);
  });
  server.listen(0,"127.0.0.1");await once(server,"listening");
  try{expect(await(await fetch("http://127.0.0.1:"+server.address().port)).text()).toBe("complete");}
  finally{await new Promise(resolve=>server.close(resolve));}
});
