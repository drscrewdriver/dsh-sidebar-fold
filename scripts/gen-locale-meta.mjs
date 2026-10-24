/**
 * gen-locale-meta.mjs —— 生成 `locale/<lang>.json` 包元数据（9 语）。
 *
 * 宿主在装载期扫描每个 bundle 的 `locale/<lang>.json`（`en.json` 为必需锚），
 * 其形状与 shipped 侧边栏一致：`{ meta: { title, description } }`。运行时文案
 * 不在这里，在 `src/client/locales.ts`（zh 键集为真理源）。
 * 改文案后重跑本脚本，勿手改产物。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const outDir = join(root, 'locale')

/** Per-language package metadata; zh is the source wording, the rest translate it. */
const META = {
  zh: { title: '侧边栏「更多」折叠', description: '在「更多」行右侧挂一个方形箭头按钮，把侧边栏的加项面板行收纳成一行，可设置默认态与不折叠清单。' },
  en: { title: 'Sidebar “More” fold', description: 'Puts a square arrow toggle on the “More” row to fold the sidebar’s add-on panel rows into that single line, with a configurable default state and never-fold list.' },
  ja: { title: 'サイドバー「その他」折りたたみ', description: '「その他」行に四角い矢印トグルを追加し、サイドバーの追加パネル行を1行に折りたたみます。既定状態と非折りたたみリストを設定できます。' },
  ko: { title: '사이드바 “기타” 접기', description: '“기타” 행에 사각형 화살표 토글을 두어 사이드바의 추가 패널 행을 한 줄로 접습니다. 기본 상태와 접지 않는 목록을 설정할 수 있습니다.' },
  fr: { title : 'Repliement « Plus » de la barre latérale', description: 'Ajoute une bascule en flèche carrée sur la ligne « Plus » pour replier les lignes de panneau ajoutées de la barre latérale ; état par défaut et liste d’exclusion configurables.' },
  de: { title: 'Seitenleisten-„Mehr“-Einklappen', description: 'Setzt einen quadratischen Pfeil-Schalter auf die Zeile „Mehr“, um die ergänzenden Panelzeilen der Seitenleiste auf eine Zeile zu reduzieren; Standardzustand und Ausnahmeliste konfigurierbar.' },
  it: { title: 'Compressione “Altro” della barra laterale', description: 'Aggiunge un interruttore a freccia quadrata sulla riga “Altro” per comprimere le righe dei pannelli aggiunti della barra laterale; stato predefinito ed elenco di esclusioni configurabili.' },
  ru: { title: 'Сворачивание «Ещё» боковой панели', description: 'Добавляет квадратный переключатель со стрелкой на строке «Ещё», сворачивая добавленные строки панелей боковой панели в одну; настраиваемые исходное состояние и список исключений.' },
  es: { title: 'Plegado de «Más» de la barra lateral', description: 'Añade un conmutador de flecha cuadrada en la fila «Más» para plegar las filas de paneles añadidas de la barra lateral; estado predeterminado y lista de exclusiones configurables.' },
}

await mkdir(outDir, { recursive: true })
for (const [lang, meta] of Object.entries(META)) {
  await writeFile(join(outDir, `${lang}.json`), JSON.stringify({ meta }, null, 2) + '\n', 'utf8')
}
console.log(`wrote ${Object.keys(META).length} locale/*.json`)
