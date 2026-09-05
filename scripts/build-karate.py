# ③ 全日本少年少女空手道選手権大会 結果 → data/karate.json
#   入力: data/*.xlsx（列: 大会回, 大会名, 部門, 種目, 順位, 氏名, 都道府県）
#   出力: 優勝・準優勝・第3位のみを圧縮配列で保存
import glob, json, re, datetime
import openpyxl

PREFS = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県']
SHORT = {('北海道' if p == '北海道' else p[:-1]): p for p in PREFS}
RANK = {'優勝': 1, '準優勝': 2, '第3位': 3, '3位': 3}

rows, skipped = [], set()
for path in sorted(glob.glob('data/*.xlsx')):
    ws = openpyxl.load_workbook(path, data_only=True).active
    for r in ws.iter_rows(min_row=2, values_only=True):
        if not r or r[0] is None: continue
        kai, _, bumon, shumoku, rank, name, pref = r[:7]
        if rank not in RANK: continue
        m = re.match(r'小学校(\d)年生(男子|女子)', str(shumoku))
        pref = str(pref).strip()
        full = pref if pref in PREFS else SHORT.get(pref)
        if not m or not full: skipped.add(f'{shumoku}/{pref}'); continue
        rows.append([int(kai), 'K' if bumon == '形' else 'U', 'M' if m.group(2) == '男子' else 'F',
                     int(m.group(1)), RANK[rank], PREFS.index(full), str(name).replace('　', ' ').strip()])

rows.sort(key=lambda x: (x[0], x[1], x[2], x[3], x[4]))
out = {
    'generated': datetime.date.today().isoformat(),
    'source': '全日本少年少女空手道選手権大会 結果（優勝・準優勝・第3位）',
    'columns': ['kai', 'bumon(K=形,U=組手)', 'sex(M/F)', 'grade', 'rank(1..3)', 'prefIndex', 'name'],
    'prefs': PREFS,
    'rows': rows,
}
with open('data/karate.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print(f'rows={len(rows)} skipped={sorted(skipped)}')
