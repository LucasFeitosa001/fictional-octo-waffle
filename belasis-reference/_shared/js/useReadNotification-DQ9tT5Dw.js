const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/Calendars.mobile-C9T635zI.js","assets/index-Bd9916Am.js","assets/index-d41Ui0WO.css","assets/MobileItemLoading-BPvi0U7B.js","assets/ClientDrawer-55jCGlAN.js","assets/PhoneInput-Uk4Fy4k3.js","assets/PhoneInput-Bbgo5x5y.css","assets/AnimatedModal-B0Wu-A-O.js","assets/index-N5o1yZfs.js","assets/useVariants-CcaHcr-K.js","assets/useMutation-BrMwTcyD.js","assets/index-pPH-OUeJ.js","assets/Overflow-BeweU6Wq.js","assets/openLink-DL3a6Hh-.js","assets/index-UewmsNya.js","assets/index-VnBECc_f.js","assets/ClientDrawer-CmlxdM94.css","assets/Calendars.desktop-B0ckrGNI.js"])))=>i.map(i=>d[i]);
import{T as w,g as b,r as a,e as P,t as c,j as e,d as k,R as h,c as R,y as D,F as j,G as I,m as S}from"./index-Bd9916Am.js";import{m as A,h as v}from"./ClientDrawer-55jCGlAN.js";import{u as z}from"./openLink-DL3a6Hh-.js";import{a as L,M as F}from"./PhoneInput-Uk4Fy4k3.js";import{D as V}from"./index-UewmsNya.js";import{u as q}from"./useMutation-BrMwTcyD.js";const G=b`
  query OnlinePaymentModal ($id: ID) {
    payment_gateways_transaction (id: $id) {
      id
      metadata
      transactionable {
        id
        package_items {
          id
          sum_cents
          product {
            id
            description
          }
        }
      }
    }
  }
`,Q=()=>z(G,{onError:r=>{w.captureException(r),console.log(r)}}),U=()=>a.useMemo(()=>[{title:c("words.date"),key:"date",dataIndex:"date",width:100,render:t=>P(t).format("L")},{title:c("words.hour"),key:"start_hour",dataIndex:"start_hour",width:60,render:t=>t},{title:c("words.service"),key:"service_description",dataIndex:"service_description",ellipsis:!0,render:t=>e.jsx("span",{title:t,children:t})},{title:c("words.value"),key:"service_value",dataIndex:"service_value",align:"right",width:100,render:t=>L(t)}],[]),Y=a.lazy(()=>j(()=>I(()=>import("./Calendars.mobile-C9T635zI.js"),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16])))),H=a.lazy(()=>j(()=>I(()=>import("./Calendars.desktop-B0ckrGNI.js"),__vite__mapDeps([17,1,2,4,5,6,7,8,9,10,11,12,13,14,15,16])))),N=(r,t)=>{var g;const[y,d]=a.useState(!1),[p,s]=a.useState(""),_=k(i=>i.is_mobile),[l,{data:u,loading:x}]=Q(),$=U(),E=(i,m)=>{l({variables:{id:i}}),s(m),d(!0)},O=()=>{d(!1)};a.useImperativeHandle(t,()=>({open:E,close:O}));const o=u==null?void 0:u.payment_gateways_transaction,{schedule_groups:C=[]}=JSON.parse((o==null?void 0:o.metadata)||"{}"),f=(g=C[0])==null?void 0:g.calendars_attributes.reduce((i,m)=>{const n=o==null?void 0:o.transactionable.package_items.find(T=>T.product.id===m.product_id);if(!n)return i;const M={date:m.start_date,start_hour:m.start_hour,service_description:n==null?void 0:n.product.description,service_value:n==null?void 0:n.sum_cents};return[...i,M]},[]);return e.jsx(F,{open:y,onCancel:()=>d(!1),footer:null,children:e.jsx(A.Provider,{value:x,children:e.jsxs(J,{children:[e.jsx(h,{$column:!0,children:e.jsx(R,{$alignCenter:!0,$size:24,$light:!0,children:c("modals.online_payment.payment_received_online")})}),e.jsx(V,{}),e.jsx(h,{$column:!0,children:e.jsx(v,{$alignCenter:!0,width:32,children:p})}),e.jsx(h,{$column:!0,children:e.jsx(v,{$alignCenter:!0,width:16,$size:16,$semibold:!0,children:c("modals.online_payment.schedule_details")})}),_?e.jsx(Y,{calendars:f||[],loading:x}):e.jsx(H,{calendars:f||[],loading:x,columns:$})]})})})};N.displayName="OnlinePaymentModal";const se=a.forwardRef(N),J=D.div.withConfig({componentId:"wb__sc-1lct6cn-0"})(["background:rgba(255,255,255,0.9);border-radius:12px;display:flex;flex-wrap:wrap;flex-direction:column;align-items:center;width:100%;min-height:400px;"]),W=b`
  mutation Notification($data: ReadNotificationInput!) {
    readNotifications(input: $data) {
      success errors
    }
  }
`,ae=()=>{const[r,{loading:t}]=q(W);return[a.useCallback(async d=>{var p;try{const s=await r({variables:{data:d}}),{success:_=!1,errors:l}=((p=s==null?void 0:s.data)==null?void 0:p.readNotifications)||{};return l==null||l.forEach(u=>S.error(u)),_}catch(s){return w.captureException(s),console.error(s),!1}},[r]),{loading:t}]};export{se as O,ae as u};
//# sourceMappingURL=useReadNotification-DQ9tT5Dw.js.map
