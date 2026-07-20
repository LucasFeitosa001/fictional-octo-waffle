import{m as x,t,j as e,c as m,R as b,y as j,g as v,r as u,as as M,e as w,b as E,C,d as T,k as F,U as g}from"./index-Bd9916Am.js";import{A as O}from"./AnimatedModal-B0Wu-A-O.js";import{D as $}from"./index-UewmsNya.js";import{m as H,h as f,E as U,aU as N,T as Y,p as Q,au as W,x as K,z as B,cO as P}from"./ClientDrawer-55jCGlAN.js";import{H as X,F as G}from"./Header-D--BctCl.js";import{u as J}from"./useConfirmDestroy-Ced6r-tG.js";import{M as V}from"./MagicTable-D-daxyPD.js";import{u as D}from"./useMutation-BrMwTcyD.js";import{T as Z}from"./index-N5o1yZfs.js";import"./PhoneInput-Uk4Fy4k3.js";import"./index-pPH-OUeJ.js";import"./useVariants-CcaHcr-K.js";import"./Overflow-BeweU6Wq.js";import"./openLink-DL3a6Hh-.js";import"./index-VnBECc_f.js";import"./DefaultHeader.desktop-CM_oLKMd.js";import"./WebookContent-BCPw5BqQ.js";import"./useWebpushSubscription-DZpB0TTw.js";import"./GoogleOutlined-CNbpRv7S.js";import"./InstagramOutlined-DPUwDZLb.js";import"./InDevelopment-DNEk_Jig.js";import"./FilterOutlined-Qp4wXgRp.js";import"./DefaultHeader.mobile-WMc2Hqhf.js";import"./ColumnsSettings-DQaC_giH.js";import"./FilterMenu.desktop-CK5te_0K.js";const ee=({ids:o,failures:r,afterSave:p})=>{const _=r.length===o.length,c=r.length===0,a=o.length-r.length;if(c){x.success(`${a} ${t("phrases.deleted_successfully",{prefix:t("words.batch",{count:a}).toLocaleLowerCase(),count:a})}`),p();return}O.information({closable:!0,className:"webook-modal hide-buttons",maskClosable:!0,onCancel:()=>p(),title:t("phrases.mass_delete_completed"),content:e.jsxs("div",{style:{maxHeight:400,width:"100%",maxWidth:480,overflowX:"hidden",overflowY:"auto"},children:[!_&&e.jsxs(m,{$size:16,$alignCenter:!0,$color:"green_2",children:[a," ",t("phrases.deleted_successfully",{prefix:t("words.batch",{count:a}).toLocaleLowerCase(),count:a})]}),r.length>0&&e.jsxs(b,{$column:!0,$paddings:[0,10],children:[e.jsx($,{dashed:!0}),e.jsx(m,{$size:16,$alignCenter:!0,$paddings:{bottom:10},children:t("phrases.failure_destroy_message",{model:t("words.batch",{count:r.length}).toLocaleLowerCase(),count:r.length})}),r.map(({id:i,code:s,errors:l=[]})=>e.jsxs(re,{children:[e.jsx(b,{$column:!0,style:{overflow:"hidden"},children:e.jsxs(m,{$size:16,$textEllipsis:!0,$block:!0,children:[t("words.item"),": ",s]})}),e.jsx(b,{$column:!0,style:{overflow:"hidden"},$mTop:10,children:l.map(y=>e.jsx(m,{style:{color:"#FF7875"},children:y},`${y}_${i}`))})]},`batch_item_${i}`))]})]})})},te=o=>t("phrases.confirm_delete",{model:t("words.batch",{count:o.length}).toLocaleLowerCase(),count:o.length}),re=j.div.withConfig({componentId:"wb__sc-1w2eutp-0"})(["display:flex;width:100%;flex-direction:column;align-items:center;background-color:#fbfbfb;border-radius:12px;box-shadow:0 2px 9px rgba(83,83,83,0.06);overflow:hidden;margin-bottom:15px;padding:10px;border:1px solid transparent;user-select:none;transition:transform .2s;"]),se=v`
  query BatchesIdsList ($actives: Boolean) {
    all_inventory_batches (actives: $actives) {
      all {
        id active
      }
    }
  }
`,oe=v`
  query BatchesList (
    $page: Int,
    $results: Int,
    $search_query: String,
    $sort_field: String,
    $sort_order: String,
    $actives: Boolean,
  ) {
    all_inventory_batches (
      page: $page,
      results: $results,
      search_term: $search_query,
      sort_field: $sort_field,
      sort_order: $sort_order,
      actives: $actives,
    ) {
      all {
        id
        product_id
        product_name
        batch_number
        expiration_date
        manufacturing_date
        quantity
        quantity_normalized
        expired
        active
        days_until_expiration
        created_at
        updated_at
      }
      total_count
    }
  }
`,ne=v`
  mutation DestroyAllInventoryBatches($data: InventoryBatchDestroyAllInput!) {
    inventoryBatchDestroyAll(input: $data) {
      success
      failures { id code errors }
      errors
    }
  }
`,ae=()=>{const[o]=D(ne);return[async p=>{const _=x.loading(`${t("verbs.wait")}...`,0);try{const{data:c}=await o({variables:{data:p}}),{success:a=!1,failures:i=[],errors:s=[]}=(c==null?void 0:c.inventoryBatchDestroyAll)||{};return s==null||s.map(l=>x.error(l)),{success:a,failures:i||[]}}catch(c){return x.error(t("phrases.generic_save_error_message")),console.error(c),{success:!1,failures:[]}}finally{_()}}]},ie=()=>u.useMemo(()=>[{label:t("words.status"),name:"actives",default_value:"true",double_checkbox:{true:t("words.active_other"),false:t("words.inactive_other")}}],[]),le=o=>o.expired?C.red:o.days_until_expiration<=30?C.orange:C.success,ce=o=>o.expired?"red":o.days_until_expiration<=30?"orange":"green",de=o=>{const{item:r}=o;return e.jsx(e.Fragment,{children:e.jsx(H.Provider,{value:!r,children:e.jsxs(b,{$column:!0,children:[e.jsx(f,{lines:1,width:14,$block:!0,$semibold:!0,children:r==null?void 0:r.product_name}),e.jsx(f,{width:10,$block:!0,$size:13,$color:"gray_1",$mTop:4,children:e.jsxs(M,{children:[e.jsx(U,{style:{fontSize:12}}),e.jsx(m,{$size:13,$color:"gray_1",children:r==null?void 0:r.batch_number})]})}),e.jsx($,{style:{margin:"10px 0"}}),e.jsxs(me,{children:[e.jsxs(I,{children:[e.jsx(m,{$color:"gray_2",$size:11,children:t("batches.drawer.manufacturing_date")}),e.jsx(f,{width:8,children:e.jsx(m,{$bold:!0,$size:13,children:r!=null&&r.manufacturing_date?w(r.manufacturing_date).format("L"):"—"})})]}),e.jsx(_e,{children:e.jsx(E,{as:N,$size:12,$color:"gray_1"})}),e.jsxs(I,{children:[e.jsx(m,{$color:"gray_2",$size:11,children:t("batches.drawer.expiration_date")}),e.jsx(f,{width:8,children:e.jsx(m,{$bold:!0,$size:13,$hex:r?le(r):void 0,children:r!=null&&r.expiration_date?w(r.expiration_date).format("L"):"—"})})]})]}),e.jsx($,{style:{margin:"10px 0"}}),e.jsxs(b,{justify:"space-between",$alignCenter:!0,children:[e.jsx(f,{width:10,$block:!0,children:!!r&&e.jsx(Y,{color:ce(r),icon:e.jsx(Q,{}),style:{borderRadius:6},children:r.expired?t("batches.expired_label"):`${r.days_until_expiration} ${t("words.day",{count:r.days_until_expiration}).toLowerCase()}`})}),e.jsx(f,{width:8,$block:!0,children:!!r&&e.jsxs(m,{$bold:!0,$size:13,children:[parseFloat(r.quantity_normalized.toFixed(1))," ",t("words.unit").toLowerCase()]})})]})]})})})},ue=u.memo(de),me=j.div.withConfig({componentId:"wb__sc-1w24xqa-0"})(["display:flex;align-items:center;justify-content:space-between;padding:10px;background-color:#fafafa;border-radius:12px;gap:10px;"]),I=j.div.withConfig({componentId:"wb__sc-1w24xqa-1"})(["display:flex;flex-direction:column;align-items:center;flex:1;gap:4px;"]),_e=j.div.withConfig({componentId:"wb__sc-1w24xqa-2"})(["display:flex;align-items:center;justify-content:center;"]),pe=v`
  mutation DestroyBatch($data: DestroyInventoryBatchInput!) {
    destroyInventoryBatch(input: $data) {
      success
      errors
    }
  }
`,he=()=>{const[o,{loading:r}]=D(pe);return[async _=>{const c=x.loading(`${t("verbs.wait")}...`,0);try{const{data:a}=await o({variables:{data:_}}),{success:i=!1,errors:s=[]}=(a==null?void 0:a.destroyInventoryBatch)||{};return{success:i,errors:s||[]}}catch(a){return x.error(t("phrases.generic_save_error_message")),console.error(a),{success:!1}}finally{c()}},r]},xe=({openBatchDrawer:o,handleDestroyBatch:r,openFlowsDrawer:p})=>{const _=T(i=>i.current_user.permissions),c=u.useCallback(i=>{if(!_.can_destroy_product){x.warning(t("phrases.no_permission_to_do_this"));return}F.confirm({centered:!0,className:"webook-modal",title:t("words.attention"),maskClosable:!0,content:t("phrases.confirm_delete",{model:t("words.batch").toLocaleLowerCase()}),okText:t("phrases.yes_delete"),okType:"danger",cancelText:t("verbs.cancel"),onOk:()=>r(i)})},[r,_.can_destroy_product]);return u.useMemo(()=>[{title:t("words.item"),default_visible:!0,always_visible:!0,key:"product_name",dataIndex:"product_name",render:(s,l)=>e.jsx(g,{style:{width:"100%",textAlign:"start"},className:"link",title:s,onClick:()=>o(l),children:s})},{title:t("words.batch"),default_visible:!0,always_visible:!0,key:"batch_number",dataIndex:"batch_number",render:(s,l)=>e.jsx(g,{title:s,onClick:()=>o(l),children:s})},{title:t("batches.drawer.manufacturing_date"),default_visible:!0,key:"manufacturing_date",dataIndex:"manufacturing_date",width:110,sorter:!0,render:s=>s?e.jsx(m,{children:w(s).format("L")}):null},{title:t("batches.drawer.expiration_date"),default_visible:!0,key:"expiration_date",dataIndex:"expiration_date",width:110,sorter:!0,render:s=>s?e.jsx(m,{children:w(s).format("L")}):null},{title:t("words.due"),default_visible:!0,key:"days_until_expiration",dataIndex:"days_until_expiration",width:160,render:(s,l)=>e.jsx(m,{children:l.expired?t("batches.expired_label"):`${s} ${t("words.day",{count:s}).toLowerCase()}`})},{title:t("words.quantity"),default_visible:!0,key:"quantity",dataIndex:"quantity",width:140,sorter:!0,render:(s,l)=>e.jsx(g,{onClick:()=>p(l.product_id,l.id),children:parseFloat(l.quantity_normalized.toFixed(1))})},{default_visible:!0,key:"actions",align:"center",width:100,render:(s,l)=>e.jsxs(W,{width:84,children:[e.jsx(Z,{title:t("verbs.edit"),placement:"bottom",children:e.jsx(g,{onClick:()=>o(l),children:e.jsx(K,{})})}),e.jsx($,{type:"vertical"}),e.jsx(g,{className:"color-red",onClick:()=>c(l.id),children:e.jsx(B,{})})]})}],[c,o,p])},Ue=()=>{const o=u.useRef(null),r=u.useRef(null),p=u.useRef(null),_=T(n=>n.current_user.permissions),[c]=he(),[a]=ae(),i=u.useCallback(()=>{var n;(n=o.current)==null||n.refetch()},[]),s=u.useCallback(async n=>{const{success:d,errors:h}=await c({id:n});if(d){x.success(t("phrases.deleted_successfully",{prefix:t("words.batch")})),i();return}h==null||h.map(z=>x.error(z))},[c,i]),l=u.useCallback(async n=>{const{success:d,failures:h=[]}=await a({ids:n});!d&&h.length===0||ee({ids:n,failures:h,afterSave:i})},[a,i]),y=u.useCallback(n=>{var d;(d=r.current)==null||d.open({id:n==null?void 0:n.id})},[]),R=u.useCallback((n,d)=>{var h;(h=p.current)==null||h.open(n,d)},[]),k=J(_.can_destroy_product,te,l),L=xe({handleDestroyBatch:s,openBatchDrawer:y,openFlowsDrawer:R}),q=ie(),A=u.useMemo(()=>[{label:t("verbs.delete"),icon:e.jsx(B,{}),danger:!0,onClick:k,disabled:!_.can_destroy_product}],[k,_.can_destroy_product]),S=u.useCallback(n=>n.id,[]);return e.jsxs(e.Fragment,{children:[e.jsx(V,{ref:o,Header:X,rowSelectorKey:S,title:t("phrases.batches_and_expiration"),permissions_key:"product",search_placeholder:t("batches.search_placeholder"),filters:q,columns:L,mass_actions:A,select_all_query:se,query:oe,getData:n=>{var d;return(d=n==null?void 0:n.all_inventory_batches)==null?void 0:d.all},getTotalCount:n=>{var d;return((d=n==null?void 0:n.all_inventory_batches)==null?void 0:d.total_count)||0},MobileItem:ue,openDrawer:y}),e.jsx(P,{ref:r,afterSave:i}),e.jsx(G,{ref:p,onSave:i})]})};export{Ue as default};
//# sourceMappingURL=Batches-BGm64Myw.js.map
