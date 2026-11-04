// Minimal local typecheck surface; production Edge runtime provides Deno itself.
declare const Deno: {env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Response|Promise<Response>):void}
