/**
 * Runtime dictionaries for the browser half (10 languages, zh key set is the
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
  'menu.settings': '侧栏折叠设置',
  'settings.defaultFolded': '默认折叠',
  'settings.defaultFoldedHint': '新窗口在没有本地记录时采用的初始状态',
  'settings.rows': '入口行',
  'settings.rowsHint': '每行三档：显示＝一直显示；折叠＝允许折叠；隐藏到更多＝移进「更多」菜单。',
  'settings.rowAlways': '显示',
  'settings.rowFold': '折叠',
  'settings.rowMore': '隐藏到更多',
  'settings.rowHint': '显示＝一直显示，折叠＝允许折叠',
  'settings.rowsEmpty': '当前侧边栏没有可管理的入口。',
  'settings.moreUnavailable': '当前宿主不支持「隐藏到更多」（需要 0.2.2 起的侧边栏）。',
  'settings.moreFixed': '宿主固定入口，不能隐藏到「更多」。',
  'settings.saving': '保存中…',
  'settings.saved': '已保存',
  'settings.saveFailed': '保存失败，侧栏已按新生效但宿主未落盘。',
  'settings.retrySave': '重试保存',
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
  'menu.settings': 'Sidebar fold settings',
  'settings.defaultFolded': 'Folded by default',
  'settings.defaultFoldedHint': 'Initial state for a window with no local record yet',
  'settings.rows': 'Entries',
  'settings.rowsHint': 'Three states per row: Show keeps it visible, Fold lets the fold hide it, Hide in More moves it into the “More” menu.',
  'settings.rowAlways': 'Show',
  'settings.rowFold': 'Fold',
  'settings.rowMore': 'Hide in More',
  'settings.rowHint': 'Show = always visible; Fold = may be folded',
  'settings.rowsEmpty': 'This sidebar has no entries to manage.',
  'settings.moreUnavailable': 'This host cannot hide entries in “More” (needs a 0.2.2 sidebar).',
  'settings.moreFixed': 'This is the host’s fixed entry; it cannot be hidden in “More”.',
  'settings.saving': 'Saving…',
  'settings.saved': 'Saved',
  'settings.saveFailed': 'Save failed: the sidebar applied it, the host did not store it.',
  'settings.retrySave': 'Retry save',
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
  'menu.settings': 'サイドバー折りたたみ設定',
  'settings.defaultFolded': '既定で折りたたむ',
  'settings.defaultFoldedHint': 'ローカル記録がないウィンドウの初期状態',
  'settings.rows': '項目',
  'settings.rowsHint': '行ごとに3段階：表示＝常に表示、折りたたみ＝折りたたみ可、「その他」へ隠す＝「その他」メニューへ移動。',
  'settings.rowAlways': '表示',
  'settings.rowFold': '折りたたみ',
  'settings.rowMore': '「その他」へ隠す',
  'settings.rowHint': '表示＝常に表示、折りたたみ＝折りたたみ可',
  'settings.rowsEmpty': '管理できる項目行がありません。',
  'settings.moreUnavailable': 'このホストは「その他」への隠し表示に対応していません（0.2.2 以降のサイドバーが必要）。',
  'settings.moreFixed': 'ホスト固定の入口のため「その他」へ隠せません。',
  'settings.saving': '保存中…',
  'settings.saved': '保存しました',
  'settings.saveFailed': '保存に失敗しました（サイドバーには反映済み、ホスト未保存）。',
  'settings.retrySave': '保存を再試行',
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
  'menu.settings': '사이드바 접기 설정',
  'settings.defaultFolded': '기본으로 접힘',
  'settings.defaultFoldedHint': '로컬 기록이 없는 창의 초기 상태',
  'settings.rows': '항목',
  'settings.rowsHint': '행마다 3단계: 표시＝항상 표시, 접기＝접기 허용, 더 보기에 숨기기＝“더 보기” 메뉴로 이동.',
  'settings.rowAlways': '표시',
  'settings.rowFold': '접기',
  'settings.rowMore': '더 보기에 숨기기',
  'settings.rowHint': '표시＝항상 표시, 접기＝접기 허용',
  'settings.rowsEmpty': '관리할 항목 행이 없습니다.',
  'settings.moreUnavailable': '이 호스트는 “더 보기”에 숨기기를 지원하지 않습니다(0.2.2 이상 사이드바 필요).',
  'settings.moreFixed': '호스트 고정 항목이라 “더 보기”에 숨길 수 없습니다.',
  'settings.saving': '저장 중…',
  'settings.saved': '저장됨',
  'settings.saveFailed': '저장 실패: 사이드바에는 적용됐지만 호스트에 기록되지 않았습니다.',
  'settings.retrySave': '저장 다시 시도',
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
  'menu.settings': 'Réglages du repli de la barre latérale',
  'settings.defaultFolded': 'Replié par défaut',
  'settings.defaultFoldedHint': 'État initial d’une fenêtre sans enregistrement local',
  'settings.rows': 'Entrées',
  'settings.rowsHint': 'Trois états par ligne : Afficher la garde visible, Replier laisse le repli la masquer, Masquer dans « Plus » la déplace dans le menu « Plus ».',
  'settings.rowAlways': 'Afficher',
  'settings.rowFold': 'Replier',
  'settings.rowMore': 'Masquer dans « Plus »',
  'settings.rowHint': 'Afficher = toujours visible ; Replier = peut être replié',
  'settings.rowsEmpty': 'Cette barre latérale n’a aucune ligne à gérer.',
  'settings.moreUnavailable': 'Cet hôte ne sait pas masquer une entrée dans « Plus » (barre latérale 0.2.2 requise).',
  'settings.moreFixed': 'Entrée fixe de l’hôte : impossible de la masquer dans « Plus ».',
  'settings.saving': 'Enregistrement…',
  'settings.saved': 'Enregistré',
  'settings.saveFailed': 'Échec de l’enregistrement : appliqué à la barre latérale, non stocké par l’hôte.',
  'settings.retrySave': 'Réessayer',
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
  'menu.settings': 'Einstellungen für das Einklappen',
  'settings.defaultFolded': 'Standardmäßig eingeklappt',
  'settings.defaultFoldedHint': 'Anfangszustand eines Fensters ohne lokalen Eintrag',
  'settings.rows': 'Einträge',
  'settings.rowsHint': 'Drei Zustände pro Zeile: Anzeigen bleibt sichtbar, Einklappen lässt die Zeile verschwinden, In „Mehr“ ausblenden verschiebt sie in das Menü „Mehr“.',
  'settings.rowAlways': 'Anzeigen',
  'settings.rowFold': 'Einklappen',
  'settings.rowMore': 'In „Mehr“ ausblenden',
  'settings.rowHint': 'Anzeigen = immer sichtbar; Einklappen = darf eingeklappt werden',
  'settings.rowsEmpty': 'Diese Seitenleiste hat keine verwaltbaren Zeilen.',
  'settings.moreUnavailable': 'Dieser Host kann Einträge nicht in „Mehr“ ausblenden (Seitenleiste 0.2.2 nötig).',
  'settings.moreFixed': 'Vom Host fixierter Eintrag — kann nicht in „Mehr“ ausgeblendet werden.',
  'settings.saving': 'Wird gespeichert…',
  'settings.saved': 'Gespeichert',
  'settings.saveFailed': 'Speichern fehlgeschlagen: in der Seitenleiste angewendet, vom Host nicht gespeichert.',
  'settings.retrySave': 'Speichern wiederholen',
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
  'menu.settings': 'Impostazioni della compressione',
  'settings.defaultFolded': 'Compresse per impostazione predefinita',
  'settings.defaultFoldedHint': 'Stato iniziale di una finestra senza record locale',
  'settings.rows': 'Voci',
  'settings.rowsHint': 'Tre stati per riga: Mostra resta visibile, Comprimi lascia che la compressione la nasconda, Nascondi in «Altro» la sposta nel menu «Altro».',
  'settings.rowAlways': 'Mostra',
  'settings.rowFold': 'Comprimi',
  'settings.rowMore': 'Nascondi in «Altro»',
  'settings.rowHint': 'Mostra = sempre visibile; Comprimi = può essere compressa',
  'settings.rowsEmpty': 'Questa barra laterale non ha righe da gestire.',
  'settings.moreUnavailable': 'Questo host non sa nascondere le voci in «Altro» (serve una barra laterale 0.2.2).',
  'settings.moreFixed': 'Voce fissa dell’host: non può essere nascosta in «Altro».',
  'settings.saving': 'Salvataggio…',
  'settings.saved': 'Salvato',
  'settings.saveFailed': 'Salvataggio non riuscito: applicato alla barra laterale, non memorizzato dall’host.',
  'settings.retrySave': 'Riprova a salvare',
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
  'menu.settings': 'Настройки сворачивания',
  'settings.defaultFolded': 'Свёрнуто по умолчанию',
  'settings.defaultFoldedHint': 'Начальное состояние окна без локальной записи',
  'settings.rows': 'Пункты',
  'settings.rowsHint': 'Три состояния на строку: Показывать оставляет её видимой, Сворачивать позволяет её скрыть, Скрыть в «Ещё» переносит её в меню «Ещё».',
  'settings.rowAlways': 'Показывать',
  'settings.rowFold': 'Сворачивать',
  'settings.rowMore': 'Скрыть в «Ещё»',
  'settings.rowHint': 'Показывать = всегда видна; Сворачивать = может быть скрыта',
  'settings.rowsEmpty': 'В этой боковой панели нет строк для управления.',
  'settings.moreUnavailable': 'Этот хост не умеет скрывать пункты в «Ещё» (нужна боковая панель 0.2.2).',
  'settings.moreFixed': 'Закреплённый хостом пункт — скрыть в «Ещё» нельзя.',
  'settings.saving': 'Сохранение…',
  'settings.saved': 'Сохранено',
  'settings.saveFailed': 'Не удалось сохранить: в панели применено, хостом не записано.',
  'settings.retrySave': 'Повторить сохранение',
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
  'menu.settings': 'Ajustes del plegado de la barra lateral',
  'settings.defaultFolded': 'Plegado por defecto',
  'settings.defaultFoldedHint': 'Estado inicial de una ventana sin registro local',
  'settings.rows': 'Entradas',
  'settings.rowsHint': 'Tres estados por fila: Mostrar la mantiene visible, Plegar deja que el pliegue la oculte, Ocultar en «Más» la mueve al menú «Más».',
  'settings.rowAlways': 'Mostrar',
  'settings.rowFold': 'Plegar',
  'settings.rowMore': 'Ocultar en «Más»',
  'settings.rowHint': 'Mostrar = siempre visible; Plegar = se puede plegar',
  'settings.rowsEmpty': 'Esta barra lateral no tiene filas que gestionar.',
  'settings.moreUnavailable': 'Este host no puede ocultar entradas en «Más» (requiere una barra lateral 0.2.2).',
  'settings.moreFixed': 'Entrada fija del host: no se puede ocultar en «Más».',
  'settings.saving': 'Guardando…',
  'settings.saved': 'Guardado',
  'settings.saveFailed': 'Error al guardar: aplicado en la barra lateral, no almacenado por el host.',
  'settings.retrySave': 'Reintentar guardado',
  'settings.align': 'Alineación de las filas',
  'settings.alignHint': 'Se aplica a las filas gestionadas por el pliegue; la fila «Más» sigue la misma alineación.',
  'settings.alignStart': 'Izquierda',
  'settings.alignCenter': 'Centrado',
  'settings.alignEnd': 'Derecha',
  'settings.readonly': 'Este host no expone una superficie de configuración editable; se muestran los valores predeterminados.',
}

/** Brazilian Portuguese dictionary, checked complete against the zh key set. */
export const pt: Record<LocaleKey, string> = {
  'fold.nothing': 'Não há entradas para recolher agora',
  'fold.expand': 'Expandir mais entradas da barra lateral',
  'fold.collapse': 'Recolher mais entradas da barra lateral',
  'menu.settings': 'Configurações de recolhimento da barra lateral',
  'settings.defaultFolded': 'Recolhido por padrão',
  'settings.defaultFoldedHint': 'Estado inicial de uma janela sem registro local',
  'settings.rows': 'Entradas',
  'settings.rowsHint': 'Três estados por linha: Mostrar mantém a linha sempre visível; Recolher permite o recolhimento; Ocultar em «Mais» move a linha para o menu «Mais».',
  'settings.rowAlways': 'Mostrar',
  'settings.rowFold': 'Recolher',
  'settings.rowMore': 'Ocultar em «Mais»',
  'settings.rowHint': 'Mostrar = sempre visível; Recolher = pode ser recolhida',
  'settings.rowsEmpty': 'A barra lateral não tem entradas gerenciáveis no momento.',
  'settings.moreUnavailable': 'Este host não oculta entradas em «Mais» (requer a barra lateral 0.2.2 ou mais recente).',
  'settings.moreFixed': 'Entrada fixa do host: não pode ser ocultada em «Mais».',
  'settings.saving': 'Salvando…',
  'settings.saved': 'Salvo',
  'settings.saveFailed': 'Falha ao salvar: aplicado na barra lateral, mas o host não gravou em disco.',
  'settings.retrySave': 'Tentar salvar novamente',
  'settings.align': 'Alinhamento do texto e do ícone',
  'settings.alignHint': 'Vale para as linhas de entrada gerenciadas pelo recolhimento na barra lateral; a linha «Mais» segue o mesmo alinhamento.',
  'settings.alignStart': 'Esquerda',
  'settings.alignCenter': 'Centralizado',
  'settings.alignEnd': 'Direita',
  'settings.readonly': 'Este host não expõe uma superfície de configuração editável; são exibidos os valores padrão incorporados.',
}

/** Registered dictionaries, zh first (the truth source). */
export const languages = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'it', 'ru', 'es', 'pt'] as const

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
  pt,
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
