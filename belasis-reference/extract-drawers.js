const { chromium } = require('playwright');
const fs=require('fs'); const REF=process.env.REF; const STATE=REF+'/state.json';
// paginas de lista com "Novo" + detalhe + filtro
const TARGETS=[['sales','/sales'],['packages','/packages'],['package-templates','/package-templates'],['clients','/clients'],['services','/services'],['products','/products'],['vendors','/vendors'],['purchases','/purchases'],['brands','/brands'],['employees','/employees'],['finance-transactions','/finance/transactions'],['finance-accounts','/finance/accounts'],['finance-cash','/finance/cash-accounting'],['promotions','/promotions'],['cashback','/cashback'],['goals','/goals'],['subscriptions','/customer/subscriptions'],['reviews','/reviews']];
const isNPS=(t)=>/indicar o sistema|InMoment|probabilidade de voc|Muito improv/i.test(t||'');
async function dismiss(page){
  await page.keyboard.press('Escape').catch(()=>{});
  for(const sel of ['text=/^descartar$/i','[aria-label="Close"]','[aria-label*="fechar" i]','.ant-modal-close','.ant-drawer-close']){
    const els=await page.locator(sel).all().catch(()=>[]);
    for(const e of els){ const box=await e.boundingBox().catch(()=>null); if(box){ const html=await page.evaluate(el=>{const d=el.closest('[role=dialog],.ant-modal,.ant-drawer');return d?d.innerText:'';},await e.elementHandle().catch(()=>null)).catch(()=>''); if(isNPS(html)){ await e.click({timeout:500}).catch(()=>{}); } } }
  }
  // fecha iframe NPS: tenta clicar em qualquer iframe com botao de fechar
  for(const f of page.frames()){ if(/inmoment|survey|wootric/i.test(f.url())){ await f.locator('[aria-label*=close i],button:has-text("×"),.close').first().click({timeout:500}).catch(()=>{}); } }
  await page.keyboard.press('Escape').catch(()=>{});
  await page.waitForTimeout(600);
}
async function capOverlay(page){
  return await page.evaluate(()=>{
    const sels=['.ant-drawer-content-wrapper','.ant-drawer','.ant-modal','[role=dialog]','[class*=Drawer]','[class*=Modal]'];
    let best=null,area=0;
    for(const s of sels){ for(const el of document.querySelectorAll(s)){ const r=el.getBoundingClientRect(); if(r.width>250&&r.height>150){ const t=el.innerText||''; if(/indicar o sistema|InMoment|Muito improv/i.test(t))continue; if(r.width*r.height>area){area=r.width*r.height;best=el;} } } }
    return best?{html:best.outerHTML,text:(best.innerText||'').slice(0,120),w:Math.round(best.getBoundingClientRect().width)}:null;
  });
}
async function main(){
  const b=await chromium.launch({headless:true,args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:1440,height:1200},locale:'pt-BR',storageState:STATE});
  const page=await ctx.newPage();
  await page.goto('https://belasis.app/sales',{waitUntil:'networkidle',timeout:45000}).catch(()=>{});
  await page.waitForTimeout(4000);
  // CSS completo de pagina carregada
  const css=await page.evaluate(()=>{let o=[];for(const s of document.styleSheets){try{for(const r of s.cssRules)o.push(r.cssText);}catch(e){}}return o.join('\n');});
  fs.writeFileSync(REF+'/_shared/styles-full.css',css); console.log('css-full:',css.length,'b');
  const idx=[];
  for(const [slug,route] of TARGETS){
    const dir=REF+'/'+slug; fs.mkdirSync(dir,{recursive:true});
    const rec={slug}; 
    try{
      await page.goto('https://belasis.app'+route,{waitUntil:'domcontentloaded',timeout:40000}); await page.waitForTimeout(4000);
      await dismiss(page);
      // NOVO -> drawer de criação
      let clicked=false;
      for(const rx of [/^\s*\+?\s*Nov[ao]\b/i,/Adicionar/i,/Criar/i,/Cadastrar/i]){ const btn=page.getByRole('button',{name:rx}).first(); if(await btn.count().catch(()=>0)){ await btn.click({timeout:3000}).catch(()=>{}); clicked=true; break; } if(!clicked){ const lnk=page.getByRole('link',{name:rx}).first(); if(await lnk.count().catch(()=>0)){ await lnk.click({timeout:3000}).catch(()=>{}); clicked=true; break; } } }
      await page.waitForTimeout(2600); await dismiss(page);
      const drawer=await capOverlay(page);
      if(drawer){ fs.writeFileSync(dir+'/drawer-novo.html',drawer.html); await page.screenshot({path:dir+'/drawer-novo.png'}); rec.novo=drawer.w+'px'; }
      else rec.novo='('+ (clicked?'sem overlay':'sem botao') +')';
      // fecha o drawer
      await page.keyboard.press('Escape').catch(()=>{}); await page.waitForTimeout(1200);
      console.log('OK',slug,'novo:',rec.novo);
    }catch(e){ rec.err=e.message.slice(0,40); console.log('ERR',slug,e.message.slice(0,40)); }
    idx.push(rec);
  }
  fs.writeFileSync(REF+'/_index-drawers.json',JSON.stringify(idx,null,2));
  console.log('=== DONE drawers:',idx.filter(x=>x.novo&&/px/.test(x.novo)).length,'/'+TARGETS.length);
  await b.close();
}
main().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
