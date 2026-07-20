import{t as o,e as l,f as P,g as B}from"./index-Bd9916Am.js";import{p as I}from"./PhoneInput-Uk4Fy4k3.js";import{a as N}from"./helpers-BfSAkm32.js";import{g as T,c as j}from"./commissionColumns-Bvau0eIu.js";const E=({employee_name:c,item_payments:i,advance_payments:y,bonification_payments:g,totals:_,show_total_gross_value:r,start_date_filter:m,end_date_filter:v})=>{const $=T(i),s={date:o("words.date"),code:o("words.code"),client:o("words.client"),service_qty:`${o("words.service")} (${o("words.quantity")})`,unit_value:o("phrases.unit_value"),gross_value:o("words.gross_value"),tax:`${o("finance.commissions.accumulated_fee")}`,assistants:o("words.assistant_other"),consumed:o("words.consumed_product_other"),total_paid:o("phrases.total_paid")},q=i.map(a=>({[s.date]:l(a.sale_date).format("L"),[s.code]:a.sale_code,[s.client]:a.client_name,[s.service_qty]:`${a.product_description} (${a.sale_item_quantity}x)`,[s.unit_value]:a.sale_item_unit_value,...r?{[s.gross_value]:a.commission_base_value}:{},[s.tax]:`${a.proportional_tax_rate} (${I(a.accumulated_rate,{precision:2,symbol_position:"right"})})`,...j(a,$),[s.assistants]:a.assistant_total_discount,[s.consumed]:a.consumed_products_total,[s.total_paid]:a.paid_value})),x={[s.date]:o("words.total"),...r?{[s.gross_value]:i.reduce((a,e)=>a+e.commission_base_value,0)}:{},[s.assistants]:i.reduce((a,e)=>a+e.assistant_total_discount,0),[s.consumed]:i.reduce((a,e)=>a+e.consumed_products_total,0),[s.total_paid]:_.commission_items_total_value},n={service:o("words.service"),product:o("words.consumed_product"),qty:o("words.quantity"),unit_qty:o("phrases.consumption_unit"),extra:o("words.extra"),unit_value:o("phrases.unit_value"),value:o("words.value")},p=i.flatMap(a=>a.consumed_products.map(e=>{var f,h;return{[n.service]:a.product_description,[n.product]:e.product_description,[n.qty]:e.quantity,[n.unit_qty]:`${e.unit_quantity} (${(f=e.product_measurement_unit)==null?void 0:f.toLocaleLowerCase()})`,[n.extra]:`${e.extra_quantity} (${(h=e.product_measurement_unit)==null?void 0:h.toLocaleLowerCase()})`,[n.unit_value]:e.product_value,[n.value]:e.product_total}})),L={[n.service]:o("words.total"),[n.value]:i.reduce((a,e)=>a+e.consumed_products_total,0)},d={date:o("words.date"),obs:o("words.observation"),value:o("words.value")},w=y.map(a=>({[d.date]:l(a.advance_date).format("L"),[d.obs]:a.advance_note,[d.value]:a.advance_value})),C={[d.date]:o("words.total"),[d.value]:_.advances_total_value},u={date:o("words.date"),obs:o("words.observation"),value:o("words.value")},b=g.map(a=>({[u.date]:l(a.bonification_date).format("L"),[u.obs]:a.bonification_note,[u.value]:a.bonification_value})),S={[u.date]:o("words.total"),[u.value]:_.bonifications_total_value},t={label:o("words.employee"),value:c},M=[...m&&v?[{[t.label]:o("words.date"),[t.value]:`${l(m).format("LL")} ${o("words.until")} ${l(v).format("LL")}`}]:[],{},...r?[{[t.label]:o("words.gross_value"),[t.value]:i.reduce((a,e)=>a+e.commission_base_value,0)}]:[],{[t.label]:o("words.commission_other"),[t.value]:_.commission_items_total_value},{[t.label]:o("words.assistant_other"),[t.value]:i.reduce((a,e)=>a+e.assistant_total_discount,0)},{[t.label]:o("words.consumed_product_other"),[t.value]:i.reduce((a,e)=>a+e.consumed_products_total,0)},{[t.label]:o("words.advance_other"),[t.value]:_.advances_total_value},{[t.label]:o("words.bonification_other"),[t.value]:_.bonifications_total_value},{[t.label]:o("words.total"),[t.value]:_.total_paid_value}];N({sheets:[{name:o("words.summary"),values:M},{name:o("words.commission_other"),values:[...q,x]},...p.length>0?[{name:o("words.consumed_product_other"),values:[...p,L]}]:[],...w.length>0?[{name:o("words.advance_other"),values:[...w,C]}]:[],...b.length>0?[{name:o("words.bonification_other"),values:[...b,S]}]:[]],title:`${o("finance.commissions.payment_commission")}-${c}-${o("words.complete")}`,closable:!1})},k=B`
  query BatchPaymentDrawer($id: ID!) {
    current_salon {
      id
      name
      employee_fee_config {
        id commission_message_received
      }
    }

    commissions_batch_payment(id: $id) {
      id
      advances_total_value
      bonifications_total_value
      commission_items_total_value
      total_paid_value
      start_date_filter
      end_date_filter

      employee {
        id
        name
        cpf_cnpj
        employee_fee_config {
          id commission_message_received
        }
      }

      conditions {
        id
        considers_taxes
        considers_value_with_discount
        considers_additional_cost
        discount_consumed_products_on
        show_total_gross_value
      }

      advance_payments {
        id
        advance_date
        advance_note
        advance_value
      }

      bonification_payments {
        id
        bonification_date
        bonification_note
        bonification_value
      }

      item_payments {
        id
        sale_date
        sale_code
        client_name
        product_id
        product_description
        sale_item_quantity
        sale_item_unit_value
        sale_item_gross_value
        commission_base_value
        proportional_discount
        additional_cost_price
        considered_commission_percentage
        assistant_commission_type
        assistant_commission_value
        accumulated_rate
        proportional_tax_rate
        paid_value
        assistant_total_discount
        total_sale_value
        total_taxes_value
        consumed_products_total

        consumed_products {
          id
          quantity
          extra_quantity
          unit_quantity
          product_description
          product_value
          product_measurement_unit
          product_total
        }
      }

      digital_signature {
        id
        image_url
        created_at
      }
    }
  }
`,F=c=>P(k,{skip:!c,fetchPolicy:"network-only",variables:{id:c}});export{k as C,E as e,F as u};
//# sourceMappingURL=useGetBatchPayment-Crg4qJMa.js.map
