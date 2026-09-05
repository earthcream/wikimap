// 共通ユーティリティ（Wikipedia API・都道府県解決）
import fs from 'node:fs';

const UA = 'wiki-prefecture-heatmap/0.1 (https://github.com/; contact via repo issues)';
const API = 'https://ja.wikipedia.org/w/api.php';

export const PREFS = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
const PREF_SET = new Set(PREFS);
export const SCHOOL = /(学校|大学|学園|高校|学院|専門|大学校)/;

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function api(params, retry = 5) {
  const url = API + '?format=json&formatversion=2&' + params;
  for (let i = 0; i < retry; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 429 || r.status >= 500) { await sleep(2000 * (i + 1)); continue; }
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error));
      return j;
    } catch (e) {
      if (i === retry - 1) throw e;
      await sleep(2000 * (i + 1));
    }
  }
}

// カテゴリ配下（サブカテゴリ再帰）の記事タイトル一覧
export async function categoryMembers(root, { maxDepth = 5, exclude = /$^/ } = {}) {
  const seen = new Set(); const pages = new Set(); const queue = [[root, 0]];
  while (queue.length) {
    const [c, d] = queue.shift();
    if (seen.has(c) || exclude.test(c)) continue; seen.add(c);
    let cont = '';
    do {
      const r = await api('action=query&list=categorymembers&cmlimit=500&cmtitle=' + encodeURIComponent(c) + cont);
      for (const m of r.query.categorymembers) {
        if (m.ns === 14) { if (d < maxDepth) queue.push([m.title, d + 1]); }
        else if (m.ns === 0) pages.add(m.title);
      }
      cont = r.continue ? '&cmcontinue=' + encodeURIComponent(r.continue.cmcontinue) : '';
    } while (cont);
  }
  return { pages: [...pages], cats: [...seen] };
}

// 複数記事のカテゴリを一括取得 → {title: [cat,...]}
export async function categoriesOf(titles, onProgress) {
  const out = {};
  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50);
    let cont = '';
    do {
      const r = await api('action=query&prop=categories&cllimit=500&titles=' + encodeURIComponent(chunk.join('|')) + cont);
      for (const p of r.query.pages) {
        if (!p.categories) continue;
        (out[p.title] ??= []).push(...p.categories.map(c => c.title.replace(/^Category:/, '')));
      }
      cont = r.continue ? '&clcontinue=' + encodeURIComponent(r.continue.clcontinue) : '';
    } while (cont);
    onProgress?.(Math.min(i + 50, titles.length), titles.length);
  }
  return out;
}

// 記事からのリンク先（ns=0）を一括取得 → Map(linkTitle -> Set(sourceTitle))
export async function linksFrom(titles, onProgress) {
  const map = new Map();
  for (let i = 0; i < titles.length; i += 10) {
    const chunk = titles.slice(i, i + 10);
    let cont = '';
    do {
      const r = await api('action=query&prop=links&plnamespace=0&pllimit=500&titles=' + encodeURIComponent(chunk.join('|')) + cont);
      for (const p of r.query.pages) for (const l of (p.links || [])) {
        if (!map.has(l.title)) map.set(l.title, new Set());
        map.get(l.title).add(p.title);
      }
      cont = r.continue ? '&plcontinue=' + encodeURIComponent(r.continue.plcontinue) : '';
    } while (cont);
    onProgress?.(Math.min(i + 10, titles.length), titles.length);
  }
  return map;
}

// 「X出身の人物」カテゴリの X を都道府県に解決（親カテゴリを辿る）。キャッシュはファイルに永続化
export class PrefResolver {
  constructor(cachePath) { this.path = cachePath; this.cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {}; }
  save() { fs.writeFileSync(this.path, JSON.stringify(this.cache, null, 0)); }
  async resolve(name, depth = 0) {
    if (PREF_SET.has(name)) return name;
    if (depth > 4 || SCHOOL.test(name)) return null;
    if (name in this.cache) return this.cache[name];
    const r = await api('action=query&prop=categories&cllimit=500&titles=' + encodeURIComponent('Category:' + name + '出身の人物'));
    const p = r.query.pages[0]; let res = null;
    for (const c of (p.categories || [])) {
      const m = c.title.match(/^Category:(.+?)出身の人物$/);
      if (m) { const x = await this.resolve(m[1], depth + 1); if (x) { res = x; break; } }
    }
    this.cache[name] = res; return res;
  }
  // 人物のカテゴリ配列から都道府県を決める（学校系は除外、最初に解決できたもの）
  async fromCats(cats) {
    const homes = cats.filter(c => /出身の人物$/.test(c)).map(c => c.replace(/出身の人物$/, '')).filter(h => !SCHOOL.test(h));
    for (const h of homes) { const x = await this.resolve(h); if (x) return x; }
    return null;
  }
}

export function birthYear(cats) {
  const b = cats.find(c => /^\d{4}年生$/.test(c));
  return b ? Number(b.slice(0, 4)) : null;
}

export const wikiUrl = (title) => 'https://ja.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_'));
