import{r as f,m as r,t as s,T as l,g as d}from"./index-Bd9916Am.js";import{u as p}from"./useMutation-BrMwTcyD.js";const y=d`
  mutation DestroyBonification ($data: DestroyBonificationInput!) {
    destroyBonification(input: $data) {
      success
      errors
    }
  }
`,T=(e=!0)=>{const[a,{loading:c}]=p(y);return[f.useCallback(async n=>{try{const{data:t}=await a({variables:{data:{id:n}}}),{success:i=!1,errors:o=[]}=(t==null?void 0:t.destroyBonification)||{};return i&&e&&r.success(`${s("phrases.deleted_successfully",{prefix:s("words.bonification"),context:"female"})}`),e&&(o==null||o.forEach(u=>r.error(u))),{success:i}}catch(t){return l.captureException(t),r.error(s("phrases.generic_save_error_message")),console.error(t),{success:!1}}},[a,e]),{loading:c}]};export{T as u};
//# sourceMappingURL=useDestroyBonification-DwZ1cJm3.js.map
