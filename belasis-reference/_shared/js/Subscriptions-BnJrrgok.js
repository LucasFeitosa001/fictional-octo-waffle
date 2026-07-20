import{g as b,r as a,j as t,R as S,t as r,y as _,cj as x}from"./index-Bd9916Am.js";import{h as p,T as h,A as y,cP as $,J as f}from"./ClientDrawer-55jCGlAN.js";import{M as w}from"./MagicTable-D-daxyPD.js";import{a as j}from"./PhoneInput-Uk4Fy4k3.js";import{S as T,a as i,u as C}from"./useSubscriptionColumns-C_FEyvp5.js";import{H as v}from"./Header-J_h_5BcG.js";import"./AnimatedModal-B0Wu-A-O.js";import"./index-N5o1yZfs.js";import"./useVariants-CcaHcr-K.js";import"./useMutation-BrMwTcyD.js";import"./index-pPH-OUeJ.js";import"./Overflow-BeweU6Wq.js";import"./openLink-DL3a6Hh-.js";import"./index-UewmsNya.js";import"./index-VnBECc_f.js";import"./ColumnsSettings-DQaC_giH.js";import"./FilterMenu.desktop-CK5te_0K.js";import"./WebookContent-BCPw5BqQ.js";import"./useWebpushSubscription-DZpB0TTw.js";import"./GoogleOutlined-CNbpRv7S.js";import"./InstagramOutlined-DPUwDZLb.js";import"./InDevelopment-DNEk_Jig.js";import"./AuditOutlined-Bo6TnUfi.js";const k=b`
  query CustomerSubscriptions(
    $page: Int, $results: Int, $payment_type: [String!], $status: [String!], $start_date: String, $end_date: String,
    $search_query: String
  ) {
    all_customer_subscriptions (
      page: $page, results: $results, payment_type: $payment_type, status: $status, start_due: $start_date,
      end_due: $end_date, search_term: $search_query, sort_field: "created_at", sort_order: "DESC"
    ) {
      all {
        id
        code
        total_cents
        status
        payment_type
        due
        payment_link

        client {
          id
          name
        }

        customer_subscription_template {
          id
          name
          image_url: small_thumb_url
          image_blurhash
        }

        customer_subscription_items {
          id
          discount
          discount_type
          quantity
          total_cents
          value_cents
          inventory_product {
            id
            description
          }
        }
      }

      total_count
    }
  }
`;b`
  mutation DestroyCustomerSubscription($data: DestroyCustomerSubscriptionInput!) {
    destroyCustomerSubscription(input: $data) {
      success errors
    }
  }
`;const I=u=>{var n,c,m;const{item:e}=u;return t.jsxs(t.Fragment,{children:[t.jsx("div",{children:t.jsx(O,{type:"image",src:(n=e==null?void 0:e.customer_subscription_template)==null?void 0:n.image_url,blurhash:(c=e==null?void 0:e.customer_subscription_template)==null?void 0:c.image_blurhash})}),t.jsxs(D,{children:[t.jsxs(S,{$column:!0,$top:2,children:[t.jsx(p,{width:16,$block:!0,$bold:!0,children:e==null?void 0:e.client.name}),t.jsx(p,{width:6,$block:!0,$semibold:!0,children:((m=e==null?void 0:e.customer_subscription_template)==null?void 0:m.name)||r("words.custom")}),e==null?void 0:e.customer_subscription_items.map(d=>t.jsx(p,{width:6,$block:!0,$color:"gray_1",$size:12,children:`${d.quantity}x ${d.inventory_product.description}`}))]}),t.jsxs("div",{children:[t.jsx(p,{width:8,$block:!0,$size:12,$semibold:!0,$align:"end",children:j(e==null?void 0:e.total_cents)}),t.jsx(h,{color:i[(e==null?void 0:e.status)||"disabled"],style:{marginRight:0},children:T[(e==null?void 0:e.status)||"disabled"]})]})]})]})},R=a.memo(I),D=_.div.withConfig({componentId:"wb__sc-zh518e-0"})(["width:100%;display:flex;flex-direction:row;"]),O=_(y).withConfig({componentId:"wb__sc-zh518e-1"})(["width:40px !important;height:40px !important;margin-right:10px !important;border:1px solid rgba(0,0,0,0.1);object-fit:cover;"]),l=_(h).withConfig({componentId:"wb__sc-1ji2gmb-0"})(["margin:2px 0;"]),A=[{value:"pending",label:t.jsx(l,{color:i.pending,children:r("customer.subscription.status.pending")})},{value:"active",label:t.jsx(l,{color:i.active,children:r("customer.subscription.status.active")})},{value:"expired",label:t.jsx(l,{color:i.expired,children:r("customer.subscription.status.expired")})},{value:"disabled",label:t.jsx(l,{color:i.disabled,children:r("customer.subscription.status.disabled")})},{value:"canceled",label:t.jsx(l,{color:i.canceled,children:r("customer.subscription.status.canceled")})}],M=[{value:"automatic",label:r("words.automatic")},{value:"manual",label:r("words.manual")}],E=()=>a.useMemo(()=>[{label:r("words.due"),name:"due",rangepicker:{start_date_name:"start_date",end_date_name:"end_date"}},{label:r("words.status"),name:"status",checkbox_options:A,checkbox_disabled:!0},{label:r("words.payment_type"),name:"payment_type",checkbox_options:M,checkbox_disabled:!0}],[]),ae=()=>{$({feature_keys:["has_customer_subscription"],addon_keys:["has_customer_subscription"],search:x.ID_CUSTOMER_SUBSCRIPTION});const u=a.useRef(null),e=a.useRef(null),n=a.useCallback(()=>{var s;(s=e.current)==null||s.refetch()},[]),c=a.useCallback(s=>{var o;(o=u.current)==null||o.open(s==null?void 0:s.id)},[]),m=a.useCallback(s=>!0,[]),d=C({openSubscriptionDrawer:c,afterDeleteSubscription:n}),g=E();return t.jsxs(t.Fragment,{children:[t.jsx(w,{ref:e,Header:v,title:r("phrases.subscription_sale_other"),storage_key:"customer_subscriptions",permissions_key:"subscription_template",columns:d,query:k,getData:s=>{var o;return(o=s==null?void 0:s.all_customer_subscriptions)==null?void 0:o.all},getTotalCount:s=>{var o;return((o=s==null?void 0:s.all_customer_subscriptions)==null?void 0:o.total_count)||0},MobileItem:R,openDrawer:c,validateRow:m,filters:g,search_placeholder:r("customer.subscription.search_placeholder")}),t.jsx(f,{ref:u,afterSave:n})]})};export{ae as default};
//# sourceMappingURL=Subscriptions-BnJrrgok.js.map
