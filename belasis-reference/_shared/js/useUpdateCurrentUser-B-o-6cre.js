import{d as g,cH as C,r as o,T,g as f}from"./index-Bd9916Am.js";const x=()=>{const n=g(t=>{var e;return(e=t.current_user)==null?void 0:e.id}),a=C(),d=o.useRef(null);return o.useCallback((t,e)=>{const{origin:c,instant:l=!1,onCompleted:r,onError:u,refetchQueries:U=[]}=e;console.debug("[useUpdateCurrentUser] scheduled:",c,e,t),d.current=setTimeout(()=>{console.debug("[useUpdateCurrentUser] executed:",c,e,t),a.mutate({mutation:m,variables:{data:{id:n,...t}},refetchQueries:U}).then(({data:s})=>{const{updateUser:{success:i=!1,errors:p=null}={}}=s||{};if(!i){console.log(p);return}r==null||r()}).catch(s=>{console.log(s),T.captureException(s),u==null||u()})},l?0:1e3)},[a,n])},m=f`
  mutation useUpdateCurrentUserMutation($data: UpdateUserInput!) {
    updateUser(input: $data) {
      success errors
    }
  }
`;export{x as u};
//# sourceMappingURL=useUpdateCurrentUser-B-o-6cre.js.map
