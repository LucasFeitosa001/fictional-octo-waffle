import{f as t,T as n,r as a,g as l}from"./index-Bd9916Am.js";const p=l`
  query ReviewsDashboardEmployees {
    employees(actives: true) {
      id
      name
      avatar_url
      avatar_blurhash
      rating
    }
  }
`,i=()=>{const{data:e,loading:o}=t(p,{fetchPolicy:"network-only",onError:s=>{n.captureException(s),console.log(s)}});return[a.useMemo(()=>e!=null&&e.employees?[...e.employees].sort((s,r)=>parseInt(r.id)-parseInt(s.id)):[],[e==null?void 0:e.employees]),o]};export{i as u};
//# sourceMappingURL=useGetEmployees-CEtGz3v-.js.map
