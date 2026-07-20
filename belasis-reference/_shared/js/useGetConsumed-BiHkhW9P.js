import{t as s,f as o,T as r,g as n}from"./index-Bd9916Am.js";import{A as i}from"./AnimatedModal-B0Wu-A-O.js";const a=e=>{i.error({className:"webook-modal",title:s("reports.report_loading_error"),content:s("phrases.try_again_contact_if_error_persists"),okText:s("phrases.try_again"),closable:!0,useConfirm:!0,maskClosable:!1,cancelText:s("verbs.close"),onOk:()=>window.location.reload(),onCancel:()=>window.close(),...e})},c=n`
  query ReportInventoryPurchaseSuggestion($status: String!, $results: Int, $groups: [String!], $brands: [String!]) {
    products: reports_inventory_suggestion(status: $status, results: $results, groups: $groups, brands: $brands) {
      id
      description
      stock_minimum
      quantity
      difference
      name_group
      name_brand
    }
  }
`,_=e=>o(c,{fetchPolicy:"network-only",variables:e,onError:t=>{r.captureException(t),console.log({error:t}),a()}}),d=n`
  query ReportInventoryConsumed(
    $start_date: String!,
    $end_date: String!,
    $cost_considered: String!,
    $results: Int,
    $client_ids: [String!],
    $product_ids: [String!],
    $employee_ids: [String!]
  ) {
    products_consumed: reports_inventory_products_consumed(
      start_date: $start_date,
      end_date: $end_date,
      cost_considered: $cost_considered,
      results: $results,
      client_ids: $client_ids,
      product_ids: $product_ids,
      employee_ids: $employee_ids
    ) {
      products {
        quantity
        unit_quantity
        extra_quantity
        product_unit
        sale_id
        sale_code
        sale_date
        description
        employee_name
        client_id
        client_name
        client_phone
        total_cents
        value
        batch_number
      }

      total_cents

      filters
    }
  }
`,p=e=>o(d,{fetchPolicy:"network-only",variables:e,onError:t=>{r.captureException(t),console.log({error:t}),a()}});export{p as a,a as o,_ as u};
//# sourceMappingURL=useGetConsumed-BiHkhW9P.js.map
