const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/DefaultHeader.desktop-CM_oLKMd.js","assets/index-Bd9916Am.js","assets/index-d41Ui0WO.css","assets/WebookContent-BCPw5BqQ.js","assets/useWebpushSubscription-DZpB0TTw.js","assets/useMutation-BrMwTcyD.js","assets/openLink-DL3a6Hh-.js","assets/useVariants-CcaHcr-K.js","assets/Overflow-BeweU6Wq.js","assets/PhoneInput-Uk4Fy4k3.js","assets/PhoneInput-Bbgo5x5y.css","assets/index-N5o1yZfs.js","assets/ClientDrawer-55jCGlAN.js","assets/AnimatedModal-B0Wu-A-O.js","assets/index-pPH-OUeJ.js","assets/index-UewmsNya.js","assets/index-VnBECc_f.js","assets/ClientDrawer-CmlxdM94.css","assets/GoogleOutlined-CNbpRv7S.js","assets/InstagramOutlined-DPUwDZLb.js","assets/InDevelopment-DNEk_Jig.js","assets/FilterOutlined-Qp4wXgRp.js","assets/DefaultHeader.mobile-WMc2Hqhf.js"])))=>i.map(i=>d[i]);
import{g as T,d as k,r as a,t,j as e,b as D,s as O,R as I,c as V,e as P,U as b,m as y,c8 as G,F as M,G as F,k as U}from"./index-Bd9916Am.js";import{a as B}from"./VendorItem.mobile-Cjr6Qwv4.js";import{T as x,h as v,c$ as R,b as Q,af as W,au as X,x as Y,z as E,D as J,aC as K,cf as C,bh as Z,X as ee,cP as te,d0 as se,aj as re,b_ as oe}from"./ClientDrawer-55jCGlAN.js";import{G as ne}from"./GenerateDocumentDrawer-Dt2MQWqi.js";import{M as ae}from"./MagicTable-D-daxyPD.js";import{V as le}from"./VendorInput-DFyrK_pJ.js";import{F as ie,T as de,a as ce}from"./index-N5o1yZfs.js";import{a as L}from"./PhoneInput-Uk4Fy4k3.js";import{u as ue}from"./useGetDocumentTemplates-ByJhJmEV.js";import{D as S}from"./index-UewmsNya.js";import{R as me}from"./PrinterOutlined-U8EP-aoz.js";import{R as _e}from"./LockOutlined-CSlPnRor.js";import{b as fe}from"./openLink-DL3a6Hh-.js";import{H as pe}from"./WebookContent-BCPw5BqQ.js";import{R as he}from"./FileExcelOutlined-KTkDII2n.js";import"./useMutation-BrMwTcyD.js";import"./Register.desktop-CHPmotQM.js";import"./index-VnBECc_f.js";import"./index-pPH-OUeJ.js";import"./useVariants-CcaHcr-K.js";import"./Overflow-BeweU6Wq.js";import"./InstagramOutlined-DPUwDZLb.js";import"./AnimatedModal-B0Wu-A-O.js";import"./ColumnsSettings-DQaC_giH.js";import"./FilterMenu.desktop-CK5te_0K.js";import"./useWebpushSubscription-DZpB0TTw.js";import"./GoogleOutlined-CNbpRv7S.js";import"./InDevelopment-DNEk_Jig.js";const be=T`
  query PurchasesList(
    $deleted: Boolean,
    $status: String,
    $page: Int,
    $results: Int,
    $start_date: String,
    $end_date: String,
    $vendor_id: ID,
    $search_query: String,
    $sort_field: String,
    $sort_order: String,
  ) {
    all_inventory_purchases (
      deleted: $deleted,
      page: $page,
      results: $results,
      status: $status,
      start_date: $start_date,
      end_date: $end_date,
      vendor_id: $vendor_id,
      search_term: $search_query,
      sort_field: $sort_field,
      sort_order: $sort_order
    ) {
      all {
        id
        code
        comment
        date
        deleted_at
        finished
        number
        sum_cents
        vendor { id name }

        finance_bill_pays {
          id
          status
          bill_type
          payment {
            id name
          }
        }
      }
      total_count
    }
  }
`;T`
  query PurchasesIdsList($deleted: Boolean) {
    all_inventory_purchases(deleted: $deleted) {
      all {
        id deleted_at
      }
    },
  }
`;const ye=()=>{const i=k(s=>s.is_mobile);return a.useMemo(()=>[{label:t("words.status"),name:"deleted",default_value:"false",double_checkbox:{true:t("words.deleted",{count:2,context:"female"}),false:t("words.not_deleted",{count:2,context:"female"})}},{label:t("words.period"),name:"date",rangepicker:{start_date_name:"start_date",end_date_name:"end_date"}},{label:t("words.payment_status"),name:"status",default_value:void 0,radio_options:xe},{label:t("words.vendor"),name:"vendor_id",default_value:void 0,render:s=>{const{setFieldsValue:n}=s;return e.jsx(ie.Item,{name:"vendor_id",noStyle:!0,children:e.jsx(le,{style:{width:"100%"},getPopupContainer:()=>document.body,size:i?"large":"middle",allowClear:!0,suffixIcon:i?e.jsx(D,{$size:16,as:O,$color:"primary"}):void 0,variant:"borderless",onChange:d=>{n({vendor_id:d})}})})}}],[i])},xe=[{value:"finished",label:e.jsx(x,{color:"#777777",children:t("words.finished")})},{value:"pending",label:e.jsx(x,{color:"orange",children:t("words.pending")})}],we=i=>{var d,u,f;const{item:s}=i,n=((u=(d=s==null?void 0:s.finance_bill_pays)==null?void 0:d.filter(m=>m.payment))==null?void 0:u.map(m=>m.payment.name).join(", "))||"";return e.jsxs(e.Fragment,{children:[e.jsxs(I,{$column:!0,style:{overflow:"hidden",flexGrow:1},children:[e.jsxs(v,{$block:!0,$textEllipsis:!0,$isFlex:!0,width:22,children:[e.jsxs(V,{$color:"primary",$bold:!0,$right:3,children:["#",s==null?void 0:s.code]}),(f=s==null?void 0:s.vendor)==null?void 0:f.name]}),e.jsxs(v,{width:22,$block:!0,$color:"gray_1",$size:12,$top:5,$right:5,$isFlex:!0,$textEllipsis:!0,children:[P(s==null?void 0:s.date).format("L"),n?` - ${n}`:""]})]}),e.jsx("div",{children:e.jsxs(I,{$column:!0,align:"bottom",$left:10,$isFlex:!1,children:[e.jsx(v,{width:6,$align:"right",$block:!0,$semibold:!0,style:{whiteSpace:"nowrap"},children:L(s==null?void 0:s.sum_cents)}),e.jsx("div",{style:{paddingTop:5,marginRight:-3},children:s?s.finished?e.jsx(R,{$backgroundColor:"#777777",$color:"white",children:t("words.finished")}):e.jsx(R,{$color:"#fdb730",$backgroundColor:"#fff4e1",children:t("words.pending")}):e.jsx(Q,{width:"8ch"})})]})})]})},ge=a.memo(we),$e=({openPurchaseDrawer:i,handleDestroyPurchases:s,openVendorDrawer:n,openGenerateDocumentModal:d})=>{const u=k(p=>p.current_user.permissions),f=G(),m=ue("Inventory::Purchase"),h=a.useCallback(p=>m.length===0?[{key:"empty-document",label:t("document_templates.no_generators_found"),disabled:!0}]:m.map(r=>({key:r.id,label:`${t("verbs.generate")} ${r.name}`,icon:e.jsx(W,{}),onClick:()=>d({document_template_id:r.id,inventory_purchase_id:p})})),[m,d]);return a.useMemo(()=>[{title:t("words.ticket"),default_visible:!0,always_visible:!0,align:"center",defaultSortOrder:"descend",key:"code",dataIndex:"code",width:80,className:"table-sort",sorter:!0,render:(r,l)=>{const _=!!l.deleted_at;return e.jsxs(b,{disabled:_,onClick:()=>{if(!u.can_edit_purchase){y.warning(t("phrases.no_permission_to_do_this"));return}i(l)},children:["#",r]})}},{title:t("words.date"),default_visible:!0,always_visible:!0,key:"date",dataIndex:"date",sorter:!0,width:100,render:r=>P(r).format("L")},{title:t("words.vendor"),default_visible:!0,key:"vendor",dataIndex:"vendor",align:"left",render:(r,l)=>{if(!r)return null;const _=!!l.deleted_at;return e.jsx(b,{title:r.title,style:{width:"100%",textAlign:"start"},disabled:_,onClick:()=>{if(!u.can_edit_vendor){y.warning(t("phrases.no_permission_to_do_this"));return}n(r.id)},children:r.name})}},{title:t("words.status"),default_visible:!0,dataIndex:"finished",key:"finished",width:90,render:r=>r?e.jsx(x,{color:f.colors.gray_1,children:t("words.finished")}):e.jsx(x,{color:"#fdb730",children:t("words.pending")})},{title:t("words.value"),default_visible:!0,always_visible:!0,dataIndex:"sum_cents",key:"sum_cents",width:100,align:"right",render:r=>L(r)},{title:t("words.payment"),default_visible:!0,dataIndex:"finance_bill_pays",key:"finance_bill_pays",width:100,render:(r,l)=>e.jsx(N,{purchase:l})},{title:t("words.payment_type"),key:"payment_method",default_visible:!0,include_key_on_query:!1,ellipsis:!0,render:(r,l)=>{var _;return Array.from(new Set((_=l.finance_bill_pays)==null?void 0:_.map($=>{var w;return(w=$.payment)==null?void 0:w.name}))).join(", ")}},{title:t("purchases.note_number"),default_visible:!1,key:"number",dataIndex:"number",ellipsis:!0,width:100,render:r=>e.jsx("span",{title:r,children:r})},{title:t("words.observation"),default_visible:!1,ellipsis:!0,align:"left",dataIndex:"comment",key:"comment",render:r=>e.jsx("span",{title:r,children:r})},{default_visible:!0,key:"actions",align:"center",width:100,render:(r,l)=>l.deleted_at?null:e.jsxs(X,{width:84,children:[e.jsx(de,{title:l.finished?t("verbs.view"):t("verbs.edit"),children:e.jsx(b,{className:"no-decoration",onClick:()=>{if(!(u!=null&&u.can_edit_purchase)){y.warning(t("phrases.no_permission_to_do_this"));return}i(l)},children:l.finished?e.jsx(ce,{}):e.jsx(Y,{})})}),e.jsx(S,{type:"vertical"}),e.jsx(b,{className:"link color-red",onClick:()=>s(l.id),children:e.jsx(E,{})}),e.jsx(S,{type:"vertical"}),e.jsx(J,{menu:{items:h(l.id)},trigger:["click"],overlayStyle:{width:190},children:e.jsx(b,{className:"link",children:e.jsx(me,{})})})]})}],[s,i,n,u.can_edit_purchase,u.can_edit_vendor,f.colors.gray_1,h])},N=({purchase:i})=>{if(!i||!i.finished)return null;const{finance_bill_pays:s=[]}=i;let n={color:"green",name:t("words.paid"),icon:fe};return s.some(d=>d.status==="2")?n={color:"red",name:t("words.late"),icon:K}:s.some(d=>d.status==="0")||!i.finished?n={color:"orange",name:t("words.open")}:s.some(d=>d.status==="4")?n={color:"blue",name:t("words.available")}:s.some(d=>d.status==="5")&&(n={color:"#777777",name:t("words.blocked"),icon:_e}),e.jsxs(x,{color:n.color,children:[n.icon&&e.jsx(D,{$hex:n.color,as:n.icon,$right:2}),n.name]})};N.displayName="PaymentTag";const ve=a.lazy(()=>M(()=>F(()=>import("./DefaultHeader.desktop-CM_oLKMd.js"),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21])))),ke=a.lazy(()=>M(()=>F(()=>import("./DefaultHeader.mobile-WMc2Hqhf.js"),__vite__mapDeps([22,1,2])))),q=()=>{const i=C(n=>n.onSearch),s=C(n=>n.title);return e.jsx(pe,{title:s,onSearch:i,tabs:[{label:t("words.purchase",{count:2}),path:"/purchases",icon:Z},{label:t("purchases.imported_xmls"),path:"/purchases/imported-electronic-invoices",icon:he}],children:e.jsx(ee,{Desktop:ve,Mobile:ke})})};q.displayName="Header";const Ze=()=>{const i=k(o=>o.current_user.permissions),s=a.useRef(null),n=a.useRef(null),d=a.useRef(null),u=a.useRef(null);te({feature_keys:["has_purchases"]});const[f]=se(),m=ye(),h=a.useCallback(o=>{var c;(c=n.current)==null||c.open({id:o==null?void 0:o.id})},[]),g=a.useCallback(o=>{var c;(c=s.current)==null||c.open({id:o})},[]),p=a.useCallback(()=>{var o;(o=d.current)==null||o.refetch()},[]),r=a.useCallback(async o=>{const{success:c}=await f({id:o});c&&(y.success(t("phrases.deleted_successfully",{prefix:t("words.purchase"),context:"female"})),p())},[p,f]),l=a.useCallback(o=>{if(!i.can_destroy_purchase){y.warning(t("phrases.no_permission_to_do_this"));return}U.confirm({centered:!0,className:"webook-modal",title:t("words.attention"),maskClosable:!0,content:t("phrases.confirm_delete",{model:t("words.purchase").toLocaleLowerCase(),context:"female"}),okText:t("phrases.yes_delete"),okType:"danger",cancelText:t("verbs.cancel"),onOk:()=>r(o)})},[r,i.can_destroy_purchase]),_=a.useCallback(o=>!o.deleted_at,[]),$=a.useCallback(o=>{var c;return(c=o==null?void 0:o.all_inventory_purchases)==null?void 0:c.all},[]),w=a.useCallback(o=>{var c;return((c=o==null?void 0:o.all_inventory_purchases)==null?void 0:c.total_count)||0},[]),A=a.useCallback(o=>({content:e.jsx(re,{icon:E,label:t("verbs.delete"),direction:"left",color:"red"}),action:()=>l(o.id)}),[l]),j=a.useCallback(o=>{var c;(c=u.current)==null||c.open(o)},[]),H=a.useMemo(()=>({openPurchaseDrawer:h,handleDestroyPurchases:l,openVendorDrawer:g,openGenerateDocumentModal:j}),[l,j,h,g]),z=$e(H);return e.jsxs(e.Fragment,{children:[e.jsx(ae,{ref:d,title:t("words.purchase",{count:2}),Header:q,permissions_key:"purchase",validateRow:_,search_placeholder:t("purchases.search_placeholder"),filters:m,columns:z,query:be,item_selectable:!1,getData:$,getTotalCount:w,MobileItem:ge,openDrawer:h,mobileSwipeLeft:A}),e.jsx(B,{ref:s}),e.jsx(oe,{ref:n,afterSave:p}),e.jsx(ne,{ref:u})]})};export{Ze as default};
//# sourceMappingURL=Purchases-DqTrH7sx.js.map
