/* UI for the independent 2022–25 improvement model. Python owns official scores. */
import {assetSizeGroup, assetSizeLabel} from './ui-core.mjs?v=20261023size1';
import {momentumCandidates, momentumReason} from './momentum-discovery.mjs?v=20261024release2';
const $ = id => document.getElementById(id);
const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Number.isFinite(n) ? n.toLocaleString('ko-KR',{maximumFractionDigits:1}) : '—';
const money = n => Number.isFinite(n) ? `${fmt(n / 1e8)}억 원` : '—';
const sectionLabels = {growth:'성장 개선',profit:'수익성 개선',balance:'재무구조 개선',cash:'현금흐름 개선',efficiency:'자본 효율 개선'};
const weights = {growth:20,profit:25,balance:25,cash:20,efficiency:10};
const verdict = (r, model) => Number.isFinite(r?.[model]?.score) ? `${fmt(r[model].score)}점` : '—';
const rowYear = (row,y) => row.series?.find(s => s.year === y) || {};
const receiptLink = row => {const n=String(row.sourceFiles?.[2025]?.receipt||'');return /^\d{14}$/.test(n)?`<a href="https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${n}" target="_blank" rel="noopener noreferrer">DART 원문 ↗</a>`:'접수번호 확인 전';};

export function createImprovementUI() {
  let data = null;
  let rows = [];
  let simulated = null;
  let selectedStory = 'improvement';
  const storyNames = {improvement:'경영개선 TOP 100',turnaround:'턴어라운드 TOP 100',strong:'개선형 우량기업 TOP 100',balance:'재무구조 개선 TOP 100',profit:'수익성 개선 TOP 100',cash:'현금흐름 개선 TOP 100',paradox:'경영개선의 역설',hidden:'숨은 개선 기업'};

  function storyRows(key) {
    const eligible=rows.filter(r=>r.eligible&&Number.isFinite(r.cii.score));
    const bySection=section=>eligible.filter(r=>Number.isFinite(r.cii.sections[section])).sort((a,b)=>b.cii.sections[section]-a.cii.sections[section]);
    switch(key){
      case 'turnaround':return eligible.filter(r=>r.type==='턴어라운드 기업').sort((a,b)=>b.cii.score-a.cii.score);
      case 'strong':return eligible.filter(r=>r.type==='개선형 우량기업').sort((a,b)=>b.cii.score-a.cii.score);
      case 'balance':return bySection('balance');
      case 'profit':return bySection('profit');
      case 'cash':return bySection('cash');
      case 'paradox':return eligible.filter(r=>r.cii.cohortPercentile>=75&&r.riskSignals.length).sort((a,b)=>b.cii.score-a.cii.score);
      case 'hidden':return eligible.filter(r=>r.size==='소형'&&r.cii.cohortPercentile>=75).sort((a,b)=>b.cii.score-a.cii.score);
      default:return eligible.sort((a,b)=>b.cii.score-a.cii.score);
    }
  }

  function stories() {
    if(!data)return;
    $('cii-stories').innerHTML=`<h2>2022~2025 경영개선 기사 발굴</h2><p>완전지표 CII(원문 검증 전) 확보 ${data.metadata.ciiCount}개 기업 · 2022년 원자료 확보 ${data.metadata.source2022}개. 실제 3년 지표가 확보될 때만 명단을 표시합니다.</p><div class="story-grid">${Object.entries(storyNames).map(([key,label])=>`<button class="button button-secondary story-filter ${selectedStory===key?'selected':''}" data-story="${key}">${label} · ${storyRows(key).length}개</button>`).join('')}</div><div id="cii-story-results"></div><p><a class="button button-secondary" href="./improvement_export.xlsx" download>전체 평가자료 Excel</a></p>`;
    const list=storyRows(selectedStory).slice(0,100);
    $('cii-story-results').innerHTML=list.length?`<h3>${h(storyNames[selectedStory])}</h3>${metricTable(list)}<button class="button button-secondary" data-story-csv="${selectedStory}">이 목록 CSV</button>`:'<p class="small-muted">조건에 맞는 평가 기업이 없습니다.</p>';
  }

  function filters() {
    for(const [id,field] of [['cii-industry','industry'],['cii-size','size'],['cii-type','type'],['fsi-industry','industry'],['fsi-size','size'],['turn-industry','industry'],['turn-size','size'],['map-industry','industry'],['map-size','size']]) {
      const el=$(id); if(!el)continue;
      const value=el.value;
      const options=field==='size'?['대','중','소']:[...new Set(rows.map(r=>r[field]).filter(Boolean))].sort();
      const initial=el.options[0]?.outerHTML||'<option value="all">전체</option>';
      el.innerHTML=initial+options.map(v=>`<option value="${h(v)}">${field==='size'?{대:'대규모 · 2조원 이상',중:'중규모 · 5,000억~2조원',소:'소규모 · 5,000억원 미만'}[v]:h(v)}</option>`).join('');
      if(options.includes(value))el.value=value;
    }
  }

  function chosen(prefix, source=rows) {
    const market=$('cii-market')?.value||'all';
    const industry=$(prefix+'-industry')?.value||'all';
    const size=$(prefix+'-size')?.value||'all';
    const type=$('cii-type')?.value||'all';
    return source.filter(r=>(prefix==='turn'||market==='all'||r.market===market)&&(industry==='all'||r.industry===industry)&&(size==='all'||assetSizeGroup(r.size)===size)&&(prefix==='turn'||type==='all'||r.type===type));
  }

  function metricTable(list, turnaround=false) {
    const items=list.slice(0,100);
    if(!items.length)return '<p class="empty-state">2022~2025년 CII와 2025년 FSI를 함께 확인한 기업이 없습니다. 자료가 확보되면 이 표에 표시합니다.</p>';
    return `<div class="table-scroll"><table class="ranking-table"><thead><tr><th>순위</th><th>기업</th><th>업종 · 규모</th><th>CII</th><th>FSI</th><th>유형</th><th>개선 부문</th>${turnaround?'<th>흑자전환</th><th>부채비율 감소</th><th>현금 개선</th>':'<th>순위 안정성</th>'}<th>원문</th></tr></thead><tbody>${items.map((r,i)=>{const a=rowYear(r,2022),b=rowYear(r,2025),debt=r.cii.values.debt_ratio_reduction;return `<tr><td>${i+1}</td><td><button class="company-link" data-new-company="${h(r.id)}">${h(r.name)}</button><span class="ticker">${h(r.ticker||r.id)} · ${h(r.market)}</span></td><td>${h(r.industry||'미확인')}<small class="row-note">${h(assetSizeLabel(r.size))}</small></td><td class="score-cell">${verdict(r,'cii')}</td><td>${verdict(r,'fsi')}</td><td>${h(r.type||'—')}</td><td>${r.improvedSections}개</td>${turnaround?`<td>${a.operating_income<=0&&b.operating_income>0?'예':'아니오'}</td><td>${Number.isFinite(debt)?`${fmt(debt)}%p`:'—'}</td><td>${a.operating_cash_flow<b.operating_cash_flow?'개선':'—'}</td>`:'<td>검증 보류</td>'}<td>${receiptLink(r)}</td></tr>`}).join('')}</tbody></table></div><p class="small-muted">조건 충족 ${list.length.toLocaleString('ko-KR')}개 · 처음 100개 표시 · 완전지표 CII 기업의 목록 · 원문 검증 전</p>`;
  }

  function renderRanking() {
    if(!data)return;
    const search=($('cii-search')?.value||'').trim().toLocaleLowerCase('ko-KR');
    const min=$('cii-min')?.value===''?null:Number($('cii-min')?.value);
    const max=$('cii-max')?.value===''?null:Number($('cii-max')?.value);
    const list=momentumCandidates(rows,{market:$('cii-market')?.value,industry:$('cii-industry')?.value,size:$('cii-size')?.value,type:$('cii-type')?.value,search,min,max,isOfficial:data.metadata.isOfficial});
    $('improvement-status').innerHTML=`2022~2025년 모멘텀 지수(CII) 완전지표 <strong>${data.metadata.ciiCount.toLocaleString('ko-KR')}개 기업</strong> · 2022년 원자료 확보 ${data.metadata.source2022.toLocaleString('ko-KR')}개 · 현재 상장 후보 ${data.metadata.listedCandidates.toLocaleString('ko-KR')}개. 완전지표 기업의 순위를 공개합니다. 공시 원문·정정공시 대조 후 바뀔 수 있습니다.`;
    $('improvement-ranking').innerHTML=`<p class="ranking-summary">검색 결과 <strong>${list.length.toLocaleString('ko-KR')}개</strong> · 시장 확인된 후보 전체에서 검색합니다. 점수 범위는 완전지표 CII 탐색점수에 적용됩니다.</p><div class="table-scroll"><table class="ranking-table momentum-table"><thead><tr><th>순위</th><th>기업명</th><th>업종</th><th>자산 규모</th><th>모멘텀 지수(CII)</th><th>재무체력 지수(FSI)</th><th>기업 유형</th><th>개선 부문</th><th>순위 안정성 / 평가 상태</th></tr></thead><tbody>${list.slice(0,100).map(r=>{const scored=Number.isFinite(r.cii.score);return `<tr><td>${scored?r.cii.rank||'—':'—'}</td><td><button class="company-link" data-new-company="${h(r.id)}">${h(r.name)}</button><span class="ticker">${h(r.ticker||r.id)} · ${h(r.market)}</span></td><td>${h(r.industry||'미확인')}</td><td>${h(assetSizeLabel(r.size))}</td><td class="score-cell">${scored?`${verdict(r,'cii')}*`:'—'}</td><td>${Number.isFinite(r.fsi.score)?`${verdict(r,'fsi')}*`:'—'}</td><td>${h(scored&&r.type?`${r.type}`:'—')}</td><td>${scored?`${r.improvedSections}개`:'—'}</td><td>${h(momentumReason(r,data.metadata.isOfficial))}</td></tr>`}).join('')||'<tr><td colspan="9" class="empty-state">조건에 맞는 상장기업이 없습니다.</td></tr>'}</tbody></table></div><p class="small-muted">처음 100개 표시 · *점수·순위·유형은 원문 검증 전 결과입니다. 두 지수는 합산하지 않습니다.</p>`;
  }

  function renderMap() {
    if(!data)return;
    const market=$('map-market')?.value||'all',industry=$('map-industry')?.value||'all',size=$('map-size')?.value||'all';
    const eligible=rows.filter(r=>r.eligible&&r.type&&Number.isFinite(r.cii.cohortPercentile)&&Number.isFinite(r.fsi.cohortPercentile));
    const list=eligible.filter(r=>(market==='all'||r.market===market)&&(industry==='all'||r.industry===industry)&&(size==='all'||assetSizeGroup(r.size)===size));
    $('map-status').innerHTML=`2022~2025 모멘텀 지수(CII)와 2025 재무체력 지수(FSI)가 모두 산출된 기업 <strong>${eligible.length.toLocaleString('ko-KR')}개</strong> · 현재 필터 ${list.length.toLocaleString('ko-KR')}개. 4분면입니다. 점을 선택하면 근거를 볼 수 있으며 원문 검증 후 유형이 바뀔 수 있습니다.`;
    $('map-chart').innerHTML=eligible.length&&!list.length?'<p class="empty-state">현재 필터에 맞는 평가 기업이 없습니다.</p>':scatter(list);
  }

  function renderFSI() {
    if(!data)return;
    const market=$('fsi-market')?.value||'all';
    const industry=$('fsi-industry')?.value||'all';
    const size=$('fsi-size')?.value||'all';
    const search=($('fsi-search')?.value||'').trim().toLocaleLowerCase('ko-KR');
    const list=rows.filter(r=>Number.isFinite(r.fsi.score)&&
      (market==='all'||r.market===market)&&(industry==='all'||r.industry===industry)&&
      (size==='all'||assetSizeGroup(r.size)===size)&&(!search||[r.name,r.ticker,r.id].some(v=>String(v||'').toLocaleLowerCase('ko-KR').includes(search)))
      ).sort((a,b)=>b.fsi.score-a.fsi.score);
    $('fsi-status').innerHTML=`2025년 FSI 완전지표 확보 <strong>${data.metadata.fsiCount.toLocaleString('ko-KR')}개 기업</strong> · 아래는 순위입니다. 공시 원문·정정공시 검증 후 바뀔 수 있습니다.`;
    $('fsi-ranking').innerHTML=list.length?`<div class="table-scroll"><table class="ranking-table"><thead><tr><th>표시순서</th><th>기업</th><th>시장 · 업종 · 규모</th><th>FSI</th><th>수익성</th><th>안정성</th><th>현금</th><th>자산 효율</th><th>위험 신호</th><th>원문</th></tr></thead><tbody>${list.slice(0,100).map((r,i)=>`<tr><td>${i+1}</td><td><button class="company-link" data-new-company="${h(r.id)}">${h(r.name)}</button><span class="ticker">${h(r.ticker||r.id)}</span></td><td>${h(r.market||'미확인')} · ${h(r.industry||'미확인')}<small class="row-note">${h(assetSizeLabel(r.size))}</small></td><td class="score-cell">${verdict(r,'fsi')}</td><td>${fmt(r.fsi.sections.profit)}</td><td>${fmt(r.fsi.sections.balance)}</td><td>${fmt(r.fsi.sections.cash)}</td><td>${fmt(r.fsi.sections.efficiency)}</td><td>${h((r.riskSignals||[]).join(' · ')||'기록 없음')}</td><td>${receiptLink(r)}</td></tr>`).join('')}</tbody></table></div><p class="small-muted">조건 충족 ${list.length.toLocaleString('ko-KR')}개 · 점수 높은 순서로 처음 100개 표시 · 기업명 검색은 전체 확보 기업에 적용됩니다.</p>`:'<p class="empty-state">조건에 맞는 완전지표 FSI 기업이 없습니다.</p>';
  }

  function turnCondition(row, condition) {
    const a=rowYear(row,2022),b=rowYear(row,2025),v=row.cii.values;
    switch(condition){
      case 'profit':return a.operating_income<=0&&b.operating_income>0;
      case 'cash':return a.operating_cash_flow<=0&&b.operating_cash_flow>0;
      case 'debt':return v.debt_ratio_reduction>=50;
      case 'margin':return v.margin_change>=5;
      case 'growth':return v.growth_persistence===3;
      case 'sections3':return row.improvedSections>=3;
      case 'sections4':return row.improvedSections>=4;
      case 'risk':return row.riskSignals.length>0;
      default:return true;
    }
  }

  function renderTurnaround() {
    if(!data)return;
    const condition=$('turn-condition')?.value||'all';
    const list=chosen('turn',rows.filter(r=>r.eligible&&r.type==='턴어라운드 기업')).filter(r=>turnCondition(r,condition)).sort((a,b)=>b.cii.score-a.cii.score);
    $('turnaround-status').innerHTML=`완전지표 턴어라운드 후보 <strong>${data.metadata.typeCounts['턴어라운드 기업']||0}개</strong> · 현재 조건에 해당 ${list.length}개. 최소 2개 핵심 부문 개선을 충족한 분류입니다. 원문 검증 후 바뀔 수 있습니다.`;
    $('turnaround-ranking').innerHTML=metricTable(list,true);
  }

  function scatter(list) {
    if(!list.length)return '<p class="empty-state">현재 필터에 맞는 완전지표 기업이 없습니다.</p>';
    const colors={'개선형 우량기업':'#17735d','턴어라운드 기업':'#a26931','안정형 우량기업':'#526d9c','개선 부진 기업':'#777e7b'};
    const points=list.slice(0,4000).map(r=>{const x=44+r.fsi.cohortPercentile*6.1,y=310-r.cii.cohortPercentile*2.75;const asset=rowYear(r,2025).assets;const radius=Number.isFinite(asset)?Math.max(3,Math.min(9,Math.log10(Math.max(asset,1))/2)):4;return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${colors[r.type]||'#888'}" opacity=".75" data-new-company="${h(r.id)}" tabindex="0"><title>${h(r.name)} · CII ${fmt(r.cii.score)} · FSI ${fmt(r.fsi.score)} · ${h(r.type)} · 개선 ${r.improvedSections}부문</title></circle>`}).join('');
    return `<svg viewBox="0 0 690 350" class="scatter-svg" role="img" aria-label="FSI와 CII 비교집단 내 백분위 지도"><rect x="44" y="35" width="305" height="137" fill="#fff4e9"/><rect x="349" y="35" width="305" height="137" fill="#e9f4ec"/><rect x="44" y="172" width="305" height="138" fill="#f1f2ef"/><rect x="349" y="172" width="305" height="138" fill="#eef2f9"/><line x1="349" x2="349" y1="35" y2="310" stroke="#8da19a"/><line x1="44" x2="654" y1="172" y2="172" stroke="#8da19a"/><text x="58" y="55">턴어라운드</text><text x="640" y="55" text-anchor="end">개선형 우량</text><text x="58" y="300">개선 부진</text><text x="640" y="300" text-anchor="end">안정형 우량</text>${points}<text x="349" y="340" text-anchor="middle">현재 경쟁력 FSI 백분위 →</text></svg><p class="chart-note">세로축: 모멘텀 지수(CII) 백분위 · 점 크기: 총자산 · 클릭: 기업별 근거</p>`;
  }

  function assetGroupRanking() {
    const groups=[['대','대규모','평균 자산 2조원 이상'],['중','중규모','평균 자산 5,000억원 이상~2조원 미만'],['소','소규모','평균 자산 5,000억원 미만']];
    $('asset-group-rankings').innerHTML=groups.map(([code,label,range])=>{
      const group=rows.filter(r=>r.eligible&&assetSizeGroup(r.size)===code);
      const cii=group.filter(r=>Number.isFinite(r.cii.score));
      const fsi=group.filter(r=>Number.isFinite(r.fsi.score));
      const ranked=cii.sort((a,b)=>b.cii.score-a.cii.score).slice(0,5);
      const listing=ranked.length?`<ol class="asset-rank-list">${ranked.map((r,i)=>`<li><span class="rank-number">${i+1}</span><button class="company-link" data-new-company="${h(r.id)}">${h(r.name)}</button><strong>${fmt(r.cii.score)}점</strong></li>`).join('')}</ol>`:'<p class="asset-group-empty">3년 개선 순위를 산출할 자료가 없습니다.</p>';
      return `<article class="panel asset-group-card"><div class="asset-group-head"><div><h3>${label}</h3><small>${range}</small></div><span class="asset-group-count">평가대상 ${group.length.toLocaleString('ko-KR')}개</span></div><p class="asset-group-note">2022~2025 CII 규모별 순위 · 원문 검증 전</p>${listing}<p class="asset-group-foot">CII 완전지표 ${cii.length}개 · FSI 완전지표 ${fsi.length}개 · 원문 검증 후 순위 변동 가능</p></article>`;
    }).join('');
  }

  function overview() {
    if(!data)return;
    const scored=rows.filter(r=>r.eligible&&Number.isFinite(r.cii.score));
    const winners=[['모멘텀 종합 1위',r=>r.cii.score],['성장 모멘텀 1위',r=>r.cii.sections.growth],['수익성 개선 1위',r=>r.cii.sections.profit],['재무구조 개선 1위',r=>r.cii.sections.balance],['현금흐름 개선 1위',r=>r.cii.sections.cash]];
    $('kpi-grid').innerHTML=winners.map(([label,get],i)=>{const winner=scored.filter(r=>Number.isFinite(get(r))).sort((a,b)=>get(b)-get(a))[0];return `<article class="kpi-card ${i===0?'accent':''}"><span class="kpi-label">${label}</span><strong class="kpi-company">${winner?h(winner.name):'공식 발표 전'}</strong><small>${winner?`${fmt(get(winner))}점 · ${h(winner.industry||'업종 미확인')} · ${h(assetSizeLabel(winner.size))} · 실제 개선 ${winner.improvedSections}부문`:'공시 원문·정정 검증 대기'}</small></article>`}).join('');
    const paired=rows.filter(r=>r.eligible&&r.type);
    $('scatter-chart').innerHTML=scatter(paired);
    assetGroupRanking();
    $('overview-ranking').innerHTML=scored.slice().sort((a,b)=>b.cii.score-a.cii.score).slice(0,10).map((r,i)=>`<tr><td>${i+1}</td><td><button class="company-link" data-new-company="${h(r.id)}">${h(r.name)}</button></td><td>${h(r.industry||'—')}</td><td class="score-cell">${fmt(r.cii.score)}</td><td>${fmt(r.fsi.score)}</td><td>${h(r.type||'—')}</td></tr>`).join('')||'<tr><td colspan="6" class="empty-state">2022년 자료를 확보했습니다. 완전지표 평가 기업이 없습니다.</td></tr>';
    document.querySelector('.leader-table thead').innerHTML='<tr><th>순위</th><th>기업</th><th>업종</th><th>CII</th><th>FSI</th><th>유형</th></tr>';
    const topCii=scored.slice().sort((a,b)=>b.cii.score-a.cii.score).slice(0,20).map(r=>r.id);
    const topFsi=rows.filter(r=>Number.isFinite(r.fsi.score)).sort((a,b)=>b.fsi.score-a.fsi.score).slice(0,20).map(r=>r.id);
    const overlap=topCii.filter(id=>topFsi.includes(id)).length;
    $('coverage-summary').innerHTML=`<div class="coverage-top"><strong>두 지수의 상위 20개 기업 중 ${topCii.length&&topFsi.length?`${overlap}개 중복`:'비교 보류'}</strong></div><p>후보 ${data.metadata.candidates.toLocaleString('ko-KR')}개 · 2025 원자료 ${data.metadata.rawCollected.toLocaleString('ko-KR')}개 · 2022 확인 ${data.metadata.source2022}개 · 완전지표 CII ${data.metadata.ciiCount}개 · 완전지표 FSI ${data.metadata.fsiCount}개(원문 검증 전). 두 지수는 합산하지 않습니다.</p><button class="text-button" data-view="validation">모형 검증 보기 →</button>`;
    document.querySelector('.landscape-panel .chart-legend').innerHTML='<span>● 개선형 우량</span><span>● 턴어라운드</span><span>● 안정형 우량</span><span>● 개선 부진</span>';
    $('story-cards').innerHTML=`<article class="story-card"><span class="eyebrow">CII</span><h3>최근 3년의 실제 개선</h3><p class="small-muted">2022~2025 네 시점으로 성장·수익·재무·현금·효율을 평가합니다.</p><button class="text-button" data-view="improvement">모멘텀 랭킹 보기 →</button></article><article class="story-card"><span class="eyebrow">FSI</span><h3>2025년 현재 재무체력</h3><p class="small-muted">수익성·재무안정성·현금창출·자산 효율의 현재 수준입니다.</p><button class="text-button" data-view="fsi">재무체력 지수 보기 →</button></article><article class="story-card"><span class="eyebrow">TURNAROUND</span><h3>위기에서 반등으로</h3><p class="small-muted">상대점수와 함께 최소 두 부문의 실제 재무 개선을 확인합니다.</p><button class="text-button" data-view="turnaround">턴어라운드 탐색 →</button></article>`;
    $('data-status').textContent='OpenDART · 순위 공개';
    $('data-date').textContent='2022~2025';
  }

  function validation() {
    if(!data)return;
    const meta=data.metadata;
    const sliders=Object.entries(weights).map(([key,value])=>`<label class="weight-slider">${sectionLabels[key]} <strong id="weight-${key}">${value}</strong>점<input type="range" min="0" max="100" value="${value}" data-weight="${key}" aria-label="${sectionLabels[key]} 배점"></label>`).join('');
    $('validation-content').innerHTML=`<h2>현재 데이터의 검증 범위</h2><p>후보 ${meta.candidates.toLocaleString('ko-KR')}개 · 2022년 자료 ${meta.source2022}개 · 완전지표 CII(원문 검증 전) ${meta.ciiCount}개 · 완전지표 FSI(원문 검증 전) ${meta.fsiCount}개 · 4분면 ${meta.quadrantCount}개</p><p class="notice">${data.methodology.ciiIndicators.length}개 CII 배점지표와 ${data.methodology.ciiDiagnostics.length}개 진단지표의 결측률을 보고서에 기록했습니다. CII·FSI 점수와 통계 결과는 공시 원문·정정공시 검증 전 탐색값입니다. 미래 성과 예측력은 아직 검증하지 않았습니다.</p><h3>초기 배점과 대안</h3><div class="table-scroll"><table class="data-table"><thead><tr><th>모형</th><th>성장</th><th>수익</th><th>재무</th><th>현금</th><th>효율</th></tr></thead><tbody>${[['초기',20,25,25,20,10],['균등',20,20,20,20,20],['수익 중심',15,35,20,20,10],['재무 중심',15,20,35,20,10],['현금 중심',15,20,20,35,10]].map(v=>`<tr>${v.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div><h3>사용자 배점 시뮬레이터</h3><p class="small-muted">공식 평가와 별개입니다. 5개 배점의 합계는 항상 100점이며 FSI는 바뀌지 않습니다.</p><div class="weight-grid">${sliders}</div><div id="weight-result" class="notice"></div><p><a href="./docs/weight-validation-report.md">검증 보고서</a> · <a href="./docs/missingness_report.csv">지표별 결측률 CSV</a></p>`;
    renderSimulation();
  }

  function methodology() {
    if(!data)return;
    const sections=[['growth','성장 개선',20],['profit','수익성 개선',25],['balance','재무구조 개선',25],['cash','현금흐름 개선',20],['efficiency','자본 효율 개선',10]];
    $('methodology-content').innerHTML=`<div class="notice"><strong>두 지수를 독립적으로 계산합니다.</strong><p>CII는 2022~2025년 실제 개선을, FSI는 2025년 현재 재무체력을 평가합니다. 합산하지 않습니다. 2022년 원자료 ${data.metadata.source2022}개, 검증 전 4분면 ${data.metadata.quadrantCount}개입니다. 완전지표 기업의 순위와 유형을 공개했으며 공시 원문·정정 검증 후 결과가 달라질 수 있습니다.</p></div><div class="method-cards">${sections.map(([key,label,weight])=>`<section class="panel method-card"><h3>${label}<strong>${weight}점</strong></h3><p>CII ${data.methodology.ciiIndicators.filter(([,section])=>section===key).length}개 지표</p></section>`).join('')}</div><section class="panel"><h2>재무체력 지수(FSI)</h2><p>2025년 수익성 30점, 재무안정성 35점, 현금창출력 25점, 자산 활용 10점. 3년 변화 지표는 포함하지 않습니다. 비교집단 내 상대적인 재무체력이며 기술력·주가·미래 전망을 평가하지 않습니다.</p></section><section class="panel"><h2>결측과 검증</h2><p>각 지수는 배점 100%와 최소 20개 비교집단을 충족해야 정식 산출합니다. 확보 배점 40점 이상 참고값은 공식 순위에서 제외합니다. 금융업은 전수 수집 대상이지만 별도 모형 검증 전 비금융 순위에 섞지 않습니다. 2022년 자료가 없는 기업의 3년 CAGR은 계산하지 않습니다.</p><p><a href="./docs/weight-validation-report.md">가중치 검증 보고서</a> · 모형 버전 ${h(data.metadata.modelVersion)}</p></section><section class="panel"><h2>기존 참고평가 보존</h2><p>2024 대비 2025년 1년 참고평가는 기존 참고평가 메뉴에서 확인할 수 있습니다. 이 점수는 CII나 FSI로 이름만 바꿔 쓰지 않았습니다.</p></section>`;
    $('methodology-content').insertAdjacentHTML('beforeend','<section class="panel"><h2>대·중·소 규모 분류</h2><p>화면과 종합 현황의 규모별 목록은 2024년 말과 2025년 말 총자산의 평균을 기준으로 나눕니다. 대규모는 2조원 이상, 중규모는 5,000억원 이상~2조원 미만, 소규모는 5,000억원 미만입니다. 이는 법적 대기업·중소기업 여부가 아닌 이 서비스의 비교용 분류입니다.</p><p>지표의 백분위 점수는 기존의 더 세분화된 다섯 자산구간(소형·중형·중대형·대형·초대형)과 업종으로 비교집단을 구성한 뒤 계산했습니다. 화면의 세 구간으로 묶으면서 점수를 다시 계산하지 않습니다.</p></section>');
  }

  function renderSimulation() {
    const target=$('weight-result');if(!target)return;
    const valid=rows.filter(r=>Number.isFinite(r.cii.score));
    if(!valid.length){target.textContent=`배점 합계 ${Object.values(weights).reduce((a,b)=>a+b,0)}점 · 완전지표 CII(원문 검증 전) 산출 기업이 없어 맞춤 순위 계산을 보류합니다.`;return;}
    simulated=valid.map(r=>({row:r,score:Object.entries(weights).reduce((total,[key,w])=>total+w*r.cii.sections[key]/100,0)})).sort((a,b)=>b.score-a.score);
    target.innerHTML=`배점 합계 100점 · 사용자 맞춤 1위: <strong>${h(simulated[0].row.name)} ${fmt(simulated[0].score)}점</strong> · 공식 점수와 분리한 시뮬레이션`;
  }

  function detail(id) {
    const r=rows.find(r=>r.id===id);if(!r)return;
    const series=r.series||[];
    $('company-detail').innerHTML=`<div class="detail-heading"><div><span class="eyebrow">${h(r.ticker||r.id)} · ${h(r.market)}</span><h2>${h(r.name)}</h2><p>${h(r.industry||'업종 미확인')} · ${h(assetSizeLabel(r.size))} · ${h(r.type?`${r.type}`:'유형 산출 전')}</p></div><div class="detail-score"><span>모멘텀 지수(CII)</span><strong>${verdict(r,'cii')}</strong><small>현재 경쟁력 FSI ${verdict(r,'fsi')} · 개선 ${r.improvedSections}부문</small></div></div><p class="notice">2022~2025년 실제 원자료를 확인할 수 있는 범위만 표시합니다. ‘—’는 미수집 또는 산출 불가입니다. FSI 참고점수는 정식 점수와 구분합니다.</p><div class="detail-grid"><section class="panel"><h3>연도별 변화 경로</h3><div class="table-scroll"><table class="data-table"><thead><tr><th>연도</th><th>매출액</th><th>영업이익</th><th>부채비율</th><th>영업현금흐름</th></tr></thead><tbody>${series.map(s=>`<tr><td>${s.year}</td><td>${money(s.revenue)}</td><td>${money(s.operating_income)}</td><td>${Number.isFinite(s.debt_ratio)?`${fmt(s.debt_ratio)}%`:'—'}</td><td>${money(s.operating_cash_flow)}</td></tr>`).join('')}</tbody></table></div></section><section class="panel"><h3>두 지수와 자료 충족률</h3><dl class="metric-dl"><div><dt>CII</dt><dd>${verdict(r,'cii')} · 충족 ${r.cii.coverage}%</dd></div><div><dt>FSI</dt><dd>${verdict(r,'fsi')} · 충족 ${r.fsi.coverage}%</dd></div><div><dt>FSI 참고</dt><dd>${Number.isFinite(r.fsi.referenceScore)?`${fmt(r.fsi.referenceScore)}점`:'—'}</dd></div><div><dt>실제 개선 부문</dt><dd>${r.improvedSections}개</dd></div></dl><p>${receiptLink(r)}</p></section></div><section class="panel"><h3>지표별 근거</h3><div class="table-scroll"><table class="data-table"><thead><tr><th>지표</th><th>원래 값</th><th>배점</th><th>백분위</th><th>비교집단</th></tr></thead><tbody>${[...data.methodology.ciiIndicators.map(([key,,w])=>[key,w,r.cii]),...data.methodology.fsiIndicators.map(([key,,w])=>[key,w,r.fsi])].map(([key,w,model])=>{const item=model.indicators[key]||{};return `<tr><td>${h(key)}</td><td>${fmt(model.values[key])}</td><td>${w}</td><td>${fmt(item.percentile)}</td><td>${h(item.cohort||'자료 부족')}</td></tr>`}).join('')}</tbody></table></div></section>`;
    $('company-dialog').showModal();
  }

  function decorateLegacyDetail(id) {
    const row=rows.find(r=>r.id===id);
    const heading=$('company-detail')?.querySelector('.detail-heading');
    if(!row||!heading)return;
    heading.insertAdjacentHTML('afterend',`<div class="detail-scores"><div><span>2022~2025 모멘텀 지수(CII)</span><strong>${verdict(row,'cii')}</strong></div><div><span>2025 현재 경쟁력 FSI</span><strong>${verdict(row,'fsi')}</strong></div><div><span>실제 개선 부문</span><strong>${row.improvedSections}개</strong></div><div><span>4분면 유형</span><strong class="detail-type">${h(row.type?`${row.type}`:'유형 산출 전')}</strong></div></div><p class="small-muted">CII·FSI는 기존 2024→2025 참고점수와 별개입니다. CII·FSI 순위와 유형은 원문 검증 전 결과입니다.</p>`);
  }

  async function load() {
    const response=await fetch('./improvement_data.json',{cache:'no-store'});
    if(!response.ok)throw new Error(`개선모형 자료 응답 ${response.status}`);
    data=await response.json();rows=data.companies||[];
    filters();overview();renderRanking();renderFSI();renderTurnaround();renderMap();validation();methodology();stories();
    return data;
  }

  function renderView(view) {
    if(view==='improvement')renderRanking();
    if(view==='fsi')renderFSI();
    if(view==='turnaround')renderTurnaround();
    if(view==='map')renderMap();
    if(view==='validation')validation();
  }

  document.addEventListener('click',event=>{const el=event.target.closest('[data-new-company]');if(el)detail(el.dataset.newCompany);const story=event.target.closest('[data-story]');if(story){selectedStory=story.dataset.story;stories();}const exportButton=event.target.closest('[data-story-csv]');if(exportButton){const values=storyRows(exportButton.dataset.story).slice(0,100);const columns=['id','name','ticker','market','industry','size','cii','fsi','type','improvedSections','receipt'];const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';const lines=[columns.join(','),...values.map(r=>[r.id,r.name,r.ticker,r.market,r.industry,r.size,r.cii.score,r.fsi.score,r.type,r.improvedSections,r.sourceFiles?.[2025]?.receipt].map(quote).join(','))];const url=URL.createObjectURL(new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`${exportButton.dataset.story}_2025.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}});
  document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.matches('[data-new-company]'))detail(event.target.dataset.newCompany);});
  document.addEventListener('change',event=>{if(['cii-market','cii-industry','cii-size','cii-type'].includes(event.target.id))renderRanking();if(['fsi-market','fsi-industry','fsi-size'].includes(event.target.id))renderFSI();if(['turn-industry','turn-size','turn-condition'].includes(event.target.id))renderTurnaround();if(['map-market','map-industry','map-size'].includes(event.target.id))renderMap();});
  document.addEventListener('input',event=>{if(['cii-search','cii-min','cii-max'].includes(event.target.id))renderRanking();if(event.target.id==='fsi-search')renderFSI();});
  document.addEventListener('input',event=>{
    const key=event.target.dataset.weight;if(!key)return;
    const next=Number(event.target.value),diff=next-weights[key];
    const others=Object.keys(weights).filter(k=>k!==key);
    let remaining=-diff;
    for(const other of others){const available=remaining<0?weights[other]:100-weights[other];const change=Math.sign(remaining)*Math.min(Math.abs(remaining),available);weights[other]+=change;remaining-=change;}
    if(remaining)weights[key]=next+remaining;else weights[key]=next;
    for(const [k,v] of Object.entries(weights)){const slider=document.querySelector(`[data-weight="${k}"]`);if(slider)slider.value=v;if($('weight-'+k))$('weight-'+k).textContent=v;}
    renderSimulation();
  });
  return {load,renderView,overview,decorateLegacyDetail};
}
