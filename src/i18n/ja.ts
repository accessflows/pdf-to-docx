import type { MessageKey } from './en';

const ja: Record<MessageKey, string> = {
  'app.title': 'PDF → DOCX · 端末上でそのまま変換',
  'app.badge': '100% 端末上で処理',
  'app.tagline':
    'ブラウザ上で複数の PDF をまとめて Word に変換します。ファイルがサーバーに送信されることはありません。',

  'drop.title': 'ここに PDF ファイルをドラッグ＆ドロップ',
  'drop.or': 'または',
  'drop.browse': 'ファイルを選択',
  'drop.suffix': '— 複数ファイルやフォルダーごと選択できます',

  'field.language': '言語',
  'field.mode': '変換モード',
  'field.imageScale': '画像の解像度',
  'field.ocr': 'スキャン PDF の OCR',
  'field.ocrLangs': 'OCR の言語',
  'field.columns': '2 段組を検出',
  'field.autoStart': 'ファイル追加時に自動変換',

  'mode.text': 'テキスト（編集可能）',
  'mode.visual': '画像（ページをそのまま保持）',

  'scale.72': '72 dpi（軽量）',
  'scale.108': '108 dpi',
  'scale.144': '144 dpi',
  'scale.216': '216 dpi（高精細）',

  'ocr.auto': '文字のないページで自動実行',
  'ocr.force': '常に OCR を実行',
  'ocr.off': 'オフ',

  'ocrLang.vieEng': 'ベトナム語 + 英語',
  'ocrLang.chiEng': '中国語 + 英語',
  'ocrLang.jpnEng': '日本語 + 英語',
  'ocrLang.korEng': '韓国語 + 英語',
  'ocrLang.rusEng': 'ロシア語 + 英語',
  'ocrLang.eng': '英語のみ',

  'action.convert': '変換',
  'action.converting': '変換中…',
  'action.convertCount': '変換（{count}）',
  'action.convertAgain': '再変換',
  'action.downloadAll': 'すべてダウンロード（.zip）',
  'action.zipping': '圧縮中…',
  'action.clear': 'リストをクリア',
  'action.download': '.docx をダウンロード',
  'action.downloadPages': '.docx をダウンロード（{pages}）',
  'action.retry': '再試行',
  'action.remove': '削除',

  'summary.empty': 'ファイルがまだありません。',
  'summary.files': 'ファイル: {count}',
  'summary.done': '完了: {count}',
  'summary.running': '実行中: {count}',
  'summary.queued': '待機中: {count}',
  'summary.failed': '失敗: {count}',

  'status.queued': '待機中',
  'status.processing': '処理中…',
  'status.done': '完了',
  'status.error': 'エラー',
  'status.readingPdf': 'PDF を読み込み中…',

  'progress.reading': '{page}/{pages} ページを読み込み中',
  'progress.ocr': '{page}/{pages} ページを OCR 中',
  'progress.render': '{page}/{pages} ページを描画中',
  'progress.write': 'DOCX を書き出し中…',

  'batch.converting': '変換中 {done}/{total} · {percent}%',

  'toast.noPdf': 'PDF ファイルが見つかりません。',
  'toast.zipFailed': 'ZIP ファイルを作成できませんでした。',

  'footnote.title': 'ご注意:',
  'footnote.body':
    'ファイルはお使いの端末上で JavaScript により処理されます。テキストモードは内容・画像・基本書式を保持しますが、表や複雑なレイアウトは再現できません。原本と 100% 同じにしたい場合は画像モードをご利用ください。1 枚の大きな画像だけのページ（表紙・スキャン）は画像として保持されます。OCR は初回のみ言語データ（約 5〜15 MB）を CDN からダウンロードします。',

  'warning.blankPages':
    'テキストレイヤーのないページ（スキャン PDF）は空欄になりました: {pages}。OCR を有効にすると変換できます。',
  'warning.picturePages':
    '1 枚の画像だけのページ（表紙やスキャン）は画像として保持しました: {pages}。',
  'warning.ocr': 'OCR で {count} ページを認識しました。誤字がないかご確認ください。',

  'error.password': 'この PDF はパスワードで保護されているため変換できません。',
  'error.invalidPdf': '有効な PDF ではないか、ファイルが壊れています。',
  'error.unreadablePdf': 'PDF の内容を読み込めませんでした。',
  'error.canvas': 'このブラウザは canvas 2D に対応していません。',
  'error.pageImage': 'PDF ページから画像を作成できませんでした。',
};

export default ja;
