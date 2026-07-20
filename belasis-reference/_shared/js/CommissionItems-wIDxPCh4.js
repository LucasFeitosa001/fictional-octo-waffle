const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/CommissionItems-bXGYsvDD.js","assets/index-Bd9916Am.js","assets/index-d41Ui0WO.css","assets/FilterMenu.desktop-CK5te_0K.js","assets/ClientDrawer-55jCGlAN.js","assets/PhoneInput-Uk4Fy4k3.js","assets/PhoneInput-Bbgo5x5y.css","assets/AnimatedModal-B0Wu-A-O.js","assets/index-N5o1yZfs.js","assets/useVariants-CcaHcr-K.js","assets/useMutation-BrMwTcyD.js","assets/index-pPH-OUeJ.js","assets/Overflow-BeweU6Wq.js","assets/openLink-DL3a6Hh-.js","assets/index-UewmsNya.js","assets/index-VnBECc_f.js","assets/ClientDrawer-CmlxdM94.css","assets/useCommissionContext-DMfkSxEI.js","assets/index-C3BHa_tj.js","assets/PaymentModal-CTb_Q_nN.js","assets/TotalInfo-ju-E1ucZ.js","assets/ColumnsSettings-DQaC_giH.js","assets/useLocalStorage-9q0Hpuat.js","assets/AuditOutlined-Bo6TnUfi.js","assets/useCommissionTabs-D8w6g4mx.js","assets/HomeOutlined-B9c9mYth.js","assets/WebookContent-BCPw5BqQ.js","assets/useWebpushSubscription-DZpB0TTw.js","assets/GoogleOutlined-CNbpRv7S.js","assets/InstagramOutlined-DPUwDZLb.js","assets/InDevelopment-DNEk_Jig.js","assets/PrinterOutlined-U8EP-aoz.js","assets/FileExcelOutlined-KTkDII2n.js","assets/FilterOutlined-Qp4wXgRp.js","assets/helpers-BfSAkm32.js","assets/FileSaver.min-BrLJoCrD.js","assets/xlsx-CSzimK3s.js","assets/commissionColumns-Bvau0eIu.js","assets/useOpenBelasisPay-3OV5sPxT.js","assets/BankOutlined-dzv2CRnS.js","assets/index-CikisfRO.js","assets/CommissionItems-BQdQRIVr.js","assets/RangeComponentMobile-Dg6Dcze8.js","assets/RangePickerFilter-BfY4_Tp8.js","assets/useSetMobileMenuActions-BqSMJ-xa.js"])))=>i.map(i=>d[i]);
import{d,cH as C,r as s,T as h,g as E,j as b,F as I,G as k}from"./index-Bd9916Am.js";import{I as g,R as Y,C as M}from"./useCommissionContext-DMfkSxEI.js";import{X as w}from"./ClientDrawer-55jCGlAN.js";import"./PhoneInput-Uk4Fy4k3.js";import"./AnimatedModal-B0Wu-A-O.js";import"./index-N5o1yZfs.js";import"./useVariants-CcaHcr-K.js";import"./useMutation-BrMwTcyD.js";import"./index-pPH-OUeJ.js";import"./Overflow-BeweU6Wq.js";import"./openLink-DL3a6Hh-.js";import"./index-UewmsNya.js";import"./index-VnBECc_f.js";const S=()=>{const e=d(t=>t.current_user.permissions),a=d(t=>t.current_user.employee_id);return e.is_admin?g:{...g,filters:{...g.filters,employee_id:a}}},q=E`
  query CommissionsListEmployeeFeeConfig ($employee_id: ID) {
    employee(id: $employee_id, active: true) {
      id
      name
      avatar_url: large_thumb_url
      has_commission
      employee_fee_config {
        id fee_payer discount_payer open_sales filter_date_by product_consumed_price_by discount_consumed_products_on
        considers_additional_cost show_total_gross_value
      }
      asaas_bank_account {
        id holder_name pix_key pix_key_type
      }
    }
  }
`,D=e=>{const a=C(),t=s.useRef({}),[_,r]=s.useState(!1),i=s.useCallback(async m=>{t.current={employee_id:m},_&&r(!1),e({type:"reset_data"}),e({type:"set_employee_loading",payload:!0});try{const{data:o}=await a.query({query:q,variables:t.current,fetchPolicy:"network-only"});e({type:"set_employee",payload:o.employee})}catch(o){r(!0),h.captureException(o),console.error(o)}finally{e({type:"set_employee_loading",payload:!1})}},[a,e,_]),c=s.useCallback(async()=>{t.current&&await i(t.current.employee_id)},[i]);return s.useMemo(()=>[i,c,_],[i,c,_])},R=E`
  fragment inventory_sale_items_fields on SaleItem {
    id
    quantity
    inventory_sale_id
    value_cents
    sum_cents
    kind_points
    commission_sale_item_discount

    inventory_product {
      id
      description
    }

    inventory_package_item {
      id
      quantity
      value_cents
      sum_cents
    }

    inventory_sale_composes {
      id
      quantity
      unit_quantity
      extra_quantity
      inventory_product_cost_price_cents
      inventory_product_employee_price_cents
      inventory_product_sale_price_cents

      total_inventory_product_cost_price_cents
      total_inventory_product_employee_price_cents
      total_inventory_product_sale_price_cents

      inventory_product { id description }
    }
  }

  fragment finance_commission_items_fields on CommissionItem {
    id
    employee_product_commission_percentage
    product_commission_percentage
    available_value
    paid_value
    blocked_value
    total_value
    considered_commission_percentage
    employee_commission_mode
    accumulated_rate
    proportional_tax_rate
    total_taxes_value
    from_package_item
    from_offers_item
    from_subscription_item
    first_payment_realized
    discounted_for_assistants_sum
    discounted_for_products_sum
    considers_additional_cost
    additional_cost_price
    sale_item_gross_value
    commission_base_value
    assistant_commission_type
    assistant_commission_value

    inventory_sale {
      id
      code
      date
      schedule_group_id
      client {
        id
        name
        avatar_url: large_thumb_url
      }
    }

    inventory_sale_item { ...inventory_sale_items_fields }

    item_sale_assistant {
      id
      commission_percentage
      discount_assistant_commission_from
      calculate_assistant_commission_on
      inventory_sale_item { ...inventory_sale_items_fields }
    }
  }

  query CommissionItemsQuery(
    $employee_id: ID,
    $start_date: String,
    $end_date: String,
    $previous_end_date: String,
    $search_previous: Boolean!
  ) {
    finance_commission_items(
      employee_id: $employee_id,
      end_date: $end_date,
      start_date: $start_date,
      only_with_available_value: true
    ) {
      ...finance_commission_items_fields
    }

    previous_commission_items: finance_commission_items(
      employee_id: $employee_id,
      end_date: $previous_end_date,
      only_with_available_value: true
    ) @include(if: $search_previous) {
      ...finance_commission_items_fields
    }

    advances(
      employee_id: $employee_id,
      end_date: $end_date,
      start_date: $start_date,
      discounted: false,
      source: "commission"
    ) {
      id
      date
      note
      value_cents
    }

    all_bonifications(
      employee_id: $employee_id,
      end_date: $end_date,
      start_date: $start_date,
      without_payment: true
    ) {
      all {
        id
        created_at
        value_cents
        note
        origin_id
      }
    }
  }
`,F=e=>{const a=C(),[t,_]=s.useState(!1),r=s.useRef(),i=s.useCallback(async m=>{r.current=m,t&&_(!1),e({type:"set_commissions_loading",payload:!0}),e({type:"set_show_tables",payload:!0}),e({type:"set_commissions",payload:{commission_items:[],advances:[],bonifications:[]}});try{const{data:o}=await a.query({query:R,variables:r.current,fetchPolicy:"network-only"}),{advances:l,finance_commission_items:u,previous_commission_items:p=[],all_bonifications:y}=o,f=[...u,...p],v={advances:l,commission_items:f,bonifications:y.all};e({type:"set_commissions",payload:v})}catch(o){_(!0),h.captureException(o),console.error(o)}finally{e({type:"set_commissions_loading",payload:!1})}},[a,e,t]),c=s.useCallback(async()=>{r.current&&i(r.current)},[i]);return s.useMemo(()=>[i,c,t],[i,c,t])},P=s.lazy(()=>I(()=>k(()=>import("./CommissionItems-bXGYsvDD.js"),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40])))),T=s.lazy(()=>I(()=>k(()=>import("./CommissionItems-BQdQRIVr.js"),__vite__mapDeps([41,1,2,24,4,5,6,7,8,9,10,11,12,13,14,15,16,25,42,3,43,17,19,20,21,22,23,44,33,39,38,26,27,28,29,30,40])))),$=()=>{const e=S(),[a,t]=s.useReducer(Y,e),_=d(n=>n.current_user.features),r=d(n=>n.is_agendapro),i=d(n=>n.is_webook),[c,m,o]=D(t),[l,u,p]=F(t),y=i||r?!0:_.has_commissions,f=async n=>{await c(n);const x={employee_id:n,start_date:e.filters.start_date.format("YYYY-MM-DD"),end_date:e.filters.end_date.format("YYYY-MM-DD"),previous_end_date:e.filters.start_date.subtract(1,"day").format("YYYY-MM-DD"),search_previous:e.filters.search_previous};l(x)};s.useEffect(()=>{const n=e.filters.employee_id;!n||!y||f(n)},[]);const v=s.useMemo(()=>({...a,dispatch:t,fetchCommissions:l,fetchFeeConfig:c,refetchFeeConfig:m,refetchCommissions:u,fee_config_error:o,commissions_has_error:p}),[p,o,l,c,u,m,a]);return b.jsx(M.Provider,{value:v,children:b.jsx(w,{Desktop:P,Mobile:T})})};$.displayName="CommissionItems";const X=s.memo($);export{X as default};
//# sourceMappingURL=CommissionItems-wIDxPCh4.js.map
