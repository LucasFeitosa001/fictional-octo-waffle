import{g as k,d as S,r as d,m as _,t as e,k as U,j as t,U as F,c8 as R,R as x,y as T,c as y}from"./index-Bd9916Am.js";import{u as O,a as W,M as Y}from"./useDestroyInventoryProduct-D_xIs2Nr.js";import{A as D,au as K,G as A,x as L,z as M,h as $,aR as Q}from"./ClientDrawer-55jCGlAN.js";import{M as V}from"./MagicTable-D-daxyPD.js";import{a as E,p as G,d as z}from"./PhoneInput-Uk4Fy4k3.js";import{D as C}from"./index-UewmsNya.js";import{T as H}from"./index-N5o1yZfs.js";import{u as X}from"./useConfirmDestroy-Ced6r-tG.js";import{A as J}from"./AnimatedModal-B0Wu-A-O.js";import{u as Z}from"./useUpdateProducts-B1meeDzT.js";import{R as ee}from"./StarTwoTone-Df4QLVx_.js";import"./openLink-DL3a6Hh-.js";import"./useVariants-CcaHcr-K.js";import"./Overflow-BeweU6Wq.js";import"./useMutation-BrMwTcyD.js";import"./index-pPH-OUeJ.js";import"./index-VnBECc_f.js";import"./ColumnsSettings-DQaC_giH.js";import"./FilterMenu.desktop-CK5te_0K.js";import"./WebookContent-BCPw5BqQ.js";import"./useWebpushSubscription-DZpB0TTw.js";import"./GoogleOutlined-CNbpRv7S.js";import"./InstagramOutlined-DPUwDZLb.js";import"./InDevelopment-DNEk_Jig.js";const te=k`
  fragment ServiceListCommonAttributes on Product {
    id
    image_blurhash
    image_url: small_thumb_url
    favorite
    description
    price_cents
    duration
    active
  }

`,se=k`
  fragment ServiceListDesktopAttributes on Product {
    commission
    site
    group_name
  }
`,re=k`
  query ServicesList (
    $page: Int,
    $results: Int,
    $search_query: String,
    $sort_field: String,
    $sort_order: String,
    $actives: Boolean,
    $favorites: Boolean,
    $group_ids: [ID],

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
      service: true,
      use_replica: true
    ) {
      all {
        ...ServiceListCommonAttributes

        ...ServiceListDesktopAttributes @skip(if: $is_mobile)
      }
      total_count
    }
  }

  ${te}
  ${se}
`,oe=k`
  query ServicesIdsList ($actives: Boolean, $favorites: Boolean) {
    all_inventory_products (actives: $actives, favorites: $favorites, service: true, use_replica: true) {
      all {
        id active favorite
      }
    },
  }
`,ie=({openServiceDrawer:i,handleDestroyService:s,handleFavorite:c})=>{const a=R(),h=S(l=>l.current_user.permissions),f=d.useCallback(l=>{if(!h.can_destroy_product){_.warning(e("phrases.no_permission_to_do_this"));return}U.confirm({centered:!0,className:"webook-modal",title:e("words.attention"),maskClosable:!0,content:e("phrases.confirm_delete",{model:e("words.service").toLocaleLowerCase()}),okText:e("phrases.yes_delete"),okType:"danger",cancelText:e("verbs.cancel"),onOk:()=>s(l)})},[s,h.can_destroy_product]);return d.useMemo(()=>[{title:e("words.name"),default_visible:!0,always_visible:!0,key:"description",dataIndex:"description",defaultSortOrder:"ascend",className:"table-sort",sorter:!0,ellipsis:!0,width:"80%",render:(o,u)=>t.jsxs(F,{title:o,style:{width:"100%",textAlign:"start"},className:"link text-overflow-ellipsis",onClick:()=>i(u),children:[t.jsx(D,{type:"image",size:"small",shape:"square",src:u.image_url,blurhash:u.image_blurhash})," ",o]})},{title:e("words.value"),default_visible:!0,key:"price_cents",dataIndex:"price_cents",align:"right",sorter:!0,width:100,render:o=>E(o)},{title:e("words.commission"),default_visible:!0,key:"commission",align:"right",dataIndex:"commission",sorter:!0,width:110,render:o=>G(o)},{title:e("words.duration"),default_visible:!0,key:"duraction",dataIndex:"duraction",sorter:!0,width:100,render:(o,u)=>z(u.duration,"seconds")},{title:e("words.category"),default_visible:!0,key:"group_name",dataIndex:"group_name",ellipsis:!0,width:"20%"},{title:e("services.shows_on_site"),default_visible:!0,sorter:!0,key:"site",ellipsis:!0,dataIndex:"site",width:160,align:"center",render:o=>o?e("words.yes"):e("words.no")},{default_visible:!0,key:"actions",align:"center",width:130,render:(o,u)=>t.jsxs(K,{width:114,children:[t.jsx("button",{className:"link",onClick:()=>c([u.id]),children:t.jsx(A,{size:16,style:{color:u.favorite?a.colors.gold:"lightgray"}})}),t.jsx(C,{type:"vertical"}),t.jsx(H,{title:e("verbs.view"),placement:"bottom",children:t.jsx("button",{className:"link",onClick:()=>i(u),children:t.jsx(L,{})})}),t.jsx(C,{type:"vertical"}),t.jsx("button",{className:"link color-red",onClick:()=>f(u.id),children:t.jsx(M,{})})]})}],[f,c,i,a.colors.gold])},ne=i=>{const{item:s}=i,c=R();return t.jsxs(t.Fragment,{children:[t.jsx("div",{children:t.jsx(ce,{type:"image",src:s==null?void 0:s.image_url,blurhash:s==null?void 0:s.image_blurhash})}),t.jsxs("div",{style:{width:"100%",overflow:"hidden"},children:[t.jsxs(x,{justify:"space-between",children:[t.jsx($,{width:10,$block:!0,$textEllipsis:!0,children:s==null?void 0:s.description}),t.jsx($,{width:4,$block:!0,$color:"gray_1",$size:14,children:t.jsx(A,{size:22,style:{color:s!=null&&s.favorite?c.colors.gold:"lightgray"}})})]}),t.jsxs(x,{justify:"space-between",children:[t.jsx($,{width:8,$block:!0,$color:"gray_1",$size:12,children:E(s==null?void 0:s.price_cents)}),t.jsx($,{width:6,$block:!0,$color:"gray_1",$size:12,children:z((s==null?void 0:s.duration)||0,"seconds",{descriptive:!0})})]})]})]})},ae=d.memo(ne),ce=T(D).withConfig({componentId:"wb__sc-9ixe5r-0"})(["width:40px !important;height:40px !important;border-radius:12px !important;margin-right:10px !important;border:1px solid #eee;"]),le=()=>{const s=S(c=>c.inventory_groups).filter(c=>c.active&&!c.deleted_at);return d.useMemo(()=>{const c=s.map(a=>({value:a.id,label:a.name}));return[{label:e("words.status"),name:"actives",default_value:"true",double_checkbox:{true:e("words.active",{count:2}),false:e("words.inactive",{count:2})}},{label:e("words.favorite",{count:2}),name:"favorites",default_value:null,double_checkbox:{true:e("phrases.with_star"),false:e("phrases.no_star")}},{label:e("words.category",{count:2}),name:"group_ids",checkbox_options:c}]},[s])},de=({ids:i,failures:s=[],magicTableRef:c})=>{var l;const a=s.length===i.length,h=s.length===0,f=s.filter(o=>o.deactivated),g=i.length-f.length;if(h){_.success(`${i.length} ${e("phrases.deleted_successfully",{prefix:e("words.service",{count:i.length}).toLocaleLowerCase(),count:i.length})}`),(l=c.current)==null||l.afterDestroyRecord(i.length);return}J.information({closable:!0,className:"webook-modal hide-buttons",maskClosable:!0,onCancel:()=>{var o;a||(o=c.current)==null||o.afterDestroyRecord(s.length)},title:e("phrases.mass_delete_completed"),content:t.jsxs("div",{style:{maxHeight:400,width:"100%",maxWidth:480,overflowX:"hidden",overflowY:"auto"},children:[!a&&t.jsxs(y,{$size:16,$alignCenter:!0,$color:"green_2",children:[g," ",e("phrases.deleted_successfully",{prefix:e("words.service",{count:g}).toLocaleLowerCase(),count:g})]}),s.length>0&&t.jsxs(x,{$column:!0,$paddings:[0,10],children:[t.jsx(C,{dashed:!0}),t.jsxs(y,{$size:16,$alignCenter:!0,$paddings:{bottom:10},children:[s.length," ",e("phrases.cant_be_deleted",{prefix:e("words.service",{count:s.length}).toLocaleLowerCase(),count:s.length})]}),s.map(({inventory_product:o,errors:u=[],deactivated:v=!1})=>t.jsxs(me,{children:[t.jsx(x,{$column:!0,style:{overflow:"hidden"},children:t.jsx(y,{$size:16,$textEllipsis:!0,$block:!0,children:o.description})}),t.jsx(x,{$column:!0,style:{overflow:"hidden"},$mTop:10,children:u.map(w=>t.jsx(y,{$color:v?"gray_1":"red",children:w},`${w}_${o.id}`))})]},`item_${o.id}`))]})]})})},ue=i=>e("phrases.confirm_delete",{model:e("words.service",{count:i.length}).toLocaleLowerCase(),count:i.length}),me=T.div.withConfig({componentId:"wb__sc-1psbmfo-0"})(["display:flex;width:100%;flex-direction:column;align-items:center;background-color:#fbfbfb;border-radius:12px;box-shadow:0 2px 9px rgba(83,83,83,0.06);overflow:hidden;margin-bottom:15px;padding:10px;border:1px solid transparent;user-select:none;transition:transform .2s;"]),Be=()=>{const i=d.useRef(null),s=d.useRef(null),c=d.useRef(null),a=S(r=>r.current_user.permissions),[h]=O(),[f]=W(),[g]=Z(),l=d.useCallback(()=>{var r;(r=i.current)==null||r.refetch()},[]),o=d.useCallback(async r=>{if(!a.can_destroy_product){_.warning(e("phrases.no_permission_to_do_this"));return}const{success:n,deactivated:m,errors:p}=await h({id:r});if(n){_.success(e("phrases.deleted_successfully",{prefix:e("words.service")})),l();return}if(m){p==null||p.map(b=>_.info(b)),l();return}p==null||p.map(b=>_.error(b))},[h,a.can_destroy_product,l]),u=d.useCallback(async r=>{const{success:n,failures:m=[]}=await f({ids:r});!n&&m.length===0||de({ids:r,failures:m,magicTableRef:i})},[f]),v=d.useCallback(r=>{var n;(n=s.current)==null||n.open({id:r==null?void 0:r.id})},[]),w=d.useCallback(r=>{if(!a.can_edit_product){_.warning(e("phrases.no_permission_to_do_this"));return}v(r)},[v,a.can_edit_product]),I=X(a.can_destroy_product,ue,u),j=d.useCallback(async r=>{if(!a.can_edit_product){_.warning(e("phrases.no_permission_to_do_this"));return}const{success:n,errors:m}=await g({product_ids:r,field:"favorite"});if(!n)return;const p=r.length-m.length,b=e("phrases.update_successfully",{prefix:e("words.service",{count:p}),count:p});_.success(b),l()},[a.can_edit_product,l,g]),B=ie({openServiceDrawer:w,handleDestroyService:o,handleFavorite:j}),N=le(),q=d.useCallback(r=>r,[]),P=d.useMemo(()=>[{label:e("verbs.delete"),icon:t.jsx(M,{}),danger:!0,onClick:(r=[])=>{const n=r.map(m=>m.id||m);I(n)}},{label:e("words.favorite"),icon:t.jsx(ee,{twoToneColor:"#f9b60c"}),title:e("phrases.reverse_favorite"),onClick:r=>{const n=r.map(m=>m.id);j(n)}},{label:e("verbs.edit"),icon:t.jsx(L,{className:"link"}),onClick:r=>{var m;if(!a.can_edit_product){_.warning(e("phrases.no_permission_to_do_this"));return}const n=r.map(p=>p.id);(m=c.current)==null||m.open(n)}}],[j,I,a.can_edit_product]);return t.jsxs(t.Fragment,{children:[t.jsx(V,{ref:i,mass_actions:P,rowSelectorKey:q,title:e("words.service",{count:2}),permissions_key:"product",search_placeholder:e("services.search_placeholder"),filters:N,columns:B,query:re,select_all_query:oe,MobileItem:ae,getData:r=>{var n;return(n=r==null?void 0:r.all_inventory_products)==null?void 0:n.all},getTotalCount:r=>{var n;return((n=r==null?void 0:r.all_inventory_products)==null?void 0:n.total_count)||0},openDrawer:v}),t.jsx(Q,{ref:s,afterSave:l}),t.jsx(Y,{ref:c,is_service:!0,afterSave:l})]})};export{Be as default};
//# sourceMappingURL=Services-CQXHgVEC.js.map
