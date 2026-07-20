import{d as i,w as r,r as c}from"./index-Bd9916Am.js";const n=(o,{disabled:t=!1}={})=>{const s=i(a=>a.is_mobile),e=r();c.useEffect(()=>{if(!(!s||t))return e({type:"set_mobile_menu_actions",payload:o.filter(Boolean)}),()=>{e({type:"set_mobile_menu_actions",payload:[]})}},[t,s,o,e])};export{n as u};
//# sourceMappingURL=useSetMobileMenuActions-BqSMJ-xa.js.map
