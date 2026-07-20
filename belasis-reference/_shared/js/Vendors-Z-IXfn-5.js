import{g,d as w,r as i,m as _,t as e,k as j,j as t,U as $}from"./index-Bd9916Am.js";import{V,a as D}from"./VendorItem.mobile-Cjr6Qwv4.js";import{u as C}from"./useConfirmDestroy-Ced6r-tG.js";import{M as I}from"./MagicTable-D-daxyPD.js";import{au as R,x as T,z as x}from"./ClientDrawer-55jCGlAN.js";import{P as b}from"./PhoneInput-Uk4Fy4k3.js";import{T as M}from"./index-N5o1yZfs.js";import{D as L}from"./index-UewmsNya.js";import{u as S}from"./useMutation-BrMwTcyD.js";import"./openLink-DL3a6Hh-.js";import"./useVariants-CcaHcr-K.js";import"./Overflow-BeweU6Wq.js";import"./Register.desktop-CHPmotQM.js";import"./index-VnBECc_f.js";import"./index-pPH-OUeJ.js";import"./InstagramOutlined-DPUwDZLb.js";import"./ColumnsSettings-DQaC_giH.js";import"./FilterMenu.desktop-CK5te_0K.js";import"./WebookContent-BCPw5BqQ.js";import"./useWebpushSubscription-DZpB0TTw.js";import"./GoogleOutlined-CNbpRv7S.js";import"./InDevelopment-DNEk_Jig.js";import"./AnimatedModal-B0Wu-A-O.js";const E=g`
  query VendorsList (
    $search_query: String, $sort_field: String, $sort_order: String, $page: Int, $results: Int, $actives: Boolean
  ) {
    all_inventory_vendors(
      search_term: $search_query, sort_field: $sort_field, sort_order: $sort_order, page: $page, results: $results,
      actives: $actives, use_replica: true
    ) {
      all {
        id name email phone1 phone2 cnpj active
      }

      total_count
    }
  }
`,q=g`
  query VendorsIdsList ($actives: Boolean) {
    all_inventory_vendors (actives: $actives, use_replica: true) {
      all {
        id active
      }
    },
  }
`,N=({handleDestroyVendors:d,openVendorDrawer:c})=>{const n=w(u=>u.current_user.permissions),h=i.useCallback(u=>{if(!n.can_destroy_vendor){_.warning(e("phrases.no_permission_to_do_this"));return}j.confirm({centered:!0,className:"webook-modal",title:e("words.attention"),maskClosable:!0,content:e("phrases.confirm_delete",{model:e("words.vendor").toLocaleLowerCase()}),okText:e("phrases.yes_delete"),okType:"danger",cancelText:e("verbs.cancel"),onOk:()=>d([u])})},[d,n.can_destroy_vendor]);return i.useMemo(()=>[{title:e("words.name"),key:"name",dataIndex:"name",always_visible:!0,render:(r,l)=>t.jsx($,{style:{textAlign:"left"},onClick:()=>{if(!n.can_edit_vendor){_.warning(e("phrases.no_permission_to_do_this"));return}c(l.id)},children:r})},{title:e("words.email"),key:"email",dataIndex:"email",ellipsis:!0,default_visible:!0},{title:e("words.phone"),key:"phone1",dataIndex:"phone1",width:170,default_visible:!0,render:r=>r?t.jsx(b,{disabled:!0,hide_input_styles:!0,value:r},r):void 0},{title:e("words.cellphone"),key:"phone2",dataIndex:"phone2",width:170,default_visible:!0,render:r=>r?t.jsx(b,{disabled:!0,hide_input_styles:!0,value:r},r):void 0},{title:e("acronyms.cnpj"),key:"cnpj",dataIndex:"cnpj",width:160,default_visible:!0},{key:"actions",always_visible:!0,width:100,align:"center",render:(r,l)=>t.jsxs(R,{width:84,children:[t.jsx(M,{title:e("verbs.view"),placement:"bottom",children:t.jsx("button",{className:"link",onClick:()=>{if(!n.can_edit_vendor){_.warning(e("phrases.no_permission_to_do_this"));return}c(l.id)},children:t.jsx(T,{})})}),l.active&&t.jsxs(t.Fragment,{children:[t.jsx(L,{type:"vertical"}),t.jsx("button",{className:"link color-red",onClick:()=>h(l.id),children:t.jsx(x,{})})]})]})}],[h,c,n.can_edit_vendor])},O=()=>i.useMemo(()=>[{label:e("words.status"),name:"actives",default_value:"true",double_checkbox:{true:e("words.active",{count:2}),false:e("words.inactive",{count:2})}}],[]),U=g`
  mutation destroyVendor($data: Inventory_Vendor_DestroyInput!) {
    inventoryVendorDestroy(input: $data) {
      success
      errors
      has_dependencies
    }
  }
`,P=()=>{const[d,c]=i.useState(!1),[n]=S(U);return{destroyVendors:i.useCallback(async(f,u)=>{c(!0);const r=_.loading(`${e("verbs.wait")}...`,0),l=[],m=[],y=[],v=f.map(a=>new Promise((p,s)=>{n({variables:{data:{id:a}}}).then(({data:{inventoryVendorDestroy:{success:o,has_dependencies:k}}})=>{if(k)return y.push(a);if(!o)return m.push(a);l.push(a)}).catch(()=>{m.push(a)}).then(()=>{p(!0)})}));await Promise.all(v).then(()=>{_.destroy(),u(l.length);const a=l.length;if(a>0){const p=`${a} ${e("phrases.deleted_successfully",{prefix:e("words.vendor",{count:a}).toLocaleLowerCase(),count:a})}`;_.success(p)}if(y.length>0&&_.info(e("vendors.deactivated_value",{count:y.length})),m.length>0){const p=`${m.length} ${e("phrases.cant_be_deleted",{prefix:e("words.vendor",{count:m.length}).toLocaleLowerCase(),count:m.length})}`;_.error(p)}}).finally(()=>{r(),c(!1)})},[n]),is_destroying:d}},de=()=>{const d=w(s=>s.current_user.permissions),c=i.useRef(null),n=i.useRef(null),{destroyVendors:h}=P(),f=i.useCallback(s=>{var o;(o=c.current)==null||o.afterDestroyRecord(s)},[]),u=i.useCallback(s=>{var o;(o=n.current)==null||o.open({id:s})},[]),r=i.useCallback(s=>{h(s,f)},[f,h]),l=N({handleDestroyVendors:r,openVendorDrawer:u}),m=O(),y=s=>e("phrases.confirm_delete",{model:e("words.vendor",{count:s.length}).toLocaleLowerCase(),count:s.length}),v=C(d.can_destroy_vendor,y,r),a=i.useMemo(()=>[{label:e("verbs.delete"),icon:t.jsx(x,{}),danger:!0,onClick:v,disabled:!d.can_destroy_vendor}],[v,d.can_destroy_vendor]),p=i.useCallback(s=>{var o;(o=n.current)==null||o.open({id:s==null?void 0:s.id})},[]);return t.jsxs(t.Fragment,{children:[t.jsx(I,{ref:c,mass_actions:a,title:e("words.vendor",{count:2}),permissions_key:"vendor",search_placeholder:e("vendors.search_placeholder"),filters:m,columns:l,query:E,select_all_query:q,MobileItem:V,getData:s=>{var o;return(o=s==null?void 0:s.all_inventory_vendors)==null?void 0:o.all},getTotalCount:s=>{var o;return((o=s==null?void 0:s.all_inventory_vendors)==null?void 0:o.total_count)||0},openDrawer:p}),t.jsx(D,{ref:n,afterSave:()=>{var s;return(s=c.current)==null?void 0:s.refetch()}})]})};export{de as default};
//# sourceMappingURL=Vendors-Z-IXfn-5.js.map
