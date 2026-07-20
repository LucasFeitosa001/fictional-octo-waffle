import{m as u,t as e,j as t,c as y,R as $,y as k,g as w,d as v,r as m,k as q,e as z,U as j,c8 as O,a5 as U}from"./index-Bd9916Am.js";import{A as F}from"./AnimatedModal-B0Wu-A-O.js";import{D as S}from"./index-UewmsNya.js";import{T as D,au as P,x as Y,z as L,A as W,n as G,G as H,ao as Q,o as K}from"./ClientDrawer-55jCGlAN.js";import{u as V}from"./useConfirmDestroy-Ced6r-tG.js";import{C as X}from"./ContactListDrawer-aJEWxSCo.js";import{E as I}from"./openLink-DL3a6Hh-.js";import{u as A}from"./useMutation-BrMwTcyD.js";import{M as J}from"./MagicTable-D-daxyPD.js";import{a as C,P as Z}from"./PhoneInput-Uk4Fy4k3.js";import{T,F as ee}from"./index-N5o1yZfs.js";import{T as te}from"./TagsInput--G22F2nk.js";import"./index-pPH-OUeJ.js";import"./useVariants-CcaHcr-K.js";import"./Overflow-BeweU6Wq.js";import"./index-VnBECc_f.js";import"./ColumnsSettings-DQaC_giH.js";import"./FilterMenu.desktop-CK5te_0K.js";import"./WebookContent-BCPw5BqQ.js";import"./useWebpushSubscription-DZpB0TTw.js";import"./GoogleOutlined-CNbpRv7S.js";import"./InstagramOutlined-DPUwDZLb.js";import"./InDevelopment-DNEk_Jig.js";const se=({ids:a,failures:o=[],magicTableRef:c})=>{var n;const d=o.length===0,_=o.filter(l=>l.deactivated),i=a.length-_.length,s=o.length===a.length;if(d){u.success(`${a.length} ${e("phrases.deleted_successfully",{prefix:e("words.client",{count:a.length}).toLocaleLowerCase(),count:a.length})}`),(n=c.current)==null||n.afterDestroyRecord(a.length);return}F.information({closable:!0,className:"webook-modal hide-buttons",maskClosable:!0,onCancel:()=>{var l;s||(l=c.current)==null||l.afterDestroyRecord(o.length)},title:e("phrases.mass_delete_completed"),content:t.jsxs("div",{style:{maxHeight:400,width:"100%",maxWidth:480,overflowX:"hidden",overflowY:"auto"},children:[!s&&t.jsxs(y,{$size:16,$alignCenter:!0,$color:"green_2",children:[i," ",e("phrases.deleted_successfully",{prefix:e("words.client",{count:i}).toLocaleLowerCase(),count:i})]}),o.length>0&&t.jsxs($,{$column:!0,$paddings:[0,10],children:[t.jsx(S,{dashed:!0}),t.jsx(y,{$size:16,$alignCenter:!0,$paddings:{bottom:10},children:e("phrases.cant_be_deleted",{prefix:`${o.length} ${e("words.client",{count:o.length}).toLocaleLowerCase()}`,count:o.length})}),o.map(({client:l,errors:p=[],deactivated:b=!1})=>t.jsxs(ae,{children:[t.jsx($,{$column:!0,style:{overflow:"hidden"},children:t.jsx(y,{$size:16,$textEllipsis:!0,$block:!0,children:l.name})}),t.jsx($,{$column:!0,style:{overflow:"hidden"},$mTop:10,children:p.map(f=>t.jsx(y,{$color:b?"gray_1":"red",children:f},`${f}_${l.id}`))})]},`item_${l.id}`))]})]})})},re=a=>e("phrases.confirm_delete",{model:e("words.client",{count:a.length}).toLocaleLowerCase(),count:a.length}),ae=k.div.withConfig({componentId:"wb__sc-m0oklf-0"})(["display:flex;width:100%;flex-direction:column;align-items:center;background-color:#fbfbfb;border-radius:12px;box-shadow:0 2px 9px rgba(83,83,83,0.06);overflow:hidden;margin-bottom:15px;padding:10px;border:1px solid transparent;user-select:none;transition:transform .2s;"]),ne=w`
  fragment ClientListCommonAttributes on Client {
    id
    name
    active
    avatar_url: small_thumb_url
    avatar_blurhash
    phone2
  }
`,ie=w`
  fragment ClientListDesktopAttributes on Client {
    name_initials
    email
    phone
    obs
    birthday
    balance_cents
    has_avatar
    cpf
    rg
    cashback_balance_cents

    customer_tag_list @include(if: $customer_tag_list)

    late_payments_sum @include(if: $late_payments_sum)

    not_consumed_packages_count @include(if: $not_consumed_packages_count)

    reviews(only_last: true) @include(if: $reviews) {
      id rating description
    }

    city @include(if: $city)
  }
`,oe=w`
  query ClientsList(
    $page: Int,
    $results: Int,
    $actives: Boolean,
    $search_query: String,
    $sort_field: String,
    $sort_order: String,
    $with_cellphone: Boolean,
    $with_debit: Boolean,
    $birthday_start_date: String,
    $birthday_end_date: String,
    $hashtags: [String],
    $last_rating: Int,

    $customer_tag_list: Boolean!,
    $late_payments_sum: Boolean!,
    $not_consumed_packages_count: Boolean!,
    $reviews: Boolean!,
    $city: Boolean!,
    $is_mobile: Boolean!,
  ) {
    all_clients(
      page: $page,
      results: $results,
      search_with_tag: $search_query,
      actives: $actives,
      sort_field: $sort_field,
      sort_order: $sort_order,
      with_cellphone: $with_cellphone,
      with_debit: $with_debit,
      last_rating: $last_rating,
      birthday_start_date: $birthday_start_date,
      birthday_end_date: $birthday_end_date,
      hashtags: $hashtags,
      use_replica: true
    ) {
      all {
        ...ClientListCommonAttributes

        ...ClientListDesktopAttributes @skip(if: $is_mobile)
      }
      total_count
    }
  }

  ${ne}
  ${ie}
`,le=w`
  query ClientsIdsList(
    $actives: Boolean,
    $search_query: String,
    $with_cellphone: Boolean,
    $with_debit: Boolean,
    $birthday_start_date: String,
    $birthday_end_date: String,
    $hashtags: [String],
    $last_rating: Int,
  ) {
    all_clients(
      search_query: $search_query,
      actives: $actives,
      with_cellphone: $with_cellphone,
      with_debit: $with_debit,
      last_rating: $last_rating,
      birthday_start_date: $birthday_start_date,
      birthday_end_date: $birthday_end_date,
      hashtags: $hashtags,
      use_replica: true
    ) {
      all {
        id active
      }
    },
  }
`,E=({handleImportContacts:a})=>t.jsx(I,{image:I.PRESENTED_IMAGE_SIMPLE,description:t.jsxs($,{$column:!0,$alignCenter:!0,$justifyCenter:!0,$paddings:[0,15],children:[t.jsx(y,{$size:16,$bold:!0,children:e("clients.import.import_contacts_prompt")}),t.jsx(y,{$alignCenter:!0,children:e("clients.import.allow_access_to_phone_book")}),t.jsx("div",{style:{marginBottom:10}}),t.jsx(y,{$size:16,$link:!0,$block:!0,$alignCenter:!0,onClick:a,children:e("clients.import.import_now")})]})});E.displayName="EmptyComponentMobile";const ce=w`
  mutation DestroyAllClients($data: DestroyAllClientsInput!) {
    destroyAllClients(input: $data) {
      success
      failures {
        client { id name }
        errors
        deactivated
      }
      errors
    }
  }
`,de=()=>{const[a]=A(ce);return[async c=>{const d=u.loading(`${e("verbs.wait")}...`,0);try{const{data:_}=await a({variables:{data:c}}),{success:i=!1,failures:s=[],errors:n=[]}=(_==null?void 0:_.destroyAllClients)||{};return n==null||n.map(l=>u.error(l)),{success:i,failures:s||[]}}catch(_){return u.error(e("phrases.generic_save_error_message")),console.error(_),{success:!1,failures:[]}}finally{d()}}]},_e=w`
  mutation DestroyClient($data: DestroyClientInput!) {
    destroyClient(input: $data) {
      success
      deactivated
      errors
    }
  }
`,ue=()=>{const[a,{loading:o}]=A(_e);return[async d=>{const _=u.loading(`${e("verbs.wait")}...`,0);try{const{data:i}=await a({variables:{data:d}});let{success:s=!1,errors:n=[],deactivated:l=!1}=(i==null?void 0:i.destroyClient)||{};return{success:s,deactivated:l,errors:n}}catch(i){return u.error(e("phrases.generic_save_error_message")),console.error(i),{success:!1}}finally{_()}},o]},he=({openClientDrawer:a,handleDestroyClient:o})=>{const c=O(),d=v(i=>i.current_user.permissions),_=m.useCallback(i=>{if(!d.can_destroy_client){u.warning(e("phrases.no_permission_to_do_this"));return}q.confirm({centered:!0,className:"webook-modal",title:e("words.attention"),maskClosable:!0,content:e("phrases.confirm_delete",{model:e("words.client").toLocaleLowerCase()}),okText:e("phrases.yes_delete"),okType:"danger",cancelText:e("verbs.cancel"),onOk:()=>o(i)})},[o,d.can_destroy_client]);return m.useMemo(()=>{const i=[{title:e("words.name"),default_visible:!0,always_visible:!0,key:"name",dataIndex:"name",defaultSortOrder:"ascend",className:"table-sort",sorter:!0,render:(s,n)=>{const l=()=>{var p;return n.has_avatar?t.jsx(W,{size:"small",src:n.avatar_url,blurhash:n.avatar_blurhash}):t.jsx(G,{style:{backgroundColor:c.color_primary},size:"small",children:(p=n.name_initials)==null?void 0:p.toUpperCase()})};return t.jsxs("div",{style:{display:"flex",flexDirection:"row",flexWrap:"nowrap",width:"100%",textAlign:"start",alignItems:"center"},onClick:()=>{if(!d.can_edit_client){u.warning(e("phrases.no_permission_to_do_this"));return}a(n)},title:s,children:[t.jsx(y,{$link:!0,children:l()}),t.jsx(y,{style:{lineHeight:1.1},$mLeft:5,$link:!0,children:s})]})}},{title:e("words.email"),default_visible:!0,key:"email",dataIndex:"email",ellipsis:!0},{title:e("words.birth"),default_visible:!0,key:"birthday",dataIndex:"birthday",width:100,render:s=>s?z(s).format("L"):""},{title:e("words.credit_other"),default_visible:!0,key:"balance_cents",dataIndex:"balance_cents",align:"right",width:90,render:s=>t.jsx("div",{style:{color:s>0?"green":void 0,wordBreak:"keep-all",whiteSpace:"nowrap"},children:C(s)})},{title:e("words.cashback"),default_visible:!1,key:"cashback_balance_cents",align:"right",dataIndex:"cashback_balance_cents",width:100,ellipsis:!0,sorter:!0,render:s=>C(s)},{title:e("acronyms.cpf"),key:"cpf",dataIndex:"cpf",width:130},{title:e("acronyms.rg"),key:"rg",dataIndex:"rg",width:120,ellipsis:!0},{title:e("words.hashtag_other"),key:"customer_tag_list",dataIndex:"customer_tag_list",include_key_on_query:!0,ellipsis:!0,render:(s=[])=>t.jsx("div",{className:"flex",title:s.join(", "),children:s.map(n=>t.jsx(me,{children:n},n))})},{title:e("words.city"),key:"city",include_key_on_query:!0,ellipsis:!0,width:200,render:s=>s.city},{title:e("words.debit_other"),key:"late_payments_sum",dataIndex:"late_payments_sum",width:100,align:"right",include_key_on_query:!0,render:s=>t.jsx("div",{style:{color:s>0?"red":void 0,wordBreak:"keep-all",whiteSpace:"nowrap"},children:C(s,{cents:!1})})},{title:e("clients.not_consumed_package_other"),key:"not_consumed_packages_count",dataIndex:"not_consumed_packages_count",include_key_on_query:!0,width:150,render:s=>s?t.jsx(D,{color:"blue",children:`${s} ${e("words.package",{count:s})}`}):null},{title:e("clients.last_review"),key:"reviews",dataIndex:"reviews",include_key_on_query:!0,width:130,render:(s=[])=>{var l,p;const n=((l=s[0])==null?void 0:l.rating)||0;return t.jsx(T,{title:(p=s[0])==null?void 0:p.description,placement:"left",children:t.jsx("div",{children:[1,2,3,4,5].map(b=>t.jsx(pe,{style:{color:b<=n?c.colors.gold:"lightgray"}},b))})})}},{title:e("words.observation",{count:2}),default_visible:!0,key:"obs",dataIndex:"obs",ellipsis:!0},{default_visible:!0,key:"actions",align:"center",width:80,render:s=>t.jsxs(P,{width:64,children:[t.jsx(T,{title:e("verbs.edit"),placement:"bottom",children:t.jsx(j,{className:"link",onClick:()=>{if(!d.can_edit_client){u.warning(e("phrases.no_permission_to_do_this"));return}a(s)},children:t.jsx(Y,{})})}),s.active&&t.jsxs(t.Fragment,{children:[t.jsx(S,{type:"vertical"}),t.jsx(j,{className:"link color-red",onClick:()=>_(s.id),children:t.jsx(L,{})})]})]})}];if(d.can_access_client_phone){const s={title:e("words.cellphone"),default_visible:!0,key:"phone2",dataIndex:"phone2",width:170,render:n=>n?t.jsx(Z,{disabled:!0,hide_input_styles:!0,value:n},n):void 0};i.splice(2,0,s)}return i},[_,a,d.can_access_client_phone,d.can_edit_client,c.color_primary,c.colors.gold])},me=k(D).withConfig({componentId:"wb__sc-18r06iu-0"})(["padding:0 3px;margin-right:2px;"]),pe=k(H).withConfig({componentId:"wb__sc-18r06iu-1"})(["font-size:16rem;margin-right:2px;"]),ge=()=>m.useMemo(()=>[{label:e("words.status"),name:"actives",default_value:"true",double_checkbox:{true:e("words.active",{count:2}),false:e("words.inactive",{count:2})}},{label:e("clients.search_tags"),name:"hashtags",render:o=>t.jsx(ee.Item,{name:"hashtags",noStyle:!0,children:t.jsx(te,{allowClear:!0,value_key:"name",placeholder:`${e("verbs.select")} ${e("words.hashtag",{count:2})}`,variant:"borderless",getPopupContainer:()=>document.body,onChange:c=>o.setFieldsValue({hashtags:c})})})},{label:e("words.cellphone"),name:"with_cellphone",double_checkbox:{true:e("clients.with_cellphone"),false:e("clients.without_cellphone")}},{label:e("words.debit"),name:"with_debit",double_checkbox:{true:e("clients.with_debit"),false:e("clients.without_debit")}},{label:e("words.birthday"),name:"birthday",rangepicker:{start_date_name:"birthday_start_date",end_date_name:"birthday_end_date"}},{label:e("clients.last_review"),name:"last_rating",default_value:null,rating:{count:5,tooltips:[e("words.awful"),e("words.bad"),e("words.neutral"),e("words.good"),e("words.excellent")]}}],[]),Oe=()=>{const a=v(r=>r.current_user.permissions),o=v(r=>r.is_mobile),c=m.useRef(null),d=m.useRef(null),_=m.useCallback(()=>{var r;(r=c.current)==null||r.refetch()},[]),[i]=ue(),[s]=de(),n=m.useCallback(async r=>{const{success:h,failures:g=[]}=await s({ids:r});!h&&g.length===0||se({ids:r,failures:g,magicTableRef:c})},[s]),l=m.useCallback(async r=>{if(!a.can_destroy_client){u.warning(e("phrases.no_permission_to_do_this"));return}const{success:h,errors:g,deactivated:N}=await i({id:r});if(h){u.success(e("phrases.deleted_successfully",{prefix:e("words.client")})),_();return}if(N){g==null||g.map(x=>u.info(x)),_();return}g==null||g.map(x=>u.error(x))},[i,a.can_destroy_client,_]),p=V(a.can_destroy_client,re,n),b=m.useCallback(r=>{var h;(h=d.current)==null||h.open({id:r==null?void 0:r.id,initial_active_bar:r?"panel":"register"})},[]),f=he({openClientDrawer:b,handleDestroyClient:l}),M=ge(),B=m.useMemo(()=>[{label:e("verbs.delete"),icon:t.jsx(L,{}),danger:!0,onClick:p}],[p]),R=m.useCallback(()=>{if(!a.can_create_client){u.warning(e("phrases.no_permission_to_do_this"));return}U.sendMessage({type:"import_contacts"})},[a.can_create_client]);return t.jsxs(t.Fragment,{children:[t.jsx(J,{ref:c,title:e("words.client",{count:2}),permissions_key:"client",search_placeholder:e("clients.search_placeholder"),EmptyComponentMobile:()=>t.jsx(E,{handleImportContacts:R}),filters:M,columns:f,query:oe,mass_actions:B,select_all_query:le,getData:r=>{var h;return(h=r==null?void 0:r.all_clients)==null?void 0:h.all},getTotalCount:r=>{var h;return((h=r==null?void 0:r.all_clients)==null?void 0:h.total_count)||0},MobileItem:Q,openDrawer:b}),t.jsx(K,{ref:d,onSave:()=>{var r;return(r=c.current)==null?void 0:r.refetch()}}),o&&t.jsx(X,{onSave:()=>{var r;return(r=c.current)==null?void 0:r.refetch()}})]})};export{Oe as default};
//# sourceMappingURL=Clients-C-93nrfF.js.map
