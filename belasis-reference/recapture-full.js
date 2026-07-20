const { chromium } = require('playwright');
const fs=require('fs'); const REF=process.env.REF; const STATE=REF+'/state.json';
const ROUTES=[['wow','/wow'],['calendar','/calendar'],['sales','/sales'],['packages','/packages'],['package-templates','/package-templates'],['subscriptions','/customer/subscriptions'],['clients','/clients'],['services','/services'],['products','/products'],['vendors','/vendors'],['purchases','/purchases'],['brands','/brands'],['employees','/employees'],['finance-dashboard','/finance/dashboard'],['finance-transactions','/finance/transactions'],['finance-accounts','/finance/accounts'],['finance-cash','/finance/cash-accounting'],['reports-dre','/reports/financial/dre'],['reviews','/reviews'],['cashback','/cashback'],['goals','/goals'],['online-booking','/online-booking'],['promotions','/promotions']];
const DRAWER=new Set(['sales','packages','clients','services','products','vendors','finance-transactions','finance-accounts','promotions','brands','employees','package-templates']);
async function killOverlays(page){
  await page.evaluate(()=>{
    for(const f of document.querySelectorAll('iframe')){ if(/inmoment|survey|wootric|delighted|nps/i.test(f.src||'')) f.remove(); }
    // banner de assinatura no topo
    for(const el of document.querySelectorAll('*')){ const t=(el.textContent||''); if(t.includes('assinatura vence hoje')&&el.getBoundingClientRect&&el.getBoundingClientRect().top<80&&el.children.length<6){ el.remove(); break; } }
  }).catch(()=>{});
  await page.keyboard.press('Escape').catch(()=>{});
}
async function capOverlay(page){
  return await page.evaluate(()=>{
    let best=null,area=0;
    for(const el of document.querySelectorAll('.ant-drawer-content-wrapper,.ant-drawer,.ant-modal,[role=dialog],[class*=Drawer],[class*=Modal],[class*=drawer],[class*=modal]')){
      const r=el.getBoundingClientRect(); const t=el.innerText||'';
      if(r.width>250&&r.height>150&&!/indicar o sistema|InMoment|Muito improv|assinatura vence/i.test(t)){ if(r.width*r.height>area){area=r.width*r.height;best=el;} }
    }
    return best?{html:best.outerHTML,text:(best.innerText||'').slice(0,100),w:Math.round(best.getBoundingClientRect().width)}:null;
  });
}
async function main(){
  const b=await chromium.launch({headless:true,args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1440,height:1500},locale:'pt-BR',storageState:STATE});
  const page=await ctx.newPage();
  const idx=[];
  for(const [slug,route] of ROUTES){
    const dir=REF+'/'+slug; fs.mkdirSync(dir,{recursive:true}); const rec={slug};
    try{
      await page.goto('https://belasis.app'+route,{waitUntil:'domcontentloaded',timeout:45000});
      await page.waitForTimeout(slug==='wow'?9000:4500);
      await killOverlays(page);
      // HTML COMPLETO (body inteiro) — inclui header + content
      const full=await page.evaluate(()=>document.body.outerHTML);
      fs.writeFileSync(dir+'/full.html',full); rec.full=full.length;
      // drawer de Novo
      if(DRAWER.has(slug)){
        const btn=page.locator(':is(button,a,[role=button],div[class*=btn i],span[class*=btn i])').filter({hasText:/^\s*\+?\s*Nov[ao]\b/i}).first();
        if(await btn.count().catch(()=>0)){ await btn.click({timeout:3000,force:true}).catch(()=>{}); await page.waitForTimeout(2600); await killOverlays(page);
          const d=await capOverlay(page); if(d){ fs.writeFileSync(dir+'/drawer-novo.html',d.html); await page.screenshot({path:dir+'/drawer-novo.png'}); rec.drawer=d.w+'px'; } else rec.drawer='no-overlay'; }
        else rec.drawer='no-btn';
        await page.keyboard.press('Escape').catch(()=>{});
      }
      console.log(slug,'full:'+rec.full+'b','drawer:'+(rec.drawer||'-'));
    }catch(e){ rec.err=e.message.slice(0,40); console.log('ERR',slug,e.message.slice(0,40)); }
    idx.push(rec);
  }
  fs.writeFileSync(REF+'/_index-full.json',JSON.stringify(idx,null,2));
  console.log('=== DONE full:'+idx.filter(x=>x.full).length+' · drawers:'+idx.filter(x=>x.drawer&&/px/.test(x.drawer||'')).length);
  await b.close();
}
main().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
