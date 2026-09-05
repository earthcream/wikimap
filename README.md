# Wikipedia 都道府県マップ

日本語版Wikipediaに記事のある人物を、出身都道府県ごとにヒートマップ表示する静的サイト（GitHub Pages）。

- `metal/` … ② メタルミュージシャン出身地マップ
- `karate/` … ③ 全少空手 入賞者マップ（`data/*.xlsx` → `scripts/build-karate.py` → `data/karate.json`。xlsxを差し替えてActionsを実行すれば更新）
- `people/` … ① 有名人輩出マップ（準備中）
- `data/metal.json` … `scripts/build-metal.mjs` が生成（GitHub Actions が毎月1日に自動更新。Actionsタブから手動実行も可）
- `data/japan.topojson` … 都道府県境界（dataofjapan/land）
- `vendor/` … d3 v7 / topojson-client

## ローカルで動かす

```
python -m http.server 8000
# → http://localhost:8000/metal/
```

## Googleアナリティクス

`karate/index.html` 冒頭の `GA_ID = 'G-XXXXXXXXXX'` を実際の測定IDに書き換える。

## データを手動で更新する

```
node scripts/build-metal.mjs
```
（Node 22 以上。Wikipedia API に数百回アクセスするので数分かかります）
