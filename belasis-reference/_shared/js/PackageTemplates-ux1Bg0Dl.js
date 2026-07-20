import{m as p,t as e,j as t,c as k,R as y,y as T,g as f,r as c,d as v,k as q,cj as N}from"./index-Bd9916Am.js";import{A as F}from"./AnimatedModal-B0Wu-A-O.js";import{D as C}from"./index-UewmsNya.js";import{au as O,x as z,z as j,h as x,N as K,cP as G,bZ as Y}from"./ClientDrawer-55jCGlAN.js";import{u as P}from"./useMutation-BrMwTcyD.js";import{u as U}from"./useConfirmDestroy-Ced6r-tG.js";import{a as w}from"./PhoneInput-Uk4Fy4k3.js";import{T as W}from"./index-N5o1yZfs.js";import{M as B}from"./MagicTable-D-daxyPD.js";import"./index-pPH-OUeJ.js";import"./useVariants-CcaHcr-K.js";import"./Overflow-BeweU6Wq.js";import"./openLink-DL3a6Hh-.js";import"./index-VnBECc_f.js";import"./ColumnsSettings-DQaC_giH.js";import"./FilterMenu.desktop-CK5te_0K.js";import"./WebookContent-BCPw5BqQ.js";import"./useWebpushSubscription-DZpB0TTw.js";import"./GoogleOutlined-CNbpRv7S.js";import"./InstagramOutlined-DPUwDZLb.js";import"./InDevelopment-DNEk_Jig.js";const Q=({ids:r,failures:s,magicTableRef:o})=>{var d;const i=s.length===r.length,u=s.length===0,n=r.length-s.length;if(u){p.success(`${n} ${e("phrases.deleted_successfully",{prefix:e("words.package_template",{count:n}).toLocaleLowerCase(),count:n})}`),(d=o.current)==null||d.afterDestroyRecord(n);return}F.information({closable:!0,className:"webook-modal hide-buttons",maskClosable:!0,onCancel:()=>{var l;i||(l=o.current)==null||l.afterDestroyRecord(n)},title:e("phrases.mass_delete_completed"),content:t.jsxs("div",{style:{maxHeight:400,width:"100%",maxWidth:480,overflowX:"hidden",overflowY:"auto"},children:[!i&&t.jsxs(k,{$size:16,$alignCenter:!0,$color:"green_2",children:[n," ",e("phrases.deleted_successfully",{prefix:e("words.package_template",{count:n}).toLocaleLowerCase(),count:n})]}),s.length>0&&t.jsxs(y,{$column:!0,$paddings:[0,10],children:[t.jsx(C,{dashed:!0}),t.jsx(k,{$size:16,$alignCenter:!0,$paddings:{bottom:10},children:e("phrases.failure_destroy_message",{model:e("words.package_template",{count:s.length}).toLocaleLowerCase(),count:s.length})}),s.map(({id:l,code:_,errors:b=[]})=>t.jsxs(X,{children:[t.jsx(y,{$column:!0,style:{overflow:"hidden"},children:t.jsxs(k,{$size:16,$textEllipsis:!0,$block:!0,children:[e("words.name")," ",_]})}),t.jsx(y,{$column:!0,style:{overflow:"hidden"},$mTop:10,children:b.map(h=>t.jsx(k,{style:{color:"#FF7875"},children:h},`${h}_${l}`))})]},`package_template_item_${l}`))]})]})})},H=r=>e("phrases.confirm_delete",{model:e("words.package_template",{count:r.length}).toLocaleLowerCase(),count:r.length}),X=T.div.withConfig({componentId:"wb__sc-1a4yqx6-0"})(["display:flex;width:100%;flex-direction:column;align-items:center;background-color:#fbfbfb;border-radius:12px;box-shadow:0 2px 9px rgba(83,83,83,0.06);overflow:hidden;margin-bottom:15px;padding:10px;border:1px solid transparent;user-select:none;transition:transform .2s;"]),Z=f`
  query PacakageTemplatesList(
    $page: Int,
    $results: Int,
    $search_query: String,
    $sort_field: String,
    $sort_order: String,
    $actives: Boolean
  ) {
    all_package_templates(
      page: $page,
      results: $results,
      search_term: $search_query,
      sort_field: $sort_field,
      sort_order: $sort_order,
      actives: $actives
    ) {
      all {
        id name active total_cents

        package_template_items {
          id quantity price_cents

          product {
            id description
          }
        }
      }
      total_count
    }
  }
`,J=f`
  query PacakageTemplatesIdsList($actives: Boolean) {
    all_package_templates(actives: $actives) {
      all {
        id active
      }
    },
  }
`,V=f`
  mutation DestroyAllInventoryPackageTemplate($data: DestroyAllPackageTemplatesInput!) {
    destroyAllInventoryPackageTemplates(input: $data) {
      success
      failures { id code errors }
      errors
    }
  }
`,ee=()=>{const[r]=P(V);return[c.useCallback(async o=>{const i=p.loading(`${e("verbs.wait")}...`,0);try{const{data:u}=await r({variables:{data:o}}),{success:n=!1,failures:d=[],errors:l=[]}=(u==null?void 0:u.destroyAllInventoryPackageTemplates)||{};return l==null||l.map(_=>p.error(_)),{success:n,failures:d||[]}}catch(u){return p.error(e("phrases.generic_save_error_message")),console.error(u),{success:!1,failures:[]}}finally{i()}},[r])]},te=f`
  mutation DestroyPackageTemplate($data: DestroyPackageTemplateInput!) {
    destroyInventoryPackageTemplate(input: $data) {
      success errors
    }
  }
`,se=()=>{const[r,{loading:s}]=P(te);return[c.useCallback(async i=>{const u=p.loading(`${e("verbs.wait")}...`,0);try{const{data:n}=await r({variables:{data:{id:i}}}),{success:d=!1,errors:l=[]}=(n==null?void 0:n.destroyInventoryPackageTemplate)||{};return l==null||l.map(_=>p.error(_)),{success:d}}catch(n){return p.error(e("phrases.generic_save_error_message")),console.error(n),{success:!1}}finally{u()}},[r]),s]},ae=({openPackageTemplateDrawer:r,handleDestroyPackageTemplate:s})=>{const o=v(n=>n.current_user.permissions),i=c.useCallback(n=>{if(!(o!=null&&o.can_destroy_sale)){p.warning(e("phrases.no_permission_to_do_this"));return}q.confirm({centered:!0,className:"webook-modal",title:e("words.attention"),maskClosable:!0,content:e("phrases.confirm_delete",{model:e("words.package_template").toLocaleLowerCase()}),okText:e("phrases.yes_delete"),okType:"danger",cancelText:e("verbs.cancel"),onOk:()=>s(n)})},[s,o==null?void 0:o.can_destroy_sale]);return c.useMemo(()=>[{title:e("words.name"),default_visible:!0,always_visible:!0,key:"name",dataIndex:"name",defaultSortOrder:"ascend",className:"table-sort",sorter:!0,ellipsis:!0,render:(d,l)=>t.jsx("button",{style:{maxWidth:"100%"},title:d,className:"link text-overflow-ellipsis",onClick:()=>r(l),children:d})},{title:e("words.total"),key:"total_cents",dataIndex:"total_cents",default_visible:!0,align:"right",width:180,render:d=>w(d)},{default_visible:!0,key:"actions",align:"center",width:100,render:(d,l)=>t.jsxs(O,{width:84,children:[t.jsx(W,{title:e("verbs.edit"),placement:"bottom",children:t.jsx("button",{className:"link",onClick:()=>r(l),children:t.jsx(z,{})})}),t.jsx(C,{type:"vertical"}),t.jsx("button",{className:"link color-red",onClick:()=>i(l.id),children:t.jsx(j,{})})]})}],[i,r])},re=()=>c.useMemo(()=>[{label:e("words.status"),name:"actives",default_value:"true",double_checkbox:{true:e("words.active_other"),false:e("words.disabled_other")}}],[]),I=r=>{var i;const{item:s}=r,o=((i=s==null?void 0:s.package_template_items)==null?void 0:i.length)||1;return t.jsxs("div",{style:{width:"100%"},children:[t.jsx(x,{width:16,$block:!0,$bold:!0,children:s==null?void 0:s.name}),t.jsxs(y,{justify:"space-between",$top:2,children:[t.jsx(x,{width:6,$block:!0,$color:"gray_1",$size:12,children:e("clients.package.item",{count:o})}),t.jsx(x,{width:8,$block:!0,$color:"gray_1",$size:12,children:w(s==null?void 0:s.total_cents)})]})]})};I.displayName="PackageTemplateItemMobile";const oe=c.memo(I),A=({package_template:r})=>{const s=[{title:`${e("words.service")}/${e("words.product")}`,key:"name",ellipsis:!0,render:(o,i)=>i.product.description},{title:e("words.quantity"),key:"quantity",dataIndex:"quantity",width:100},{title:e("words.unitary_price"),key:"price_cents",dataIndex:"price_cents",align:"right",width:180,render:o=>w(o)},{key:"actions",width:100}];return t.jsx(ne,{columns:s,dataSource:r.package_template_items,rowKey:"id",pagination:!1})};A.displayName="PackageItems";const ne=T(K).withConfig({componentId:"wb__sc-7jcnq4-0"})([".ant-table-content{min-height:0 !important;height:auto !important;}.ant-table-expanded-row td{padding:12px 8px !important;}"]),Pe=()=>{const r=c.useRef(null),s=c.useRef(null),o=v(a=>a.current_user.permissions),[i]=se(),[u]=ee(),n=c.useCallback(async a=>{const{success:m,failures:g=[]}=await u({ids:a});!m&&g.length===0||Q({ids:a,failures:g,magicTableRef:r})},[u]),d=c.useCallback(async a=>{var g;const{success:m}=await i(a);m&&(p.success(e("phrases.deleted_successfully",{prefix:e("words.package_template")})),(g=r.current)==null||g.refetch())},[i]),l=U(o.can_destroy_package,H,n),_=c.useCallback(a=>{var m;(m=s.current)==null||m.open(a==null?void 0:a.id)},[]),b=c.useCallback(a=>{if(!o.can_edit_package){p.warning(e("phrases.no_permission_to_do_this"));return}_(a)},[_,o.can_edit_package]),h=ae({openPackageTemplateDrawer:b,handleDestroyPackageTemplate:d}),D=re(),$=c.useCallback(a=>t.jsx(A,{package_template:a}),[]),M=c.useMemo(()=>({expandedRowRender:$}),[$]),E=c.useMemo(()=>[{label:e("verbs.delete"),icon:t.jsx(j,{}),danger:!0,onClick:l,disabled:!o.can_destroy_package}],[l,o.can_destroy_package]);G({feature_keys:["has_packages_template"],addon_keys:["has_packages_template"],search:N.ID_PACKAGE_TEMPLATE});const R=c.useCallback(a=>{var m;return((m=a==null?void 0:a.all_package_templates)==null?void 0:m.total_count)||0},[]),L=c.useCallback(a=>{var m;return(m=a==null?void 0:a.all_package_templates)==null?void 0:m.all},[]),S=c.useCallback(a=>a.active,[]);return t.jsxs(t.Fragment,{children:[t.jsx(B,{ref:r,title:e("words.package_template_other"),permissions_key:"package",search_placeholder:e("input.search_by_name"),filters:D,columns:h,mass_actions:E,query:Z,select_all_query:J,getData:L,getTotalCount:R,expandable:M,validateRow:S,MobileItem:oe,openDrawer:_}),t.jsx(Y,{ref:s,afterSave:()=>{var a;return(a=r.current)==null?void 0:a.refetch()}})]})};export{Pe as default};
//# sourceMappingURL=PackageTemplates-ux1Bg0Dl.js.map
