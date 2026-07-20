import{f as k,g as d,T as l,r as c,m as C,d as m,w as v,W as A,aD as P}from"./index-Bd9916Am.js";import{u as W}from"./useMutation-BrMwTcyD.js";const T=d`
  query FetchWhatsappStatus {
    current_user {
      has_whatsapp_feature
      whatsapp_status
    }

    current_salon {
      id
      whatsapp_billing_configuration {
        id
        balance
      }
    }
  }
`,B=t=>k(T,{...t,fetchPolicy:"network-only",notifyOnNetworkStatusChange:!0,onError:e=>{l.captureException(e),console.error(e)}}),U=t=>{const e="=".repeat((4-t.length%4)%4),i=(t+e).replace(/-/g,"+").replace(/_/g,"/"),a=window.atob(i),r=new Uint8Array(a.length);for(let n=0;n<a.length;++n)r[n]=a.charCodeAt(n);return r},I=d`
  mutation CreateWebpushSubscription ($data: CreateWebpushSubscriptionInput!) {
    createWebpushSubscription (input: $data) {
      success
      errors
    }
  }
`,R=()=>{const[t,{loading:e}]=W(I);return[c.useCallback(async a=>{try{const{data:r}=await t({variables:{data:a}}),{success:n,errors:u}=(r==null?void 0:r.createWebpushSubscription)||{};return n?{success:!0}:(l.captureException(`[useCreateWebpushSubscription] ${u}`),console.error(u),{success:!1})}catch(r){return l.captureException(r),console.error(r),{success:!1}}},[t]),{loading:e}]},O=d`
  mutation DestroySale($data: DestroyWebpushSubscriptionInput!) {
    destroyWebpushSubscription(input: $data) {
      success errors
    }
  }
`,x=()=>{const[t,{loading:e}]=W(O);return[c.useCallback(async a=>{var r;try{const n=await t({variables:{data:{endpoint:a}}}),{success:u=!1,errors:p=[]}=((r=n.data)==null?void 0:r.destroyWebpushSubscription)||{};return p==null||p.forEach(b=>C.error(b)),{success:u}}catch(n){return l.captureException(n),console.error(n),{success:!1}}},[t]),e]},N=()=>{const t=m(s=>s.is_mobile),e=v(),i=c.useRef(),[a]=R(),[r]=x(),n=c.useCallback(()=>navigator.userAgent.indexOf("Edg")>-1?!1:!("serviceWorker"in navigator)||!("PushManager"in window)?(console.debug("[useWebpushSubscription] Push messaging is not supported"),!1):Notification.permission==="denied"?(console.debug("[useWebpushSubscription] Permission denied"),!1):!0,[]),u=c.useCallback(async()=>{try{i.current=await navigator.serviceWorker.register(A.SERVICE_WORKER_URL);const s=await i.current.pushManager.getSubscription();return e({type:"set_webpush_subscription",payload:s}),s}catch(s){return console.debug("[useWebpushSubscription] Service Worker Error",s),e({type:"set_webpush_subscription",payload:null}),null}},[e]),p=c.useCallback(async s=>{var g,f;const o=s.toJSON()||{},h=o.endpoint,_=(g=o.keys)==null?void 0:g.auth,w=(f=o.keys)==null?void 0:f.p256dh,{success:E}=await a({endpoint:h,auth:_,p256dh:w});E?e({type:"set_webpush_subscription",payload:s}):s.unsubscribe()},[a,e]),b=c.useCallback(async()=>{const s=U(P);if(i.current)try{const o=await i.current.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:s});p(o)}catch(o){console.debug("[useWebpushSubscription] Failed to subscribe the user: ",o)}},[p]),S=c.useCallback(async()=>{if(t)return;const s=n(),o=await u();!s||o||b()},[n,u,t,b]),y=c.useCallback(async()=>{if(t)return!1;try{const s=await u();if(!s)return!1;s.unsubscribe(),e({type:"set_webpush_subscription",payload:null});const o=s.endpoint,{success:h}=await r(o);return h}catch(s){return console.log("[useWebpushSubscription] ",s),!1}},[r,e,u,t]);return c.useMemo(()=>({subscribeUser:S,removeSubscription:y}),[y,S])};export{T as W,N as a,B as u};
//# sourceMappingURL=useWebpushSubscription-DZpB0TTw.js.map
