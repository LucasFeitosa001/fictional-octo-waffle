import{g as T,d as D,r,e as A,t as e,i as M,j as a,U as C,m as p,k as N,cj as E}from"./index-Bd9916Am.js";import{H as F,A as L}from"./Header-Bjt_zBQP.js";import{T as j,au as q,a0 as H,cW as P,cP as z,cX as B,aj as O,z as U,W,o as V,aP as Q}from"./ClientDrawer-55jCGlAN.js";import{M as X}from"./MagicTable-D-daxyPD.js";import{A as Y}from"./ActionsColumn-D-n7tH0B.js";import{A as G}from"./AnamnesisMobileItem-BFpunm0i.js";import{F as I}from"./index-N5o1yZfs.js";import"./useMutation-BrMwTcyD.js";import"./openLink-DL3a6Hh-.js";import"./useVariants-CcaHcr-K.js";import"./Overflow-BeweU6Wq.js";import"./PhoneInput-Uk4Fy4k3.js";import"./index-UewmsNya.js";import"./index-pPH-OUeJ.js";import"./WebookContent-BCPw5BqQ.js";import"./useWebpushSubscription-DZpB0TTw.js";import"./GoogleOutlined-CNbpRv7S.js";import"./InstagramOutlined-DPUwDZLb.js";import"./InDevelopment-DNEk_Jig.js";import"./SnippetsOutlined-BLaCHr2v.js";import"./AnimatedModal-B0Wu-A-O.js";import"./index-VnBECc_f.js";import"./ColumnsSettings-DQaC_giH.js";import"./FilterMenu.desktop-CK5te_0K.js";import"./PrinterOutlined-U8EP-aoz.js";const J=T`
  query AnamnesisList(
    $page: Int,
    $results: Int,
    $client_id: ID,
    $anamnesis_template_id: ID,
    $search_query: String,
    $start_date: String,
    $end_date: String,
    $signeds: Boolean,
    $closed: Boolean
  ) {
    all_anamnesis(
      page: $page,
      results: $results,
      client_id: $client_id,
      anamnesis_template_id: $anamnesis_template_id,
      search: $search_query,
      order_by: "entry_date",
      order: "DESC",
      start_date: $start_date,
      end_date: $end_date,
      signeds: $signeds,
      closed: $closed,
    ) {
      total_count
      all {
        id
        updated_at
        status
        anamnesis_template { id name }
        client { id name }
        fields
        entry_date
        employee { id name }
        salon { id name }

        digital_signature {
          id
          created_at
        }

        electronic_signature {
          id
          status
        }
      }
    }
  }
`,K=f=>{var b,g;const{openDrawer:o,handleDestroy:d,clientDrawerRef:w,anamnesisTemplaneDrawerRef:h,employeeDrawerRef:y}=f,u=D(l=>l.current_user.salon),c=D(l=>l.current_user.permissions),m=(g=(b=u.organization)==null?void 0:b.organization_configuration)==null?void 0:g.share_clients_between_salons;return r.useMemo(()=>{const l=[{title:e("words.date"),key:"entry_date",dataIndex:"entry_date",default_visible:!0,width:100,render:n=>A(n).format("L")},{title:e("phrases.updated_at"),key:"updated_at",dataIndex:"updated_at",default_visible:!0,width:155,render:n=>A(n,M).format("L, HH:mm[h]")},{title:e("words.client"),key:"client",dataIndex:"client",always_visible:!0,ellipsis:!0,render:n=>a.jsx(C,{title:n.name,className:"link text-overflow-ellipsis",onClick:()=>{var t;if(!c.can_edit_client){p.warning(e("phrases.no_permission_to_do_this"));return}(t=w.current)==null||t.open({id:n.id,initial_active_bar:"anamnesis"})},children:n.name})},{title:e("words.anamnesi_template"),key:"anamnesis_template",dataIndex:"anamnesis_template",default_visible:!0,ellipsis:!0,render:n=>a.jsx(C,{title:n.name,className:"link text-overflow-ellipsis",onClick:()=>{var t;if(!c.can_edit_anamnesis){p.warning(e("phrases.no_permission_to_do_this"));return}(t=h.current)==null||t.open(n.id)},children:n.name})},{title:e("words.employee"),key:"employee",dataIndex:"employee",default_visible:!0,ellipsis:!0,render:n=>a.jsx(C,{title:n.name,className:"link text-overflow-ellipsis",onClick:()=>{var t;if(!c.can_edit_employee){p.warning(e("phrases.no_permission_to_do_this"));return}(t=y.current)==null||t.open({id:n.id})},children:n.name})},{title:e("words.status"),key:"status",dataIndex:"status",default_visible:!0,width:90,render:n=>{const t=n==="open";return a.jsx(j,{color:t?"green":"red",children:t?e("words.open"):e("words.closed")})}}];return m&&l.push({title:e("words.subsidiary"),key:"salon",default_visible:!0,ellipsis:!0,dataIndex:"salon",render:(n,t)=>t.salon.name}),l.push({title:`${e("digital_signature.signed")}?`,key:"digital_signature",default_visible:!0,width:90,render:(n,t)=>{var _,k;const x=!!((_=t==null?void 0:t.digital_signature)!=null&&_.id)||((k=t==null?void 0:t.electronic_signature)==null?void 0:k.status)==="finished";return a.jsx(j,{color:x?"blue":"red",children:x?e("words.yes"):e("words.no")})}}),l.push({title:e("words.action",{count:2}),key:"actions",always_visible:!0,width:70,align:"center",render:(n,t)=>a.jsx(q,{width:54,children:a.jsx(Y,{record:t,openDrawer:o,handleDestroy:d})})}),l},[h,w,y,d,o,c.can_edit_anamnesis,c.can_edit_client,c.can_edit_employee,m])},Z=()=>r.useMemo(()=>[{label:e("words.client"),name:"client_id",render:o=>a.jsx(I.Item,{name:"client_id",noStyle:!0,children:a.jsx(H,{classNames:{popup:{root:"ant-select-dropdown-small"}},onChange:d=>o.setFieldsValue({client_id:d}),show_phone:!0,style:{width:"100%"},allowClear:!0,variant:"borderless",getPopupContainer:()=>document.body})})},{label:e("words.anamnesi_template"),name:"anamnesis_template_id",render:o=>a.jsx(I.Item,{name:"anamnesis_template_id",noStyle:!0,children:a.jsx(P,{onChange:d=>o.setFieldsValue({anamnesis_template_id:d}),style:{width:"100%"},allowClear:!0,variant:"borderless",getPopupContainer:()=>document.body})})},{label:e("words.period"),name:"dates",rangepicker:{start_date_name:"start_date",end_date_name:"end_date"}},{label:e("words.status"),name:"closed",default_value:null,double_checkbox:{true:e("words.closed"),false:e("words.open")}},{label:e("digital_signature.signed_other",{context:"female"}),name:"signeds",default_value:null,double_checkbox:{true:e("words.yes"),false:e("words.no")}}],[]),ve=()=>{const f=D(s=>s.current_user.permissions),o=D(s=>s.current_user.salon),d=r.useRef(null),w=r.useRef(null),h=r.useRef(null),y=r.useRef(null),u=r.useRef(null);z({feature_keys:["has_anamnesis"],addon_keys:["has_anamnesis"],search:E.ID_ANAMNESIS});const[c]=B(),m=r.useCallback((s,i)=>{var v;(v=y.current)==null||v.open(s==null?void 0:s.id,{tab:i})},[]),b=r.useCallback(s=>{var i;(i=u.current)==null||i.afterDestroyRecord(s)},[]),g=r.useCallback(async s=>{const{success:i}=await c({id:s});i&&(p.success(e("phrases.deleted_successfully",{prefix:e("words.anamnesi"),context:"female"})),b(1))},[b,c]),l=r.useCallback(s=>{if(!(o.id===s.salon.id)){p.warning(e("anamnesis.delete_from_another_salon"));return}if(!f.can_destroy_anamnesis){p.warning(e("phrases.no_permission_to_do_this"));return}N.confirm({centered:!0,className:"webook-modal",title:e("words.attention"),maskClosable:!0,content:e("phrases.confirm_delete",{model:e("words.anamnesi").toLocaleLowerCase(),context:"female"}),okText:e("phrases.yes_delete"),okType:"danger",cancelText:e("verbs.cancel"),onOk:()=>g(s.id)})},[o.id,g,f.can_destroy_anamnesis]),n=K({openDrawer:m,handleDestroy:l,clientDrawerRef:w,anamnesisTemplaneDrawerRef:h,employeeDrawerRef:d}),t=Z(),x=r.useCallback(s=>{var i;(i=u.current)==null||i.refetch(),s&&m({id:s},"digital_signature")},[m]),_=r.useCallback(()=>{var s;(s=u.current)==null||s.refetch()},[]),k=r.useCallback(()=>!0,[]),R=r.useCallback(s=>{var i;return((i=s==null?void 0:s.all_anamnesis)==null?void 0:i.total_count)||0},[]),S=r.useCallback(s=>{var i;return(i=s==null?void 0:s.all_anamnesis)==null?void 0:i.all},[]),$=r.useCallback(s=>({content:a.jsx(O,{icon:U,label:e("verbs.delete"),direction:"left",color:"red"}),action:()=>l(s)}),[l]);return a.jsxs(a.Fragment,{children:[a.jsx(X,{Header:F,ref:u,permissions_key:"anamnesis",filters:t,search_placeholder:e("input.search_by_name"),openDrawer:m,title:e("words.anamnesi",{count:2}),columns:n,item_selectable:!1,query:J,MobileItem:G,getData:S,getTotalCount:R,validateRow:k,mobileSwipeLeft:$}),a.jsx(W,{ref:y,afterSave:x}),a.jsx(V,{ref:w,onSave:_}),a.jsx(L,{ref:h,afterSave:_}),a.jsx(Q,{ref:d,onSave:_})]})};export{ve as default};
//# sourceMappingURL=Anamnesis-DGN4WlbX.js.map
