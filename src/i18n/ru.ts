import type { MessageKey } from './en';

const ru: Record<MessageKey, string> = {
  'app.title': 'PDF → DOCX · конвертация прямо на вашем устройстве',
  'app.badge': '100% на вашем устройстве',
  'app.tagline':
    'Конвертируйте несколько PDF в Word сразу, прямо в браузере. Файлы не отправляются на сервер.',

  'drop.title': 'Перетащите файлы PDF сюда',
  'drop.or': 'или',
  'drop.browse': 'выбрать файлы',
  'drop.suffix': '— можно выбрать несколько файлов или целую папку',

  'field.language': 'Язык',
  'field.mode': 'Режим конвертации',
  'field.imageScale': 'Качество изображения',
  'field.ocr': 'OCR для сканированных PDF',
  'field.ocrLangs': 'Языки OCR',
  'field.columns': 'Определять две колонки',
  'field.autoStart': 'Начинать конвертацию сразу после добавления файлов',

  'mode.text': 'Текст (редактируемый)',
  'mode.layout': 'Точная вёрстка (по координатам)',
  'mode.visual': 'Изображения (страницы как есть)',

  'scale.72': '72 dpi (лёгкий)',
  'scale.108': '108 dpi',
  'scale.144': '144 dpi',
  'scale.216': '216 dpi (чёткий)',

  'ocr.auto': 'Автоматически, если на странице нет текста',
  'ocr.force': 'Всегда выполнять OCR',
  'ocr.off': 'Выключено',

  'ocrLang.vieEng': 'Вьетнамский + английский',
  'ocrLang.chiEng': 'Китайский + английский',
  'ocrLang.jpnEng': 'Японский + английский',
  'ocrLang.korEng': 'Корейский + английский',
  'ocrLang.rusEng': 'Русский + английский',
  'ocrLang.eng': 'Только английский',

  'action.convert': 'Конвертировать',
  'action.converting': 'Конвертация…',
  'action.convertCount': 'Конвертировать ({count})',
  'action.convertAgain': 'Конвертировать снова',
  'action.downloadAll': 'Скачать все (.zip)',
  'action.zipping': 'Сжатие…',
  'action.clear': 'Очистить список',
  'action.download': 'Скачать .docx',
  'action.downloadPages': 'Скачать .docx ({pages})',
  'action.retry': 'Повторить',
  'action.remove': 'Удалить',

  'summary.empty': 'Файлов пока нет.',
  'summary.files': 'Файлов: {count}',
  'summary.done': 'Готово: {count}',
  'summary.running': 'В работе: {count}',
  'summary.queued': 'В очереди: {count}',
  'summary.failed': 'Ошибок: {count}',

  'status.queued': 'В очереди',
  'status.processing': 'Обработка…',
  'status.done': 'Готово',
  'status.error': 'Ошибка',
  'status.readingPdf': 'Чтение PDF…',

  'progress.reading': 'Чтение страницы {page}/{pages}',
  'progress.ocr': 'OCR страницы {page}/{pages}',
  'progress.render': 'Отрисовка страницы {page}/{pages}',
  'progress.write': 'Запись DOCX…',

  'batch.converting': 'Конвертация {done}/{total} · {percent}%',

  'toast.noPdf': 'Файлы PDF не найдены.',
  'toast.zipFailed': 'Не удалось создать ZIP-файл.',

  'footnote.title': 'Примечание:',
  'footnote.body':
    'файлы обрабатываются JavaScript на вашем устройстве. Точная вёрстка оставляет каждую строку на её месте из PDF, текстовый режим пересобирает более аккуратные абзацы, а режим изображений сохраняет страницы пиксель в пиксель. Страницы из одной большой картинки (обложки, сканы) всегда сохраняются как изображение. В первый раз OCR скачивает языковые данные (~5–15 МБ) с CDN.',

  'warning.blankPages':
    'Страницы без текстового слоя (скан) оставлены пустыми: {pages}. Включите OCR, чтобы их преобразовать.',
  'warning.picturePages':
    'Страницы из одной картинки (обложка или скан) сохранены как изображение: {pages}.',
  'warning.ocr': 'OCR распознал страницы: {count}. Проверьте текст на опечатки.',

  'error.password': 'PDF защищён паролем, поэтому конвертация невозможна.',
  'error.invalidPdf': 'Файл не является корректным PDF или повреждён.',
  'error.unreadablePdf': 'Не удалось прочитать содержимое PDF.',
  'error.canvas': 'Этот браузер не поддерживает canvas 2D.',
  'error.pageImage': 'Не удалось создать изображение из страницы PDF.',
  'error.oldBrowser':
    'Этот браузер слишком старый для конвертации. Обновите Chrome, Edge, Firefox или Safari.',
  'action.cancel': 'Остановить',
  'status.cancelled': 'Отменено',
  'warning.imageLimit': 'На страницах с более чем 60 картинками оставлены первые 60: {pages}.',
  'error.ocr': 'Этап OCR завершился ошибкой. Проверьте соединение и повторите.',
};

export default ru;
