import {assetSizeGroup} from './ui-core.mjs';

export function momentumReason(row, isOfficial) {
  if (row.industry === '금융·보험업') return '금융업 별도 평가모형 미검증';
  if (!row.eligible) return '필수 재무자료 또는 평가대상 확인 전';
  if (!row.sourceYears?.includes(2022)) return '2022년 원자료 미확보';
  if (row.cii?.coverage < 100) return 'CII 지표 미충족';
  if (Number.isFinite(row.cii?.score)) return isOfficial ? '검증 완료' : '순위 · 공시 원문·정정 검증 전';
  return '평가 보류';
}

export function momentumCandidates(rows, filters) {
  const {market='all',industry='all',size='all',type='all',search='',min=null,max=null}=filters;
  const term=search.trim().toLocaleLowerCase('ko-KR');
  return rows.filter(row=>{
    if (!['코스피','코스닥'].includes(row.market)) return false;
    if (market!=='all'&&row.market!==market) return false;
    if (industry!=='all'&&row.industry!==industry) return false;
    if (size!=='all'&&assetSizeGroup(row.size)!==size) return false;
    if (type!=='all'&&row.type!==type) return false;
    if (term&&![row.name,row.ticker,row.id].some(value=>String(value||'').toLocaleLowerCase('ko-KR').includes(term))) return false;
    const score=Number.isFinite(row.cii?.score)?row.cii.score:null;
    if (min!==null&&(score===null||score<min)) return false;
    if (max!==null&&(score===null||score>max)) return false;
    return true;
  }).sort((a,b)=>{
    const av=a.cii?.score,bv=b.cii?.score;
    if (Number.isFinite(av)&&Number.isFinite(bv)) return bv-av;
    if (Number.isFinite(av)) return -1;
    if (Number.isFinite(bv)) return 1;
    return a.name.localeCompare(b.name,'ko');
  });
}
