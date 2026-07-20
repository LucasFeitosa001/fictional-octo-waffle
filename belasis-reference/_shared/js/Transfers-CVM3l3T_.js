const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/Transfers.desktop-B1FmP0gP.js","assets/index-Bd9916Am.js","assets/index-d41Ui0WO.css","assets/ClientDrawer-55jCGlAN.js","assets/PhoneInput-Uk4Fy4k3.js","assets/PhoneInput-Bbgo5x5y.css","assets/AnimatedModal-B0Wu-A-O.js","assets/index-N5o1yZfs.js","assets/useVariants-CcaHcr-K.js","assets/useMutation-BrMwTcyD.js","assets/index-pPH-OUeJ.js","assets/Overflow-BeweU6Wq.js","assets/openLink-DL3a6Hh-.js","assets/index-UewmsNya.js","assets/index-VnBECc_f.js","assets/ClientDrawer-CmlxdM94.css","assets/constants-DCod3P6y.js","assets/Pagination.desktop-BLiVg_XC.js","assets/FilterMenu.desktop-CK5te_0K.js","assets/constants-x6gqETE9.js","assets/HomeOutlined-B9c9mYth.js","assets/TransactionOutlined-BjckbzBU.js","assets/SwapOutlined-5n1sdI44.js","assets/WebookContent-BCPw5BqQ.js","assets/useWebpushSubscription-DZpB0TTw.js","assets/GoogleOutlined-CNbpRv7S.js","assets/InstagramOutlined-DPUwDZLb.js","assets/InDevelopment-DNEk_Jig.js","assets/FilterOutlined-Qp4wXgRp.js","assets/Transfers.mobile-BUgnr-Px.js","assets/FiltersHeader.mobile-CLRAMy7q.js","assets/useSetMobileMenuActions-BqSMJ-xa.js"])))=>i.map(i=>d[i]);
import{e as m,d as E,r,f as M,T as Y,m as j,t as v,g as A,j as f,F as p,G as T}from"./index-Bd9916Am.js";import{c as D,u as I,Y as R,X as $}from"./ClientDrawer-55jCGlAN.js";const l={show_filters:!1,page:1,results:20,filters:{start_date:m().startOf("month"),end_date:m().endOf("month")}},w=(e,t)=>{switch(t.type){case"reset_data":return l;case"set_filters":return{...e,page:1,filters:{...e.filters,...t.payload}};case"set_page":return{...e,page:t.payload};case"set_result":return{...e,results:t.payload};case"toggle_show_filters":return{...e,show_filters:!e.show_filters};default:return e}},b=()=>({...l,filters:{...l.filters}}),y=D({dispatch:e=>{},...l}),L=e=>I(y,e),C=A`
  query AsaasTransfers ($start_date: String, $end_date: String, $page: Int, $results: Int) {
    asaas_transfers(start_date: $start_date, end_date: $end_date, page: $page, results: $results) {
      all {
        id
        status
        date_created
        effective_date
        net_value
        operation_type
        account_name
        owner_name
        cpf_cnpj
      }

      total_count
    }
  }
`,O=e=>{const t=E(s=>s.is_mobile),[n,_]=r.useState(),a=s=>{let o=[];const u=(s==null?void 0:s.asaas_transfers.total_count)||0;t&&e.page!==1?o=[...(n==null?void 0:n.asaas_transfers.all)||[],...(s==null?void 0:s.asaas_transfers.all)||[]]:o=(s==null?void 0:s.asaas_transfers.all)||[],_({asaas_transfers:{all:o,total_count:u}})},{loading:c,refetch:i}=M(C,{fetchPolicy:"network-only",variables:e,notifyOnNetworkStatusChange:!0,onError:s=>{console.error(s),Y.captureException(s),j.error(v("phrases.generic_load_error_message"))},onCompleted:a});return{data:n,loading:c,refetch:i}},k=r.lazy(()=>p(()=>T(()=>import("./Transfers.desktop-B1FmP0gP.js"),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28])))),P=r.lazy(()=>p(()=>T(()=>import("./Transfers.mobile-BUgnr-Px.js"),__vite__mapDeps([29,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,30,23,24,25,26,27,31,28,16,19,20,21,22])))),h=()=>{var d,g;const e=b(),[t,n]=r.useReducer(w,{...e}),_=r.useMemo(()=>{const S=t.filters.start_date.format("YYYY-MM-DD"),x=t.filters.end_date.format("YYYY-MM-DD");return{start_date:S,end_date:x,page:t.page,results:t.results}},[t.filters.end_date,t.filters.start_date,t.page,t.results]),{data:a,loading:c,refetch:i}=O(_),s=r.useMemo(()=>({...t,dispatch:n}),[t]),o=(d=a==null?void 0:a.asaas_transfers)==null?void 0:d.all,u=((g=a==null?void 0:a.asaas_transfers)==null?void 0:g.total_count)||0;return f.jsx(y.Provider,{value:s,children:f.jsx(R,{children:f.jsx($,{Desktop:k,Mobile:P,loading:c,transfers:o,total_count:u,refetch:i})})})};h.displayName="Transfers";const N=r.memo(h),q=Object.freeze(Object.defineProperty({__proto__:null,default:N},Symbol.toStringTag,{value:"Module"}));export{q as T,b as a,L as u};
//# sourceMappingURL=Transfers-CVM3l3T_.js.map
