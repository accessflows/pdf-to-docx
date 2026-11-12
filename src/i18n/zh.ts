import type { MessageKey } from './en';

const zh: Record<MessageKey, string> = {
  'app.title': 'PDF → DOCX · 在您的设备上直接转换',
  'app.badge': '100% 在您的设备上处理',
  'app.tagline': '在浏览器中一次把多个 PDF 转换成 Word，文件绝不会上传到任何服务器。',

  'drop.title': '将 PDF 文件拖放到此处',
  'drop.or': '或',
  'drop.browse': '选择文件',
  'drop.suffix': '— 可多选文件，也可选择整个文件夹',

  'field.language': '语言',
  'field.mode': '转换模式',
  'field.imageScale': '图片清晰度',
  'field.ocr': '扫描版 PDF 的 OCR',
  'field.ocrLangs': 'OCR 语言',
  'field.columns': '识别双栏排版',
  'field.autoStart': '添加文件后自动转换',

  'mode.text': '文字（可编辑）',
  'mode.layout': '精确版式（按原位置固定）',
  'mode.visual': '图片（保持页面原样）',

  'scale.72': '72 dpi（体积小）',
  'scale.108': '108 dpi',
  'scale.144': '144 dpi',
  'scale.216': '216 dpi（清晰）',

  'ocr.auto': '页面没有文字时自动执行',
  'ocr.force': '始终执行 OCR',
  'ocr.off': '关闭',

  'ocrLang.vieEng': '越南语 + 英语',
  'ocrLang.chiEng': '中文 + 英语',
  'ocrLang.jpnEng': '日语 + 英语',
  'ocrLang.korEng': '韩语 + 英语',
  'ocrLang.rusEng': '俄语 + 英语',
  'ocrLang.eng': '仅英语',

  'action.convert': '转换',
  'action.converting': '正在转换…',
  'action.convertCount': '转换（{count}）',
  'action.convertAgain': '重新转换',
  'action.downloadAll': '下载全部（.zip）',
  'action.zipping': '正在压缩…',
  'action.clear': '清空列表',
  'action.download': '下载 .docx',
  'action.downloadPages': '下载 .docx（{pages}）',
  'action.retry': '重试',
  'action.remove': '删除',

  'summary.empty': '还没有文件。',
  'summary.files': '文件：{count}',
  'summary.done': '已完成：{count}',
  'summary.running': '进行中：{count}',
  'summary.queued': '等待中：{count}',
  'summary.failed': '失败：{count}',

  'status.queued': '等待中',
  'status.processing': '正在处理…',
  'status.done': '完成',
  'status.error': '错误',
  'status.readingPdf': '正在读取 PDF…',

  'progress.reading': '正在读取第 {page}/{pages} 页',
  'progress.ocr': '正在 OCR 第 {page}/{pages} 页',
  'progress.render': '正在渲染第 {page}/{pages} 页',
  'progress.write': '正在写入 DOCX…',

  'batch.converting': '正在转换 {done}/{total} · {percent}%',

  'toast.noPdf': '没有找到 PDF 文件。',
  'toast.zipFailed': '无法创建 ZIP 文件。',

  'footnote.title': '提示：',
  'footnote.body':
    '文件通过 JavaScript 在您的设备上处理。精确版式把每一行固定在 PDF 中的原位置，文字模式会重新整理成更整洁的段落，图片模式让页面像素级一致。整页只有一张大图的页面（书籍封面、扫描件）会以图片形式保留。首次使用 OCR 时会从 CDN 下载语言数据（约 5–15 MB）。',

  'warning.blankPages':
    '以下页面没有文字层（扫描版 PDF），已留空：{pages}。开启 OCR 即可转换这些页面。',
  'warning.picturePages': '整页只有一张图片的页面（封面或扫描件）已按图片保留：{pages}。',
  'warning.ocr': '有 {count} 页通过 OCR 识别 —— 请校对可能出现的错字。',

  'error.password': '该 PDF 受密码保护，无法转换。',
  'error.invalidPdf': '文件不是有效的 PDF，或者已经损坏。',
  'error.unreadablePdf': '无法读取 PDF 的内容。',
  'error.canvas': '此浏览器不支持 canvas 2D。',
  'error.pageImage': '无法从 PDF 页面生成图片。',
  'error.oldBrowser': '此浏览器版本过旧，无法转换。请更新 Chrome、Edge、Firefox 或 Safari。',
  'action.cancel': '停止',
  'status.cancelled': '已取消',
  'warning.imageLimit': '图片超过 60 张的页面只保留了前 60 张：{pages}。',
  'error.ocr': 'OCR 步骤失败，请检查网络后重试。',
};

export default zh;
