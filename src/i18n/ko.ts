import type { MessageKey } from './en';

const ko: Record<MessageKey, string> = {
  'app.title': 'PDF → DOCX · 내 기기에서 바로 변환',
  'app.badge': '100% 내 기기에서 처리',
  'app.tagline':
    '브라우저에서 여러 PDF를 한 번에 Word로 변환합니다. 파일은 서버로 업로드되지 않습니다.',

  'drop.title': '여기에 PDF 파일을 끌어다 놓으세요',
  'drop.or': '또는',
  'drop.browse': '파일 선택',
  'drop.suffix': '— 여러 파일이나 폴더 전체를 선택할 수 있습니다',

  'field.language': '언어',
  'field.mode': '변환 모드',
  'field.imageScale': '이미지 해상도',
  'field.ocr': '스캔 PDF OCR',
  'field.ocrLangs': 'OCR 언어',
  'field.columns': '2단 레이아웃 감지',
  'field.autoStart': '파일을 추가하면 자동으로 변환',

  'mode.text': '텍스트(편집 가능)',
  'mode.layout': '원본 레이아웃(위치 고정)',
  'mode.visual': '이미지(페이지 그대로 유지)',

  'scale.72': '72 dpi(가벼움)',
  'scale.108': '108 dpi',
  'scale.144': '144 dpi',
  'scale.216': '216 dpi(선명)',

  'ocr.auto': '텍스트가 없는 페이지에서 자동 실행',
  'ocr.force': '항상 OCR 실행',
  'ocr.off': '사용 안 함',

  'ocrLang.vieEng': '베트남어 + 영어',
  'ocrLang.chiEng': '중국어 + 영어',
  'ocrLang.jpnEng': '일본어 + 영어',
  'ocrLang.korEng': '한국어 + 영어',
  'ocrLang.rusEng': '러시아어 + 영어',
  'ocrLang.eng': '영어만',

  'action.convert': '변환',
  'action.converting': '변환 중…',
  'action.convertCount': '변환 ({count})',
  'action.convertAgain': '다시 변환',
  'action.downloadAll': '모두 다운로드(.zip)',
  'action.zipping': '압축 중…',
  'action.clear': '목록 지우기',
  'action.download': '.docx 다운로드',
  'action.downloadPages': '.docx 다운로드({pages})',
  'action.retry': '다시 시도',
  'action.remove': '삭제',

  'summary.empty': '아직 파일이 없습니다.',
  'summary.files': '파일: {count}',
  'summary.done': '완료: {count}',
  'summary.running': '진행 중: {count}',
  'summary.queued': '대기 중: {count}',
  'summary.failed': '실패: {count}',

  'status.queued': '대기 중',
  'status.processing': '처리 중…',
  'status.done': '완료',
  'status.error': '오류',
  'status.readingPdf': 'PDF 읽는 중…',

  'progress.reading': '{page}/{pages} 페이지 읽는 중',
  'progress.ocr': '{page}/{pages} 페이지 OCR 중',
  'progress.render': '{page}/{pages} 페이지 렌더링 중',
  'progress.write': 'DOCX 쓰는 중…',

  'batch.converting': '변환 중 {done}/{total} · {percent}%',

  'toast.noPdf': 'PDF 파일을 찾지 못했습니다.',
  'toast.zipFailed': 'ZIP 파일을 만들지 못했습니다.',

  'footnote.title': '참고:',
  'footnote.body':
    '파일은 내 기기에서 JavaScript로 처리됩니다. 원본 레이아웃은 각 줄을 PDF와 같은 위치에 고정하고, 텍스트 모드는 문단을 깔끔하게 다시 만들며, 이미지 모드는 페이지를 픽셀 단위로 그대로 유지합니다. 한 장의 큰 이미지로만 이루어진 페이지(표지, 스캔)는 항상 이미지로 유지됩니다. OCR은 처음 사용할 때 언어 데이터(약 5~15MB)를 CDN에서 내려받습니다.',

  'warning.blankPages':
    '텍스트 레이어가 없는 페이지(스캔 PDF)는 비어 있습니다: {pages}. OCR을 켜면 변환할 수 있습니다.',
  'warning.picturePages':
    '한 장의 이미지로만 이루어진 페이지(표지 또는 스캔)는 이미지로 유지했습니다: {pages}.',
  'warning.ocr': 'OCR로 {count}페이지를 인식했습니다. 오타가 없는지 확인하세요.',

  'error.password': '이 PDF는 비밀번호로 보호되어 있어 변환할 수 없습니다.',
  'error.invalidPdf': '유효한 PDF가 아니거나 파일이 손상되었습니다.',
  'error.unreadablePdf': 'PDF 내용을 읽을 수 없습니다.',
  'error.canvas': '이 브라우저는 canvas 2D를 지원하지 않습니다.',
  'error.pageImage': 'PDF 페이지에서 이미지를 만들 수 없습니다.',
  'error.oldBrowser': '이 브라우저는 너무 오래되어 변환할 수 없습니다. Chrome, Edge, Firefox, Safari를 업데이트하세요.',
  'action.cancel': '중지',
  'status.cancelled': '취소됨',
  'warning.imageLimit': '이미지가 60개를 넘는 페이지는 처음 60개만 유지했습니다: {pages}.',
  'error.ocr': 'OCR 단계가 실패했습니다. 연결을 확인한 뒤 다시 시도하세요.',
};

export default ko;
