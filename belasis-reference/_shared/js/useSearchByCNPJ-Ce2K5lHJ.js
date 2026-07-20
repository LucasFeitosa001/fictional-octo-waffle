import{r as u,cH as i,m as y,T as p,g as h}from"./index-Bd9916Am.js";const f=h`
  query SearchByCPF($cnpj: String!) {
    search_by_cnpj(cnpj: $cnpj) {
      success
      errors

      name
      razao_social
      number
      address
      district
      phone
      cep
      email
    }
  }
`,m=()=>{const[a,r]=u.useState(!1),t=i();return[async n=>{r(!0);try{const{data:e}=await t.query({fetchPolicy:"network-only",query:f,variables:n}),{success:c,errors:s,...o}=e==null?void 0:e.search_by_cnpj;return!c&&(s!=null&&s.length)?(s.forEach(l=>y.error(l)),{success:!1}):{success:c,...o}}catch(e){return p.captureException(e),console.error("[useSearchByCNPJ] ",e),{success:!1}}finally{r(!1)}},{loading:a}]};export{m as u};
//# sourceMappingURL=useSearchByCNPJ-Ce2K5lHJ.js.map
