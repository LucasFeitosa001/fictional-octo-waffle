import{f as s,r as l,g as m}from"./index-Bd9916Am.js";const a=m`
  query FetchDocumentTemplates ($class_type: String) {
    document_templates (class_type: $class_type, page: 1, per_page: 10) {
      all {
        id name
      }
    }
  }
`,p=t=>{const{data:e}=s(a,{variables:{class_type:t}});return l.useMemo(()=>(e==null?void 0:e.document_templates.all)||[],[e==null?void 0:e.document_templates.all])};export{p as u};
//# sourceMappingURL=useGetDocumentTemplates-ByJhJmEV.js.map
