import{t as a,e as d,f as x,g as L}from"./index-Bd9916Am.js";import{p as C}from"./PhoneInput-Uk4Fy4k3.js";import{a as S}from"./helpers-BfSAkm32.js";import{g as P,c as B}from"./commissionColumns-Bvau0eIu.js";const k=({employee_name:c,group_item_payments:i,advance_payments:b,bonification_payments:f,totals:n,show_total_gross_value:r,start_date_filter:u,end_date_filter:m})=>{const w=P(i),s={service:a("words.service"),qty:a("words.quantity"),gross_value:a("words.gross_value"),tax:`${a("finance.commissions.accumulated_fee")}`,assistants:a("words.assistant_other"),consumed:a("words.consumed_product_other"),total_paid:a("phrases.total_paid")},y=i.map(o=>({[s.service]:o.product_description,[s.qty]:o.sale_item_quantity,...r?{[s.gross_value]:o.commission_base_value}:{},[s.tax]:`${o.proportional_tax_rate} (${C(o.accumulated_rate,{precision:2,symbol_position:"right"})})`,...B(o,w),[s.assistants]:o.assistant_total_discount,[s.consumed]:o.consumed_products_total,[s.total_paid]:o.paid_value})),h={[s.service]:a("words.total"),[s.qty]:i.reduce((o,t)=>o+t.sale_item_quantity,0),...r?{[s.gross_value]:i.reduce((o,t)=>o+t.commission_base_value,0)}:{},[s.assistants]:i.reduce((o,t)=>o+t.assistant_total_discount,0),[s.consumed]:i.reduce((o,t)=>o+t.consumed_products_total,0),[s.total_paid]:n.commission_items_total_value},_={date:a("words.date"),obs:a("words.observation"),value:a("words.value")},v=b.map(o=>({[_.date]:d(o.advance_date).format("L"),[_.obs]:o.advance_note,[_.value]:o.advance_value})),g={[_.date]:a("words.total"),[_.value]:n.advances_total_value},l={date:a("words.date"),obs:a("words.observation"),value:a("words.value")},p=f.map(o=>({[l.date]:d(o.bonification_date).format("L"),[l.obs]:o.bonification_note,[l.value]:o.bonification_value})),$={[l.date]:a("words.total"),[l.value]:n.bonifications_total_value},e={label:a("words.employee"),value:c},q=[...u&&m?[{[e.label]:a("words.date"),[e.value]:`${d(u).format("LL")} ${a("words.until")} ${d(m).format("LL")}`}]:[],{},...r?[{[e.label]:a("words.gross_value"),[e.value]:i.reduce((o,t)=>o+t.commission_base_value,0)}]:[],{[e.label]:a("words.commission_other"),[e.value]:n.commission_items_total_value},{[e.label]:a("words.advance_other"),[e.value]:n.advances_total_value},{[e.label]:a("words.bonification_other"),[e.value]:n.bonifications_total_value},{[e.label]:a("words.total"),[e.value]:n.total_paid_value}];S({sheets:[{name:a("words.summary"),values:q},{name:a("words.commission_other"),values:[...y,h]},...v.length>0?[{name:a("words.advance_other"),values:[...v,g]}]:[],...p.length>0?[{name:a("words.bonification_other"),values:[...p,$]}]:[]],title:`${a("finance.commissions.payment_commission")}-${c}-${a("words.summary")}`,closable:!1})},I=L`
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

      group_item_payments {
        id
        product_description
        considered_commission_percentage
        assistant_commission_type
        assistant_commission_value
        accumulated_rate
        proportional_tax_rate
        total_taxes_value
        sale_item_quantity
        sale_item_gross_value
        commission_base_value
        proportional_discount
        additional_cost_price
        paid_value
        consumed_products_total
        assistant_total_discount
      }

      digital_signature {
        id
        image_url
        created_at
      }
    }
  }
`,A=c=>x(I,{skip:!c,fetchPolicy:"network-only",variables:{id:c}});export{I as C,k as e,A as u};
//# sourceMappingURL=useGetBatchPayment-9DPsG23f.js.map
