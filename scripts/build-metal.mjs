// ② メタルミュージシャン × 出身都道府県 データ生成
//   出力: data/metal.json
//   対象:
//     A. Category:日本のヘヴィメタル・ミュージシャン 配下（サブカテゴリ含む）の人物記事
//     B. Category:日本のヘヴィメタル・バンド 配下の各バンド記事の Infobox「メンバー／旧メンバー」欄にリンクされた人物
//        （生年カテゴリあり・ミュージシャン系カテゴリあり・「〇〇出身の人物」カテゴリありのもの）
//   出身地は「〇〇出身の人物」カテゴリを親カテゴリへ辿って都道府県に解決
import fs from 'node:fs';
import { api, categoryMembers, categoriesOf, PrefResolver, birthYear, wikiUrl, PREFS } from './lib.mjs';

const MUS = /(ミュージシャン|歌手|ギタリスト|ベーシスト|ドラマー|ボーカリスト|キーボーディスト|シンガーソングライター|作曲家|音楽プロデューサー)/;
const INSTR = /^(ボーカル|ギター|ベース|ドラム|キーボード|ドラムス|バイオリン|ヴァイオリン|DJ|サンプラー|マニピュレーター|パーカッション|コーラス|サポート|ピアノ|シンセサイザー|エレクトリック|アコースティック)/;
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);

fs.mkdirSync('data', { recursive: true });
const resolver = new PrefResolver('data/pref-cache.json');

// A) 人物カテゴリ
log('カテゴリ収集: 日本のヘヴィメタル・ミュージシャン');
const mus = await categoryMembers('Category:日本のヘヴィメタル・ミュージシャン');
const musPages = mus.pages.filter(t => !/一覧$/.test(t));
log(' ', musPages.length, '記事');

// B) バンド記事 → Infobox メンバー欄のリンク
log('カテゴリ収集: 日本のヘヴィメタル・バンド');
const bands = await categoryMembers('Category:日本のヘヴィメタル・バンド');
const bandPages = bands.pages.filter(t => !/一覧$|^ジャパニーズ・メタル$/.test(t));
log(' ', bandPages.length, '記事');

const members = new Map(); // title -> Set(band)
const FIELD = /\|\s*(?:Current_members|Past_members|現在のメンバー|旧メンバー|過去のメンバー|メンバー|元メンバー)\s*=\s*([\s\S]{0,4000}?)(?=\n\s*\||\n\}\}|\n==)/g;
for (let i = 0; i < bandPages.length; i += 50) {
  const chunk = bandPages.slice(i, i + 50);
  const r = await api('action=query&prop=revisions&rvprop=content&rvslots=main&titles=' + encodeURIComponent(chunk.join('|')));
  for (const p of r.query.pages) {
    const wt = p.revisions?.[0]?.slots?.main?.content || '';
    let m; FIELD.lastIndex = 0;
    while ((m = FIELD.exec(wt))) {
      for (const l of m[1].matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) {
        const t = l[1].trim();
        if (INSTR.test(t)) continue;
        if (!members.has(t)) members.set(t, new Set());
        members.get(t).add(p.title);
      }
    }
  }
  log('  bands', Math.min(i + 50, bandPages.length), '/', bandPages.length);
}
log(' メンバー欄リンク', members.size, '件');

// カテゴリ取得と判定
const candidates = [...new Set([...musPages, ...members.keys()])];
const cats = await categoriesOf(candidates, (i, n) => i % 500 === 0 && log('  cats', i, '/', n));
const musSet = new Set(musPages);
const people = [];
for (const t of candidates) {
  const c = cats[t]; if (!c) continue;
  if (c.some(x => /^架空/.test(x))) continue;
  const fromCat = musSet.has(t);
  const fromBand = members.has(t) && c.some(x => /^\d{4}年生$/.test(x)) && c.some(x => MUS.test(x));
  if (!fromCat && !fromBand) continue;
  people.push({ title: t, cats: c, fromCat, bands: [...(members.get(t) || [])] });
}
log('人物候補', people.length);

// 都道府県解決
const out = [];
let i = 0;
for (const p of people) {
  const pref = await resolver.fromCats(p.cats);
  if (++i % 50 === 0) { log('  pref', i, '/', people.length); resolver.save(); }
  if (!pref) continue;
  out.push({ name: p.title, url: wikiUrl(p.title), pref, birth: birthYear(p.cats), src: p.fromCat ? 'category' : 'band', bands: p.bands.map(b => b.replace(/ \(.*\)$/, '')).slice(0, 5) });
}
resolver.save();
out.sort((a, b) => PREFS.indexOf(a.pref) - PREFS.indexOf(b.pref) || (a.birth ?? 9999) - (b.birth ?? 9999));

const byPref = Object.fromEntries(PREFS.map(p => [p, 0]));
for (const p of out) byPref[p.pref]++;

fs.writeFileSync('data/metal.json', JSON.stringify({
  generated: new Date().toISOString(),
  source: 'ja.wikipedia.org（Category:日本のヘヴィメタル・ミュージシャン ／ Category:日本のヘヴィメタル・バンド 各記事のメンバー欄）',
  total: out.length,
  unresolved: people.length - out.length,
  byPref,
  people: out,
}, null, 1));
log('完了: 出身地あり', out.length, '/ 候補', people.length);
