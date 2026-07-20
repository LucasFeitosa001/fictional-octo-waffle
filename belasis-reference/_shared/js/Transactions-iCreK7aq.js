const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/Transactions.mobile-Cem-lMnt.js","assets/index-Bd9916Am.js","assets/index-d41Ui0WO.css","assets/BillPayDrawer-CXxKrQie.js","assets/ClientDrawer-55jCGlAN.js","assets/PhoneInput-Uk4Fy4k3.js","assets/PhoneInput-Bbgo5x5y.css","assets/AnimatedModal-B0Wu-A-O.js","assets/index-N5o1yZfs.js","assets/useVariants-CcaHcr-K.js","assets/useMutation-BrMwTcyD.js","assets/index-pPH-OUeJ.js","assets/Overflow-BeweU6Wq.js","assets/openLink-DL3a6Hh-.js","assets/index-UewmsNya.js","assets/index-VnBECc_f.js","assets/ClientDrawer-CmlxdM94.css","assets/useCreateBillPayment-CqJshU-3.js","assets/SwapOutlined-5n1sdI44.js","assets/VendorInput-DFyrK_pJ.js","assets/VendorItem.mobile-Cjr6Qwv4.js","assets/Register.desktop-CHPmotQM.js","assets/InstagramOutlined-DPUwDZLb.js","assets/CheckboxItem-DdFD0G4r.js","assets/FiltersHeader.mobile-CLRAMy7q.js","assets/WebookContent-BCPw5BqQ.js","assets/useWebpushSubscription-DZpB0TTw.js","assets/GoogleOutlined-CNbpRv7S.js","assets/InDevelopment-DNEk_Jig.js","assets/useSetMobileMenuActions-BqSMJ-xa.js","assets/FilterOutlined-Qp4wXgRp.js","assets/CalculatorOutlined-Dn4rkZx2.js","assets/BillStatustag-CPMbUt9d.js","assets/LockOutlined-CSlPnRor.js","assets/RollbackOutlined-BcdomjF-.js","assets/Transactions.desktop-DZfm3bxt.js","assets/ColumnsSettings-DQaC_giH.js","assets/PrinterOutlined-U8EP-aoz.js","assets/useLocalStorage-9q0Hpuat.js","assets/Pagination.desktop-BLiVg_XC.js","assets/functions-CYsmhwyf.js","assets/FilterMenu.desktop-CK5te_0K.js"])))=>i.map(i=>d[i]);
import{g as D,j as e,c as C,y as Y,p as te,r as s,t as i,T as I,m as v,$ as pe,B as Z,R as G,f as me,n as fe,e as F,d as se,F as ae,G as ne}from"./index-Bd9916Am.js";import{h as ye,m as be,cu as he,S as ge,a1 as $e,cP as xe,l as ve,Y as Ce,X as we,c0 as Be}from"./ClientDrawer-55jCGlAN.js";import{I as Re,u as je,R as De,T as Me,B as Pe,a as Se}from"./BillPayDrawer-CXxKrQie.js";import{u as U}from"./openLink-DL3a6Hh-.js";import{a as O,M as re}from"./PhoneInput-Uk4Fy4k3.js";import{u as H}from"./useMutation-BrMwTcyD.js";import{C as ee,F as ke}from"./index-N5o1yZfs.js";import{T as Ie}from"./TransferDrawer-CwZmDP4Y.js";import{G as Ee}from"./GenerateDocumentDrawer-Dt2MQWqi.js";import{A as oe}from"./AnimatedModal-B0Wu-A-O.js";import{D as Fe}from"./index-UewmsNya.js";import"./index-pPH-OUeJ.js";import"./useVariants-CcaHcr-K.js";import"./Overflow-BeweU6Wq.js";import"./index-VnBECc_f.js";import"./useCreateBillPayment-CqJshU-3.js";import"./SwapOutlined-5n1sdI44.js";import"./VendorInput-DFyrK_pJ.js";import"./VendorItem.mobile-Cjr6Qwv4.js";import"./Register.desktop-CHPmotQM.js";import"./InstagramOutlined-DPUwDZLb.js";const Te=D`
  query FinanceAllTransactions (
    $accounts: [ID], $charts: [ID], $payments: [ID], $start_date: String, $end_date: String, $date_type: String,
    $status: [ID], $search_query: String, $sort_field: String, $sort_order: String, $bill_type: String
  ) {
    finance_bills (
      accounts: $accounts, charts: $charts, payments: $payments, start_date: $start_date, end_date: $end_date,
      date_type: $date_type, status: $status, search: $search_query, sort_field: $sort_field, sort_order: $sort_order,
      bill_type: $bill_type, no_transfer: true
    ) {
      all {
        ... on BillPay {
          id date due value_cents status bill_type historical movement_type movement_url movement_id
          vendor { id name }
          employee { id name }
          account { id name }
          cash_accounting { id code }
          chart { id name _default }
          payment { id name }
          bill_pay_offs { id compensated_at }
          salon { id }

          movement {
            ... on Movement {
              id code note has_commissions_advance_payment
            }
            ... on CashAccounting {
              id code closed
            }
          }
        }

        ... on BillRec {
          id date due value_cents status movement_type bill_type historical movement_url net_value_cents payment_rates
          consider_rates

          cash_accounting { id code }
          chart { id name _default }
          payment { id name processing_days }
          client { id name }
          account { id name }
          salon { id }

          movement {
            ... on Movement {
              id code
            }
            ... on CashAccounting {
              id code closed
            }
            ... on Offers_Sale {
              id code
            }
            ... on CustomerSubscriptionPayment {
              id customer_subscription {
                id code
              }
            }
          }

          bill_rec_offs { id compensated_at }
        }
      }
    }
  }
`,Ae=()=>U(Te,{fetchPolicy:"network-only"}),T=({name:a,color:r,value:m})=>e.jsx(Le,{$color:r,children:e.jsxs("div",{style:{color:"#FFFFFF"},children:[e.jsx(C,{$size:18,$block:!0,children:a}),e.jsx(ye,{width:"100%",$size:24,$bold:!0,$block:!0,children:O(m)})]})});T.displayName="Total";const Le=Y.div.withConfig({componentId:"wb__sc-hqobjs-0"})([""," background:",";border-radius:12px;padding:10px;display:flex;justify-content:space-between;box-shadow:rgba(99,99,99,0.2) 0 2px 8px 0;margin-bottom:10px;box-sizing:border-box;"],a=>!a.theme.is_mobile&&te`
    width: 24%;
  `,a=>a.$color),le=(a,r)=>{const[m,t]=s.useState(!1),[l,{data:o,loading:_}]=Ae(),u=(o==null?void 0:o.finance_bills.all)||[],f=u.filter(d=>d.bill_type==="rec"),y=u.filter(d=>d.bill_type==="pay"),p=f.filter(d=>d.status==="3").reduce((d,x)=>d+x.value_cents,0),h=f.filter(d=>d.status!=="3").reduce((d,x)=>d+x.value_cents,0),M=y.filter(d=>d.status==="3").reduce((d,x)=>d+x.value_cents,0),B=y.filter(d=>d.status!=="3").reduce((d,x)=>d+x.value_cents,0),P=()=>{t(!0),l({variables:a})},R=()=>t(!1);return s.useImperativeHandle(r,()=>({open:P,close:R})),e.jsx(re,{title:e.jsx(C,{$block:!0,$size:18,$bold:!0,children:i("words.total_other")}),centered:!0,closable:!0,destroyOnHidden:!0,open:m,onCancel:R,width:800,footer:!1,children:e.jsx(be.Provider,{value:_,children:e.jsxs(Ne,{children:[e.jsx(T,{name:i("finance.dashboard.received"),color:"#5cb85c",value:p}),e.jsx(T,{name:i("finance.dashboard.to_receive"),color:"#2196F3",value:h}),e.jsx(T,{name:i("finance.dashboard.paid"),color:"#f5a139",value:M}),e.jsx(T,{name:i("finance.dashboard.to_pay"),color:"#c73d3d",value:B})]})})})};le.displayName="TotalsModal";const Ye=s.memo(s.forwardRef(le)),Ne=Y.div.withConfig({componentId:"wb__sc-1ep11yo-0"})([""," justify-content:space-between;margin:0 0 15px 0;"],a=>!a.theme.is_mobile&&te(["display:flex;"])),ze=D`
  query LoadFinanceBillPayData($id: ID!) {
    finance_bill: finance_bill_pay(id: $id) {
      id
      recurrence { id }
    }
  }
`,qe=D`
  query LoadFinanceBillRecData($id: ID!) {
    finance_bill: finance_bill_rec(id: $id) {
      id
      recurrence: bill_rec_recurrence { id }
    }
  }
`,Ge=a=>U(qe,{onCompleted:r=>{const m=!!r.finance_bill.recurrence;a(m)},onError:r=>{I.captureException(r),console.error(r),v.error(i("phrases.generic_load_error_message"))}}),Oe=a=>U(ze,{onCompleted:r=>{const m=!!r.finance_bill.recurrence;a(m)},onError:r=>{I.captureException(r),console.error(r),v.error(i("phrases.generic_load_error_message"))}}),Ue=D`
  mutation BillModalDeleteBillPay($data: DeleteFinanceBillPayInput!) {
    deleteFinanceBillPay(input: $data) {
      deleted errors
    }
  }
`,He=D`
mutation BillModalDeleteBillRec($data: DeleteFinanceBillRecInput!) {
  deleteFinanceBillRec(input: $data) {
    deleted errors
  }
}
`,Qe=()=>{const[a,{loading:r}]=H(Ue);return[s.useCallback(async t=>{var l;try{const o=await a({variables:{data:t}}),{deleted:_,errors:u}=((l=o.data)==null?void 0:l.deleteFinanceBillPay)||{};return _?{success:!0}:(u==null||u.forEach(f=>v.error(f)),{success:!1})}catch(o){return I.captureException(o),console.error(o),v.error(i("phrases.generic_delete_error_message")),{success:!1}}},[a]),r]},Ve=()=>{const[a,{loading:r}]=H(He);return[s.useCallback(async t=>{var l;try{const o=await a({variables:{data:t}}),{deleted:_,errors:u}=((l=o.data)==null?void 0:l.deleteFinanceBillRec)||{};return _?{success:!0}:(u==null||u.forEach(f=>v.error(f)),{success:!1})}catch(o){return I.captureException(o),console.error(o),v.error(i("phrases.generic_delete_error_message")),{success:!1}}},[a]),r]},ie=({afterDeleteBill:a},r)=>{const[m,t]=s.useState(!1),[l,o]=s.useState(),[_,u]=s.useState(!1),[f,y]=s.useState(!1),[p,{loading:h,error:M}]=Oe(y),[B,{loading:P,error:R}]=Ge(y),[d,x]=Qe(),[E,A]=Ve(),N=s.useCallback(b=>{o(b),b.bill_type==="pay"?p({variables:{id:b.id}}):B({variables:{id:b.id}}),t(!0)},[p,B]),z=s.useCallback(()=>{t(!1)},[]);s.useImperativeHandle(r,()=>({open:N,close:z}));const w=s.useCallback(async()=>{if(!l)return;let b=null;l.bill_type==="pay"?b=await d({id:l.id,affect_future_recurrences:_}):l.bill_type==="rec"&&(b=await E({id:l.id,affect_future_recurrences:_})),b!=null&&b.success&&(t(!1),v.success(i("phrases.deleted_successfully",{context:"female",prefix:i("words.transaction")})),a())},[_,a,l,d,E]),L=s.useCallback(()=>{u(!1),o(void 0)},[]),S=h||P,q=M||R;return e.jsx(re,{width:400,footer:null,closable:!1,open:m,afterClose:L,children:e.jsxs(he,{spinning:S,children:[e.jsx(C,{$size:15,$semibold:!0,$bottom:20,children:i("phrases.confirm_delete",{context:"female",model:i("words.transaction").toLocaleLowerCase()})}),e.jsx(C,{$block:!0,$bottom:20,children:f&&e.jsxs(e.Fragment,{children:[e.jsxs(C,{$block:!0,$bottom:10,children:[i("finance.transactions.delete_next_recurrences"),":"]}),e.jsx(ge,{checked:_,onChange:b=>u(b)})]})}),e.jsxs(pe,{gutter:8,justify:"end",children:[e.jsx(ee,{children:e.jsx(Z,{onClick:()=>t(!1),children:i("verbs.cancel")})}),e.jsx(ee,{children:e.jsx(Z,{danger:!0,type:"primary",disabled:!!q,onClick:w,loading:x||A,children:i("verbs.delete")})})]})]})})};ie.displayName="DeleteBillModal";const Ke=s.memo(s.forwardRef(ie)),We=({ids:a,failures:r})=>{const m=r.length===a.length,t=r.length===0,l=a.length-r.length;if(t){v.success(i("finance.transactions.mass_payment.all_payed"));return}oe.information({closable:!0,className:"webook-modal hide-buttons",maskClosable:!0,title:i("finance.transactions.mass_payment.title"),content:e.jsxs("div",{style:{maxHeight:400,width:"100%",maxWidth:480,overflowX:"hidden",overflowY:"auto"},children:[!m&&e.jsx(C,{$size:16,$alignCenter:!0,$color:"green_2",children:i("finance.transactions.mass_payment.some_payed_success",{count:l})}),r.length>0&&e.jsxs(G,{$column:!0,$paddings:[0,10],children:[e.jsx(Fe,{dashed:!0}),e.jsx(C,{$size:16,$alignCenter:!0,$paddings:{bottom:10},children:i("finance.transactions.mass_payment.some_failed",{count:r.length})}),r.map(({id:o,historical:_,value_cents:u,bill_type:f,errors:y=[]})=>e.jsxs(Xe,{$backgroundColor:f==="Finance::BillRec"?"#def3de99":"#ffe5e599",children:[e.jsx(G,{$column:!0,children:e.jsx(C,{$size:16,$block:!0,children:_?e.jsxs(e.Fragment,{children:[O(u)," - ",_]}):e.jsxs(e.Fragment,{children:[O(u)," - ",f==="Finance::BillRec"?i("words.receipt"):i("words.expense")]})})}),e.jsx(G,{$column:!0,style:{overflow:"hidden"},$mTop:10,children:y.map(p=>e.jsx(C,{style:{color:"#FF7875"},children:p},`${p}_${o}`))})]},`sale_failure_item_${o}`))]})]})})},Xe=Y.div.withConfig({componentId:"wb__sc-1y3zag0-0"})(["display:flex;width:100%;flex-direction:column;align-items:center;background-color:",";border-radius:12px;box-shadow:0 2px 9px rgba(83,83,83,0.06);overflow:hidden;margin-bottom:15px;padding:10px;border:1px solid transparent;user-select:none;transition:transform .2s;"],a=>a.$backgroundColor),Je=D`
  query FinanceTransactions (
    $accounts: [ID],
    $charts: [ID],
    $payments: [ID],
    $start_date: String,
    $end_date: String,
    $date_type: String,
    $status: [ID],
    $page: Int,
    $results: Int,
    $search_query: String,
    $sort_field: String,
    $sort_order: String,
    $bill_type: String
  ) {
    finance_bills(
      accounts: $accounts,
      charts: $charts,
      payments: $payments,
      start_date: $start_date,
      end_date: $end_date,
      date_type: $date_type,
      status: $status,
      page: $page,
      results: $results,
      search: $search_query,
      sort_field: $sort_field,
      sort_order: $sort_order,
      bill_type: $bill_type
    ) {
      total_count

      all {
        ... on BillPay {
          id date due value_cents status bill_type historical movement_type movement_url movement_id
          organization_transaction
          vendor { id name }
          employee { id name }
          account { id name }
          cash_accounting { id code }
          chart { id name _default }
          payment { id name }
          bill_pay_offs { id compensated_at }
          salon { id }

          movement {
            ... on Movement {
              id code note has_commissions_advance_payment
            }
            ... on CashAccounting {
              id code closed reopened_at
            }
          }
        }

        ... on BillRec {
          id date due value_cents status movement_type bill_type historical movement_url net_value_cents payment_rates
          consider_rates
          organization_transaction

          cash_accounting { id code }
          chart { id name _default }
          payment { id name processing_days }
          client { id name }
          account { id name }
          salon { id }

          movement {
            ... on Movement {
              id code
            }
            ... on CashAccounting {
              id code closed reopened_at
            }
            ... on Offers_Sale {
              id code
            }
            ... on CustomerSubscriptionPayment {
              id customer_subscription {
                id code
              }
            }
          }

          bill_rec_offs { id compensated_at }
        }
      }
    }
  }
`,Ze=a=>me(Je,{fetchPolicy:"network-only",notifyOnNetworkStatusChange:!0,...a,onError:r=>{console.error(r),I.captureException(r),v.error(i("phrases.generic_load_error_message"))}}),et=()=>{const{search:a}=fe();return s.useMemo(()=>{const r=new URLSearchParams(a);return Object.keys(Re.filters).reduce((t,l)=>{const o=r.get(l);return o?l==="start_date"||l==="end_date"?{...t,[l]:F(o)}:l==="date_type"?{...t,[l]:o}:{...t,[l]:o.split(",")}:t},{})},[a])},tt=a=>{const r=se(l=>l.current_user.permissions),m=r.can_edit_bill_pay,t=r.can_edit_bill_rec;return s.useCallback((l,o)=>{if(!m&&!t){v.warning(i("phrases.no_permission_to_do_this"));return}let _=F();const u=()=>{const[f,y]=s.useState(F());return _=f,e.jsxs(e.Fragment,{children:[i("finance.transactions.confirm_mass_payment"),e.jsx(ke.Item,{style:{marginTop:12},layout:"vertical",required:!0,label:i("phrases.payment_date"),children:e.jsx(st,{value:f,onChange:p=>{p&&F.isDayjs(p)&&y(p)},size:"large",style:{width:"100%"},format:"DD MMMM, YYYY",disabledDate:p=>p>F(),getPopupContainer:p=>p.parentElement||document.body,allowClear:!1})})]})};oe.information({useConfirm:!0,className:"webook-modal",title:i("finance.transactions.confirm_mass_payment_title"),content:e.jsx(u,{}),okText:i("phrases.yes_pay"),okType:"danger",cancelText:i("verbs.cancel"),onOk:()=>a(l,_,o)})},[a,m,t])},st=Y($e).withConfig({componentId:"wb__sc-b43ifc-0"})(["input{text-align:center;}"]),at=D`
  mutation CreateBillMultiplePolymorphicPayments ($data: CreateBillMultiplePolymorphicPaymentsInput!) {
    createBillMultiplePolymorphicPayments (input: $data) {
      success
      failures {
        id
        historical
        bill_type
        value_cents
        errors
      }
      bill_recs {
        id
        status
        compensated_at
      }
      bill_pays {
        id
        status
        compensated_at
      }
    }
  }
`,nt=()=>{const[a,{loading:r}]=H(at);return[s.useCallback(async t=>{var l;try{const o=await a({variables:{data:t}}),{success:_=!1,failures:u=[],bill_recs:f=[],bill_pays:y=[]}=((l=o.data)==null?void 0:l.createBillMultiplePolymorphicPayments)||{},p=[...f.map(h=>({...h,bill_type:"rec"})),...y.map(h=>({...h,bill_type:"pay"}))];return{success:_,failures:u,updated_bills:p}}catch(o){return I.captureException(o),console.error(o),v.error(i("clients.debit.cant_create_payment_message_error")),{success:!1,updated_bills:[]}}},[a]),r]},rt=s.lazy(()=>ae(()=>ne(()=>import("./Transactions.mobile-Cem-lMnt.js"),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34])))),ot=s.lazy(()=>ae(()=>ne(()=>import("./Transactions.desktop-DZfm3bxt.js"),__vite__mapDeps([35,1,2,4,5,6,7,8,9,10,11,12,13,14,15,16,20,21,22,3,17,18,19,36,37,32,33,38,39,40,41,25,26,27,28,30,31])))),lt=()=>{const a=je(),r=et(),m={...a.filters,...r},[t,l]=s.useReducer(De,{...a,filters:m}),[o,_]=s.useState([]),[u,f]=s.useState(0),[y,p]=s.useState([]),h=se(n=>n.is_mobile),M=s.useRef(null),B=s.useRef(null),P=s.useRef(null),R=s.useRef(null),d=s.useRef(null),x=s.useRef(null),E=s.useRef(null);s.useEffect(()=>{Object.keys(r).length!==0&&l({type:"toggle_show_filters"})},[]),xe({feature_keys:["has_finance_transactions"]});const A=s.useMemo(()=>{let n="both";t.filters.bill_type.length===1&&(n=t.filters.bill_type[0]);const c=t.filters.start_date.format("YYYY-MM-DD"),g=t.filters.end_date.format("YYYY-MM-DD"),j=t.filters.search?t.filters.search.replace(/[,.]/g,""):void 0;return{...t.filters,search_query:j,bill_type:n,start_date:c,end_date:g,page:t.page,results:t.results,sort_field:t.filters.date_type,sort_order:t.sort_order}},[t.filters,t.page,t.results,t.sort_order]),N=s.useCallback(n=>{if(!h||t.page===1){_(n.finance_bills.all),f(n.finance_bills.total_count);return}_(c=>{const g=new Set(c.map($=>`${$.bill_type}_${$.id}`)),j=n.finance_bills.all.filter($=>!g.has(`${$.bill_type}_${$.id}`));return[...c,...j]}),f(n.finance_bills.total_count)},[h,t.page]),{loading:z,refetch:w}=Ze({variables:A,onCompleted:N}),[L]=nt(),S=s.useCallback(n=>{_(c=>c.map(g=>g.id===n.id&&g.bill_type===n.bill_type?{...g,...n}:g))},[]),q=s.useCallback(async(n,c,g)=>{const{success:j,failures:$=[],updated_bills:ue=[]}=await L({ids:n,bills_type:g,compensated_at:c.format("YYYY-MM-DD")});if(j){p([]),ue.forEach(_e=>{S(_e)}),We({ids:n,failures:$});return}v.error("Houve um erro na criação dos pagamentos.")},[L,S]),b=tt(q),k=s.useCallback(()=>{if(h){if(t.page===1){w();return}l({type:"set_page",payload:1});return}w()},[h,w,t.page]),ce=s.useCallback(()=>{if(h){if(t.page===1){w();return}l({type:"set_page",payload:1});return}const n=Math.ceil((u-1)/t.results);if(t.page>n){l({type:"set_page",payload:n});return}w()},[h,w,t.page,t.results,u]),Q=s.useCallback(()=>{l({type:"set_page",payload:t.page+1})},[t.page]),V=s.useCallback(n=>{var c;(c=x.current)==null||c.open(n)},[]),K=s.useCallback(n=>{p(n)},[]),W=s.useCallback(n=>{if(n){const c=(o==null?void 0:o.map(g=>g.id))||[];p(c)}else p([])},[o]),X=s.useMemo(()=>({selected_rows:y,selectedRowKeys:y,onChange:K,onSelectAll:W}),[y,K,W]),J=s.useMemo(()=>[{label:i("verbs.pay"),icon:e.jsx(ve,{}),onClick:n=>{const c=o.filter($=>n.includes($.id)),g=c.map($=>$.id),j=c.map($=>$.bill_type==="rec"?"Finance::BillRec":"Finance::BillPay");b(g,j)}}],[b,o]),de=s.useMemo(()=>({...t,dispatch:l,openAdvanceDrawer:n=>{var c;return(c=R.current)==null?void 0:c.open(n)},openBillRecDrawer:n=>{var c;return(c=M.current)==null?void 0:c.open({id:n})},openBillPayDrawer:n=>{var c;return(c=B.current)==null?void 0:c.open({id:n})},openTransferDrawer:()=>{var n;return(n=P.current)==null?void 0:n.open()},openDeleteBillModal:n=>{var c;return(c=d.current)==null?void 0:c.open(n)},openGenerateDocumentModal:V,refetch:k,handleFetchMore:Q,openTotalsModal:()=>{var n;return(n=E.current)==null?void 0:n.open()},updateBillInList:S,mass_actions:J,row_selection:X}),[Q,k,V,J,t,X,S]);return e.jsxs(Me.Provider,{value:de,children:[e.jsx(Ce,{children:e.jsx(we,{Desktop:ot,Mobile:rt,bills:o,loading:z,total_count:u})}),e.jsx(Pe,{ref:M,afterSave:k}),e.jsx(Se,{ref:B,afterSave:k}),e.jsx(Ie,{ref:P,afterSave:k}),e.jsx(Be,{ref:R,afterSave:k}),e.jsx(Ke,{ref:d,afterDeleteBill:ce}),e.jsx(Ee,{ref:x}),e.jsx(Ye,{ref:E,...A})]})};lt.displayName="Transactions";export{lt as default};
//# sourceMappingURL=Transactions-iCreK7aq.js.map
