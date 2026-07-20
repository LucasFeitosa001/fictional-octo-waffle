const { chromium, devices } = require('playwright');
const fs=require('fs'); const REF=process.env.REF; const STATE=REF+'/state.json';
const CRED=JSON.parse(fs.readFileSync(REF+'/cred.json','utf8'));
fs.mkdirSync(REF+'/_shared',{recursive:true});
const ROUTES=[['wow','/wow'],['calendar','/calendar'],['sales','/sales'],['packages','/packages'],['package-templates','/package-templates'],['subscriptions','/customer/subscriptions'],['clients','/clients'],['anamnesis','/anamnesis'],['services','/services'],['products','/products'],['vendors','/vendors'],['purchases','/purchases'],['brands','/brands'],['document-templates','/document-templates'],['employees','/employees'],['groups','/groups'],['finance-dashboard','/finance/dashboard'],['finance-transactions','/finance/transactions'],['finance-accounts','/finance/accounts'],['finance-cash','/finance/cash-accounting'],['finance-cash-history','/finance/cash-accounting/history'],['invoices','/invoices/invoice'],['reports-dre','/reports/financial/dre'],['reports-favorites','/reports/favorites'],['reviews','/reviews'],['cashback','/cashback'],['goals','/goals'],['online-booking','/online-booking'],['promotions','/promotions']];
async function grab(page,slug,route,view){
  const dir=REF+'/'+slug; fs.mkdirSync(dir,{recursive:true});
  await page.goto('https://belasis.app'+route,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(slug==='wow'?9000:4500);
  const html= view==='desktop'
    ? await page.evaluate(()=>{const c=[...document.querySelectorAll('div,main,section')].filter(e=>{const r=e.getBoundingClientRect();return r.left>=228&&r.width>900&&r.height>150;});c.sort((a,b)=>b.getBoundingClientRect().width*b.getBoundingClientRect().height-a.getBoundingClientRect().width*a.getBoundingClientRect().height);return (c[0]||document.body).outerHTML;})
    : await page.evaluate(()=>document.body.outerHTML);
  fs.writeFileSync(dir+'/'+(view==='desktop'?'main.html':'mobile.html'),html);
  await page.screenshot({path:dir+'/'+(view==='desktop'?'shot.png':'mobile.png')});
  if(view==='desktop'){const t=await page.evaluate(()=>{const c=[...document.querySelectorAll('div,main')].filter(e=>e.getBoundingClientRect().left>=228).sort((a,b)=>b.getBoundingClientRect().height-a.getBoundingClientRect().height)[0]||document.body;return (c.innerText||'').slice(0,1200);});fs.writeFileSync(dir+'/text.txt',t);}
  return html.length;
}
async function main(){
  const b=await chromium.launch({headless:true,args:['--no-sandbox']});
  // DESKTOP + login
  const dctx=await b.newContext({viewport:{width:1440,height:1400},locale:'pt-BR'});
  const dp=await dctx.newPage();
  await dp.goto('https://belasis.app/login',{waitUntil:'domcontentloaded',timeout:60000}).catch(()=>{});
  await dp.waitForTimeout(2500);
  await dp.fill('#email,input[type=email]',CRED.email).catch(()=>{});
  await dp.fill('#password,input[type=password]',CRED.pass).catch(()=>{});
  await dp.getByRole('button',{name:/entrar/i}).first().click().catch(()=>dp.keyboard.press('Enter'));
  await dp.waitForTimeout(8000); await dctx.storageState({path:STATE});
  console.log('login →', dp.url());
  const css=await dp.evaluate(()=>{let o=[];for(const s of document.styleSheets){try{for(const r of s.cssRules)o.push(r.cssText);}catch(e){}}return o.join('\n');});
  fs.writeFileSync(REF+'/_shared/styles.css',css); console.log('css:',css.length,'b');
  const idx=[];
  for(const [slug,route] of ROUTES){ try{ const n=await grab(dp,slug,route,'desktop'); idx.push({slug,desktop:n}); console.log('D',slug,n+'b',/login/.test(dp.url())?'[LOGIN!]':''); }catch(e){ idx.push({slug,derr:e.message.slice(0,40)}); console.log('D-ERR',slug,e.message.slice(0,40)); } }
  await dctx.close();
  // MOBILE
  const mctx=await b.newContext({...devices['iPhone 13'],locale:'pt-BR',storageState:STATE});
  const mp=await mctx.newPage(); await mp.goto('https://belasis.app/wow',{waitUntil:'domcontentloaded'}).catch(()=>{}); await mp.waitForTimeout(3000);
  for(const [slug,route] of ROUTES){ try{ const n=await grab(mp,slug,route,'mobile'); const e=idx.find(x=>x.slug===slug); if(e)e.mobile=n; console.log('M',slug,n+'b'); }catch(e){ console.log('M-ERR',slug,e.message.slice(0,40)); } }
  fs.writeFileSync(REF+'/_index.json',JSON.stringify(idx,null,2));
  console.log('=== DONE:',idx.length,'páginas · css',css.length,'b');
  await b.close();
}
main().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
