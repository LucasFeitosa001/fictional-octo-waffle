import{g,m as a,t as n,T as l}from"./index-Bd9916Am.js";import{u as v}from"./useMutation-BrMwTcyD.js";const p=g`
  mutation updateOnlineBookingSettings($data: SaveSalonInput!) {
    saveSalon(input: $data) {
      success errors
    }
  }
`,d=()=>{const[r,{loading:t}]=v(p);return[async o=>{const c=a.loading(`${n("verbs.wait")}...`,0);try{const{data:e}=await r({variables:{data:o}}),{success:i,errors:s}=(e==null?void 0:e.saveSalon)||{};return s==null||s.forEach(u=>a.error(u)),{success:i}}catch(e){return l.captureException(e),a.error(n("phrases.generic_save_error_message")),console.error(e),{success:!1}}finally{c()}},t]};export{d as u};
//# sourceMappingURL=useSaveOnlineBookingSettings-DfcVL0Yk.js.map
