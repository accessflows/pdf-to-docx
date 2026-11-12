import type { MessageKey } from './en';

const vi: Record<MessageKey, string> = {
  'app.title': 'PDF → DOCX · chuyển đổi ngay trên máy bạn',
  'app.badge': '100% trên máy bạn',
  'app.tagline':
    'Chuyển nhiều file PDF sang Word cùng lúc, ngay trong trình duyệt. File không được tải lên server nào.',

  'drop.title': 'Kéo & thả file PDF vào đây',
  'drop.or': 'hoặc',
  'drop.browse': 'chọn file',
  'drop.suffix': '— chọn được nhiều file, kể cả cả thư mục',

  'field.language': 'Ngôn ngữ',
  'field.mode': 'Chế độ chuyển',
  'field.imageScale': 'Độ nét ảnh',
  'field.ocr': 'OCR cho PDF scan',
  'field.ocrLangs': 'Ngôn ngữ OCR',
  'field.columns': 'Nhận diện bố cục 2 cột',
  'field.autoStart': 'Tự động chuyển khi thêm file',

  'mode.text': 'Văn bản (sửa được)',
  'mode.visual': 'Hình ảnh (giữ nguyên trang)',

  'scale.72': '72 dpi (nhẹ)',
  'scale.108': '108 dpi',
  'scale.144': '144 dpi',
  'scale.216': '216 dpi (nét)',

  'ocr.auto': 'Tự động khi trang không có chữ',
  'ocr.force': 'Luôn chạy OCR',
  'ocr.off': 'Tắt',

  'ocrLang.vieEng': 'Tiếng Việt + Anh',
  'ocrLang.chiEng': 'Tiếng Trung + Anh',
  'ocrLang.jpnEng': 'Tiếng Nhật + Anh',
  'ocrLang.korEng': 'Tiếng Hàn + Anh',
  'ocrLang.rusEng': 'Tiếng Nga + Anh',
  'ocrLang.eng': 'Chỉ tiếng Anh',

  'action.convert': 'Chuyển đổi',
  'action.converting': 'Đang chuyển đổi…',
  'action.convertCount': 'Chuyển đổi ({count})',
  'action.convertAgain': 'Chuyển đổi lại',
  'action.downloadAll': 'Tải tất cả (.zip)',
  'action.zipping': 'Đang nén…',
  'action.clear': 'Xóa danh sách',
  'action.download': 'Tải .docx',
  'action.downloadPages': 'Tải .docx ({pages})',
  'action.retry': 'Thử lại',
  'action.remove': 'Xóa',

  'summary.empty': 'Chưa có file nào.',
  'summary.files': 'File: {count}',
  'summary.done': 'Xong: {count}',
  'summary.running': 'Đang chạy: {count}',
  'summary.queued': 'Chờ: {count}',
  'summary.failed': 'Lỗi: {count}',

  'status.queued': 'Chờ',
  'status.processing': 'Đang xử lý…',
  'status.done': 'Xong',
  'status.error': 'Lỗi',
  'status.readingPdf': 'Đang đọc PDF…',

  'progress.reading': 'Đọc trang {page}/{pages}',
  'progress.ocr': 'OCR trang {page}/{pages}',
  'progress.render': 'Dựng ảnh trang {page}/{pages}',
  'progress.write': 'Đang ghi file DOCX…',

  'batch.converting': 'Đang chuyển đổi {done}/{total} file · {percent}%',

  'toast.noPdf': 'Không tìm thấy file PDF nào.',
  'toast.zipFailed': 'Không tạo được file ZIP.',

  'footnote.title': 'Lưu ý:',
  'footnote.body':
    'file được xử lý bằng JavaScript ngay trên máy bạn. Chế độ văn bản giữ nội dung, hình ảnh và định dạng cơ bản nhưng không tái tạo được bảng hay bố cục phức tạp — hãy dùng chế độ hình ảnh khi cần giống bản gốc 100%. Trang scan hoặc trang bìa (chỉ có một ảnh lớn) được giữ nguyên dưới dạng ảnh. OCR tải dữ liệu ngôn ngữ (~5–15 MB) từ CDN ở lần dùng đầu tiên.',

  'warning.blankPages':
    'Các trang không có lớp văn bản (PDF scan) đã bị bỏ trống: {pages}. Bật OCR để chuyển các trang này.',
  'warning.picturePages':
    'Các trang là hình (bìa hoặc bản scan) được giữ nguyên dưới dạng ảnh: {pages}.',
  'warning.ocr': '{count} trang được nhận dạng bằng OCR — hãy đọc lại để sửa lỗi chính tả nếu có.',

  'error.password': 'PDF được bảo vệ bằng mật khẩu nên không thể chuyển đổi.',
  'error.invalidPdf': 'File không phải PDF hợp lệ hoặc đã bị hỏng.',
  'error.unreadablePdf': 'Không đọc được nội dung PDF.',
  'error.canvas': 'Trình duyệt không hỗ trợ canvas 2D.',
  'error.pageImage': 'Không thể tạo ảnh từ trang PDF.',
};

export default vi;
