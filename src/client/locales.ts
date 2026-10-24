/**
 * Runtime dictionaries for the browser half (9 languages, zh key set is the
 * source of truth — `dsh-plugin-dev` §4).
 *
 * These strings are ours: the toggle's accessible name and the settings card.
 * The sidebar row labels we *read* (`更多`/`More`) belong to the host and are
 * matched, never rendered, so they live in `constants.ts` instead.
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'fold.nothing': '当前没有可折叠的入口',
  'fold.expand': '展开侧边栏更多入口',
  'fold.collapse': '收起侧边栏更多入口',
  'settings.defaultFolded': '默认折叠',
  'settings.defaultFoldedHint': '新窗口在没有本地记录时采用的初始状态',
  'settings.keep': '保持可见的入口',
  'settings.keepHint': '以下是当前侧边栏里的入口行；打开开关的那一行在折叠时保持可见。',
  'settings.keepRowHint': '折叠时保持可见',
  'settings.keepEmpty': '当前侧边栏没有可折叠的入口。',
  'settings.align': '文字与图标对齐',
  'settings.alignHint': '作用于侧边栏里被折叠管理的入口行；「更多」行跟随同一个对齐。',
  'settings.alignStart': '左对齐',
  'settings.alignCenter': '居中',
  'settings.alignEnd': '右对齐',
  'settings.readonly': '当前宿主未下发可写配置面，展示内置默认值。',
} as const

/** Every other dictionary is checked complete against the zh key set. */
export type LocaleKey = keyof typeof zh

export const en: Record<LocaleKey, string> = {
  'fold.nothing': 'Nothing to fold right now',
  'fold.expand': 'Expand sidebar entries',
  'fold.collapse': 'Collapse sidebar entries',
  'settings.defaultFolded': 'Folded by default',
  'settings.defaultFoldedHint': 'Initial state for a window with no local record yet',
  'settings.keep': 'Entries kept visible',
  'settings.keepHint': 'These are the entry rows in this sidebar right now; a row switched on stays visible while the rest fold.',
  'settings.keepRowHint': 'Keep visible while folded',
  'settings.keepEmpty': 'This sidebar has no entry rows to fold.',
  'settings.align': 'Row alignment',
  'settings.alignHint': 'Applies to the entry rows managed by the fold; the “More” row follows the same alignment.',
  'settings.alignStart': 'Left',
  'settings.alignCenter': 'Center',
  'settings.alignEnd': 'Right',
  'settings.readonly': 'No writable configuration surface is served by this host; showing built-in defaults.',
}

export const ja: Record<LocaleKey, string> = {
  'fold.nothing': '折りたたむ項目がありません',
  'fold.expand': 'サイドバーの項目を展開',
  'fold.collapse': 'サイドバーの項目を折りたたむ',
  'settings.defaultFolded': '既定で折りたたむ',
  'settings.defaultFoldedHint': 'ローカル記録がないウィンドウの初期状態',
  'settings.keep': '表示したままにする項目',
  'settings.keepHint': '現在のサイドバーにある項目行です。オンにした行は折りたたみ時も表示されます。',
  'settings.keepRowHint': '折りたたみ時も表示',
  'settings.keepEmpty': '折りたためる項目行がありません。',
  'settings.align': '行の配置',
  'settings.alignHint': '折りたたみ対象の入口行に適用されます。「その他」行も同じ配置になります。',
  'settings.alignStart': '左寄せ',
  'settings.alignCenter': '中央',
  'settings.alignEnd': '右寄せ',
  'settings.readonly': 'このホストは書き込み可能な設定面を提供していません。既定値を表示しています。',
}

export const ko: Record<LocaleKey, string> = {
  'fold.nothing': '접을 항목이 없습니다',
  'fold.expand': '사이드바 항목 펼치기',
  'fold.collapse': '사이드바 항목 접기',
  'settings.defaultFolded': '기본으로 접힘',
  'settings.defaultFoldedHint': '로컬 기록이 없는 창의 초기 상태',
  'settings.keep': '계속 표시할 항목',
  'settings.keepHint': '현재 사이드바의 항목 행입니다. 켜 둔 행은 접을 때도 표시됩니다.',
  'settings.keepRowHint': '접을 때도 표시',
  'settings.keepEmpty': '접을 항목 행이 없습니다.',
  'settings.align': '행 정렬',
  'settings.alignHint': '접기 대상 입구 행에 적용됩니다. “더 보기” 행도 같은 정렬을 따릅니다.',
  'settings.alignStart': '왼쪽',
  'settings.alignCenter': '가운데',
  'settings.alignEnd': '오른쪽',
  'settings.readonly': '이 호스트가 쓰기 가능한 설정면을 제공하지 않습니다. 기본값을 표시합니다.',
}

export const fr: Record<LocaleKey, string> = {
  'fold.nothing': 'Rien à replier pour le moment',
  'fold.expand': 'Déplier les entrées de la barre latérale',
  'fold.collapse': 'Replier les entrées de la barre latérale',
  'settings.defaultFolded': 'Replié par défaut',
  'settings.defaultFoldedHint': 'État initial d’une fenêtre sans enregistrement local',
  'settings.keep': 'Entrées toujours visibles',
  'settings.keepHint': 'Voici les lignes d’entrée présentes dans cette barre latérale ; une ligne activée reste visible lors du repli.',
  'settings.keepRowHint': 'Rester visible pendant le repli',
  'settings.keepEmpty': 'Cette barre latérale n’a aucune ligne à replier.',
  'settings.align': 'Alignement des lignes',
  'settings.alignHint': 'S’applique aux lignes gérées par le repli ; la ligne « Plus » suit le même alignement.',
  'settings.alignStart': 'Gauche',
  'settings.alignCenter': 'Centré',
  'settings.alignEnd': 'Droite',
  'settings.readonly': 'Cet hôte ne fournit pas de surface de configuration modifiable ; valeurs par défaut affichées.',
}

export const de: Record<LocaleKey, string> = {
  'fold.nothing': 'Derzeit nichts einzuklappen',
  'fold.expand': 'Seiteneinträge ausklappen',
  'fold.collapse': 'Seiteneinträge einklappen',
  'settings.defaultFolded': 'Standardmäßig eingeklappt',
  'settings.defaultFoldedHint': 'Anfangszustand eines Fensters ohne lokalen Eintrag',
  'settings.keep': 'Sichtbar bleibende Einträge',
  'settings.keepHint': 'Das sind die Eintragszeilen dieser Seitenleiste; eine aktivierte Zeile bleibt beim Einklappen sichtbar.',
  'settings.keepRowHint': 'Beim Einklappen sichtbar bleiben',
  'settings.keepEmpty': 'Diese Seitenleiste hat keine einklappbaren Zeilen.',
  'settings.align': 'Zeilenausrichtung',
  'settings.alignHint': 'Gilt für die vom Einklappen verwalteten Einträge; die Zeile „Mehr“ folgt derselben Ausrichtung.',
  'settings.alignStart': 'Links',
  'settings.alignCenter': 'Zentriert',
  'settings.alignEnd': 'Rechts',
  'settings.readonly': 'Dieser Host stellt keine beschreibbare Konfigurationsoberfläche bereit; Standardwerte werden angezeigt.',
}

export const it: Record<LocaleKey, string> = {
  'fold.nothing': 'Niente da comprimere al momento',
  'fold.expand': 'Espandi le voci della barra laterale',
  'fold.collapse': 'Comprimi le voci della barra laterale',
  'settings.defaultFolded': 'Compresse per impostazione predefinita',
  'settings.defaultFoldedHint': 'Stato iniziale di una finestra senza record locale',
  'settings.keep': 'Voci sempre visibili',
  'settings.keepHint': 'Queste sono le righe presenti nella barra laterale; una riga attiva resta visibile durante la compressione.',
  'settings.keepRowHint': 'Resta visibile durante la compressione',
  'settings.keepEmpty': 'Questa barra laterale non ha righe da comprimere.',
  'settings.align': 'Allineamento delle righe',
  'settings.alignHint': 'Si applica alle righe gestite dalla compressione; anche la riga «Altro» segue lo stesso allineamento.',
  'settings.alignStart': 'Sinistra',
  'settings.alignCenter': 'Centrato',
  'settings.alignEnd': 'Destra',
  'settings.readonly': 'L’host non espone una superficie di configurazione modificabile; vengono mostrati i valori predefiniti.',
}

export const ru: Record<LocaleKey, string> = {
  'fold.nothing': 'Сейчас нечего сворачивать',
  'fold.expand': 'Развернуть записи боковой панели',
  'fold.collapse': 'Свернуть записи боковой панели',
  'settings.defaultFolded': 'Свёрнуто по умолчанию',
  'settings.defaultFoldedHint': 'Начальное состояние окна без локальной записи',
  'settings.keep': 'Остаются видимыми',
  'settings.keepHint': 'Это строки текущей боковой панели; включённая строка остаётся видимой при сворачивании.',
  'settings.keepRowHint': 'Остаётся видимой при сворачивании',
  'settings.keepEmpty': 'В этой боковой панели нет строк для сворачивания.',
  'settings.align': 'Выравнивание строк',
  'settings.alignHint': 'Применяется к строкам, которыми управляет сворачивание; строка «Ещё» следует тому же выравниванию.',
  'settings.alignStart': 'По левому краю',
  'settings.alignCenter': 'По центру',
  'settings.alignEnd': 'По правому краю',
  'settings.readonly': 'Хост не предоставляет поверхность записи настроек; показаны значения по умолчанию.',
}

export const es: Record<LocaleKey, string> = {
  'fold.nothing': 'Nada que plegar ahora mismo',
  'fold.expand': 'Desplegar entradas de la barra lateral',
  'fold.collapse': 'Plegar entradas de la barra lateral',
  'settings.defaultFolded': 'Plegado por defecto',
  'settings.defaultFoldedHint': 'Estado inicial de una ventana sin registro local',
  'settings.keep': 'Entradas siempre visibles',
  'settings.keepHint': 'Estas son las filas de la barra lateral actual; una fila activada sigue visible al plegar.',
  'settings.keepRowHint': 'Mantener visible al plegar',
  'settings.keepEmpty': 'Esta barra lateral no tiene filas que plegar.',
  'settings.align': 'Alineación de las filas',
  'settings.alignHint': 'Se aplica a las filas gestionadas por el pliegue; la fila «Más» sigue la misma alineación.',
  'settings.alignStart': 'Izquierda',
  'settings.alignCenter': 'Centrado',
  'settings.alignEnd': 'Derecha',
  'settings.readonly': 'Este host no expone una superficie de configuración editable; se muestran los valores predeterminados.',
}

/** Registered dictionaries, zh first (the truth source). */
export const languages = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'it', 'ru', 'es'] as const

/** One of the supported language tags. */
export type Language = (typeof languages)[number]

/** All dictionaries keyed by language (not by text key — mixing those up is a type error). */
export const dictionaries: Record<Language, Record<LocaleKey, string>> = {
  zh,
  en,
  ja,
  ko,
  fr,
  de,
  it,
  ru,
  es,
}

/**
 * Pick the dictionary for the shell's current language.
 *
 * The host's locale service is not read here on purpose: `documentElement.lang`
 * is what the shipped shell drives, so following it stays correct without
 * depending on a private locale face.
 * @param lang - `document.documentElement.lang` (may be empty).
 * @returns a dictionary keyed by the zh key set.
 */
export function pickDictionary(lang: string): Record<LocaleKey, string> {
  const tag = (lang || '').toLowerCase()
  for (const candidate of languages) {
    if (tag.startsWith(candidate)) return dictionaries[candidate]
  }
  return en
}
