import{m as y,t as e,j as s,c as P,R as j,y as q,g as E,r as d,d as x,k as re,U as N,e as A,$ as ne}from"./index-Bd9916Am.js";import{A as oe}from"./AnimatedModal-B0Wu-A-O.js";import{D as ae}from"./index-UewmsNya.js";import{af as F,x as ie,t as le,z as U,D as ce,v as de,aC as ue,T as w,cA as me,au as _e,h as C,b as z,cP as he,f as pe,o as fe}from"./ClientDrawer-55jCGlAN.js";import{G as ge}from"./GenerateDocumentDrawer-Dt2MQWqi.js";import{u as xe}from"./useConfirmDestroy-Ced6r-tG.js";import{u as G}from"./useMutation-BrMwTcyD.js";import{M as we}from"./MagicTable-D-daxyPD.js";import{a as Y}from"./PhoneInput-Uk4Fy4k3.js";import{E as be,a as ke}from"./ElectronicInvoiceIcon-DM6u-2c0.js";import{u as ye}from"./useGetDocumentTemplates-ByJhJmEV.js";import{a as $e}from"./index-N5o1yZfs.js";import{R as je}from"./LockOutlined-CSlPnRor.js";import{b as ve}from"./openLink-DL3a6Hh-.js";import{I as L}from"./InvoiceTag-C1_su4BZ.js";import"./index-pPH-OUeJ.js";import"./useVariants-CcaHcr-K.js";import"./Overflow-BeweU6Wq.js";import"./index-VnBECc_f.js";import"./ColumnsSettings-DQaC_giH.js";import"./FilterMenu.desktop-CK5te_0K.js";import"./WebookContent-BCPw5BqQ.js";import"./useWebpushSubscription-DZpB0TTw.js";import"./GoogleOutlined-CNbpRv7S.js";import"./InstagramOutlined-DPUwDZLb.js";import"./InDevelopment-DNEk_Jig.js";const Ie=({ids:r,failures:t,magicTableRef:m})=>{var c;const h=t.length===r.length,a=t.length===0,i=r.length-t.length;if(a){y.success(`${i} ${e("phrases.deleted_successfully",{prefix:e("words.package",{count:i}).toLocaleLowerCase(),count:i})}`),(c=m.current)==null||c.afterDestroyRecord(i);return}oe.information({closable:!0,className:"webook-modal hide-buttons",maskClosable:!0,onCancel:()=>{var u;h||(u=m.current)==null||u.afterDestroyRecord(i)},title:e("phrases.mass_delete_completed"),content:s.jsxs("div",{style:{maxHeight:400,width:"100%",maxWidth:480,overflowX:"hidden",overflowY:"auto"},children:[!h&&s.jsxs(P,{$size:16,$alignCenter:!0,$color:"green_2",children:[i," ",e("phrases.deleted_successfully",{prefix:e("words.package",{count:i}).toLocaleLowerCase(),count:i})]}),t.length>0&&s.jsxs(j,{$column:!0,$paddings:[0,10],children:[s.jsx(ae,{dashed:!0}),s.jsx(P,{$size:16,$alignCenter:!0,$paddings:{bottom:10},children:e("phrases.failure_destroy_message",{model:e("words.package",{count:t.length}).toLocaleLowerCase(),count:t.length})}),t.map(({id:u,code:g,errors:b=[]})=>s.jsxs(Pe,{children:[s.jsx(j,{$column:!0,style:{overflow:"hidden"},children:s.jsxs(P,{$size:16,$textEllipsis:!0,$block:!0,children:[e("words.code")," #",g]})}),s.jsx(j,{$column:!0,style:{overflow:"hidden"},$mTop:10,children:b.map(k=>s.jsx(P,{style:{color:"#FF7875"},children:k},`${k}_${u}`))})]},`package_item_${u}`))]})]})})},Ce=r=>e("phrases.confirm_delete",{model:e("words.package",{count:r.length}).toLocaleLowerCase(),count:r.length}),Pe=q.div.withConfig({componentId:"wb__sc-1k9herd-0"})(["display:flex;width:100%;flex-direction:column;align-items:center;background-color:#fbfbfb;border-radius:12px;box-shadow:0 2px 9px rgba(83,83,83,0.06);overflow:hidden;margin-bottom:15px;padding:10px;border:1px solid transparent;user-select:none;transition:transform .2s;"]),De=E`
  query PackagesList (
    $page: Int,
    $results: Int,
    $search_query: String,
    $sort_field: String,
    $sort_order: String,
    $deleted: Boolean,
    $start_date: String,
    $end_date: String,
    $status: String,
    $payment_status: [ID],
    $bill_recs: Boolean!,
    $client: Boolean!
  ) {
    inventory_packages (
      page: $page,
      results: $results,
      search_term: $search_query,
      sort_field: $sort_field,
      sort_order: $sort_order,
      deleted: $deleted,
      start_date: $start_date,
      end_date: $end_date,
      status: $status,
      payment_status: $payment_status,
    ) {
      all {
        id
        code
        date
        expiration_date
        deleted_at
        client @include(if: $client) {
          id name
        }
        sum_cents
        finished
        available
        bill_recs @include(if: $bill_recs) {
          id status
        }
        comment

        package_items {
          id
          product {
            id
            service
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
      }
      total_count
    }
  }
`,Te=E`
  query PackageIdsList ($deleted: Boolean) {
    inventory_packages (deleted: $deleted) {
      all {
        id active
      }
    },
  }
`,Se=E`
  mutation DestroyAllInventoryPackages($data: DestroyAllInventoryPackagesInput!) {
    destroyAllInventoryPackages(input: $data) {
      success
      failures { id code errors }
      errors
    }
  }
`,Re=()=>{const[r]=G(Se);return[d.useCallback(async m=>{const h=y.loading(`${e("verbs.wait")}...`,0);try{const{data:a}=await r({variables:{data:m}}),{success:i=!1,failures:c=[],errors:u=[]}=(a==null?void 0:a.destroyAllInventoryPackages)||{};return u==null||u.map(g=>y.error(g)),{success:i,failures:c||[]}}catch(a){return y.error(e("phrases.generic_save_error_message")),console.error(a),{success:!1,failures:[]}}finally{h()}},[r])]},B=r=>{const{inventory_package:t,document_templates:m,destroyPackage:h,openPackageDrawer:a,openGenerateDocumentModal:i}=r,c=x(_=>_.current_user.permissions),u=x(_=>_.current_user.addons.has_document_template),g=d.useCallback(_=>{if(!(c!=null&&c.can_destroy_package)){y.warning(e("phrases.no_permission_to_do_this"));return}re.confirm({centered:!0,className:"webook-modal",title:e("words.attention"),maskClosable:!0,content:e("phrases.confirm_delete",{model:e("words.package").toLocaleLowerCase()}),okText:e("phrases.yes_delete"),okType:"danger",cancelText:e("verbs.cancel"),onOk:()=>h(_)})},[h,c==null?void 0:c.can_destroy_package]),b=d.useMemo(()=>m.length===0?[{key:"empty-document",label:e("document_templates.no_generators_found"),disabled:!0}]:m.map(_=>({key:_.id,label:`${e("verbs.generate")} ${_.name}`,icon:s.jsx(F,{}),onClick:()=>i({document_template_id:_.id,inventory_package_id:t.id})})),[m,i,t.id]),k=d.useMemo(()=>{const _=[{key:"see-package",label:t.finished?e("verbs.view"):e("verbs.edit"),icon:t.finished?s.jsx($e,{}):s.jsx(ie,{}),onClick:()=>{if(!(c!=null&&c.can_edit_package)){y.warning(e("phrases.no_permission_to_do_this"));return}a(t.id)}},{key:"print",label:e("verbs.print"),icon:s.jsx(F,{}),onClick:()=>{window.open(`/reports/package/${t.id}`,"_blank","noopener, noreferrer")}}];return u&&_.push({key:"document_templates",icon:s.jsx(le,{}),label:e("document_templates.generate_document"),className:"hidden-right-arrow",children:b}),_.push({key:"destroy",onClick:()=>g(t.id),label:e("verbs.delete"),danger:!0,icon:s.jsx(U,{})}),_},[b,g,u,t.finished,t.id,a,c==null?void 0:c.can_edit_package]);return s.jsx(j,{justify:"center",children:s.jsx(ce,{menu:{items:k},trigger:["click"],children:s.jsx(N,{className:"link",children:s.jsx(de,{})})})})};B.displayName="ActionsColumn";const W=({bill_recs:r,inventory_package:t,style:m})=>{const h=d.useMemo(()=>r!=null&&r.some(a=>a.status==="0")||!t.finished?{color:"orange",name:e("words.open")}:r!=null&&r.some(a=>a.status==="2")?{color:"red",name:e("words.overdue"),icon:s.jsx(ue,{})}:r!=null&&r.some(a=>a.status==="4")?{color:"blue",name:e("words.available")}:r!=null&&r.some(a=>a.status==="5")?{color:"#777777",name:e("words.blocked"),icon:s.jsx(je,{})}:{color:"green",name:e("words.paid"),icon:s.jsx(ve,{})},[r,t.finished]);return s.jsxs(w,{style:m,color:h.color,children:[h.icon," ",h.name]})};W.displayName="PaymentTag";const Ae=d.memo(W),Ee=({openPackageDrawer:r,handleDestroyPackage:t,refetch:m,openClientDrawer:h,openGenerateDocumentModal:a})=>{const i=x(p=>p.current_user.permissions),c=x(p=>p.is_webook),u=x(p=>{var n;return(n=p.current_user.salon.enotas_token)==null?void 0:n.token}),g=x(p=>p.current_user.addons.has_nfs)&&!!u,b=x(p=>p.current_user.addons.has_nfe)&&!!u,k=x(p=>p.current_user.addons.has_nfce)&&!!u,_=ye("Inventory::Package");return d.useMemo(()=>{let p=[{title:e("words.ticket"),key:"code",dataIndex:"code",align:"center",className:"table-sort",sorter:!0,default_visible:!0,always_visible:!0,width:80,render:(n,l)=>s.jsxs(N,{style:{maxWidth:"100%"},title:n,className:"link",onClick:()=>{if(!l.deleted_at){if(!i.can_edit_package){y.warning(e("phrases.no_permission_to_do_this"));return}r(l.id)}},children:["#",n]})},{title:e("words.date"),key:"date",dataIndex:"date",sorter:!0,defaultSortOrder:"descend",default_visible:!0,width:110,render:n=>A(n).format("L")},{title:e("words.validity"),key:"expiration_date",dataIndex:"expiration_date",sorter:!0,defaultSortOrder:"descend",default_visible:!0,width:110,render:n=>n?A(n).format("L"):""},{title:e("words.client"),key:"client",dataIndex:"client",include_key_on_query:!0,default_visible:!0,render:n=>s.jsx(N,{style:{maxWidth:"100%"},title:n==null?void 0:n.name,onClick:()=>h(n==null?void 0:n.id),children:n==null?void 0:n.name})},{title:e("words.status"),key:"finished",dataIndex:"finished",default_visible:!0,width:90,render:n=>n?s.jsx(w,{color:"#777777",children:e("words.finished")}):s.jsx(w,{color:"orange",children:e("words.pending")})},{title:e("words.availability"),key:"available",dataIndex:"available",default_visible:!0,width:130,render:(n,l)=>l.finished?n?s.jsx(w,{color:"green",children:e("words.active")}):s.jsx(w,{color:"red",children:e("words.expired")}):s.jsx(w,{color:"orange",children:e("words.pending")})},{title:e("words.value"),key:"sum_cents",dataIndex:"sum_cents",default_visible:!0,width:120,align:"right",render:n=>Y(n)},{title:e("words.payment"),key:"bill_recs",dataIndex:"bill_recs",include_key_on_query:!0,default_visible:!1,width:110,render:(n,l)=>s.jsx(Ae,{style:{margin:0},bill_recs:n,inventory_package:l})},{title:e("words.observation"),key:"comment",dataIndex:"comment",default_visible:!1,ellipsis:!0}];return c||p.push({title:e("words.invoice"),key:"invoices",dataIndex:"invoices",default_visible:!0,ellipsis:!0,align:"center",width:100,render:(n,l)=>{if(!l)return null;const T=l.package_items.some(I=>I.product.service),S=l.package_items.some(I=>!I.product.service);return s.jsxs(s.Fragment,{children:[s.jsx(me,{has_service:T,can_issue:g,sale_finished:l.finished,invoice:l.invoice,sale_id:l.id,type:"Inventory::Package",refetch:m}),s.jsx("span",{style:{paddingLeft:10},children:s.jsx(be,{has_product:S,can_issue:b,sale_finished:l.finished,electronic_invoice:l.electronic_invoice,type:"Inventory::Package",sale_id:l.id,refetch:m})}),s.jsx("span",{style:{paddingLeft:10},children:s.jsx(ke,{has_product:S,can_issue:k,sale_finished:l.finished,electronic_consumer_invoice:l.electronic_consumer_invoice,sale_id:l.id,type:"Inventory::Package",refetch:m})})]})}}),p.push({default_visible:!0,key:"actions",width:70,align:"center",render:(n,l)=>l.deleted_at?null:s.jsx(_e,{width:54,children:s.jsx(B,{destroyPackage:t,inventory_package:l,openPackageDrawer:r,document_templates:_,openGenerateDocumentModal:a})})}),p},[t,_,k,b,g,c,h,r,i.can_edit_package,m,a])},Me=[{value:"finished",label:s.jsx(w,{color:"#777777",children:e("words.finished")})},{value:"pending",label:s.jsx(w,{color:"orange",children:e("words.pending")})}],Le=[{value:"5",label:s.jsx(w,{style:{margin:"2px 0"},color:"#777777",children:e("words.blocked")})},{value:"4",label:s.jsx(w,{style:{margin:"2px 0"},color:"blue",children:e("words.available")})},{value:"0",label:s.jsx(w,{style:{margin:"2px 0"},color:"orange",children:e("words.open")})},{value:"2",label:s.jsx(w,{style:{margin:"2px 0"},color:"red",children:e("words.late")})},{value:"3",label:s.jsx(w,{style:{margin:"2px 0"},color:"green",children:e("words.paid")})}],Ne=()=>d.useMemo(()=>[{label:e("words.status"),name:"deleted",default_value:"false",double_checkbox:{true:e("words.deleted",{count:2}),false:e("words.not_deleted",{count:2})}},{label:e("words.period"),name:"dates",rangepicker:{start_date_name:"start_date",end_date_name:"end_date"}},{label:e("words.payment_status"),name:"status",radio_options:Me,checkbox_disabled:!0},{label:e("words.payment"),help:e("package.filters.payment_help"),name:"payment_status",checkbox_options:Le,checkbox_disabled:!0}],[]),K=({inventory_package:r})=>{var g,b,k,_,v,p;const t=x(n=>{var l;return(l=n.current_user.salon.enotas_token)==null?void 0:l.token}),m=x(n=>n.current_user.addons.has_nfs)&&!!t,h=x(n=>n.current_user.addons.has_nfe)&&!!t,a=x(n=>n.current_user.addons.has_nfce)&&!!t,i=r.finished,c=r.package_items.some(n=>n.product.service),u=r.package_items.some(n=>!n.product.service);return t?s.jsxs(ne,{style:{paddingTop:5},children:[m&&s.jsx(L,{label:e("acronyms.ESI"),id:(g=r.invoice)==null?void 0:g.id,status:(b=r.invoice)==null?void 0:b.status,disabled:!c||!i}),h&&s.jsx(L,{label:e("acronyms.EI"),id:(k=r.electronic_invoice)==null?void 0:k.id,status:(_=r.electronic_invoice)==null?void 0:_.status,disabled:!u||!i}),a&&s.jsx(L,{label:e("acronyms.ECI"),id:(v=r.electronic_consumer_invoice)==null?void 0:v.id,status:(p=r.electronic_consumer_invoice)==null?void 0:p.status,disabled:!u||!i})]}):null};K.displayName="InvoicesMobile";const Q=r=>{var m;const{item:t}=r;return s.jsxs(j,{$column:!0,children:[s.jsxs(j,{justify:"space-between",children:[s.jsxs(C,{width:22,$block:!0,$textEllipsis:!0,$isFlex:!0,children:[s.jsxs(P,{$color:"primary",$bold:!0,children:["#",t==null?void 0:t.code]})," ",(m=t==null?void 0:t.client)==null?void 0:m.name]}),s.jsx(C,{width:6,$align:"right",$block:!0,$semibold:!0,style:{whiteSpace:"nowrap"},children:Y(t==null?void 0:t.sum_cents)})]}),s.jsxs(j,{$top:5,justify:"space-between",children:[s.jsxs(C,{width:8,$block:!0,$color:"gray_1",$size:12,$isFlex:!0,$textEllipsis:!0,children:[e("words.date"),": ",A(t==null?void 0:t.date).format("L")]}),H(t)]}),s.jsxs(j,{$top:5,justify:"space-between",children:[t!=null&&t.expiration_date?s.jsxs(C,{width:8,$block:!0,$color:"gray_1",$size:12,$isFlex:!0,$textEllipsis:!0,children:[e("words.expires_in"),": ",A(t==null?void 0:t.expiration_date).format("L")]}):s.jsx(C,{width:8,$block:!0,$color:"gray_1",$size:12,$isFlex:!0,$textEllipsis:!0,children:e("words.not_expire")}),X(t)]}),t&&s.jsx(j,{children:s.jsx(K,{inventory_package:t})})]})};Q.displayName="PackageItemMobile";const Fe=d.memo(Q),D=q(w).withConfig({componentId:"wb__sc-1pb78m-0"})(["margin-right:0 !important;width:75px;text-align:center;"]),H=r=>r?r.finished?s.jsx(D,{color:"#777777",children:e("words.finished")}):s.jsx(D,{color:"orange",children:e("words.pending")}):s.jsx(z,{width:"8ch"});H.displayName="getStatus";const X=r=>r?r.finished?r.available?s.jsx(D,{color:"green",children:e("words.active")}):s.jsx(D,{color:"red",children:e("words.expired")}):s.jsx(D,{color:"orange",children:e("words.pending")}):s.jsx(z,{width:"8ch"});X.displayName="getAvailability";const Oe=E`
  mutation DestroyPackage($data: DestroyPackageInput!) {
    destroyPackage(input: $data) {
      success errors
    }
  }
`,qe=()=>{const[r,{loading:t}]=G(Oe);return[d.useCallback(async h=>{const a=y.loading(`${e("verbs.wait")}...`,0);try{const{data:i}=await r({variables:{data:{id:h}}}),{success:c=!1,errors:u=[]}=(i==null?void 0:i.destroyPackage)||{};return u==null||u.map(g=>y.error(g)),{success:c}}catch(i){return y.error(e("phrases.generic_save_error_message")),console.error(i),{success:!1}}finally{a()}},[r]),t]},O={true:!0,false:!1,all:null,none:null},hs=()=>{const r=d.useRef(null),t=d.useRef(null),m=d.useRef(null),h=d.useRef(null),a=x(o=>o.current_user.permissions),i=x(o=>o.current_user.features.has_packages),[c]=qe(),[u]=Re(),g=d.useCallback(async o=>{const{success:f,failures:$=[]}=await u({ids:o});!f&&$.length===0||Ie({ids:o,failures:$,magicTableRef:r})},[u]),b=d.useCallback(async o=>{var $;const{success:f}=await c(o);f&&(y.success(e("phrases.deleted_successfully",{prefix:e("words.package")})),($=r.current)==null||$.refetch())},[c]),k=d.useCallback(o=>!o.deleted_at,[]),_=d.useCallback(()=>{var o;(o=r.current)==null||o.refetch()},[]),v=xe(a.can_destroy_package,Ce,g),p=d.useCallback(o=>{var f;if(!a.can_edit_client){y.warning(e("phrases.no_permission_to_do_this"));return}(f=m.current)==null||f.open({id:o})},[a.can_edit_client]),n=d.useCallback(o=>{var f;(f=t.current)==null||f.open(o)},[]),l=d.useCallback(o=>{var f;(f=h.current)==null||f.open(o)},[]),T=d.useMemo(()=>({openPackageDrawer:n,handleDestroyPackage:b,refetch:_,openClientDrawer:p,openGenerateDocumentModal:l}),[_,b,p,l,n]),S=Ee(T),I=Ne(),J=d.useMemo(()=>[{label:e("verbs.delete"),icon:s.jsx(U,{}),danger:!0,onClick:v,disabled:!a.can_destroy_package}],[v,a.can_destroy_package]),V=d.useCallback(o=>{o!=null&&o.deleted_at||n(o==null?void 0:o.id)},[n]),Z=d.useCallback(o=>{const f={},$={},te=o.status==="pending";return Object.entries(o).forEach(([R,M])=>{R==="payment_status"&&te?$[R]=[]:$[R]=M,M in O&&(f[R]=O[M])}),{...$,...f}},[]),ee=d.useCallback(o=>{var f;return((f=o==null?void 0:o.inventory_packages)==null?void 0:f.total_count)||0},[]),se=d.useCallback(o=>{var f;return(f=o==null?void 0:o.inventory_packages)==null?void 0:f.all},[]);return he({feature_keys:["has_packages"]}),s.jsxs(s.Fragment,{children:[s.jsx(we,{ref:r,title:e("words.package",{count:2}),permissions_key:"package",search_placeholder:e("package.search_placeholder"),filters:I,columns:S,has_feature:i,mass_actions:J,query:De,select_all_query:Te,getData:se,getTotalCount:ee,openDrawer:V,MobileItem:Fe,validateRow:k,parseFilters:Z}),s.jsx(pe,{ref:t,afterSave:_}),s.jsx(fe,{ref:m,onSave:_}),s.jsx(ge,{ref:h})]})};export{hs as default};
//# sourceMappingURL=Packages-CjOikPG9.js.map
