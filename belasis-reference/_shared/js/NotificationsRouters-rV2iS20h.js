import{cH as re,r as s,T as ce,g as Z,t as a,e as Q,i as ue,j as t,y as A,p as de,d as J,B as Y,u as _e,c8 as pe,z as me,A as h}from"./index-Bd9916Am.js";import{bl as fe,h as $,e as he,Z as ge}from"./ClientDrawer-55jCGlAN.js";import{H as xe,R as we,S as ye,C as be,D as je,a as ve,T as Re}from"./WebookContent-BCPw5BqQ.js";import{u as Ne,O as Me}from"./useReadNotification-DQ9tT5Dw.js";import{S as Ce}from"./index-CBt7zz8y.js";import{R as K,a as V}from"./index-N5o1yZfs.js";import{u as ke}from"./useSetMobileMenuActions-BqSMJ-xa.js";import{b as Se,E as Ie}from"./openLink-DL3a6Hh-.js";const Te=Z`
  fragment NotificationAttributes on Notification {
    id
    created_at
    action
    read_at
    notifiable_id
    schedule_group_id

    client_name
    employee_name
    service_name
    ticket_number
    service_return_days
    calendar_date
    review_rating
    notifiable_is_deleted
    title
    message
  }
`,$e=Z`
  query NotificationsPage ($read: Boolean, $page: Int, $type: String) {
    all_notifications (
      read: $read,
      page: $page,
      results: 20,
      type: $type,
      sort_field: "created_at",
      sort_order: "DESC"
    ) {
      all {
        ...NotificationAttributes
      }

      total_count
    }

    response: all_notifications (read: false, page: 1, results: 1, type: "response") {
      total_count
    }

    external_appointment: all_notifications (read: false, page: 1, results: 1, type: "external_appointment") {
      total_count
    }

    salon_review: all_notifications (read: false, page: 1, results: 1, type: "salon_review") {
      total_count
    }

    client_return: all_notifications (read: false, page: 1, results: 1, type: "client_return") {
      total_count
    }

    schedule_canceled: all_notifications (read: false, page: 1, results: 1, type: "schedule_canceled") {
      total_count
    }

    cs_announce: all_notifications (read: false, page: 1, results: 1, type: "cs_announce") {
      total_count
    }

    online_payment: all_notifications (read: false, page: 1, results: 1, type: "online_payment") {
      total_count
    }
  }

  ${Te}
`,Ae=(e,l)=>{const o=re(),[c,u]=s.useState(!1),[d,m]=s.useState({response:0,external_appointment:0,salon_review:0,client_return:0,schedule_canceled:0,cs_announce:0,online_payment:0});return[s.useCallback(async C=>{u(!0);try{const r=await o.query({fetchPolicy:"network-only",query:$e,variables:C}),x=r.data.all_notifications.all,N=r.data.all_notifications.total_count,b={response:r.data.response.total_count,external_appointment:r.data.external_appointment.total_count,salon_review:r.data.salon_review.total_count,client_return:r.data.client_return.total_count,schedule_canceled:r.data.schedule_canceled.total_count,cs_announce:r.data.cs_announce.total_count,online_payment:r.data.online_payment.total_count};l==null||l(N),e==null||e(w=>[...w,...x]),m(b)}catch(r){ce.captureException(r),console.log(r)}finally{u(!1)}},[o,e,l]),{loading:c,totals_count:d}]},Ee={response:a("notification.response.title"),external_appointment:a("notification.external_appointment.title"),salon_review:a("notification.salon_review.title"),client_return:a("notification.client_return.title"),schedule_canceled:a("notification.schedule_canceled.title"),cs_announce:void 0,goals:void 0,online_payment:void 0,waiting_schedule:void 0,trial:void 0},X=({notification:e,onClick:l})=>{const o=Ee[e.action]||e.title,c=s.useMemo(()=>e.action==="client_return"?a("notification.client_return.message",{service_return_days:e.service_return_days,client_name:e.client_name,service_name:e.service_name}):e.action==="external_appointment"?a("notification.external_appointment.message",{calendar_date:e.calendar_date,client_name:e.client_name}):e.action==="response"?a("notification.response.message",{client_name:e.client_name}):e.action==="schedule_canceled"?a("notification.schedule_canceled.message",{calendar_date:e.calendar_date,client_name:e.client_name}):["cs_announce","goals","online_payment","waiting_schedule","trial"].includes(e.action)?e.message:a("notification.salon_review.message",{employee_name:e.employee_name,review_rating:e.review_rating,client_name:e.client_name}),[e]),u=s.useMemo(()=>{const d=Q(e.created_at,ue);return Q().isSame(d,"day")?d.fromNow():d.format("L")},[e.created_at]);return t.jsxs(ee,{onClick:()=>l(e),children:[t.jsxs("div",{className:"header",children:[t.jsx("span",{className:"title",children:o}),t.jsx("span",{className:"time",children:u})]}),t.jsx("div",{className:"content",title:c,children:c})]})};X.displayName="NotificationItem";const ee=A.div.withConfig({componentId:"wb__sc-jcrm8g-0"})(["background:rgba(0,0,0,.05);padding:10px;border-radius:12px;height:85px;cursor:pointer;margin:10px 5px 10px 0;",";&:hover{background:rgba(0,0,0,.07);}.header{display:flex;flex-direction:row;justify-content:space-between;font-weight:bold;letter-spacing:1px;.title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:75%;}.time{font-size:12rem;}}.content{white-space:nowrap;text-overflow:ellipsis;overflow:hidden;@supports (-webkit-line-clamp:2){overflow:hidden;text-overflow:ellipsis;white-space:pre-line;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}}"],e=>e.theme.is_mobile&&de(["margin:10px 15px;"])),Be=({totals:e})=>{const l=J(o=>o.current_user.permissions);return s.useMemo(()=>{let o=[{label:t.jsx(p,{count:e.cs_announce,title:a("words.news",{count:2})}),path:"/notifications/news"},{label:t.jsx(p,{count:e.external_appointment,title:a("words.scheduling",{count:2})}),path:"/notifications/schedules"},{label:t.jsx(p,{count:e.schedule_canceled,title:a("notification.schedule_canceled.title",{count:2})}),path:"/notifications/canceled_schedules"},{label:t.jsx(p,{count:e.salon_review,title:a("words.review",{count:2})}),path:"/notifications/salon_reviews"}];return l.is_admin&&o.push({label:t.jsx(p,{count:e.response,title:a("notification.response.sms_responses")}),path:"/notifications/sms_response"},{label:t.jsx(p,{count:e.client_return,title:a("notification.client_return.title",{count:2})}),path:"/notifications/client_returns"},{label:t.jsx(p,{count:e.online_payment,title:a("notification.online_payments")}),path:"/notifications/online_payment"}),o},[l.is_admin,e])},p=({title:e,count:l})=>t.jsx(Le,{count:l,offset:[5,-8],children:e});p.displayName="Label";const Le=A(fe).withConfig({componentId:"wb__sc-1oddc1l-0"})(["color:unset !important;font-weight:bold !important;font-size:16rem !important;line-height:16px !important;transition:color 0.1s !important;"]),te=({read:e,loading:l,handleChangeRead:o,readAll:c,totals:u})=>{const d=J(i=>i.is_mobile),m=Be({totals:u});return d?null:t.jsxs(xe,{$showBottomBorder:!0,title:a("words.notification",{count:2}),tabs:m,children:[!e&&t.jsx(Y,{onClick:c,loading:l,children:a("notification.set_all_as_read")}),t.jsx(Y,{icon:e?t.jsx(K,{}):t.jsx(V,{}),type:"primary",onClick:o,children:e?a("notification.show_unread"):a("notification.show_read")})]})};te.displayName="Header";const He=({handleChangeRead:e,readAll:l,read:o})=>{const c=s.useMemo(()=>[{label:a("notification.set_all_as_read"),icon:Se,onClick:l,disabled:o},{label:o?a("notification.show_unread"):a("notification.show_read"),icon:o?K:V,onClick:e,is_active:o}],[e,o,l]);ke(c)},ne=()=>t.jsxs(ee,{children:[t.jsxs("div",{className:"header",children:[t.jsx($,{width:20}),t.jsx($,{width:6})]}),t.jsx("div",{className:"content",children:t.jsx($,{width:"100%",lines:2})})]});ne.displayName="NotificationItemLoading";const g=({type:e})=>{const[l,o]=s.useState([]),[c,u]=s.useState(0),[d,m]=s.useState(1),[i,C]=s.useState(!1),r=_e(),[x,{loading:N,totals_count:b}]=Ae(o,u),[w,{loading:se}]=Ne(),M=s.useRef(null),j=s.useRef(!0),k=s.useRef(null),E=s.useRef(null),B=s.useRef(null),L=s.useRef(null),H=s.useRef(null),O=s.useRef(null),F=s.useRef(null),D=s.useRef(null),ae=pe();s.useEffect(()=>{I()},[]);const S=s.useCallback(async()=>{j.current=!0;const n={page:1,results:20,read:!i,type:e};o([]),u(0),m(1),C(!i),await x(n),j.current=!1},[x,i,e]),I=s.useCallback(async()=>{j.current=!0;const n={page:d,results:20,read:i,type:e};m(f=>f+1),await x(n),j.current=!1},[x,d,i,e]),oe=s.useCallback(({currentTarget:{scrollTop:n}})=>{var v,R;if(!M.current)return;const f=(v=M.current)==null?void 0:v.getClientHeight(),_=(R=M.current)==null?void 0:R.getScrollHeight(),y=c>l.length;n+f>=_&&!j.current&&y&&I()},[I,l.length,c]),P=s.useCallback(async n=>{n.read_at||!await w({id:n.id})||(o(_=>_.filter(y=>y.id!==n.id)),i||u(_=>_-1))},[i,w]),le=s.useCallback(n=>{var f,_,y,v,R,z,G,U,W;if(P(n),["external_appointment","waiting_schedule"].includes(n.action)){(f=k.current)==null||f.open({schedule_group_id:n.schedule_group_id});return}if(n.action==="salon_review"){(_=E.current)==null||_.open(n.notifiable_id);return}if(n.action==="response"){(y=B.current)==null||y.open(n.notifiable_id);return}if(n.action==="client_return"){(v=L.current)==null||v.open(n.notifiable_id);return}if(n.action==="cs_announce"){(R=O.current)==null||R.open(n.notifiable_id);return}if(n.action==="online_payment"){(z=F.current)==null||z.open(n.notifiable_id,n.message);return}if(n.action==="goals"){r("/goals");return}if(n.action==="schedule_canceled"){if(n.notifiable_is_deleted){(G=H.current)==null||G.open(n.schedule_group_id);return}(U=k.current)==null||U.open({schedule_group_id:n.schedule_group_id});return}if(n.action==="trial"){(W=D.current)==null||W.open(n.title,n.message);return}},[r,P]),T=s.useCallback(async()=>{await w({type:e})&&(o([]),u(0))},[w,e]),ie=s.useMemo(()=>i?b:{...b,[e]:c},[i,c,b,e]),q=l.length===0;return He(s.useMemo(()=>({read:i,readAll:T,handleChangeRead:S}),[S,i,T])),t.jsxs(t.Fragment,{children:[t.jsx(te,{readAll:T,loading:se,read:i,handleChangeRead:S,totals:ie}),t.jsx(Oe,{$pageFull:!0,children:t.jsxs(Ce,{ref:M,onScroll:oe,children:[q&&N&&[-1,-2,-3,-4,-6].map(n=>t.jsx(ne,{},`notification-loading-${n}`)),q&&!N&&t.jsx(Ie,{style:{marginTop:30},description:a("phrases.empty")}),l.map(n=>t.jsx(X,{notification:n,onClick:le},`${e}-${n.id}`)),t.jsx("div",{style:{marginBottom:ae.sidebar_mobile_bottom_margin}})]})}),t.jsx(he,{ref:k}),t.jsx(we,{ref:E}),t.jsx(ye,{ref:B}),t.jsx(be,{ref:L}),t.jsx(je,{ref:H}),t.jsx(ve,{ref:O}),t.jsx(Me,{ref:F}),t.jsx(Re,{ref:D})]})},Oe=A(ge).withConfig({componentId:"wb__sc-8u8tdl-0"})(["height:calc(100vh - 104px);"]),Fe=()=>t.jsxs(me,{children:[t.jsx(h,{path:"/schedules",element:t.jsx(g,{type:"external_appointment"},"external_appointment")}),t.jsx(h,{path:"/canceled_schedules",element:t.jsx(g,{type:"schedule_canceled"},"schedule_canceled")}),t.jsx(h,{path:"/sms_response",element:t.jsx(g,{type:"response"},"response")}),t.jsx(h,{path:"/salon_reviews",element:t.jsx(g,{type:"salon_review"},"salon_review")}),t.jsx(h,{path:"/client_returns",element:t.jsx(g,{type:"client_return"},"client_return")}),t.jsx(h,{path:"/news",element:t.jsx(g,{type:"cs_announce"},"cs_announce")}),t.jsx(h,{path:"/online_payment",element:t.jsx(g,{type:"online_payment"},"online_payment")})]});Fe.displayName="NotificationsRouters";export{Fe as N,Ae as u};
//# sourceMappingURL=NotificationsRouters-rV2iS20h.js.map
