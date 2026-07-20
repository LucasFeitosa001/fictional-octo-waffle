import{g as A,t as s,m as v,j as e,c as R,R as S,y as Q,d as b,r as h,cj as pe,k as V,U as P,e as T,$ as X}from"./index-Bd9916Am.js";import{A as he}from"./AnimatedModal-B0Wu-A-O.js";import{D as J}from"./index-UewmsNya.js";import{bY as fe,aL as K,af as U,x as ye,t as xe,z as ee,R as ge,D as be,v as we,T as j,B as ve,E as $e,l as se,cA as je,au as ke,h as O,b as Ie,cB as Se,cC as Ce,I as Re,o as Me}from"./ClientDrawer-55jCGlAN.js";import{G as De}from"./GenerateDocumentDrawer-Dt2MQWqi.js";import{u as Te}from"./useConfirmDestroy-Ced6r-tG.js";import{M as Le}from"./MagicTable-D-daxyPD.js";import{u as te}from"./useMutation-BrMwTcyD.js";import{a as L}from"./PhoneInput-Uk4Fy4k3.js";import{E as Ae,a as Ee}from"./ElectronicInvoiceIcon-DM6u-2c0.js";import{u as Fe}from"./useGetDocumentTemplates-ByJhJmEV.js";import{a as Ne,T as E,C as Oe}from"./index-N5o1yZfs.js";import{R as Ye}from"./PrinterOutlined-U8EP-aoz.js";import{R as Pe}from"./TrophyOutlined-Y3i6aYba.js";import{R as qe}from"./AuditOutlined-Bo6TnUfi.js";import{I as Y}from"./InvoiceTag-C1_su4BZ.js";import"./index-pPH-OUeJ.js";import"./useVariants-CcaHcr-K.js";import"./Overflow-BeweU6Wq.js";import"./openLink-DL3a6Hh-.js";import"./index-VnBECc_f.js";import"./ColumnsSettings-DQaC_giH.js";import"./FilterMenu.desktop-CK5te_0K.js";import"./WebookContent-BCPw5BqQ.js";import"./useWebpushSubscription-DZpB0TTw.js";import"./GoogleOutlined-CNbpRv7S.js";import"./InstagramOutlined-DPUwDZLb.js";import"./InDevelopment-DNEk_Jig.js";const He=A`
  query InventorySalesList(
    $deleted: Boolean,
    $page: Int,
    $results: Int,
    $search_query: String,
    $start_date: String,
    $end_date: String,
    $status: ID,
    $payment: [ID],
    $payment_status: [ID]
    $payment_method: Boolean!,
  ) {
    inventory_sales(
      deleted: $deleted,
      page: $page,
      results: $results,
      search: $search_query,
      start_date: $start_date,
      end_date: $end_date,
      status: $status,
      payment: $payment,
      payment_status: $payment_status,
      sort_field: "ID",
      sort_order: "DESC"
    ) {
      total_count

      all {
        id number code sum_cents finished date comment discount_cents deleted_at schedule_group_id

        client {
          id name deleted_at
        }

        sale_items {
          id
          package_item_id
          subscription_item_id
          offers_sale_item_id
          kind_points
          discount_cents
          product {
            id service
          }
        }

        bill_recs {
          id status cash_accounting_id

          payment @include(if: $payment_method) {
            id name kind
          }

          cash_accounting {
            id code
          }
        }

        electronic_invoice {
          id status_reason status document_id xml_file_link pdf_file_link
        }

        electronic_consumer_invoice {
          id status_reason status document_id xml_file_link pdf_file_link
        }

        invoice {
          id status pdf_link xml_link status_reason
        }

        audits(action: "destroy") {
          id
          user {
            id email
          }
        }
      }
    }
  }
`,Ke=A`
  query InventorySalesIdsQuery(
    $search_query: String,
    $start_date: String,
    $end_date: String,
    $status: ID,
    $payment: [ID],
    $payment_status: [ID],
    $sort_field: String,
    $sort_order: String,
  ) {
    inventory_sales(
      search: $search_query,
      start_date: $start_date,
      end_date: $end_date,
      status: $status,
      payment: $payment,
      payment_status: $payment_status,
      sort_field: $sort_field,
      sort_order: $sort_order,
    ) {
      all {
        id deleted_at
      }
    }
  }
`,z=({ids:o,failures:t,magicTableRef:l,isDestroy:_=!1,texts:i})=>{var g;const d=t.length===o.length,u=t.length===0,m=o.length-t.length,a=s(i.successPrefix,{count:m}).toLocaleLowerCase();if(u){_?v.success(`${m} ${s(i.successKey,{prefix:a,count:m,context:"female"})}`):v.success(i.successMessage),(g=l.current)==null||g.afterDestroyRecord(m);return}he.information({closable:!0,className:"webook-modal hide-buttons",maskClosable:!0,onCancel:()=>{var f;d||(f=l.current)==null||f.afterDestroyRecord(m)},title:i.title,content:e.jsxs("div",{style:{maxHeight:400,width:"100%",maxWidth:480,overflowX:"hidden",overflowY:"auto"},children:[!d&&e.jsx(R,{$size:16,$alignCenter:!0,$color:"green_2",children:_?`${m} ${s(i.successKey,{prefix:a,count:m,context:"female"})}`:s(i.successKey,{model:a,count:m,context:"female"})}),t.length>0&&e.jsxs(S,{$column:!0,$paddings:[0,10],children:[e.jsx(J,{dashed:!0}),e.jsx(R,{$size:16,$alignCenter:!0,$paddings:{bottom:10},children:s(i.failureMessageKey,{model:s("words.sale",{count:t.length}).toLocaleLowerCase(),count:t.length,context:"female"})}),t.map(({id:f,code:x,errors:p=[]})=>e.jsxs(ze,{children:[e.jsx(S,{$column:!0,style:{overflow:"hidden"},children:e.jsxs(R,{$size:16,$textEllipsis:!0,$block:!0,children:[s("words.ticket")," #",x]})}),e.jsx(S,{$column:!0,style:{overflow:"hidden"},$mTop:10,children:p.map(r=>e.jsx(R,{style:{color:"#FF7875"},children:r},`${r}_${f}`))})]},`sale_failure_item_${f}`))]})]})})},Ue=o=>s("phrases.confirm_delete_female",{model:s("words.sale",{count:o.length}).toLocaleLowerCase(),count:o.length,context:"female"}),ze=Q.div.withConfig({componentId:"wb__sc-11kuqzk-0"})(["display:flex;width:100%;flex-direction:column;align-items:center;background-color:#fbfbfb;border-radius:12px;box-shadow:0 2px 9px rgba(83,83,83,0.06);overflow:hidden;margin-bottom:15px;padding:10px;border:1px solid transparent;user-select:none;transition:transform .2s;"]),B=50,Be=o=>{const t=b(i=>{var d;return(d=i.current_user.salon.enotas_token)==null?void 0:d.token}),l=b(i=>i.current_user.addons.has_nfs)&&!!t,_=fe();return h.useCallback(i=>{if(!l){_({is_addon:!0,search:pe.ID_NEW_INVOICE});return}if(i.length>B){v.warning(s("invoices.mass_issue.limited",{max:B}));return}let d=!0,u=!0;const m=()=>{const[a,g]=h.useState(!0),[f,x]=h.useState(!0);return d=a,u=f,e.jsxs(e.Fragment,{children:[s("invoices.mass_issue.confirm_mass_issue"),e.jsx(K,{checked:a,onChange:p=>g(p.target.checked),children:s("invoices.mass_issue.send_client_data")}),e.jsx(K,{checked:f,onChange:p=>x(p.target.checked),children:s("invoices.mass_issue.send_client_address")})]})};V.confirm({centered:!0,className:"webook-modal",title:s("invoices.issue_invoice"),maskClosable:!0,content:e.jsx(m,{}),okText:s("words.yes"),okType:"danger",cancelText:s("verbs.cancel"),onOk:()=>{o(i,d,u)}})},[_,o,l])},Ge=A`
  mutation MassIssueInvoice($data: MassIssueInvoiceInput!) {
    massIssueInvoice(input: $data) {
      success
      failures { id code errors }
    }
  }
`,We=()=>{const[o]=te(Ge);return[async l=>{const _=v.loading(`${s("verbs.wait")}...`,0);try{const{data:i}=await o({variables:{data:l}}),{success:d=!1,failures:u=[]}=(i==null?void 0:i.massIssueInvoice)||{};return{success:d,failures:u}}catch(i){return v.error(s("phrases.generic_save_error_message")),console.error(i),{success:!1}}finally{_()}}]},Ze=A`
  mutation DestroyAllInventorySales($data: DestroyAllInventorySalesInput!) {
    destroyAllInventorySales(input: $data) {
      success
      failures { id code errors }
      errors
    }
  }
`,Qe=()=>{const[o]=te(Ze);return[async l=>{const _=v.loading(`${s("verbs.wait")}...`,0);try{const{data:i}=await o({variables:{data:l}}),{success:d=!1,failures:u=[],errors:m=[]}=(i==null?void 0:i.destroyAllInventorySales)||{};return m==null||m.map(a=>v.error(a)),{success:d,failures:u||[]}}catch(i){return v.error(s("phrases.generic_save_error_message")),console.error(i),{success:!1,failures:[]}}finally{_()}}]},ne=o=>{var p,r;const{sale:t,document_templates:l,destroySale:_,openDrawer:i,openGenerateDocumentModal:d}=o,u=b(n=>n.current_user.permissions),m=b(n=>n.current_user.addons.has_document_template),a=(r=((p=t.bill_recs)==null?void 0:p.find(n=>n.cash_accounting_id))||{})==null?void 0:r.cash_accounting,g=h.useCallback(()=>{if(!(u!=null&&u.can_destroy_sale)){v.warning(s("phrases.no_permission_to_do_this"));return}V.confirm({centered:!0,className:"webook-modal",title:s("words.attention"),maskClosable:!0,content:s("phrases.confirm_delete_female",{model:s("words.sale").toLocaleLowerCase(),context:"female"}),okText:s("phrases.yes_delete"),okType:"danger",cancelText:s("verbs.cancel"),onOk:()=>_(t.id)})},[_,u==null?void 0:u.can_destroy_sale,t.id]),f=h.useMemo(()=>l.length===0?[{key:"empty-document",label:s("document_templates.no_generators_found"),disabled:!0}]:l.map(n=>({key:n.id,label:`${s("verbs.generate")} ${n.name}`,icon:e.jsx(U,{}),onClick:()=>d({document_template_id:n.id,inventory_sale_id:t.id})})),[l,d,t.id]),x=h.useMemo(()=>{const n=[{key:"see-sale",title:t.finished?s("verbs.view"):s("verbs.edit"),icon:t.finished?e.jsx(Ne,{}):e.jsx(ye,{}),label:`${t.finished?s("verbs.see"):s("verbs.edit")} `+s("words.sale").toLocaleLowerCase(),onClick:()=>{if(!(u!=null&&u.can_edit_sale)){v.warning(s("phrases.no_permission_to_do_this"));return}i(t)}},{key:"print",icon:e.jsx(U,{}),onClick:()=>window.open(`/reports/sale/${t.id}`,"_blank","noopener, noreferrer"),label:s("verbs.print")},{key:"report-thermal-printer",icon:e.jsx(Ye,{}),onClick:()=>window.open(`/reports/sale/${t.id}?report_thermal_printer=true`,"_blank","noopener, noreferrer"),label:s("sale.thermal_print")}];return m&&n.push({key:"document_templates",icon:e.jsx(xe,{}),label:s("document_templates.generate_document"),className:"hidden-right-arrow",children:f}),n.push({key:"divider",type:"divider"},{key:"destroy",danger:!0,icon:e.jsx(ee,{}),label:s("verbs.delete"),onClick:g}),n},[g,f,m,i,u==null?void 0:u.can_edit_sale,t]);return e.jsxs(S,{justify:"center",children:[!!a&&e.jsxs(e.Fragment,{children:[e.jsx(E,{title:s("sale.verified_cash_closing",{number:a.code}),placement:"left",children:e.jsx("span",{style:{color:"#FF9800"},children:e.jsx(ge,{})})}),e.jsx(J,{type:"vertical"})]}),e.jsx(be,{menu:{items:x},trigger:["click"],overlayStyle:{width:190},children:e.jsx(P,{className:"link",children:e.jsx(we,{})})})]})};ne.displayName="ActionsColumn";const Ve=h.memo(ne),oe=({sale:o})=>{const t=o.sale_items.some(a=>a.package_item_id),l=o.sale_items.some(a=>a.offers_sale_item_id),_=o.sale_items.some(a=>a.kind_points==="-"),i=o.sale_items.some(a=>a.subscription_item_id),d=h.useMemo(()=>o.bill_recs||[],[o.bill_recs]),u=h.useMemo(()=>d.some(a=>a.status==="0")||!o.finished?{color:"orange",name:s("words.open")}:o.finished?d.some(a=>a.status==="2")?{color:"red",name:s("words.overdue")}:d.some(a=>a.status==="4")?{color:"blue",name:s("words.available")}:d.some(a=>a.status==="5")?{color:"#777777",name:s("words.blocked")}:{color:"green",name:s("words.paid")}:{icon:void 0,color:void 0,name:void 0},[d,o.finished]),m=h.useMemo(()=>{const a=[];if(t&&a.push(s("words.package").toLocaleLowerCase()),l&&a.push(s("words.offer").toLocaleLowerCase()),_&&a.push(s("sale.fidelity_points").toLocaleLowerCase()),i&&a.push(s("words.subscription").toLocaleLowerCase()),!!a.length)return s("sale.has_item_type",{models:a.join(", ")})},[_,l,t,i]);return e.jsx(E,{title:m,children:e.jsxs(j,{color:u.color,children:[u.name,_&&e.jsxs(e.Fragment,{children:[" - ",e.jsx(Pe,{})]}),t&&e.jsxs(e.Fragment,{children:[" - ",e.jsx(ve,{})]}),l&&e.jsxs(e.Fragment,{children:[" - ",e.jsx($e,{})]}),i&&e.jsxs(e.Fragment,{children:[" - ",e.jsx(qe,{})]})]})})};oe.displayName="PaymentTag";const Xe=h.memo(oe),Je=({openDrawer:o,handleDestroySale:t,clientDrawerRef:l,refetch:_,openGenerateDocumentModal:i})=>{const d=b(p=>p.current_user.permissions),u=b(p=>p.is_webook),m=b(p=>{var r;return(r=p.current_user.salon.enotas_token)==null?void 0:r.token}),a=b(p=>p.current_user.addons.has_nfs)&&!!m,g=b(p=>p.current_user.addons.has_nfe)&&!!m,f=b(p=>p.current_user.addons.has_nfce)&&!!m,x=Fe("Inventory::Sale");return h.useMemo(()=>{let p=[{title:s("words.ticket"),dataIndex:"code",key:"code",defaultSortOrder:"descend",width:80,always_visible:!0,render:(r,n)=>{var w;return(w=n.client)!=null&&w.deleted_at?`#${r}`:e.jsxs(P,{onClick:()=>{if(!d.can_edit_sale){v.warning(s("phrases.no_permission_to_do_this"));return}o(n)},children:["#",r]})}},{title:s("words.number"),key:"number",dataIndex:"number",width:80,ellipsis:!0,align:"left",default_visible:!1,render:r=>e.jsx("span",{title:r,children:r})},{title:s("words.date"),dataIndex:"date",key:"date",width:100,default_visible:!0,render:r=>T(r).format("L")},{title:s("words.client"),key:"client",dataIndex:"client",align:"left",width:"40%",always_visible:!0,render:r=>r!=null&&r.deleted_at?e.jsx("span",{title:s("phrases.client_deleted"),children:r.name}):e.jsx(P,{style:{maxWidth:"100%"},title:r==null?void 0:r.name,onClick:()=>{var n;if(!d.can_edit_client){v.warning(s("phrases.no_permission_to_do_this"));return}(n=l.current)==null||n.open({id:r==null?void 0:r.id})},children:r==null?void 0:r.name})},{title:s("words.status"),key:"status",dataIndex:"finished",default_visible:!0,width:80,render:r=>r?e.jsx(j,{color:"#777777",children:s("words.finished")}):e.jsx(j,{color:"orange",children:s("words.pending")})},{title:s("words.value"),key:"sum_cents",dataIndex:"sum_cents",align:"right",default_visible:!0,ellipsis:!0,width:100,render:(r,n)=>{const I=(n.sale_items||[]).reduce((k,F)=>k+(F.discount_cents||0),0)+((n==null?void 0:n.discount_cents)||0);return e.jsxs("div",{style:{wordBreak:"keep-all",whiteSpace:"nowrap"},children:[I>0&&e.jsx(E,{title:s("sale.discount_value",{value:L(I)}),children:e.jsx(se,{style:{color:"#52c41a",marginRight:4}})}),L(r)]})}},{title:s("words.payment"),key:"bill_recs",dataIndex:"bill_recs",default_visible:!0,width:100,render:(r,n)=>e.jsx(Xe,{sale:n})},{title:s("words.payment_type"),key:"payment_method",default_visible:!1,include_key_on_query:!0,ellipsis:!0,width:"35%",render:(r,n)=>{var w;return Array.from(new Set((w=n.bill_recs)==null?void 0:w.map(I=>{var k;return(k=I.payment)==null?void 0:k.name}))).join(", ")}},{title:s("words.observation"),key:"comment",dataIndex:"comment",default_visible:!1,ellipsis:!0,align:"left",width:"25%",render:r=>e.jsx("span",{title:r,children:r})}];return u||p.push({title:s("words.invoice"),key:"invoices",dataIndex:"invoices",default_visible:!0,ellipsis:!0,width:100,render:(r,n)=>{if(!n)return null;const w=n.sale_items.some(k=>k.product.service),I=n.sale_items.some(k=>!k.product.service);return e.jsxs(e.Fragment,{children:[e.jsx(je,{has_service:w,can_issue:a,sale_finished:n.finished,invoice:n.invoice,sale_id:n.id,type:"Inventory::Sale",refetch:_}),e.jsx("span",{style:{marginLeft:10},children:e.jsx(Ae,{has_product:I,can_issue:g,sale_finished:n.finished,electronic_invoice:n.electronic_invoice,type:"Inventory::Sale",sale_id:n.id,refetch:_})}),e.jsx("span",{style:{marginLeft:10},children:e.jsx(Ee,{has_product:I,can_issue:f,sale_finished:n.finished,electronic_consumer_invoice:n.electronic_consumer_invoice,sale_id:n.id,type:"Inventory::Sale",refetch:_})})]})}}),p.push({key:"actions",align:"center",always_visible:!0,width:70,render:(r,n)=>!n.deleted_at&&e.jsx(ke,{width:54,style:{height:46,paddingRight:0},children:e.jsx(Ve,{sale:n,document_templates:x,openGenerateDocumentModal:i,destroySale:t,openDrawer:o})})}),p},[l,x,t,f,g,a,u,o,i,d.can_edit_client,d.can_edit_sale,_])},es=[{value:"finished",label:e.jsx(j,{color:"#777777",children:s("words.finished")})},{value:"pending",label:e.jsx(j,{color:"orange",children:s("words.pending")})}],G=[{value:"5",label:e.jsx(j,{style:{margin:"2px 0"},color:"#777777",children:s("words.blocked")})},{value:"4",label:e.jsx(j,{style:{margin:"2px 0"},color:"blue",children:s("words.available")})},{value:"0",label:e.jsx(j,{style:{margin:"2px 0"},color:"orange",children:s("words.open")})},{value:"2",label:e.jsx(j,{style:{margin:"2px 0"},color:"red",children:s("words.overdue")})},{value:"3",label:e.jsx(j,{style:{margin:"2px 0"},color:"green",children:s("words.paid")})}],ss=()=>{const t=b(l=>l.finance_payments).filter(l=>l.active);return h.useMemo(()=>{const l=t.map(i=>({value:i.id,label:i.name}));return{filters:[{label:s("words.status"),name:"deleted",default_value:"false",double_checkbox:{true:s("words.deleted",{count:2,context:"female"}),false:s("words.not_deleted",{count:2,context:"female"})}},{label:s("words.period"),name:"date",rangepicker:{start_date_name:"start_date",end_date_name:"end_date"}},{label:s("words.payment_status"),name:"status",radio_options:es},{label:s("words.payment"),help:s("sale.tooltip.filter_payment"),name:"payment_status",checkbox_options:G,checkbox_disabled:!0},{label:s("words.payment_type"),name:"payment",checkbox_options:l,checkbox_disabled:!0}],payment_status_count:G.length,payment_count:l.length}},[t])},re=({sale:o})=>{var a,g,f,x,p,r;const t=b(n=>{var w;return(w=n.current_user.salon.enotas_token)==null?void 0:w.token}),l=b(n=>n.current_user.addons.has_nfs)&&!!t,_=b(n=>n.current_user.addons.has_nfe)&&!!t,i=b(n=>n.current_user.addons.has_nfce)&&!!t,d=o.finished,u=o.sale_items.some(n=>n.product.service),m=o.sale_items.some(n=>!n.product.service);return t?e.jsxs(X,{style:{paddingTop:5},children:[l&&e.jsx(Y,{label:"NFS-e",id:(a=o.invoice)==null?void 0:a.id,status:(g=o.invoice)==null?void 0:g.status,disabled:!u||!d}),_&&e.jsx(Y,{label:"NF-e",id:(f=o.electronic_invoice)==null?void 0:f.id,status:(x=o.electronic_invoice)==null?void 0:x.status,disabled:!m||!d}),i&&e.jsx(Y,{label:"NFC-e",id:(p=o.electronic_consumer_invoice)==null?void 0:p.id,status:(r=o.electronic_consumer_invoice)==null?void 0:r.status,disabled:!m||!d})]}):null};re.displayName="Invoices";const ae=o=>{var u,m,a,g,f;const{item:t}=o,l=((m=(u=t==null?void 0:t.bill_recs)==null?void 0:u.filter(x=>x.payment))==null?void 0:m.map(x=>x.payment.name).join(", "))||"",_=(g=(a=t==null?void 0:t.audits)==null?void 0:a[0])==null?void 0:g.user,d=((t==null?void 0:t.sale_items)||[]).reduce((x,p)=>x+(p.discount_cents||0),0)+((t==null?void 0:t.discount_cents)||0);return e.jsxs(S,{$column:!0,children:[e.jsxs(S,{justify:"space-between",children:[e.jsxs(O,{$block:!0,$textEllipsis:!0,$isFlex:!0,width:22,children:[e.jsxs(R,{$color:"primary",$bold:!0,$right:3,children:["#",t==null?void 0:t.code]})," ",(f=t==null?void 0:t.client)==null?void 0:f.name]}),e.jsxs(O,{onClick:x=>x.stopPropagation(),width:6,$align:"right",$block:!0,$semibold:!0,children:[d>0&&e.jsx(E,{title:s("sale.discount_value",{value:L(d)}),children:e.jsx(se,{style:{color:"#52c41a",marginRight:6}})}),L(t==null?void 0:t.sum_cents)]})]}),e.jsxs(S,{$top:5,justify:"space-between",children:[e.jsxs(O,{width:8,$block:!0,$color:"gray_1",$size:12,$isFlex:!0,$textEllipsis:!0,children:[T(t==null?void 0:t.date).format("L"),l?` - ${l}`:""]}),ie(t)]}),e.jsx(S,{children:t&&e.jsx(re,{sale:t})}),!!(t!=null&&t.deleted_at)&&e.jsx(S,{$top:5,children:e.jsxs(R,{$color:"gray_1",$size:12,children:[s("sale.order_deleted_on_date",{number:t.code,date:T(t.deleted_at,"YYYY-MM-DD HH:mm:ss ZZ").format("L, HH:mm[h]"),interpolation:{escapeValue:!1}}),!!_&&` ${s("words.by").toLocaleLowerCase()} ${_.email}`]})})]})};ae.displayName="SaleItemMobile";const ts=h.memo(ae),W=Q(j).withConfig({componentId:"wb__sc-15lb7ec-0"})(["margin-right:0 !important;width:75px;text-align:center;"]),ie=o=>o?o.finished?e.jsx(W,{color:"#777777",children:s("words.finished")}):e.jsx(W,{color:"#fdb730",children:s("words.pending")}):e.jsx(Ie,{width:"8ch"});ie.displayName="getStatus";const ce=({sale:o})=>{var l,_;const t=(_=(l=o.audits)==null?void 0:l[0])==null?void 0:_.user;return e.jsx(X,{className:"disabled",children:e.jsxs(Oe,{offset:1,span:12,children:[s("sale.order_deleted_on_date",{number:o.code,date:T(o.deleted_at,"YYYY-MM-DD HH:mm:ss ZZ").format("L, HH:mm[h]"),interpolation:{escapeValue:!1}}),!!t&&` ${s("words.by").toLocaleLowerCase()} ${t.email}`]})},o.id)};ce.displayName="ExpandedRow";const Z={true:!0,false:!1,all:null,none:null},Ts=()=>{const o=h.useRef(null),t=h.useRef(null),l=h.useRef(null),_=h.useRef(null),i=b(c=>c.current_user.permissions),d=h.useCallback(()=>{var c;(c=l.current)==null||c.refetch()},[]),[u]=Qe(),[m]=Se(),[a]=We(),g=h.useCallback(async c=>{const{success:y,failures:$=[]}=await u({ids:c});!y&&$.length===0||z({ids:c,failures:$,magicTableRef:l,isDestroy:!0,texts:{successMessage:"",successPrefix:"words.sale",successKey:"phrases.deleted_successfully",failureMessageKey:"phrases.failure_destroy_message",title:s("phrases.mass_delete_completed")}})},[u]),f=h.useCallback(async c=>{const{success:y}=await m({id:c});y&&(v.success(s("phrases.deleted_successfully",{prefix:s("words.sale"),context:"female"})),d())},[m,d]),x=h.useCallback(async(c,y,$)=>{const{success:N,failures:D=[]}=await a({ids:c,type:"Inventory::Sale",send_client:y,send_client_address:$});if(N){z({ids:c,failures:D,magicTableRef:l,texts:{successMessage:s("invoices.mass_issue.all_issued"),successPrefix:"words.sale",successKey:"invoices.mass_issue.issued_message",failureMessageKey:"invoices.mass_issue.failure_issue_message",title:s("invoices.mass_issue.process_started")}});return}v.error(s("invoices.mass_issue.error_on_issue"))},[a]),p=Te(i.can_destroy_sale,Ue,g),r=Be(x),n=h.useCallback(c=>{var $;const y=!!(c!=null&&c.deleted_at);($=o.current)==null||$.open({sale_id:c==null?void 0:c.id,with_deleted:y})},[]),w=h.useCallback(c=>{var y;(y=_.current)==null||y.open(c)},[]),I=h.useMemo(()=>({openDrawer:n,clientDrawerRef:t,handleDestroySale:f,refetch:d,openGenerateDocumentModal:w}),[f,n,w,d]),k=Je(I),{filters:F,payment_status_count:q,payment_count:H}=ss(),le=h.useMemo(()=>({expandIconColumnIndex:-1,rowExpandable:c=>!!c.deleted_at,expandedRowRender:c=>e.jsx(ce,{sale:c})}),[]),de=h.useCallback(c=>!(c!=null&&c.deleted_at),[]),ue=h.useCallback(c=>c.filter(y=>!!y.deleted_at).map(y=>y.id),[]),_e=h.useMemo(()=>[{label:s("invoices.issue_invoice"),icon:e.jsx(Ce,{style:{marginInlineEnd:8}}),onClick:r},{label:s("verbs.delete"),icon:e.jsx(ee,{}),danger:!0,onClick:p}],[r,p]),me=h.useCallback(c=>{const y={},$={},N=c.status==="pending",D={payment_status:q,payment:H};return Object.entries(c).forEach(([C,M])=>{if(["payment_status","payment"].includes(C)&&N?$[C]=[]:$[C]=M,C in D&&Array.isArray(M)&&M.length===D[C]){$[C]=[];return}M in Z&&(y[C]=Z[M])}),{...$,...y}},[q,H]);return e.jsxs(e.Fragment,{children:[e.jsx(Le,{ref:l,mass_actions:_e,openDrawer:n,permissions_key:"sale",search_placeholder:s("sale.search_placeholder"),title:s("words.sale",{count:2}),filters:F,columns:k,query:He,MobileItem:ts,select_all_query:Ke,getData:c=>{var y;return(y=c==null?void 0:c.inventory_sales)==null?void 0:y.all},getTotalCount:c=>{var y;return((y=c==null?void 0:c.inventory_sales)==null?void 0:y.total_count)||0},validateRow:de,expandable:le,expandedRowKeys:ue,parseFilters:me}),e.jsx(Re,{ref:o,afterSave:d}),e.jsx(Me,{ref:t,onSave:d}),e.jsx(De,{ref:_})]})};export{Ts as default};
//# sourceMappingURL=Sales-BXQc1KYc.js.map
