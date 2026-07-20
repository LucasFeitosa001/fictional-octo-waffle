const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/Dashboard.desktop-BDhE2tu3.js","assets/index-Bd9916Am.js","assets/index-d41Ui0WO.css","assets/ClientDrawer-55jCGlAN.js","assets/PhoneInput-Uk4Fy4k3.js","assets/PhoneInput-Bbgo5x5y.css","assets/AnimatedModal-B0Wu-A-O.js","assets/index-N5o1yZfs.js","assets/useVariants-CcaHcr-K.js","assets/useMutation-BrMwTcyD.js","assets/index-pPH-OUeJ.js","assets/Overflow-BeweU6Wq.js","assets/openLink-DL3a6Hh-.js","assets/index-UewmsNya.js","assets/index-VnBECc_f.js","assets/ClientDrawer-CmlxdM94.css","assets/UsergroupAddOutlined-qzAlcXHB.js","assets/useGetEmployees-CEtGz3v-.js","assets/YAxis-bi-TQpBs.js","assets/generateCategoricalChart-9JSRxMGH.js","assets/tiny-invariant-BaFNuDhB.js","assets/BarChart-B03HCBds.js","assets/WebookContent-BCPw5BqQ.js","assets/useWebpushSubscription-DZpB0TTw.js","assets/GoogleOutlined-CNbpRv7S.js","assets/InstagramOutlined-DPUwDZLb.js","assets/InDevelopment-DNEk_Jig.js","assets/DesktopOutlined-BHgN7Crp.js","assets/ReportsComponents-DSNa3sJo.js","assets/FilterButton-xRBUF8AX.js","assets/FilterOutlined-Qp4wXgRp.js","assets/FilterMenu.desktop-CK5te_0K.js","assets/HomeOutlined-B9c9mYth.js","assets/Dashboard.mobile-5h0Y9ESR.js","assets/LockOutlined-CSlPnRor.js","assets/Settings.desktop-DrRS23sp.js","assets/Settings.mobile-BcVIR7By.js","assets/Ratings.desktop-BYLLpXXJ.js","assets/Ratings.mobile-BLRjw5tD.js","assets/RangeComponentMobile-Dg6Dcze8.js","assets/FiltersDrawer-B1hk9I7I.js","assets/RangePickerFilter-BfY4_Tp8.js","assets/useSetMobileMenuActions-BqSMJ-xa.js"])))=>i.map(i=>d[i]);
import{f as z,T as A,cj as y,g as D,m as C,t as a,r as i,j as e,R as m,c as f,y as $,B as Q,d as x,e as M,K as J,p as de,F as R,G as E,u as le,z as ce,A as F}from"./index-Bd9916Am.js";import{c as ue,u as me,cQ as ge,U as pe,Y as P,Z as K,aw as fe,X as B,a0 as he,a3 as xe,bY as we,aM as ve}from"./ClientDrawer-55jCGlAN.js";import{u as be}from"./useMutation-BrMwTcyD.js";import{F as h,I}from"./index-N5o1yZfs.js";import{d as X,H as T}from"./WebookContent-BCPw5BqQ.js";import{R as $e}from"./DesktopOutlined-BHgN7Crp.js";import{P as je}from"./ReportsComponents-DSNa3sJo.js";import{F as ye}from"./FilterButton-xRBUF8AX.js";import{F as Se,a as k,S as O}from"./FilterMenu.desktop-CK5te_0K.js";import{R as Ie}from"./HomeOutlined-B9c9mYth.js";import{c as Re}from"./openLink-DL3a6Hh-.js";D`
  query MetricsSalon($start_date: String!,$end_date: String!,$diff_start_date: String!,$diff_end_date: String!) {
    current_salon {
      id
      name

      salon_reviews_information(start_date: $start_date, end_date: $end_date) {
        reviews_sent_count
        average_rating
        response_time(convert_time_in_words: true)
        response_rate(start_date: $start_date, end_date: $end_date)
      }

      old_salon_reviews_information: salon_reviews_information(start_date: $diff_start_date, end_date: $diff_end_date) {
        reviews_sent_count
        average_rating
        response_time
        response_rate(start_date: $diff_start_date, end_date: $diff_end_date)
      }

      employee_ratings: all_employees(active: true) {
        all {
          id
          name
          avatar_url: large_thumb_url
          avatar_blurhash
          rating(start_date: $start_date, end_date: $end_date)
          old_rating: rating(start_date: $diff_start_date, end_date: $diff_end_date)
        }
      }
    }
  }
`;const Ee=D`
  query SalonInformation {
    current_salon {
      id

      has_whatsapp_plan: has_addon(ids: [
        ${y.ID_REVIEW_WHATSAPP_BEGINNER},
        ${y.ID_REVIEW_WHATSAPP_PROFESSIONAL},
        ${y.ID_REVIEW_WHATSAPP_PREMIUM},
        ${y.ID_REVIEW_WHATSAPP_BONUS}
      ])
      has_sms_plan: has_addon(ids: [
        ${y.ID_REVIEW_BEGINNER},
        ${y.ID_REVIEW_PROFESSIONAL},
        ${y.ID_REVIEW_PREMIUM}
      ])

      salon_review_configuration_attributes: review_configurations {
        id
        success_swal_text
        footer_text
        header_text
        header_title
        module_active
        send_priority
      }

      sms_message_configuration_attributes: sms_message_configuration {
        id
        sms_message_review
      }
    }
  }
`,Ce=()=>z(Ee,{onError:r=>{A.captureException(r),console.log(r)}}),Z=ue({has_free:!1}),N=r=>me(Z,r),Me=D`
  mutation SaveSalon($data: SaveSalonInput!) {
    saveSalon(input: $data) {
      success errors
    }
  }
`,ee=()=>{const[r,{loading:s}]=be(Me);return[async o=>{try{const{data:t}=await r({variables:{data:o}}),{success:u=!1,errors:c=[]}=(t==null?void 0:t.saveSalon)||{};return c==null||c.map(p=>C.error(p)),{success:u}}catch(t){return A.captureException(t),C.error(a("phrases.generic_save_error_message")),console.error(t),{success:!1}}},{loading:s}]},W=a("reviews.default_sms_review"),q=a("reviews.default_success_text"),te=({salon_information:r,saveSalon:s,openBlockModal:n,refetch:o})=>{const[t]=h.useForm(),u=N(_=>_.has_free),c=i.useRef(null);i.useEffect(()=>{if(r){const{id:_,success_swal_text:l}=r.salon_review_configuration_attributes,g={sms_message_configuration_attributes:r.sms_message_configuration_attributes,salon_review_configuration_attributes:{id:_,success_swal_text:l}};t.setFieldsValue(g)}},[r,t]);const p=_=>e.jsx(f,{$link:!0,onClick:()=>{t.setFieldsValue(_)},children:a("reviews.restore_default")}),d=async(_,l)=>l?l.includes("%NOME%")&&l.includes("%LINK%")?Promise.resolve(!0):Promise.reject(a("reviews.insert_keywords_message")):Promise.resolve(!0),w=async _=>{if(u){n();return}try{const{sms_message_configuration_attributes:l,salon_review_configuration_attributes:g}=await t.validateFields();if(!(await s(_==="sms_message"?{sms_message_configuration_attributes:l}:{salon_review_configuration_attributes:g})).success)return;C.success(a("phrases.saved_successfully",{prefix:a("words.message"),context:"female"})),o()}catch(l){console.log(l)}};return e.jsxs(h,{form:t,layout:void 0,component:!1,scrollToFirstError:!0,initialValues:{sms_message_configuration_attributes:{id:"",sms_message_review:W},salon_review_configuration_attributes:{id:"",success_swal_text:q}},children:[e.jsx(h.Item,{noStyle:!0,name:["sms_message_configuration_attributes","id"],children:e.jsx(I,{type:"hidden"})}),e.jsx(h.Item,{noStyle:!0,name:["salon_review_configuration_attributes","id"],children:e.jsx(I,{type:"hidden"})}),e.jsxs(m,{$gap:10,children:[e.jsxs(U,{$alignCenter:!0,$column:!0,children:[e.jsx(f,{$size:16,$bold:!0,$alignCenter:!0,$mBottom:20,children:a("reviews.review_request_message")}),e.jsxs(f,{$mBottom:20,$align:"justify",children:[a("reviews.order_completion_message")," ",p({sms_message_configuration_attributes:{sms_message_review:W}})]}),e.jsx(h.Item,{name:["sms_message_configuration_attributes","sms_message_review"],rules:[{validateTrigger:"onChange",validator:d},{required:!0,message:a("phrases.required_field")}],style:{width:"100%"},children:e.jsx(G,{autoSize:!1,rows:3,maxLength:255,ref:c,showCount:!0})}),e.jsx(m,{$fullWidth:!0,children:e.jsx(ge,{keys:["client_name","link_review"],textAreaRef:c,fieldName:["sms_message_configuration_attributes","sms_message_review"],setFieldsValue:t.setFieldsValue})}),e.jsx(m,{$mTop:15}),e.jsx(H,{onClick:()=>w("sms_message"),children:a("verbs.save")})]}),e.jsxs(U,{$alignCenter:!0,$column:!0,children:[e.jsx(f,{$size:16,$bold:!0,$alignCenter:!0,$mBottom:20,children:a("reviews.thank_you_message")}),e.jsxs(f,{$mBottom:20,$align:"justify",children:[a("reviews.after_review_thank_you_message")," ",p({salon_review_configuration_attributes:{success_swal_text:q}})]}),e.jsx(h.Item,{name:["salon_review_configuration_attributes","success_swal_text"],rules:[{required:!0,message:a("phrases.required_field")}],style:{width:"100%"},children:e.jsx(G,{autoSize:!1,rows:3,maxLength:255,showCount:!0})}),e.jsx(m,{}),e.jsx(H,{onClick:()=>w("salon_review_configuration"),children:a("verbs.save")})]})]})]})};te.displayName="MessagesDesktop";const U=$(m).withConfig({componentId:"wb__sc-h826rm-0"})(["position:relative;border-radius:12px;background:#FFFFFF;box-shadow:0 3px 6px -4px rgba(0,0,0,0.12),0 2px 3px 0 rgba(0,0,0,0.08),0 9px 28px 8px rgba(0,0,0,0.05);padding:15px 25px 25px;"]),G=$(I.TextArea).withConfig({componentId:"wb__sc-h826rm-1"})(["resize:none !important;"]),H=$(Q).attrs({type:"primary"}).withConfig({componentId:"wb__sc-h826rm-2"})(["padding:0 50px !important;"]),se=r=>{const s=i.useRef(null),{form:n,saving:o,onSubmit:t}=r,u=x(c=>c.current_user.salon);return e.jsxs(h,{form:n,layout:void 0,scrollToFirstError:!0,onFinish:t,initialValues:{salon_review_configuration_attributes:{id:"",header_title:"",header_text:"",footer_text:""}},children:[e.jsx(h.Item,{noStyle:!0,name:["salon_review_configuration_attributes","id"],children:e.jsx(I,{type:"hidden"})}),e.jsxs(ke,{$column:!0,$alignCenter:!0,children:[e.jsxs(m,{$column:!0,$paddings:{top:15},$alignCenter:!0,children:[e.jsxs(f,{$alignCenter:!0,$size:24,children:[e.jsx($e,{})," ",a("reviews.review_page_settings")]}),e.jsx(f,{$mBottom:15,$size:16,children:a("reviews.review_screen_message")})]}),e.jsxs(Fe,{children:[e.jsx(Ae,{children:e.jsx(Q,{loading:o,className:"btn ant-button-success",type:"primary",onClick:n.submit,children:a("verbs.save")})}),e.jsxs(Pe,{children:[e.jsx(m,{$column:!0,children:e.jsx(f,{$alignCenter:!0,$textEllipsis:!0,$size:30,$light:!0,children:u.name})}),e.jsx(Te,{}),e.jsxs(m,{$column:!0,$alignCenter:!0,children:[e.jsx(h.Item,{name:["salon_review_configuration_attributes","header_title"],rules:[{required:!0,message:a("phrases.required_field")}],style:{width:"100%"},children:e.jsx(I,{style:{textAlign:"center"}})}),e.jsx(h.Item,{name:["salon_review_configuration_attributes","header_text"],rules:[{required:!0,message:a("phrases.required_field")}],style:{width:"100%"},children:e.jsx(I.TextArea,{rows:3,style:{textAlign:"center",resize:"none"}})})]}),e.jsxs(m,{$column:!0,$alignCenter:!0,$isFlex:!0,$mBottom:10,children:[e.jsx(pe,{size:150}),e.jsx(f,{$size:18,$mTop:10,children:a("reviews.employee_name")}),e.jsx(X,{disabled:!0,value:5}),e.jsxs(f,{$mTop:10,$bold:!0,children:[a("words.comment"),":"]}),e.jsx(f,{$alignCenter:!0,children:a("reviews.sample_comment")})]}),e.jsxs(m,{$column:!0,$alignCenter:!0,$margins:[20,0],children:[e.jsx(h.Item,{name:["salon_review_configuration_attributes","footer_text"],rules:[{required:!0,message:a("phrases.required_field")}],style:{width:"100%"},children:e.jsx(I.TextArea,{ref:s,rows:3,style:{textAlign:"center",resize:"none"}})}),e.jsx(f,{children:a("reviews.service_date",{date:M().format("L"),interpolation:{escapeValue:!1}})})]})]})]})]})]})};se.displayName="ReviewPage";const De=i.memo(se),Fe=$.div.withConfig({componentId:"wb__sc-1gggfu5-0"})(["display:flex;position:relative;align-items:flex-start;overflow-x:hidden;justify-content:center;width:100%;border-bottom-left-radius:12px;border-bottom-right-radius:12px;background:linear-gradient(rgba(255,255,255,.95),rgba(255,255,255,.95)),no-repeat center;background-size:cover;"]),ke=$(m).withConfig({componentId:"wb__sc-1gggfu5-1"})(["margin-top:10px;border-radius:12px;background:#FFFFFF;box-shadow:0 3px 6px 2px rgba(0,0,0,0.12),0 2px 3px 0 rgba(0,0,0,0.08),0 9px 22px 8px rgba(0,0,0,0.05);"]),Ae=$(m).withConfig({componentId:"wb__sc-1gggfu5-2"})(["position:absolute;left:0;top:0;padding:15px;display:flex;flex-wrap:wrap;justify-content:flex-start;.btn{margin:3px;height:40px;}.btn-default{background:transparent;color:#FFFFFF;transition:all .1s;&:hover{background:rgba(255,255,255,0.9);;color:#555;}}"]),Pe=$.div.withConfig({componentId:"wb__sc-1gggfu5-3"})(["background:rgba(255,255,255,0.9);border-radius:12px;box-shadow:0 6px 18px 2px rgba(0,0,0,.5);display:flex;flex-wrap:wrap;flex-direction:column;align-items:center;margin:100px 10px;padding:15px;width:500px;max-width:95%;min-height:400px;"]),Te=$.hr.withConfig({componentId:"wb__sc-1gggfu5-4"})(["border-color:#ddd;width:80%;"]),re=r=>{const{salon_information:s,loading:n,openBlockModal:o,refetch:t,routes:u}=r,c=N(g=>g.has_free),p=x(g=>g.current_user.permissions),[d,{loading:w}]=ee(),[_]=h.useForm();i.useEffect(()=>{if(s){const{module_active:g,success_swal_text:j,...b}=s.salon_review_configuration_attributes;_.setFieldsValue({salon_review_configuration_attributes:b})}},[s,_]);const l=async g=>{if(c){o();return}const j={salon_review_configuration_attributes:g.salon_review_configuration_attributes},{success:b}=await d(j);b&&(C.success(a("phrases.saved_successfully",{prefix:a("words.personalization",{count:2}),context:"female",count:2})),t())};return e.jsxs(P,{children:[e.jsx(T,{title:a("words.review_other"),tabs:u,$showBottomBorder:!0}),e.jsx(J,{loading:n}),e.jsxs(K,{style:{display:"flex",flexDirection:"column",marginBottom:20},has_permission:p.can_access_reviews,children:[e.jsx(te,{salon_information:s,saveSalon:d,openBlockModal:o,refetch:t}),e.jsx(De,{form:_,onSubmit:l,saving:w})]})]})};re.displayName="PersonalizationDesktop";const ze=i.memo(re),Be=D`
  query MetricsSalon($start_date: String!,$end_date: String!,$diff_start_date: String!,$diff_end_date: String!) {
    current_salon {
      id
      name

      salon_reviews_information(start_date: $start_date, end_date: $end_date) {
        reviews_sent_count
        average_rating
        response_time(convert_time_in_words: true)
        response_rate(start_date: $start_date, end_date: $end_date)
      }

      old_salon_reviews_information: salon_reviews_information(start_date: $diff_start_date, end_date: $diff_end_date) {
        reviews_sent_count
        average_rating
        response_time
        response_rate(start_date: $diff_start_date, end_date: $diff_end_date)
      }

      employee_ratings: all_employees(active: true) {
        all {
          id
          name
          avatar_url: large_thumb_url
          avatar_blurhash
          rating(start_date: $start_date, end_date: $end_date)
          old_rating: rating(start_date: $diff_start_date, end_date: $diff_end_date)
        }
      }
    }
  }
`,Ne=r=>{const s=r[0],n=r[1],o=n.diff(s,"day"),t=s.subtract(o,"days");return z(Be,{variables:{start_date:s.format("YYYY-MM-DD"),end_date:n.format("YYYY-MM-DD"),diff_start_date:t.format("YYYY-MM-DD"),diff_end_date:s.format("YYYY-MM-DD")},onError:u=>{A.captureException(u),console.log(u)}})},Ye=i.lazy(()=>R(()=>E(()=>import("./Dashboard.desktop-BDhE2tu3.js"),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32])))),Le=i.lazy(()=>R(()=>E(()=>import("./Dashboard.mobile-5h0Y9ESR.js"),__vite__mapDeps([33,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17,34,22,23,24,25,26,27,28,29,30,31,32])))),ae=({routes:r})=>{const[s,n]=i.useState([M().subtract(1,"month"),M()]),o=x(p=>p.is_mobile),t=x(p=>p.current_user.permissions),{data:u,loading:c}=Ne(s);return e.jsxs(P,{children:[e.jsx(T,{title:a("words.review_other"),tabs:r,$showBottomBorder:!0}),e.jsx(je,{style:o?{margin:"0 15px 15px",padding:0}:{marginTop:10},children:e.jsx(fe,{disabled:c,style:{width:"unset"},variant:"borderless",value:s,onChange:n,placement:"bottomLeft"})}),e.jsx(Y,{$pageFull:!0,has_permission:t.can_access_reviews,children:e.jsx(B,{Desktop:Ye,Mobile:Le,data:u,loading:c})})]})};ae.displayName="Dashboard";const Y=$(K).withConfig({componentId:"wb__sc-1oz0mcs-0"})(["display:flex;",""],r=>r.theme.is_mobile&&de(["margin-top:0;height:100%;"])),Ve=i.lazy(()=>R(()=>E(()=>import("./Settings.desktop-DrRS23sp.js"),__vite__mapDeps([35,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15])))),Oe=i.lazy(()=>R(()=>E(()=>import("./Settings.mobile-BcVIR7By.js"),__vite__mapDeps([36,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,22,23,24,25,26,27,28,29,30,31,32])))),ne=r=>{const{salon_information:s,refetch:n,routes:o,loading:t,openBlockModal:u}=r,c=N(g=>g.has_free),p=x(g=>g.current_user.permissions),[d]=ee(),w=!!(s!=null&&s.salon_review_configuration_attributes.module_active),_=i.useCallback(async g=>{const j={salon_review_configuration_attributes:{id:s==null?void 0:s.salon_review_configuration_attributes.id,...g}},{success:b}=await d(j);b&&(C.success(a("phrases.saved_successfully",{prefix:a("words.setting"),context:"female"})),n())},[n,s==null?void 0:s.salon_review_configuration_attributes.id,d]),l=i.useCallback(()=>{if(w){_({module_active:!1});return}if(c){u();return}_({module_active:!0})},[_,c,w,u]);return e.jsxs(P,{children:[e.jsx(T,{title:a("words.review_other"),tabs:o,$showBottomBorder:!0}),e.jsx(J,{loading:t}),e.jsx(Y,{style:{height:"unset"},has_permission:p.can_access_reviews,children:e.jsx(B,{Desktop:Ve,Mobile:Oe,handleClickActiveModule:l,...r})})]})};ne.displayName="Settings";const We=D`
  query SalonReviewsQuery(
    $start_date: String!,
    $end_date: String!,
    $rating: Int,
    $results: Int!,
    $page: Int!,
    $employee_ids: [String!],
    $client_ids: [String!]
  ) {
    current_salon {
      id

      reviews(
        start_date: $start_date,
        end_date: $end_date,
        employee_ids: $employee_ids,
        client_ids: $client_ids,
        sort_order: "DESC",
        sort_field: "updated_at",
        rating: $rating,
        results: $results,
        page: $page
      ) {
        all {
          id
          description
          rating
          created_at
          client_name

          inventory_sale {
            id
            code

            client {
              id
              name
              has_avatar
              name_initials
              avatar_url: small_thumb_url
              avatar_blurhash
            }
          }

          employee {
            id
            name
          }
        },
        total_count
      }
    }
  }
`,qe=r=>{const s=x(t=>t.current_user.permissions),n=x(t=>t.current_user.employee),o=s.can_access_all_reviews?r.employee_ids:[n.id];return z(We,{variables:{...r,start_date:r.start_date.format("YYYY-MM-DD"),end_date:r.end_date.format("YYYY-MM-DD"),employee_ids:o},onError:t=>{A.captureException(t),console.log(t)}})},Ue={start_date:M().subtract(1,"month"),end_date:M(),results:15,page:1,rating:void 0},_t=(r=0,s=0)=>(r-s)*100/(s>=1?s:1),dt=r=>r/60/60/24,Ge=JSON.stringify({raw_value:0,result_in_words:0}),lt=(r=Ge)=>JSON.parse(r),ie=({show_filters:r,filters:s,handleChangeFilters:n})=>{const o=x(t=>t.current_user.permissions);return e.jsxs(Se,{$visible:r,children:[e.jsxs(k,{children:[e.jsx(m,{$alignCenter:!0,justify:"space-between",$bottom:15,children:e.jsx(f,{$size:14,$semibold:!0,children:a("words.period")})}),e.jsxs(m,{$column:!0,children:[e.jsx(O,{allowClear:!1,onRangeChange:t=>n({page:1,start_date:t[0],end_date:t[1]}),value:s.start_date,onChange:t=>n({page:1,start_date:t,end_date:s.end_date}),format:"LL",placeholder:a("date.start_date")}),e.jsx(O,{allowClear:!1,onRangeChange:t=>n({page:1,start_date:t[0],end_date:t[1]}),value:s.end_date,onChange:t=>n({page:1,start_date:s.start_date,end_date:t}),format:"LL",placeholder:a("date.end_date")})]})]}),e.jsxs(k,{children:[e.jsx(m,{$alignCenter:!0,justify:"space-between",$bottom:15,children:e.jsx(f,{$size:14,$semibold:!0,children:a("words.client")})}),e.jsx(m,{children:e.jsx(he,{onChange:t=>n({client_ids:t?[t]:void 0}),show_phone:!1,style:{width:"100%"},allowClear:!0,getPopupContainer:()=>document.body})})]}),e.jsxs(k,{children:[e.jsx(m,{$alignCenter:!0,justify:"space-between",$bottom:15,children:e.jsx(f,{$size:14,$semibold:!0,children:a("words.employee")})}),e.jsx(m,{children:e.jsx(xe,{style:{width:"100%"},getPopupContainer:()=>document.body,disabled:!o.can_access_all_reviews,onChange:t=>n({employee_ids:t?[t]:void 0}),allowClear:!0,showCreateButton:!1})})]}),e.jsxs(k,{children:[e.jsx(m,{$alignCenter:!0,justify:"space-between",$bottom:15,children:e.jsx(f,{$size:14,$semibold:!0,children:a("words.review")})}),e.jsx(X,{value:s.rating,onChange:t=>n({rating:t||void 0})})]})]})};ie.displayName="ReviewsFiltersDesktop";const He=i.memo(ie),Qe=i.lazy(()=>R(()=>E(()=>import("./Ratings.desktop-BYLLpXXJ.js"),__vite__mapDeps([37,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,22,23,24,25,26])))),Je=i.lazy(()=>R(()=>E(()=>import("./Ratings.mobile-BLRjw5tD.js"),__vite__mapDeps([38,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,22,23,24,25,26,39,31,40,41,42,32,30,28])))),oe=r=>{var j,b,L,V;const[s,n]=i.useState(Ue),[o,t]=i.useState(!1),{routes:u}=r,c=x(v=>v.current_user.permissions),p=x(v=>v.is_mobile),{data:d,loading:w}=qe(s),_=i.useCallback(v=>{n(S=>({...S,...v}))},[]),l=i.useMemo(()=>{var v,S;return((S=(v=d==null?void 0:d.current_salon)==null?void 0:v.reviews)==null?void 0:S.all)||[]},[(b=(j=d==null?void 0:d.current_salon)==null?void 0:j.reviews)==null?void 0:b.all]),g=i.useMemo(()=>{var v,S;return((S=(v=d==null?void 0:d.current_salon)==null?void 0:v.reviews)==null?void 0:S.total_count)||0},[(V=(L=d==null?void 0:d.current_salon)==null?void 0:L.reviews)==null?void 0:V.total_count]);return e.jsxs(P,{children:[e.jsx(T,{title:a("words.review_other"),tabs:u,$showBottomBorder:!0,children:!p&&e.jsx(ye,{show_filters:o,setShowFilters:t})}),e.jsxs(Y,{$pageFull:!0,has_permission:c.can_access_reviews,children:[!p&&e.jsx(He,{show_filters:o,filters:s,handleChangeFilters:_}),e.jsx(B,{Desktop:Qe,Mobile:Je,loading:w,reviews:l,total_count:g,handleChangeFilters:_,filters:s,setShowFilters:t})]})]})};oe.displayName="Ratings";const _e=()=>{const r=we(),s=x(l=>l.current_user.permissions),n=x(l=>l.is_mobile),o=le();i.useEffect(()=>{s.is_admin||o("/reviews/ratings")},[s.is_admin,o]);const{data:{current_salon:t}={},loading:u,refetch:c}=Ce(),p=!(t!=null&&t.has_sms_plan)&&!(t!=null&&t.has_whatsapp_plan),d=i.useCallback(()=>{r({is_addon:!0,search:y.ID_REVIEW_WHATSAPP_PREMIUM})},[r]),w=i.useMemo(()=>({has_free:p}),[p]),_=i.useMemo(()=>{const l=[{label:a("words.panel"),path:"/reviews",disabled:!s.is_admin,icon:Ie},{label:a("words.review_other"),path:"/reviews/ratings",icon:Re}];return n||l.push({label:a("words.personalization"),path:"/reviews/personalization",disabled:!s.is_admin}),l.push({label:a("words.setting_other"),path:"/reviews/settings",disabled:!s.is_admin,icon:ve}),l},[n,s.is_admin]);return e.jsx(Z.Provider,{value:w,children:e.jsx(m,{$column:!0,children:e.jsxs(ce,{children:[e.jsx(F,{path:"/",element:e.jsx(ae,{routes:_})}),e.jsx(F,{path:"/ratings",element:e.jsx(oe,{routes:_})}),e.jsx(F,{path:"/personalization",element:e.jsx(ze,{salon_information:t,loading:u,openBlockModal:d,refetch:c,routes:_})}),e.jsx(F,{path:"/settings",element:e.jsx(ne,{salon_information:t,refetch:c,loading:u,openBlockModal:d,routes:_})})]})})})};_e.displayName="Reviews";const ct=Object.freeze(Object.defineProperty({__proto__:null,default:_e},Symbol.toStringTag,{value:"Module"}));export{ct as R,_t as a,ee as b,dt as c,lt as j,N as u};
//# sourceMappingURL=Reviews-4L4EJU1y.js.map
