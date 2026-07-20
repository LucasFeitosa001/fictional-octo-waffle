const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/Transactions.desktop-DApnSMCu.js","assets/index-Bd9916Am.js","assets/index-d41Ui0WO.css","assets/ClientDrawer-55jCGlAN.js","assets/PhoneInput-Uk4Fy4k3.js","assets/PhoneInput-Bbgo5x5y.css","assets/AnimatedModal-B0Wu-A-O.js","assets/index-N5o1yZfs.js","assets/useVariants-CcaHcr-K.js","assets/useMutation-BrMwTcyD.js","assets/index-pPH-OUeJ.js","assets/Overflow-BeweU6Wq.js","assets/openLink-DL3a6Hh-.js","assets/index-UewmsNya.js","assets/index-VnBECc_f.js","assets/ClientDrawer-CmlxdM94.css","assets/useRefundTransaction-DMUXWRts.js","assets/UndoOutlined-CnKHx9Ml.js","assets/Pagination.desktop-BLiVg_XC.js","assets/FilterMenu.desktop-CK5te_0K.js","assets/constants-x6gqETE9.js","assets/HomeOutlined-B9c9mYth.js","assets/TransactionOutlined-BjckbzBU.js","assets/SwapOutlined-5n1sdI44.js","assets/WebookContent-BCPw5BqQ.js","assets/useWebpushSubscription-DZpB0TTw.js","assets/GoogleOutlined-CNbpRv7S.js","assets/InstagramOutlined-DPUwDZLb.js","assets/InDevelopment-DNEk_Jig.js","assets/FilterOutlined-Qp4wXgRp.js","assets/Transactions.mobile-D0-pClGL.js","assets/CheckboxItem-DdFD0G4r.js","assets/FiltersHeader.mobile-CLRAMy7q.js","assets/useSetMobileMenuActions-BqSMJ-xa.js"])))=>i.map(i=>d[i]);
import{e as S,d as $,r as s,f as A,T as E,m as I,t as M,g as Y,j as l,F as y,G as D}from"./index-Bd9916Am.js";import{c as v,u as P,Y as O,X as G,J as N,e as z,f as L}from"./ClientDrawer-55jCGlAN.js";const d={show_filters:!1,page:1,results:20,filters:{start_date:S().startOf("month"),end_date:S().endOf("month"),anticipable:[]},openTransactionDetails:()=>{}},q=(t,r)=>{switch(r.type){case"reset_data":return d;case"set_filters":return{...t,page:1,filters:{...t.filters,...r.payload}};case"set_page":return{...t,page:r.payload};case"set_result":return{...t,results:r.payload};case"toggle_show_filters":return{...t,show_filters:!t.show_filters};default:return t}},Q=()=>({...d,filters:{...d.filters}}),x=v({dispatch:t=>{},...d}),H=t=>P(x,t),V=Y`
  query AsaasTransactions ($start_date: String, $end_date: String, $anticipable: Boolean, $page: Int, $results: Int) {
    asaas_transactions(start_date: $start_date, end_date: $end_date, anticipable: $anticipable, page: $page, results: $results) {
      all {
        id
        value
        status
        description
        due_date
        billing_type
        anticipated
        anticipable
        refunded
        credit_date

        transactionable {
          ... on Package {
            id code
          }

          ... on CustomerSubscription {
            id code
          }

          ... on ScheduleGroup {
            id
          }
        }
      }

      total_count
    }
  }
`,B=t=>{const r=$(e=>e.is_mobile),[o,u]=s.useState(),f=e=>{let n=[];const g=(e==null?void 0:e.asaas_transactions.total_count)||0;r&&t.page!==1?n=[...(o==null?void 0:o.asaas_transactions.all)||[],...(e==null?void 0:e.asaas_transactions.all)||[]]:n=(e==null?void 0:e.asaas_transactions.all)||[],u({asaas_transactions:{all:n,total_count:g}})},{loading:a,refetch:p}=A(V,{fetchPolicy:"network-only",variables:t,notifyOnNetworkStatusChange:!0,onError:e=>{console.error(e),E.captureException(e),I.error(M("phrases.generic_load_error_message"))},onCompleted:f});return{data:o,loading:a,refetch:p}},F=s.lazy(()=>y(()=>D(()=>import("./Transactions.desktop-DApnSMCu.js"),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29])))),J=s.lazy(()=>y(()=>D(()=>import("./Transactions.mobile-D0-pClGL.js"),__vite__mapDeps([30,1,2,31,3,4,5,6,7,8,9,10,11,12,13,14,15,32,24,25,26,27,28,33,29,16,17,20,21,22,23])))),R=()=>{var b,m;const t=Q(),r=s.useRef(null),o=s.useRef(null),u=s.useRef(null),f=s.useCallback(i=>{var _,T,h;if(!i.transactionable)return;const c=i.transactionable.__typename;if(c==="CustomerSubscription"){(_=r.current)==null||_.open(i.transactionable.id);return}if(c==="ScheduleGroup"){(T=o.current)==null||T.open({schedule_group_id:i.transactionable.id});return}if(c==="Package"){(h=u.current)==null||h.open(i.transactionable.id);return}},[]),[a,p]=s.useReducer(q,{...t,openTransactionDetails:f}),e=s.useMemo(()=>{const i=a.filters.start_date.format("YYYY-MM-DD"),c=a.filters.end_date.format("YYYY-MM-DD"),_=a.filters.anticipable.length===1?a.filters.anticipable[0]:void 0;return{start_date:i,end_date:c,anticipable:_,page:a.page,results:a.results}},[a.filters.anticipable,a.filters.end_date,a.filters.start_date,a.page,a.results]),{data:n,loading:g,refetch:w}=B(e),j=s.useMemo(()=>({...a,dispatch:p}),[a]),k=(b=n==null?void 0:n.asaas_transactions)==null?void 0:b.all,C=((m=n==null?void 0:n.asaas_transactions)==null?void 0:m.total_count)||0;return l.jsxs(x.Provider,{value:j,children:[l.jsx(O,{children:l.jsx(G,{Desktop:F,Mobile:J,loading:g,transactions:k,total_count:C,refetch:w})}),l.jsx(N,{ref:r}),l.jsx(z,{ref:o}),l.jsx(L,{ref:u})]})};R.displayName="Transactions";const U=s.memo(R),K=Object.freeze(Object.defineProperty({__proto__:null,default:U},Symbol.toStringTag,{value:"Module"}));export{K as T,Q as a,H as u};
//# sourceMappingURL=Transactions-CQ1kuciY.js.map
