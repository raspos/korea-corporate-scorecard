import {isNumber, scoreOf, filterCompanies, sortCompanies, pageCompanies, assetSizeGroup, assetSizeLabel, escapeHtml as h, makeCsv} from './ui-core.mjs?v=20261023size1';
import {createImprovementUI} from './improvement-ui.mjs?v=20261023momentum2';

const $ = id => document.getElementById(id);
const nf = new Intl.NumberFormat('ko-KR');
const state = {data:null, companies:[], byId:new Map(), view:'overview', page:1, pageSize:25, sort:'overall', direction:'desc', market:'all', compare:[], detail:null, insight:'debt'};
const improvementUI = createImprovementUI();
const labels = {overall:'종합 참고점수',growth:'성장성',profitability:'수익성',stability:'재무안정성',cashflow:'현금창출',improvement:'경영개선'};
const qualityLabels = {VERIFIED:'원문 검증',PARTIALLY_VERIFIED:'산식 검증',NEEDS_REVIEW:'검토 필요',INSUFFICIENT_DATA:'자료 부족'};
const colors = ['#167564','#e6a34b','#557bc1','#986ba8','#c76762','#6d8d57','#9c7b55'];
const number = (n,d=1) => isNumber(n) ? n.toLocaleString('ko-KR',{maximumFractionDigits:d,minimumFractionDigits:d}) : '—';
const signed = n => isNumber(n) ? `${n>0?'+':''}${number(n)}` : '—';
const money = n => !isNumber(n) ? '—' : Math.abs(n)>=1e12 ? `${number(n/1e12,2)}조` : `${number(n/1e8,0)}억`;
const metric = (c,key) => c.metrics?.[key] ?? null;
const score = (c,key='overall') => number(scoreOf(c,key));
const issues = c => (c.quality?.issues || []).map(x=>typeof x==='string'?x:x.message||x.reason||JSON.stringify(x));
const current = c => c.isCurrentListed ?? ['코스피','코스닥','코넥스'].includes(c.market);
const hasData = c => c.series?.some(s=>isNumber(s.assets)||isNumber(s.revenue));
const coverage = c => c.scores?.coverage ?? 0;
const html = (id,value) => {if($(id)) $(id).innerHTML=value;};
const text = (id,value) => {if($(id)) $(id).textContent=value;};
const badge = c => `<span class="badge market-badge">${h(c.market || '시장 미확인')}</span>`;
const companyButton = c => `<button class="company-link" data-company="${h(c.id)}">${h(c.name)}</button><span class="ticker">${h(c.ticker || c.id)}</span>`;
const qualityBadge = c => `<span class="badge quality-${h(c.quality?.status || 'INSUFFICIENT_DATA')}">${qualityLabels[c.quality?.status]||'자료 부족'}</span>`;

function toast(message) {
  text('toast',message); $('toast')?.classList.add('show'); clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>$('toast')?.classList.remove('show'),3000);
}

function showView(view, updateHash=true) {
  if(!['overview','improvement','fsi','turnaround','map','rankings','insights','compare','methodology','validation','data'].includes(view)) view='overview';
  state.view=view;
  text('current-view-title',({overview:'종합 현황',improvement:'모멘텀 랭킹',fsi:'재무체력 지수',turnaround:'턴어라운드',map:'기업 모멘텀 지도',rankings:'기존 참고평가',insights:'모멘텀 탐색',compare:'기업 맞대결',methodology:'평가방법론',validation:'모형 검증',data:'수집·품질 현황'})[view]);
  document.querySelectorAll('[id^="view-"]').forEach(el=>{el.hidden=el.id!==`view-${view}`;});
  document.querySelectorAll('[data-view]').forEach(el=>{
    const active=el.dataset.view===view; el.classList.toggle('active',active); el.classList.toggle('is-active',active);
    if(el.closest('nav')) {if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');}
  });
  if(updateHash)history.replaceState(null,'',`#${view}`);
  if(view==='rankings')renderRankings(); if(view==='compare')renderComparison();
  if(view==='insights')renderInsights(); if(view==='data')renderData();
  improvementUI.renderView(view);
  if(state.data) {
    const legacy=['rankings','insights','compare','data'].includes(view);
    text('data-status',legacy?'OpenDART · 잠정 참고평가':'OpenDART · 원문 검증 전');
    text('data-date',legacy?'2024 대비 2025':view==='fsi'?'2025':'2022~2025');
    const periodLabel=document.querySelector('label[for="year-select"]');
    if(periodLabel?.firstChild)periodLabel.firstChild.nodeValue=legacy?'비교기간':view==='fsi'?'평가기준연도':'3년 평가기간';
    if($('year-select')?.options[0])$('year-select').options[0].textContent=legacy?'2024 대비 2025':view==='fsi'?'2025 (원문 검증 전)':'2022~2025 (자료 검증 중)';
  }
  window.scrollTo({top:0,behavior:'instant'});
}

async function loadData() {
  $('load-state')?.removeAttribute('hidden');
  try {
    const response=await fetch(`./dashboard_data.json?v=${Date.now()}`,{cache:'no-store'});
    if(!response.ok)throw new Error(`자료 파일 응답 ${response.status}`);
    const data=await response.json(); if(!Array.isArray(data.companies))throw new Error('자료 형식을 확인할 수 없습니다.');
    state.data=data;state.companies=data.companies;state.byId=new Map(data.companies.map(c=>[c.id,c]));
    $('load-state')?.setAttribute('hidden','');text('data-status','OpenDART · 잠정 참고평가');text('data-date',`${data.metadata?.baselineYear||2024} 대비 ${data.metadata?.year||2025}`);
    populateFilters();renderMethodology();renderData();renderInsights();renderRankings();
    try {await improvementUI.load();} catch(error) {html('kpi-grid',`<p class="notice">3년 평가자료를 불러오지 못했습니다: ${h(error.message)}</p>`);}
    showView(location.hash.slice(1)||'overview',false);
  } catch(error) {
    text('data-status','데이터 확인 필요');
    html('load-state',`<div class="empty-state"><h2>평가 자료를 불러오지 못했습니다</h2><p>${h(error.message)}</p><button class="button primary" id="retry-load">다시 불러오기</button></div>`);
    $('retry-load')?.addEventListener('click',loadData);
  }
}

function populateFilters() {
  html('market-filter','<option value="all">전체 시장</option><option>코스피</option><option>코스닥</option><option>코넥스</option>');
  document.querySelectorAll('[data-ranking="cash"],[data-sort="cash"]').forEach(el=>{if(el.dataset.ranking)el.dataset.ranking='cashflow';if(el.dataset.sort)el.dataset.sort='cashflow';});
  for(const [id,key,title] of [['industry-filter','industry','전체 산업']]) {
    const values=[...new Set(state.companies.filter(current).map(c=>c[key]).filter(Boolean))];
    values.sort((a,b)=>a.localeCompare(b,'ko'));
    html(id,`<option value="all">${title}</option>`+values.map(v=>`<option>${h(v)}</option>`).join(''));
  }
  html('size-filter','<option value="all">전체 규모</option><option value="대">대규모 · 2조원 이상</option><option value="중">중규모 · 5,000억~2조원</option><option value="소">소규모 · 5,000억원 미만</option>');
  html('quality-filter','<option value="all">전체 품질</option>'+Object.entries(qualityLabels).map(([k,v])=>`<option value="${k}">${v}</option>`).join(''));
  html('ranking-type',Object.entries(labels).map(([k,v])=>`<option value="${k}">${v}</option>`).join(''));
  html('insight-select',Object.entries(lenses).map(([k,v])=>`<option value="${k}">${v.title}</option>`).join(''));
  if(!$('export-xlsx')) {
    const anchor=document.createElement('a');anchor.id='export-xlsx';anchor.className='button button-secondary';
    anchor.href='./dashboard_export.xlsx';anchor.download='기업성적표_2025_참고평가.xlsx';anchor.textContent='전체 자료 Excel';
    $('export-csv')?.insertAdjacentElement('afterend',anchor);
  }
}

function renderOverview() {
  const listed=state.companies.filter(current),evaluated=listed.filter(c=>isNumber(scoreOf(c)));
  const winner=sortCompanies(evaluated)[0],improved=sortCompanies(evaluated,'improvement').find(c=>isNumber(scoreOf(c,'improvement')));
  const kpis=[['시장 확인 법인',nf.format(listed.length),'DART 기업개황 Y · K · N'],['재무 원자료 확보',nf.format(state.data.metadata.currentListedCollected??listed.filter(hasData).length),'현재 상장 분류 법인 기준'],['참고평가 가능',nf.format(evaluated.length),'자료 충족 기업만 잠정 산출'],['종합 참고점수 1위',winner?.name||'산출 전',winner?`${score(winner)}점 · 지표 충족 ${number(coverage(winner),0)}%`:'충족 기업 없음'],['경영개선 참고 1위',improved?.name||'자료 수집 중',improved?`${score(improved,'improvement')}점 · 확보 지표 기준`:'2024·2025 지표 확인 필요']];
  html('kpi-grid',kpis.map(([label,value,note],i)=>`<article class="kpi-card ${i===2?'accent':''}"><span class="kpi-label">${label}</span><strong class="${i>2?'kpi-company':''}">${h(value)}</strong><small>${h(note)}</small></article>`).join(''));
  const marketCounts=['코스피','코스닥','코넥스'].map(m=>`${m} ${nf.format(listed.filter(c=>c.market===m).length)}`).join(' · ');
  html('coverage-summary',`<div class="coverage-top"><strong>수집 범위를 먼저 확인하세요</strong><span>${h(marketCounts)}</span></div><p>${nf.format(state.companies.length)}개 후보 법인을 보존하고 있습니다. 모든 성장·개선 지표는 2024년 대비 2025년 연간 실적으로 계산합니다. 2022년 자료는 기본평가에 필요하지 않습니다. 전체 상장사 공식 순위가 아닙니다.</p><button class="text-button" data-view="data">수집 현황과 제외 사유 보기 →</button>`);
  renderOverviewRanking();renderScatter();renderStoryCards();
}

function renderOverviewRanking() {
  const list=sortCompanies(state.companies.filter(c=>current(c)&&(state.market==='all'||c.market===state.market)&&isNumber(scoreOf(c)))).slice(0,10);
  html('overview-ranking',list.map((c,i)=>`<tr><td class="rank-cell">${String(i+1).padStart(2,'0')}</td><td>${companyButton(c)}</td><td>${badge(c)}</td><td class="score-cell">${score(c)}</td><td><span class="small-muted">${number(coverage(c),0)}%</span></td><td><button class="icon-button" data-add-compare="${h(c.id)}" aria-label="${h(c.name)} 비교에 추가">＋</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty-state">이 시장에 평가 가능한 기업이 없습니다.</td></tr>');
  text('overview-top100','전체 기업 순위 보기 →');
}

function renderScatter() {
  const list=state.companies.filter(c=>current(c)&&isNumber(scoreOf(c))&&isNumber(scoreOf(c,'improvement')));
  if(!list.length){html('scatter-chart','<div class="empty-state">개선 지표를 확보하면 지도가 표시됩니다.</div>');return;}
  const w=690,ht=330,l=48,r=18,t=20,b=46,pw=w-l-r,ph=ht-t-b;
  const industries=[...new Set(list.map(c=>c.industry))].sort();
  const legend=document.querySelector('.landscape-panel .chart-legend');
  if(legend)legend.innerHTML=industries.slice(0,5).map((name,i)=>`<span><i style="background:${colors[i%colors.length]}"></i>${h(name||'산업 미확인')}</span>`).join('')+(industries.length>5?'<span>외 산업군</span>':'');
  const grid=[0,25,50,75,100].map(v=>`<line x1="${l}" y1="${ht-b-v/100*ph}" x2="${w-r}" y2="${ht-b-v/100*ph}" stroke="#e3e9e8"/><text x="${l-10}" y="${ht-b-v/100*ph+4}" text-anchor="end">${v}</text><text x="${l+v/100*pw}" y="${ht-b+22}" text-anchor="middle">${v}</text>`).join('');
  const dots=list.map(c=>{
    const x=l+scoreOf(c)/100*pw,y=ht-b-scoreOf(c,'improvement')/100*ph,assets=c.assets??c.series?.at(-1)?.assets;
    const radius=Math.max(2.8,Math.min(8,Math.log10(Math.max(1,assets||1))/2.5));
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${colors[industries.indexOf(c.industry)%colors.length]}" opacity=".62" data-company="${h(c.id)}" tabindex="0" role="button" aria-label="${h(c.name)} 종합 ${score(c)} 개선 ${score(c,'improvement')}"><title>${h(c.name)} · ${h(c.market)}\n종합 참고 ${score(c)} · 개선 참고 ${score(c,'improvement')}\n지표 충족 ${number(coverage(c),0)}%</title></circle>`;
  }).join('');
  html('scatter-chart',`<svg class="scatter-svg" viewBox="0 0 ${w} ${ht}" role="img" aria-label="기업별 종합과 경영개선 참고점수 산점도"><rect x="${l}" y="${t}" width="${pw/2}" height="${ph/2}" fill="#f4f6fb"/><rect x="${l+pw/2}" y="${t}" width="${pw/2}" height="${ph/2}" fill="#eaf3ee"/>${grid}<line x1="${l+pw/2}" x2="${l+pw/2}" y1="${t}" y2="${ht-b}" stroke="#b8c6c3" stroke-dasharray="4 5"/><line x1="${l}" x2="${w-r}" y1="${t+ph/2}" y2="${t+ph/2}" stroke="#b8c6c3" stroke-dasharray="4 5"/><text class="quadrant-label" x="${l+10}" y="${t+18}">회복 속도에 주목</text><text class="quadrant-label" x="${w-r-10}" y="${t+18}" text-anchor="end">현재 수준 · 개선 모두 상위</text>${dots}<text x="${w/2}" y="${ht-3}" text-anchor="middle">종합 참고점수 →</text><text transform="translate(12 ${ht/2}) rotate(-90)" text-anchor="middle">경영개선 참고점수 →</text></svg><div class="chart-note">${nf.format(list.length)}개 법인 · 원 클릭: 기업 상세 · 크기: 자산 · 색: 산업 · 확보 지표만 반영</div>`);
}

const lenses={
  debt:{title:'부채비율을 낮춘 기업',description:'2024년 대비 2025년 부채비율 감소 폭입니다. 두 연도 모두 자기자본이 양수인 법인만 포함합니다.',key:'debt_reduction',unit:'%p',test:(c,v)=>v>0},
  growth:{title:'매출이 가장 빠르게 성장한 기업',description:'2024년 대비 2025년 매출 증가율입니다. 두 연간 실적을 직접 비교합니다.',key:'revenue_growth',unit:'%',test:()=>true},
  turnaround:{title:'영업이익 흑자전환 기업',description:'2024년 영업손실에서 2025년 영업흑자로 전환한 법인을 영업이익률 순으로 보여줍니다.',key:'operating_margin',unit:'%',test:c=>{const s=c.series||[];return(s.find(x=>x.year===2024)?.operatingIncome??1)<0&&(s.find(x=>x.year===2025)?.operatingIncome??-1)>0;}},
  divergence:{title:'매출 성장 · 이익률 하락',description:'2024년 대비 2025년 매출은 증가했지만 영업이익률은 하락한 기업입니다.',key:'margin_improvement',unit:'%p',direction:'asc',test:(c,v)=>metric(c,'revenue_growth')>0&&v<0},
  cashrisk:{title:'이익은 흑자 · 영업현금은 적자',description:'2025년 순이익은 양수지만 영업활동현금흐름은 음수인 기업입니다. 현금흐름 시차를 함께 확인하세요.',key:'ocf_margin',unit:'%',direction:'asc',test:c=>{const s=c.series?.find(x=>x.year===2025);return s?.netIncome>0&&s?.operatingCashFlow<0;}},
  efficiency:{title:'자산을 효율적으로 활용한 기업',description:'2025년 당기순이익을 2024·2025년 평균 총자산으로 나눈 ROA를 비교합니다.',key:'roa',unit:'%',test:()=>true},
  margin:{title:'높은 수익성을 보인 소형기업',description:'2024·2025년 평균 총자산이 5,000억원 미만인 법인을 영업이익률 순으로 보여줍니다.',key:'operating_margin',unit:'%',test:c=>c.size==='소형'},
  ocf:{title:'매출 대비 현금창출이 높은 기업',description:'2025년 영업활동현금흐름/매출액을 비교합니다. 금융업 등은 일반기업 평가에서 분리합니다.',key:'ocf_margin',unit:'%',test:()=>true},
};
function lensRows(key){const lens=lenses[key]||lenses.debt;return state.companies.filter(c=>current(c)&&c.evaluationModel!=='financial'&&!String(c.industry).includes('금융')).map(c=>({c,value:metric(c,lens.key)})).filter(({c,value})=>isNumber(value)&&lens.test(c,value)).sort((a,b)=>(a.value-b.value)*(lens.direction==='asc'?1:-1));}
function renderStoryCards(){html('story-cards',['debt','growth','cashrisk'].map((key,i)=>{const lens=lenses[key],rows=lensRows(key),top=rows[0];return `<article class="story-card story-${i}"><span class="eyebrow">${['BALANCE SHEET','GROWTH','CASH FLOW'][i]}</span><h3>${lens.title}</h3>${top?`<div class="story-value">${signed(top.value)}<small>${lens.unit}</small></div><button class="company-link" data-company="${h(top.c.id)}">${h(top.c.name)}</button>`:'<p>조건에 맞는 자료가 없습니다.</p>'}<p class="small-muted">${key==='growth'?'2024 → 2025 · 증가율':key==='debt'?'2024 → 2025 · 감소 폭':'2025 · 영업현금흐름 비율'}</p><button class="text-button" data-lens="${key}">${nf.format(rows.length)}개 기업 살펴보기 →</button></article>`;}).join(''));}

function filters(){return{search:$('rank-search')?.value,market:$('market-filter')?.value,industry:$('industry-filter')?.value,size:$('size-filter')?.value,quality:$('quality-filter')?.value,currentOnly:true};}
function filteredRows(){return sortCompanies(filterCompanies(state.companies,filters()),state.sort,state.direction);}
function renderRankings(){
  if(!state.data)return;const list=filteredRows(),page=pageCompanies(list,state.page,state.pageSize);state.page=page.page;
  text('ranking-count',`${nf.format(list.length)}개 법인 · 참고점수 확보 ${nf.format(list.filter(c=>isNumber(scoreOf(c,state.sort))).length)}개`);
  html('ranking-body',page.rows.map(c=>`<tr><td class="rank-cell">${c.rank??'—'}</td><td>${companyButton(c)}<small class="row-note">${h(assetSizeLabel(c.size))} · 지표 충족 ${number(coverage(c),0)}%</small></td><td>${badge(c)}<small class="row-note">${h(c.industry||'산업 미확인')}</small></td><td class="score-cell">${score(c)}</td><td>${score(c,'growth')}</td><td>${score(c,'profitability')}</td><td>${score(c,'stability')}</td><td>${score(c,'cashflow')}</td><td>${score(c,'improvement')}</td><td><button class="icon-button ${state.compare.includes(c.id)?'selected':''}" data-add-compare="${h(c.id)}" aria-label="${h(c.name)} 비교에 추가">${state.compare.includes(c.id)?'✓':'＋'}</button></td></tr>`).join('')||'<tr><td colspan="10" class="empty-state">조건에 맞는 기업이 없습니다. 필터를 초기화해 보세요.</td></tr>');
  const start=Math.max(1,page.page-2),end=Math.min(page.pages,start+4);
  html('pagination',`<span class="pagination-meta">${list.length?nf.format((page.page-1)*state.pageSize+1):0}–${nf.format(Math.min(page.page*state.pageSize,list.length))} / ${nf.format(list.length)}</span><div class="page-buttons"><button data-page="${page.page-1}" ${page.page===1?'disabled':''} aria-label="이전 페이지">←</button>${Array.from({length:end-start+1},(_,i)=>start+i).map(p=>`<button data-page="${p}" ${p===page.page?'aria-current="page" class="active"':''}>${p}</button>`).join('')}<button data-page="${page.page+1}" ${page.page===page.pages?'disabled':''} aria-label="다음 페이지">→</button></div>`);
  document.querySelectorAll('[data-sort]').forEach(el=>{el.setAttribute('aria-pressed',String(el.dataset.sort===state.sort));el.closest('th')?.setAttribute('aria-sort',el.dataset.sort===state.sort?(state.direction==='desc'?'descending':'ascending'):'none');});
  document.querySelectorAll('[data-ranking]').forEach(el=>el.classList.toggle('is-active',el.dataset.ranking===state.sort));
}
function sourceLink(c){const receipt=String(c.provenance?.receipt||'');return /^\d{14}$/.test(receipt)?`<a href="https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${receipt}" target="_blank" rel="noopener noreferrer">DART 원문 ↗</a>`:'<span class="small-muted">접수번호 미확인</span>';}
function lensComparison(c,key){
  const field=({debt:'debtRatio',growth:'revenue',turnaround:'operatingIncome',divergence:'operatingMargin',cashrisk:'operatingCashFlow',efficiency:'roa',margin:'operatingMargin',ocf:'ocfMargin'})[key];
  const isMoney=['revenue','operatingIncome','operatingCashFlow'].includes(field);
  const before=c.series?.find(s=>s.year===2024)?.[field],after=c.series?.find(s=>s.year===2025)?.[field];
  return {before,after,unit:isMoney?'원':'%',display:value=>isMoney?(isNumber(value)?`${money(value)}원`:'—'):(isNumber(value)?`${number(value)}%`:'—')};
}
function renderInsights(){
  if(!state.data)return;const lens=lenses[state.insight],list=lensRows(state.insight);if($('insight-select'))$('insight-select').value=state.insight;
  text('insight-description',`${lens.description} 조건 충족 ${nf.format(list.length)}개 기업.`);
  html('insight-list',`<div class="table-wrap"><table class="data-table"><thead><tr><th>순서</th><th>기업</th><th>시장 · 산업</th><th>2024년</th><th>2025년</th><th>${['debt','growth','divergence'].includes(state.insight)?'전년 대비 변화':'2025 관찰지표'}</th><th>연결 범위</th><th>원문</th></tr></thead><tbody>${list.slice(0,100).map(({c,value},i)=>{const p=lensComparison(c,state.insight);return `<tr><td>${i+1}</td><td>${companyButton(c)}</td><td>${badge(c)}<small class="row-note">${h(c.industry||'미확인')}</small></td><td>${p.display(p.before)}</td><td>${p.display(p.after)}</td><td class="metric-value">${signed(value)}${lens.unit}</td><td>${h(c.provenance?.fsDiv||'확인 필요')}</td><td>${sourceLink(c)}</td></tr>`;}).join('')||'<tr><td colspan="8" class="empty-state">현재 자료에서 조건을 충족한 기업이 없습니다.</td></tr>'}</tbody></table></div><p class="small-muted">상위 100개 표시 · 2024년 대비 2025년 연간 비교 · 다운로드에 조건에 맞는 전체 기업 포함</p>`);
}

function chartSeries(c,key='revenue'){
  const series=(c.series||[]).filter(s=>isNumber(s[key])).sort((a,b)=>a.year-b.year);if(!series.length)return'<div class="empty-state">선택한 시계열의 확보 자료가 없습니다.</div>';
  const ratio=['operatingMargin','debtRatio','roe'].includes(key),max=Math.max(...series.map(s=>Math.abs(s[key])),1);
  return `<div class="history-chart">${series.map(s=>`<div class="history-column"><span>${ratio?`${signed(s[key])}%`:`${money(s[key])}원`}</span><div class="history-bar" style="height:${Math.max(3,Math.abs(s[key])/max*110)}px;${s[key]<0?'background:#c38f6b':''}"></div><strong>${s.year}</strong><small>${ratio?'공시자료 계산 지표':s[key]<0?'음수':'단위: 원'}</small></div>`).join('')}</div>`;
}
function showCompany(id){
  const c=state.byId.get(id);if(!c)return;state.detail=id;const series=(c.series||[]).slice().sort((a,b)=>a.year-b.year);
  html('company-detail',`<div class="detail-heading"><div><span class="eyebrow">CORPORATE MOMENTUM PROFILE / ${h(c.ticker||c.id)}</span><h2>${h(c.name)}</h2><div class="detail-meta">${badge(c)}<span>${h(c.industry||'산업 미확인')}</span><span>${h(assetSizeLabel(c.size))}</span>${qualityBadge(c)}</div></div><div class="detail-score"><span>종합 참고점수</span><strong>${score(c)}</strong><small>지표 충족 ${number(coverage(c),0)}% · 전체 공식순위 아님</small></div></div><p class="notice">${h(c.evaluationReason||c.exclusionReasons?.join(' · ')||'확보 지표의 가중치를 재비례한 잠정 참고값입니다. 미수집 지표는 0점으로 넣지 않습니다.')} 공시 원문 검증은 완료되지 않았습니다. 비교 기간은 2024년 대비 2025년입니다.</p><div class="detail-scores">${['growth','profitability','stability','cashflow','improvement'].map(k=>`<div><span>${labels[k]}</span><strong>${score(c,k)}</strong></div>`).join('')}</div><div class="detail-grid"><section class="panel"><h3>매출과 이익의 흐름</h3>${chartSeries(c)}<p class="small-muted">2024·2025 연간 비교자료 · 원 단위 · 기존 1년 참고평가에는 2022년 불필요</p></section><section class="panel"><h3>핵심 재무지표</h3><dl class="metric-dl">${[['영업이익률','operating_margin','%'],['ROA','roa','%'],['ROE','roe','%'],['부채비율','debt_ratio','%'],['자산회전율','asset_turnover','배'],['영업현금흐름/매출','ocf_margin','%']].map(([label,key,unit])=>`<div><dt>${label}</dt><dd>${number(metric(c,key))}${isNumber(metric(c,key))?unit:''}</dd></div>`).join('')}</dl></section></div><section class="panel"><h3>연간 재무자료 비교 <small>단위: 원</small></h3><div class="table-wrap"><table class="data-table"><thead><tr><th>지표</th>${series.map(s=>`<th>${s.year}</th>`).join('')}<th>증감(2025−2024)</th></tr></thead><tbody>${[['매출액','revenue'],['영업이익','operatingIncome'],['당기순이익','netIncome'],['자산총계','assets'],['부채총계','liabilities'],['자본총계','equity'],['영업현금흐름','operatingCashFlow']].map(([label,key])=>`<tr><td>${label}</td>${series.map(s=>`<td>${isNumber(s[key])?nf.format(s[key]):'—'}</td>`).join('')}<td>${isNumber(c.changes?.[key])?`${c.changes[key]>0?'+':''}${nf.format(c.changes[key])}`:'—'}</td></tr>`).join('')}</tbody></table></div></section><section class="panel"><h3>지표별 산출 근거</h3><p class="small-muted">배점은 전체 모형 기준입니다. 비교집단과 결측 사유를 확인할 수 있습니다.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>지표</th><th>원래 값</th><th>배점</th><th>백분위</th><th>가중점수</th><th>비교집단 / 결측 사유</th></tr></thead><tbody>${(c.indicators||[]).map(i=>`<tr><td>${h(i.label)}</td><td>${number(i.value,2)}${isNumber(i.value)?h(i.unit||''):''}</td><td>${number(i.weight,0)}</td><td>${number(i.percentile)}</td><td>${number(i.weightedScore,2)}</td><td class="reason-cell">${h(i.reason||`${i.cohortLabel||'비교집단'} · ${i.cohortCount||0}개`)}</td></tr>`).join('')}</tbody></table></div></section><section class="panel"><h3>자료 품질과 출처</h3><ul class="issue-list">${issues(c).map(i=>`<li>${h(i)}</li>`).join('')||'<li>자동 정합성 검사에서 기록된 문제가 없습니다. 원문 대조 완료를 뜻하지 않습니다.</li>'}</ul><p>${sourceLink(c)} <span class="small-muted">접수번호 ${h(c.provenance?.receipt||'미확인')} · ${h(c.provenance?.fsDiv||'연결 범위 확인 필요')} · ${h(c.provenance?.sourceFile||'')}</span></p><button class="button secondary" data-export-company="${h(c.id)}">이 기업 재무자료 CSV</button></section>`);
  improvementUI.decorateLegacyDetail(id);
  text('detail-compare',state.compare.includes(id)?'비교에 추가됨':'비교에 추가');const dialog=$('company-dialog');if(dialog&&!dialog.open)dialog.showModal();
  const chartPanel=$('company-detail').querySelector('.detail-grid .panel');
  if(chartPanel){
    const select=document.createElement('select');select.id='detail-chart-metric';select.setAttribute('aria-label','재무 시계열 지표');
    select.innerHTML=[['revenue','매출액'],['operatingIncome','영업이익'],['operatingMargin','영업이익률'],['assets','총자산'],['debtRatio','부채비율'],['roe','ROE'],['operatingCashFlow','영업현금흐름']].map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
    chartPanel.querySelector('h3').insertAdjacentElement('afterend',select);
    const chart=chartPanel.querySelector('.history-chart');if(chart){chart.id='detail-history-chart';select.addEventListener('change',()=>{$('detail-history-chart').outerHTML=`<div id="detail-history-chart">${chartSeries(c,select.value)}</div>`;});}
  }
}

function addCompare(id){if(state.compare.includes(id)){toast('이미 비교에 포함된 기업입니다.');return;}if(state.compare.length>=3){toast('최대 3개 기업을 비교할 수 있습니다.');return;}state.compare.push(id);renderComparison();renderRankings();if(state.detail===id)text('detail-compare','비교에 추가됨');toast(`${state.byId.get(id)?.name}을 비교에 추가했습니다.`);}
function radar(list){
  const cx=180,cy=155,r=105,keys=['growth','profitability','stability','cashflow','improvement'];
  const point=(i,v)=>{const a=-Math.PI/2+i*2*Math.PI/keys.length;return[cx+Math.cos(a)*r*v/100,cy+Math.sin(a)*r*v/100];};
  const polygon=v=>keys.map((_,i)=>point(i,v).join(',')).join(' ');
  return `<svg viewBox="0 0 360 315" class="radar-svg" role="img" aria-label="선택 기업의 5개 부문 참고점수 비교">${[25,50,75,100].map(v=>`<polygon points="${polygon(v)}" fill="none" stroke="#dbe4e1"/>`).join('')}${keys.map((k,i)=>{const[x,y]=point(i,119);return`<line x1="${cx}" y1="${cy}" x2="${point(i,100)[0]}" y2="${point(i,100)[1]}" stroke="#dbe4e1"/><text x="${x}" y="${y}" text-anchor="middle">${labels[k]}</text>`;}).join('')}${list.map((c,i)=>keys.every(k=>isNumber(scoreOf(c,k)))?`<polygon points="${keys.map((k,j)=>point(j,scoreOf(c,k)).join(',')).join(' ')}" fill="${colors[i]}22" stroke="${colors[i]}" stroke-width="2"/>`:'').join('')}</svg>`;
}
function renderComparison(){
  html('compare-chips',state.compare.map((id,i)=>{const c=state.byId.get(id);return`<span class="compare-chip" style="--chip-color:${colors[i]}">${h(c.name)}<button data-remove-compare="${h(id)}" aria-label="${h(c.name)} 비교에서 제거">×</button></span>`;}).join(''));
  const list=state.compare.map(id=>state.byId.get(id)).filter(Boolean);if(!list.length){html('comparison-content','<div class="empty-state"><h3>어떤 기업을 나란히 볼까요?</h3><p>위에서 기업을 검색하거나 순위표의 ＋ 버튼으로 최대 3개를 선택하세요.</p></div>');return;}
  const rows=[['시장',c=>c.market||'미확인'],['산업',c=>c.industry||'미확인'],['자산규모',c=>assetSizeLabel(c.size)],...Object.entries(labels).map(([k,v])=>[v,c=>score(c,k)]),['지표 충족률',c=>`${number(coverage(c),0)}%`],['2024 매출액',c=>`${money(c.series?.find(s=>s.year===2024)?.revenue)}원`],['2025 매출액',c=>`${money(c.series?.find(s=>s.year===2025)?.revenue)}원`],['매출 증가율(전년 대비)',c=>`${signed(metric(c,'revenue_growth'))}%`],['영업이익 개선(전기 매출 대비)',c=>`${signed(metric(c,'profit_improvement'))}%`],['부채비율 감소(전년 대비)',c=>`${signed(metric(c,'debt_reduction'))}%p`],['총자산',c=>`${money(c.series?.at(-1)?.assets)}원`],['영업이익률',c=>`${number(metric(c,'operating_margin'))}%`],['ROA',c=>`${number(metric(c,'roa'))}%`],['부채비율',c=>`${number(metric(c,'debt_ratio'))}%`]];
  html('comparison-content',`<div class="compare-layout"><section class="panel"><h3>부문별 참고점수</h3>${radar(list)}<div class="chart-legend">${list.map((c,i)=>`<span><i style="background:${colors[i]}"></i>${h(c.name)}</span>`).join('')}</div><p class="small-muted">모든 부문 값이 있는 기업만 다각형을 표시합니다. 서버에서 산출한 점수를 사용합니다.</p></section><section class="panel"><h3>같은 기준으로 나란히 보기</h3><div class="table-wrap"><table class="data-table compare-table"><thead><tr><th>항목</th>${list.map(c=>`<th>${companyButton(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(([label,get])=>`<tr><td>${label}</td>${list.map(c=>`<td>${h(get(c))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section></div><p class="notice">${new Set(list.map(c=>c.industry)).size>1||new Set(list.map(c=>c.size)).size>1?'서로 다른 산업 또는 자산 그룹의 기업입니다. 비교집단 내 상대 성과와 지표 충족률을 함께 확인하세요.':'같은 산업·규모라도 연결 범위와 확보 지표가 다를 수 있습니다.'} 참고점수는 신용등급이나 미래 주가 전망을 뜻하지 않습니다.</p>`);
}
function renderCompareSuggestions(){const q=$('compare-search')?.value.trim()||'',list=q?filterCompanies(state.companies,{search:q,currentOnly:true}).slice(0,8):[];html('compare-suggestions',list.map(c=>`<button class="suggestion" data-add-compare="${h(c.id)}"><strong>${h(c.name)}</strong><span>${h(c.ticker||c.id)} · ${h(c.market)}</span><b>＋</b></button>`).join('')||(q?'<p class="small-muted">검색 결과가 없습니다.</p>':''));if($('compare-suggestions'))$('compare-suggestions').hidden=!q;$('compare-search')?.setAttribute('aria-expanded',String(Boolean(q)));}

function renderMethodology(){
  const blocks=[['A','성장성',30,[['전년 대비 매출 증가율',15],['전년 대비 영업이익 개선',5],['이익 상태 개선',5],['자기자본 증가율',5]]],['B','수익성',25,[['영업이익률',7],['전년 대비 영업이익률 개선',6],['ROA',5],['ROE',4],['총자산회전율',3]]],['C','재무안정성',25,[['현재 부채비율',5],['전년 대비 부채비율 감소 폭',8],['유동비율',4],['차입금 의존도',4],['이자보상배율',4]]],['D','현금창출·주주환원',20,[['영업현금흐름/매출',6],['전년 대비 영업현금흐름 개선',5],['현금이익 전환',4],['잉여현금흐름',3],['주주환원 실적',2]]]];
  html('methodology-content',`<div class="notice"><strong>현재 평가 상태</strong><p>연간 평가모형은 19개 지표, 100점 만점입니다. 모든 성장·개선은 2024년 대비 2025년 한 해 변화를 평가합니다. 매출 성장의 중복 배점을 합쳤으며 2022년 자료는 필요하지 않습니다. 정식 종합점수는 모든 지표를 충족할 때만 산출합니다. 참고점수는 확보 지표의 가중치를 재비례한 값입니다.</p></div><div class="method-cards">${blocks.map(([letter,title,total,indicators])=>`<section class="panel method-card"><span class="method-letter">${letter}</span><h3>${title}<strong>${total}<small>점</small></strong></h3><ul>${indicators.map(([label,w])=>`<li><span>${label}</span><b>${w}점</b></li>`).join('')}</ul></section>`).join('')}</div><div class="detail-grid"><section class="panel"><h3>점수를 만드는 순서</h3><ol class="method-steps"><li>OpenDART 원계정을 계정 ID·재무제표 구분으로 정규화합니다.</li><li>기간·연결 범위·자산=부채+자본을 점검합니다.</li><li>동일 산업과 평균 자산 규모로 비교집단을 구성합니다.</li><li>20개 미만이면 인접 규모, 같은 산업으로 확대하고 기준을 기록합니다.</li><li>백분위·가중점수를 Python에서 산출합니다. 동점은 평균순위로 처리합니다.</li><li>금융업 별도 모형이 필요하거나 자료가 부족하면 제외 사유를 남깁니다.</li></ol></section><section class="panel"><h3>결측과 예외 처리</h3><p>누락 수치는 0으로 바꾸지 않습니다. 전기 영업이익이 0 이하인 기업은 단순 이익증가율을 쓰지 않고 전기 매출 대비 이익 개선 폭과 흑자전환 상태로 평가합니다. 자기자본이 0 이하이면 부채비율을 낮은 위험으로 해석하지 않습니다.</p><p>ROA는 순이익/평균 총자산, ROE는 순이익/평균 자기자본입니다. 자동 검사는 원문 검증을 대체하지 않습니다.</p><p>금융회사·리츠 등은 일반 비금융기업 점수에서 분리합니다.</p></section></div><section class="panel"><h3>현재 수준과 개선 속도</h3><p>경영개선 모형은 매출 성장 20점, 수익성 개선 25점, 재무구조 개선 25점, 현금흐름 개선 20점, 자본효율 개선 10점입니다. 매출·이익률·부채비율·현금흐름·자본효율 개선은 모두 2024→2025 변화입니다. 동일 모형의 과거 종합점수 재계산이 끝나기 전에는 ‘점수 상승 순위’를 표시하지 않습니다.</p></section><section class="panel"><h3>원자료와 버전</h3><dl class="metric-dl"><div><dt>산식 버전</dt><dd>${h(state.data.metadata?.modelVersion||'검증 중')}</dd></div><div><dt>재무 기준</dt><dd>${h(state.data.metadata?.asOf||'2025-12-31')}</dd></div><div><dt>표시 기간</dt><dd>2024 대비 2025 · 연간</dd></div><div><dt>전체 공식순위</dt><dd>미발표</dd></div></dl><p><a href="https://opendart.fss.or.kr/guide/main.do" target="_blank" rel="noopener noreferrer">OpenDART 공식 개발가이드 ↗</a></p><button class="button secondary" id="export-methodology">평가 방법 JSON 다운로드</button></section>`);
}

function renderData(){
  if(!state.data)return;const all=state.companies,listed=all.filter(current),counts={};all.forEach(c=>{const s=c.quality?.status||'INSUFFICIENT_DATA';counts[s]=(counts[s]||0)+1;});
  const stages=[['기업 후보',all.length,all.length],['시장구분 확인',listed.length,all.length],['현재 상장 분류 중 재무 확보',listed.filter(hasData).length,listed.length],['참고평가 가능',listed.filter(c=>isNumber(scoreOf(c))).length,listed.length],['원문 검증 완료',counts.VERIFIED||0,listed.length]];
  html('data-progress',stages.map(([label,count,total])=>`<div class="progress-row"><div><strong>${label}</strong><span>${nf.format(count)} / ${nf.format(total)}</span></div><progress value="${count}" max="${total||1}"></progress></div>`).join('')+`<div class="year-status">${[2024,2025].map(y=>`<div><strong>${y}${y===2026?' 분기':''}</strong><span>${y===2022||y===2026?'미수집':`${nf.format(all.filter(c=>c.series?.some(s=>s.year===y&&isNumber(s.revenue))).length)}개 비교표시`}</span></div>`).join('')}</div>`);
  html('quality-summary',Object.entries(qualityLabels).map(([k,label])=>`<div class="quality-stat"><span>${label}</span><strong>${nf.format(counts[k]||0)}</strong><small>${h(k)}</small></div>`).join(''));
  text('data-quality-note',`자동 정합성 검사는 공시 원문 대조 완료를 뜻하지 않습니다. 과거 API 호출 횟수는 기존 수집기가 기록하지 않아 확인 불가입니다. 분석 생성: ${state.data.metadata?.generatedAt||'미확인'}`);
  const query=($('quality-search')?.value||'').trim().toLocaleLowerCase('ko');
  const list=all.filter(c=>!query||`${c.name} ${c.ticker||''} ${c.id} ${issues(c).join(' ')} ${c.exclusionReasons?.join(' ')||''}`.toLocaleLowerCase('ko').includes(query));
  html('quality-body',list.slice(0,150).map(c=>`<tr><td>${companyButton(c)}</td><td>${badge(c)}</td><td>${qualityBadge(c)}</td><td class="reason-cell">${h(issues(c).join(' · ')||c.exclusionReasons?.join(' · ')||'자동 검사 통과 · 원문 대조 전')}</td></tr>`).join('')||'<tr><td colspan="4" class="empty-state">검색 결과가 없습니다.</td></tr>');
}

function download(content,filename,type='text/csv;charset=utf-8'){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`${filename} 다운로드를 시작했습니다.`);}
function exportRows(list){const headers=['DART고유번호','기업명','종목코드','시장','산업','자산규모','표본내순위','종합참고점수','성장성','수익성','재무안정성','현금창출','개선참고점수','지표충족률(%)','품질','비교기준연도','평가연도','출처','접수번호','공식순위여부'];const rows=list.map(c=>[c.id,c.name,c.ticker,c.market,c.industry,c.size,c.rank,scoreOf(c),scoreOf(c,'growth'),scoreOf(c,'profitability'),scoreOf(c,'stability'),scoreOf(c,'cashflow'),scoreOf(c,'improvement'),coverage(c),c.quality?.status,2024,2025,'OpenDART',c.provenance?.receipt,'아니오']);download(makeCsv(headers,rows),'기업성적표_2025_참고평가.csv');}

document.addEventListener('click',event=>{
  const el=event.target.closest('button,a,circle');if(!el)return;
  if(el.dataset.view){event.preventDefault();showView(el.dataset.view);}if(el.dataset.company)showCompany(el.dataset.company);
  if(el.dataset.addCompare)addCompare(el.dataset.addCompare);
  if(el.dataset.removeCompare){state.compare=state.compare.filter(id=>id!==el.dataset.removeCompare);renderComparison();renderRankings();}
  if(el.dataset.page){state.page=Number(el.dataset.page);renderRankings();$('ranking-table')?.scrollIntoView({block:'start'});}
  if(el.dataset.sort){state.direction=state.sort===el.dataset.sort?(state.direction==='desc'?'asc':'desc'):['rank','name'].includes(el.dataset.sort)?'asc':'desc';state.sort=el.dataset.sort;renderRankings();}
  if(el.dataset.market){state.market=el.dataset.market;document.querySelectorAll('[data-market]').forEach(x=>x.classList.toggle('active',x.dataset.market===state.market));renderOverviewRanking();}
  if(el.dataset.ranking){state.sort=el.dataset.ranking;state.page=1;showView('rankings');if($('ranking-type'))$('ranking-type').value=state.sort;}
  if(el.dataset.lens){state.insight=el.dataset.lens;showView('insights');}
  if(el.dataset.exportCompany){const c=state.byId.get(el.dataset.exportCompany);download(makeCsv(['기업','연도','매출액(원)','영업이익(원)','순이익(원)','총자산(원)','부채(원)','자본(원)','영업현금흐름(원)','접수번호'],(c.series||[]).map(s=>[c.name,s.year,s.revenue,s.operatingIncome,s.netIncome,s.assets,s.liabilities,s.equity,s.operatingCashFlow,c.provenance?.receipt])),`${c.name}_재무자료.csv`);}
  if(el.id==='export-methodology')download(JSON.stringify({metadata:state.data.metadata,methodology:state.data.methodology},null,2),'평가방법_2025.json','application/json');
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('circle[data-company]'))showCompany(e.target.dataset.company);});
for(const id of ['rank-search','market-filter','industry-filter','size-filter','quality-filter'])$(id)?.addEventListener(id==='rank-search'?'input':'change',()=>{state.page=1;renderRankings();});
$('ranking-type')?.addEventListener('change',e=>{state.sort=e.target.value;state.direction='desc';state.page=1;renderRankings();});
$('page-size')?.addEventListener('change',e=>{state.pageSize=Number(e.target.value);state.page=1;renderRankings();});
$('reset-filters')?.addEventListener('click',()=>{['rank-search','market-filter','industry-filter','size-filter','quality-filter'].forEach(id=>{if($(id))$(id).value=id==='rank-search'?'':'all';});state.page=1;state.sort='overall';state.direction='desc';if($('ranking-type'))$('ranking-type').value='overall';renderRankings();});
$('insight-select')?.addEventListener('change',e=>{state.insight=e.target.value;renderInsights();});
$('compare-search')?.addEventListener('input',renderCompareSuggestions);$('quality-search')?.addEventListener('input',renderData);
$('close-detail')?.addEventListener('click',()=>$('company-dialog').close());
$('company-dialog')?.addEventListener('click',e=>{if(e.target===$('company-dialog'))$('company-dialog').close();});
$('detail-compare')?.addEventListener('click',()=>{if(state.detail)addCompare(state.detail);});
$('export-csv')?.addEventListener('click',()=>exportRows(filteredRows()));
$('export-insights')?.addEventListener('click',()=>{const lens=lenses[state.insight];download(makeCsv(['기업','종목코드','시장','관찰지표','2024년 값','2025년 값','수치 단위','순위 지표값','지표 단위','비교기간','출처','접수번호'],lensRows(state.insight).map(({c,value})=>[c.name,c.ticker,c.market,lens.title,lensComparison(c,state.insight).before,lensComparison(c,state.insight).after,lensComparison(c,state.insight).unit,value,lens.unit,'2024년 대비 2025년','OpenDART',c.provenance?.receipt])),`인사이트_${state.insight}_2025.csv`);});
$('export-quality')?.addEventListener('click',()=>download(makeCsv(['고유번호','기업','시장','품질','평가가능여부','사유'],state.companies.map(c=>[c.id,c.name,c.market,c.quality?.status,isNumber(scoreOf(c))?'잠정 참고평가':'평가 불가',issues(c).join(' · ')])),'데이터품질_2025.csv'));
$('retry-load')?.addEventListener('click',loadData);
window.addEventListener('hashchange',()=>showView(location.hash.slice(1),false));
loadData();
