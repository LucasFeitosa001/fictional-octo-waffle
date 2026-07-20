import{o as r}from"./useGetConsumed-BiHkhW9P.js";import{f as s,T as a,g as n}from"./index-Bd9916Am.js";const o=n`
  query ReportClientsBirthdays($start_date: String!, $end_date: String!, $status: String!) {
    clients: reports_clients_birthdays(start_date: $start_date, end_date: $end_date, status: $status) {
      id
      name
      nickname
      phone1
      phone2
      email
      birthday
    }
  }
`,p=t=>s(o,{skip:!t,fetchPolicy:"network-only",variables:t,onError:e=>{a.captureException(e),console.log({error:e}),r()}});export{p as u};
//# sourceMappingURL=useGetReportClientBirthday-ESA71bMt.js.map
