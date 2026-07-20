import{f as h,T as x,m as f,t as l,g as T,r,l as t,j as o}from"./index-Bd9916Am.js";import{S as n}from"./openLink-DL3a6Hh-.js";const _=T`
  query TagsInput {
    client_tags {
      id name
    }
  }
`,w=()=>h(_,{fetchPolicy:"network-only",onError:s=>{x.captureException(s),console.log(s),f.error(l("phrases.generic_load_error_message"))}}),c=({value_key:s="id",...i},p)=>{const{data:{client_tags:u=[]}={},loading:d}=w(),m=r.useCallback((e,a)=>{const g=t.deburr(e.toLowerCase());return t.deburr(a==null?void 0:a.children.toLowerCase()).indexOf(g)>=0},[]);return o.jsx(n,{showSearch:!0,ref:p,loading:d,placeholder:l("words.hashtag"),optionFilterProp:"name",filterOption:m,style:{width:"100%"},getPopupContainer:e=>e.parentNode,...i,children:u.map(e=>o.jsx(n.Option,{value:e[s],name:e.name,children:e.name},e.id))})};c.displayName="TagsInput";const j=r.memo(r.forwardRef(c));export{j as T};
//# sourceMappingURL=TagsInput--G22F2nk.js.map
