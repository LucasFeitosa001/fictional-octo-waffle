import{m as b,t as e,j as t,c as v,R as $,y as A,g as D,d as I,r as c,c8 as M,k as Q,U as j}from"./index-Bd9916Am.js";import{A as H}from"./AnimatedModal-B0Wu-A-O.js";import{D as R}from"./index-UewmsNya.js";import{u as W,a as Y,M as K}from"./useDestroyInventoryProduct-D_xIs2Nr.js";import{h as k,G as S,A as z,x as T,au as G,z as F,b$ as X}from"./ClientDrawer-55jCGlAN.js";import{H as J,F as V}from"./Header-D--BctCl.js";import{u as Z}from"./useUpdateProducts-B1meeDzT.js";import{u as ee}from"./useConfirmDestroy-Ced6r-tG.js";import{M as te}from"./MagicTable-D-daxyPD.js";import{a as C,p as se}from"./PhoneInput-Uk4Fy4k3.js";import{T as re}from"./index-N5o1yZfs.js";import{R as oe}from"./StarTwoTone-Df4QLVx_.js";import"./openLink-DL3a6Hh-.js";import"./useVariants-CcaHcr-K.js";import"./Overflow-BeweU6Wq.js";import"./useMutation-BrMwTcyD.js";import"./index-pPH-OUeJ.js";import"./index-VnBECc_f.js";import"./DefaultHeader.desktop-CM_oLKMd.js";import"./WebookContent-BCPw5BqQ.js";import"./useWebpushSubscription-DZpB0TTw.js";import"./GoogleOutlined-CNbpRv7S.js";import"./InstagramOutlined-DPUwDZLb.js";import"./InDevelopment-DNEk_Jig.js";import"./FilterOutlined-Qp4wXgRp.js";import"./DefaultHeader.mobile-WMc2Hqhf.js";import"./ColumnsSettings-DQaC_giH.js";import"./FilterMenu.desktop-CK5te_0K.js";const ie=({ids:s,failures:r=[],magicTableRef:u})=>{var y;const m=r.length===s.length,i=r.length===0,p=r.filter(a=>a.deactivated),_=s.length-p.length;if(i){b.success(`${s.length} ${e("phrases.deleted_successfully",{prefix:e("words.product",{count:s.length}).toLocaleLowerCase(),count:s.length})}`),(y=u.current)==null||y.afterDestroyRecord(s.length);return}H.information({closable:!0,className:"webook-modal hide-buttons",maskClosable:!0,onCancel:()=>{var a;m||(a=u.current)==null||a.afterDestroyRecord(r.length)},title:e("phrases.mass_delete_completed"),content:t.jsxs("div",{style:{maxHeight:400,width:"100%",maxWidth:480,overflowX:"hidden",overflowY:"auto"},children:[!m&&t.jsxs(v,{$size:16,$alignCenter:!0,$color:"green_2",children:[_," ",e("phrases.deleted_successfully",{prefix:e("words.product",{count:_}).toLocaleLowerCase(),count:_})]}),r.length>0&&t.jsxs($,{$column:!0,$paddings:[0,10],children:[t.jsx(R,{dashed:!0}),t.jsxs(v,{$size:16,$alignCenter:!0,$paddings:{bottom:10},children:[r.length," ",e("phrases.cant_be_deleted",{prefix:e("words.product",{count:r.length}).toLocaleLowerCase(),count:r.length})]}),r.map(({inventory_product:a,errors:l=[],deactivated:d=!1})=>t.jsxs(ae,{children:[t.jsx($,{$column:!0,style:{overflow:"hidden"},children:t.jsx(v,{$size:16,$textEllipsis:!0,$block:!0,children:a.description})}),t.jsx($,{$column:!0,style:{overflow:"hidden"},$mTop:10,children:l.map(g=>t.jsx(v,{$color:d?"gray_1":"red",children:g},`${g}_${a.id}`))})]},`item_${a.id}`))]})]})})},ne=s=>e("phrases.confirm_delete",{model:e("words.product",{count:s.length}).toLocaleLowerCase(),count:s.length}),ae=A.div.withConfig({componentId:"wb__sc-1xtwk3m-0"})(["display:flex;width:100%;flex-direction:column;align-items:center;background-color:#fbfbfb;border-radius:12px;box-shadow:0 2px 9px rgba(83,83,83,0.06);overflow:hidden;margin-bottom:15px;padding:10px;border:1px solid transparent;user-select:none;transition:transform .2s;"]),le=D`
  fragment ProductListCommonAttributes on Product {
    id
    active
    description
    image_blurhash
    image_url: small_thumb_url
    favorite
    price_cents
    cost_cents
    employee_price_cents
    quantity
    unit_quantity
    observation
    und
  }
`,ce=D`
  fragment ProductListDesktopAttributes on Product {
    commission
    group_name
    brand_name
    stock_minimum
    code
    bar_code
  }
`,de=D`
  query ProductsList (
    $page: Int,
    $results: Int,
    $search_query: String,
    $sort_field: String,
    $sort_order: String,
    $actives: Boolean,
    $favorites: Boolean,
    $group_ids: [ID],
    $brand_ids: [ID],
    $is_mobile: Boolean!,
  ) {
    all_inventory_products (
      page: $page,
      results: $results,
      search_term: $search_query,
      sort_field: $sort_field,
      sort_order: $sort_order,
      actives: $actives,
      favorites: $favorites,
      group_ids: $group_ids,
      brand_ids: $brand_ids,
      service: false,
      use_replica: true
    ) {
      all {
        ...ProductListCommonAttributes

        ...ProductListDesktopAttributes @skip(if: $is_mobile)
      }
      total_count
    }
  }

  ${le}
  ${ce}
`,ue=D`
  query ProductsIdsList ($actives: Boolean, $favorites: Boolean) {
    all_inventory_products (actives: $actives, favorites: $favorites, service: false, use_replica: true) {
      all {
        id active
      }
    },
  }
`,_e=()=>{const s=I(i=>i.inventory_groups),r=I(i=>i.inventory_brands),u=s.filter(i=>i.active&&!i.deleted_at),m=r.filter(i=>i.active);return c.useMemo(()=>{const i=u.map(_=>({value:_.id,label:_.name})),p=m.map(_=>({value:_.id,label:_.name}));return[{label:e("words.status"),name:"actives",default_value:"true",double_checkbox:{true:e("words.active",{count:2}),false:e("words.inactive",{count:2})}},{label:e("words.favorite",{count:2}),name:"favorites",default_value:null,double_checkbox:{true:e("phrases.with_star"),false:e("phrases.no_star")}},{label:e("words.category",{count:2}),name:"group_ids",checkbox_options:i},{label:e("words.brand",{count:2}),name:"brand_ids",checkbox_options:p}]},[m,u])},me=s=>{const{item:r}=s,u=M();return t.jsxs(t.Fragment,{children:[t.jsx("div",{children:t.jsx(pe,{src:r==null?void 0:r.image_url,blurhash:r==null?void 0:r.image_blurhash})}),t.jsxs("div",{style:{width:"100%",overflow:"hidden"},children:[t.jsxs($,{justify:"space-between",children:[t.jsx(k,{lines:2,width:10,$block:!0,children:r==null?void 0:r.description}),t.jsx(k,{width:8,$block:!0,$color:"gray_1",$size:14,children:t.jsx(S,{size:22,style:{color:r!=null&&r.favorite?u.colors.gold:"lightgray"}})})]}),t.jsxs($,{justify:"space-between",$top:5,children:[t.jsx(k,{width:6,$block:!0,$color:"gray_1",$size:12,children:C(r==null?void 0:r.price_cents)}),t.jsx(N,{product:r})]})]})]})},he=c.memo(me),pe=A(z).attrs({type:"image"}).withConfig({componentId:"wb__sc-14i0srr-0"})(["width:40px !important;height:40px !important;border-radius:12px !important;margin-right:10px !important;border:1px solid #eee;"]),N=({product:s})=>{var m;const r=s==null?void 0:s.unit_quantity;if(r){const i=parseFloat((s.quantity/r).toFixed(1)),p=i>(s.stock_minimum||0)?"success":"red";return t.jsx(k,{width:12,$block:!0,$color:p,$size:12,children:e("phrases.number_of_units",{count:i,unit:e("words.unit").toLocaleLowerCase()})})}const u=s?(s==null?void 0:s.quantity)>((s==null?void 0:s.stock_minimum)||0)?"success":"red":"gray_1";return t.jsx(k,{width:12,$block:!0,$color:u,$size:12,children:e("phrases.number_of_units",{count:(s==null?void 0:s.quantity)||0,unit:(m=s==null?void 0:s.und)==null?void 0:m.toLocaleLowerCase()})})};N.displayName="Quantity";const fe=({openProductDrawer:s,handleDestroyProduct:r,openFlowsDrawer:u,handleFavorite:m})=>{const i=M(),p=I(a=>a.current_user.permissions),_=c.useCallback(a=>{if(!p.can_destroy_product){b.warning(e("phrases.no_permission_to_do_this"));return}Q.confirm({centered:!0,className:"webook-modal",title:e("words.attention"),maskClosable:!0,content:e("phrases.confirm_delete",{model:e("words.product").toLocaleLowerCase()}),okText:e("phrases.yes_delete"),okType:"danger",cancelText:e("verbs.cancel"),onOk:()=>r(a)})},[r,p.can_destroy_product]);return c.useMemo(()=>[{title:e("words.name"),default_visible:!0,always_visible:!0,key:"description",dataIndex:"description",defaultSortOrder:"ascend",className:"table-sort",sorter:!0,width:"50%",render:(l,d)=>t.jsxs(j,{title:l,style:{width:"100%",textAlign:"start"},className:"link text-overflow-ellipsis",onClick:()=>s(d),children:[t.jsx(z,{type:"image",shape:"square",src:d.image_url,size:"small",blurhash:d.image_blurhash})," ",l]})},{title:e("words.brand"),default_visible:!0,key:"brand_name",dataIndex:"brand_name",ellipsis:!0,width:"25%",render:l=>l||null},{title:e("words.category"),default_visible:!0,key:"group_name",dataIndex:"group_name",ellipsis:!0,width:"25%"},{title:e("products.drawer.register.item_code"),default_visible:!1,align:"right",key:"code",dataIndex:"code",width:140,sorter:!0},{title:e("products.drawer.register.bar_code"),default_visible:!1,align:"right",key:"bar_code",dataIndex:"bar_code",width:150,sorter:!0},{title:e("words.stock"),default_visible:!0,key:"quantity",dataIndex:"quantity",width:140,ellipsis:!0,render:(l,d)=>{const g=d.unit_quantity,w=parseFloat((l/g).toFixed(1)),P=w>(d.stock_minimum||0)?"success":"red";return t.jsxs(v,{$color:P,title:e("phrases.number_of_units",{count:w,unit:e("words.unit").toLocaleLowerCase()}),$semibold:!0,onClick:()=>u(d.id),$cursor:"pointer",children:[e("phrases.number_of_units",{count:w,unit:e("words.unit").toLocaleLowerCase()})," ",t.jsx(T,{})]})},sorter:!0},{title:e("words.sale_price"),default_visible:!0,key:"price_cents",dataIndex:"price_cents",align:"right",width:140,render:l=>C(l),sorter:!0},{title:e("employee_fee_config.cost_price"),default_visible:!1,key:"cost_cents",dataIndex:"cost_cents",align:"right",width:120,render:l=>C(l),sorter:!0},{title:e("employee_fee_config.employee_price"),default_visible:!1,key:"employee_price_cents",dataIndex:"employee_price_cents",align:"right",width:120,render:l=>C(l),sorter:!0},{title:e("words.commission"),default_visible:!0,align:"right",key:"commission",dataIndex:"commission",width:100,render:l=>se(l),sorter:!0},{title:e("words.observation_other"),default_visible:!1,key:"observation",dataIndex:"observation",width:160,ellipsis:!0},{default_visible:!0,key:"actions",align:"center",width:130,render:(l,d)=>t.jsxs(G,{width:114,children:[t.jsx(j,{className:"link",onClick:()=>m([d.id]),children:t.jsx(S,{size:16,style:{color:d.favorite?i.colors.gold:"lightgray"}})}),t.jsx(R,{type:"vertical"}),t.jsx(re,{title:e("verbs.edit"),placement:"bottom",children:t.jsx(j,{className:"link",onClick:()=>s(d),children:t.jsx(T,{})})}),t.jsx(R,{type:"vertical"}),t.jsx(j,{className:"link color-red",onClick:()=>_(d.id),children:t.jsx(F,{})})]})}],[_,m,u,s,i.colors.gold])},He=()=>{const s=c.useRef(null),r=c.useRef(null),u=c.useRef(null),m=c.useRef(null),{permissions:i}=I(o=>o.current_user),[p]=W(),[_]=Y(),[y]=Z(),a=c.useCallback(()=>{var o;(o=s.current)==null||o.refetch()},[]),l=c.useCallback(async o=>{if(!i.can_destroy_product){b.warning(e("phrases.no_permission_to_do_this"));return}const{success:n,deactivated:h,errors:f}=await p({id:o});if(n){b.success(e("phrases.deleted_successfully",{prefix:e("words.product")})),a();return}if(h){f==null||f.map(x=>b.info(x)),a();return}f==null||f.map(x=>b.error(x))},[p,i.can_destroy_product,a]),d=c.useCallback(async o=>{const{success:n,failures:h=[]}=await _({ids:o});!n&&h.length===0||ie({ids:o,failures:h,magicTableRef:s})},[_]),g=c.useCallback(o=>{var n;(n=r.current)==null||n.open({id:o==null?void 0:o.id})},[]),w=c.useCallback(o=>{if(!i.can_edit_product){b.warning(e("phrases.no_permission_to_do_this"));return}g(o)},[g,i.can_edit_product]),P=c.useCallback(o=>{var n;(n=m.current)==null||n.open(o)},[]),q=ee(i.can_destroy_product,ne,d),L=c.useCallback(async o=>{if(!i.can_edit_product){b.warning(e("phrases.no_permission_to_do_this"));return}const{success:n,errors:h}=await y({product_ids:o,field:"favorite"});if(!n)return;const f=o.length-h.length,x=e("phrases.update_successfully",{prefix:e("words.product",{count:f}),count:f});b.success(x),a()},[i.can_edit_product,a,y]),B=fe({openProductDrawer:w,handleDestroyProduct:l,openFlowsDrawer:P,handleFavorite:L}),U=_e(),E=c.useCallback(o=>o,[]),O=c.useMemo(()=>[{label:e("verbs.delete"),icon:t.jsx(F,{}),danger:!0,onClick:(o=[])=>{const n=o.map(h=>h.id||h);q(n)}},{label:e("words.favorite"),icon:t.jsx(oe,{twoToneColor:"#f9b60c"}),title:e("phrases.reverse_favorite"),onClick:o=>{const n=o.map(h=>h.id);L(n)}},{label:e("verbs.edit"),icon:t.jsx(T,{className:"link"}),onClick:o=>{var h;if(!i.can_edit_product){b.warning(e("phrases.no_permission_to_do_this"));return}const n=o.map(f=>f.id);(h=u.current)==null||h.open(n)}}],[L,q,i.can_edit_product]);return t.jsxs(t.Fragment,{children:[t.jsx(te,{ref:s,Header:J,title:e("words.product_other"),permissions_key:"product",rowSelectorKey:E,search_placeholder:e("products.search_placeholder"),filters:U,mass_actions:O,columns:B,query:de,item_selectable:!1,select_all_query:ue,getData:o=>{var n;return(n=o==null?void 0:o.all_inventory_products)==null?void 0:n.all},getTotalCount:o=>{var n;return((n=o==null?void 0:o.all_inventory_products)==null?void 0:n.total_count)||0},MobileItem:he,openDrawer:g}),t.jsx(X,{ref:r,afterSave:a}),t.jsx(K,{ref:u,is_service:!1,afterSave:a}),t.jsx(V,{ref:m})]})};export{He as default};
//# sourceMappingURL=Products-DXfLZCvV.js.map
