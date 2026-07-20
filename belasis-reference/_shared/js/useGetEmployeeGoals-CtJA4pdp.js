import{f as t,T as s,g as u}from"./index-Bd9916Am.js";const _=u`
  query EmployeeGoalsQuery($employee_ids: [ID!], $date: String!, $force_reload: Boolean) {
    all_goals(employee_ids: $employee_ids, date: $date, force_reload: $force_reload) {
      employee { id name small_thumb_url large_thumb_url avatar_blurhash }
      goals {
        id
        employee { id name small_thumb_url large_thumb_url avatar_blurhash }
        value
        value_type
        current_value
        pay_bonus
        bonus_value_cents

        bonification {
          id
        }

        goal_products {
          id
          inventory_product {
            id
            description
            image_url: small_thumb_url
            image_blurhash
            is_service: service
          }
        }
      }
    }
  }
`,n=({employee_ids:a,period:l,force_reload:o},r)=>t(_,{skip:!r,fetchPolicy:"network-only",variables:{employee_ids:a,date:l.format("YYYY-MM-DD"),force_reload:o},notifyOnNetworkStatusChange:!0,onError:e=>{s.captureException(e),console.log(e)}});export{n as u};
//# sourceMappingURL=useGetEmployeeGoals-CtJA4pdp.js.map
