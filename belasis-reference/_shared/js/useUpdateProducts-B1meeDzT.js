import{g as i,m as t,t as e,T as p}from"./index-Bd9916Am.js";import{u as g}from"./useMutation-BrMwTcyD.js";const l=i`
  mutation MassActionUpdateProducts($data: UpdateInventoryProductsInput!) {
    updateInventoryProducts(input: $data) {
      success
      errors
    }
  }
`,y=()=>{const[a,{loading:o}]=g(l);return[async c=>{const n=t.loading(`${e("verbs.wait")}...`,0);try{const{data:r}=await a({variables:{data:c}}),{success:u,errors:s}=(r==null?void 0:r.updateInventoryProducts)||{};return s==null||s.map(d=>t.error(d)),{success:u,errors:s||[]}}catch(r){return p.captureException(r),console.error(r),t.error(e("phrases.generic_save_error_message")),{success:!1,errors:[]}}finally{n()}},{loading:o}]};export{y as u};
//# sourceMappingURL=useUpdateProducts-B1meeDzT.js.map
