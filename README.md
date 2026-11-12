# PDF → DOCX (chạy hoàn toàn trên máy người dùng)

Trang web tĩnh chuyển PDF sang DOCX **ngay trong trình duyệt**: file không được upload lên server nào,
không cần backend, chạy được offline sau lần tải đầu.

## Tính năng

- **Nhiều file cùng lúc**: kéo & thả (kể cả cả thư mục), hàng đợi chạy song song có giới hạn theo số core CPU.
  Tự động chuyển khi thêm file (có thể tắt); nút chính đổi thành "Chuyển đổi lại" khi mọi file đã xong,
  và luôn có thanh tiến trình tổng + % từng file.
- **Ba chế độ chuyển**
  - `Bố cục gốc (neo tuyệt đối)`: giữ **từng dòng chữ và từng ảnh đúng toạ độ** trong PDF
    (mỗi dòng là một `w:framePr` neo theo trang, ảnh là floating picture `behindDoc`), nên DOCX trông
    gần như bản gốc mà chữ vẫn sửa được. Đo trên `sample.pdf` rồi xuất lại bằng Word: lệch **0,0–0,2 pt**
    theo cả x và y, cỡ chữ khớp 100% ở các dòng so khớp được (chế độ văn bản: lệch tới 34–51 pt).
  - `Văn bản (sửa được)`: dựng lại đoạn văn, tiêu đề, chữ đậm/nghiêng, giãn dòng, lề, khổ giấy — DOCX sạch
    và dễ sửa nhất. Hình ảnh trong PDF (ảnh chụp, hình minh hoạ, logo) được nhúng lại đúng vị trí.
  - `Hình ảnh (giữ nguyên trang)`: mỗi trang PDF thành một ảnh PNG trong DOCX, giống bản gốc 100% nhưng không sửa chữ được.

  Ở cả ba chế độ, trang chỉ có một ảnh lớn (bìa sách, trang scan) được giữ nguyên cả trang dưới dạng ảnh.
- **OCR cho PDF scan** (tesseract.js): tự động nhận dạng trang không có lớp văn bản, chọn được bộ ngôn ngữ
  Anh / Việt / Trung / Nhật / Hàn / Nga (mỗi ngôn ngữ ghép với tiếng Anh để nhận đúng ký tự Latin).
  Trang scan/bìa bị phủ kín bởi một ảnh được giữ nguyên dạng ảnh thay vì OCR (chọn "Luôn chạy OCR" để ép).
- **Nhận diện bố cục 2 cột** (có thể tắt).
- Tải từng file `.docx` hoặc tải tất cả thành một file `.zip`.
- **Giao diện 6 ngôn ngữ**: English (mặc định), Tiếng Việt, 中文, 日本語, 한국어, Русский — ô chọn ở góc trên
  bên phải, lưu vào `localStorage`, đổi cả `<html lang>` và tiêu đề tab. Sáng/tối theo hệ điều hành.

## Ngôn ngữ giao diện

Bản dịch nằm trong `src/i18n/`: `en.ts` là từ điển gốc (định nghĩa `MessageKey`), các file còn lại phải
có đủ khoá và đủ placeholder như `en.ts` — test `tests/i18n.test.ts` kiểm tra điều này.

Thêm ngôn ngữ mới: tạo file từ điển, đăng ký trong `DICTIONARIES` + `LOCALES` (`src/i18n/index.ts`),
thêm dòng vào `OCR_LANGS_BY_LOCALE` và `PAGE_FORMS` nếu ngôn ngữ đó cần dạng số nhiều riêng.

Cảnh báo và lỗi từ tầng chuyển đổi là dữ liệu có mã (`{ code, pages }`, `ConvertError`), giao diện mới
dịch thành câu — nhờ vậy đổi ngôn ngữ không cần chuyển lại file.

## Chạy

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build tĩnh vào dist/
npm run preview    # xem thử bản build
npm test           # unit test + test chuyển đổi end-to-end (Node)
```

`npm run build` tự động copy font chuẩn + CMaps của pdf.js vào `public/pdfjs` (script `scripts/copy-pdfjs-assets.mjs`)
để trình duyệt không phải gọi CDN khi đo font hoặc gặp file CJK.

## Cách hoạt động

```
File PDF
  └─ pdf.js (worker)          đọc trang + getTextContent() -> fragment có toạ độ, cỡ chữ, font
      │                       + getOperatorList() -> ảnh vẽ trên trang và cờ chữ ẩn (text layer của bản scan)
      ├─ src/core/anchoredLayout  gộp fragment thành từng dòng, giữ nguyên x/baseline (chế độ bố cục)
      ├─ src/core/textLayout  gộp dòng, tách cột, gom đoạn, suy ra heading / canh giữa / giãn dòng (chế độ văn bản)
      │   └─ src/core/docxBuild  -> Paragraph/TextRun, frame neo tuyệt đối hoặc floating picture
      └─ src/core/imageEncode    pixel của ảnh -> PNG/JPEG (canvas trong trình duyệt, PNG thuần trong Node)
          └─ Packer         -> Blob .docx  -> tải về hoặc nén ZIP
```

- Chế độ bố cục gốc: mỗi dòng thành một paragraph có `w:framePr` neo theo trang (`hAnchor/vAnchor=page`,
  `wrap=none`, `lineRule=exact`), ảnh thành floating picture `behindDoc` cùng toạ độ. Không có gì chảy lại,
  nên vị trí khớp bản gốc; đổi lại mỗi dòng là một khung riêng nên sửa nhiều sẽ dễ lệch.
- Chế độ hình ảnh: `page.render()` vào canvas → PNG → `ImageRun` với kích thước trang gốc.
- Chế độ văn bản: mỗi ảnh được vẽ trên trang (XObject hoặc inline) được nhúng lại theo đúng khung và thứ tự
  xuất hiện, thu nhỏ cho vừa lề nếu cần. Trang không có chữ dùng được (chữ ẩn hoặc không có text layer) mà
  lại được phủ gần kín bằng một ảnh — bìa sách, trang scan, poster — được giữ nguyên cả trang dưới dạng ảnh.
  Từ 200.000 pixel trở lên, ảnh không có kênh trong suốt được lưu bằng JPEG để DOCX không phình to.
- Trang không có text layer và không có ảnh: nếu bật OCR, trang được render rồi đưa qua tesseract.js
  (dữ liệu ngôn ngữ tải từ CDN ở lần đầu, sau đó trình duyệt cache lại); nếu tắt OCR, trang bị bỏ trống và có cảnh báo.

| Đường dẫn | Vai trò |
| --- | --- |
| `src/main.ts` | Toàn bộ UI: dropzone, hàng đợi, tiến trình, tải file/zip |
| `src/i18n/` | Từ điển 6 ngôn ngữ + hàm `t()`, `formatPages()` |
| `src/core/pdfExtract.ts` | pdf.js → fragment văn bản, nhận biết đậm/nghiêng/tên font |
| `src/core/pdfImages.ts` | pdf.js operator list → khung của từng ảnh, phát hiện trang scan/bìa |
| `src/core/anchoredLayout.ts` | Fragment → dòng giữ đúng toạ độ (nền của chế độ bố cục gốc) |
| `src/core/imageEncode.ts` | pixel pdf.js → PNG/JPEG (không cần canvas khi chạy test) |
| `src/core/textLayout.ts` | Engine bố cục thuần (không phụ thuộc DOM) — được unit test kỹ nhất |
| `src/core/docxBuild.ts` | Layout + ảnh → DOCX (bố cục gốc, văn bản, hình ảnh) |
| `src/core/renderPages.ts` | Render trang PDF ra canvas/PNG |
| `src/core/ocr.ts` | Bọc tesseract.js, giữ worker để tái sử dụng giữa các file |
| `src/core/convert.ts` | Ghép toàn bộ pipeline cho một file, sinh cảnh báo |

## Giới hạn đã biết

- Không chế độ nào tái tạo **bảng, biểu đồ, công thức, hình vẽ vector hay chữ nghệ thuật**: chế độ bố cục gốc
  đặt chữ và ảnh đúng chỗ nhưng đường kẻ vector vẫn mất; chế độ hình ảnh giữ được tất cả nhưng không sửa được.
- Chế độ bố cục gốc dùng font thay thế khi PDF nhúng font lạ, nên một dòng có thể xuống hàng khác chỗ hoặc
  dài/ngắn hơn một chút; màu chữ hiện chưa được giữ (pdf.js không trả màu trong `getTextContent`).
- Chế độ văn bản **không tái tạo** bảng, biểu đồ, công thức, hình vẽ vector hay chữ nghệ thuật.
  Hình ảnh bitmap thì được giữ lại, nhưng không giữ được hiệu ứng trong suốt, mặt nạ stencil (ảnh 1-bit)
  hay vị trí chồng lên chữ. Với tài liệu cần giống bản gốc, dùng chế độ hình ảnh.
- PDF scan không có text layer: cần OCR (chậm hơn, có thể sai chính tả) hoặc chế độ hình ảnh. Trang scan
  bị phủ kín bởi một ảnh được giữ nguyên dạng ảnh (không tự OCR) — chọn "Luôn chạy OCR" nếu muốn chữ sửa được.
- Nhận diện 2 cột chỉ áp dụng cho bố cục 2 cột đơn giản; nếu có dòng chạy ngang qua giữa trang thì tự động
  quay về 1 cột để không làm sai thứ tự đọc.
- Font trong DOCX được suy ra từ tên font nhúng; font lạ sẽ dùng font mặc định của Word.
- PDF có mật khẩu sẽ báo lỗi rõ ràng (không hỗ trợ mở khoá).
- OCR cần internet ở lần dùng đầu tiên để tải core WASM + dữ liệu ngôn ngữ.

## Kiểm thử

```bash
npm test
```

- `tests/textLayout.test.ts`: gộp dòng, chèn khoảng trắng bị thiếu, tách đoạn, nối từ bị gạch nối, tách cột, canh giữa.
- `tests/anchoredLayout.test.ts`: dòng giữ đúng x/baseline, gộp fragment cùng dòng, tách đoạn khi gặp khoảng trống lớn.
- `tests/i18n.test.ts`: mỗi ngôn ngữ có đủ khoá và đúng placeholder như bản tiếng Anh, số nhiều "trang" theo từng ngôn ngữ.
- `tests/convert.test.ts`: chuyển PDF thật (sinh bằng `tests/helpers/createTestPdf.ts` và
  `tests/helpers/createImagePdf.ts`) → kiểm tra XML của DOCX, ảnh được nhúng (`word/media/*`), toạ độ
  `w:framePr` của chế độ bố cục gốc, mã cảnh báo trang scan, mã lỗi file hỏng, giữ nguyên dấu tiếng Việt.
- `npm run fixtures` sinh `.tmp/sample.pdf` để thử tay trên giao diện.

## Deploy

Build ra `dist/` là thư mục tĩnh, `base: './'` nên chạy được ở bất kỳ thư mục con nào.

**GitHub Pages (đã bật sẵn)**: workflow `.github/workflows/deploy-pages.yml` chạy test → build → publish
mỗi lần push lên `main`. Site: **https://accessflows.github.io/pdf-to-docx/** — không cần cấu hình gì thêm.

- **Netlify / Vercel / Cloudflare Pages**: build command `npm run build`, publish directory `dist`.
- **Tự host**: copy `dist/` lên bất kỳ web server tĩnh nào.

Không cần cấu hình CORS hay bất kỳ biến môi trường nào.

Test chạy trên Node dùng **legacy build** của pdf.js (alias trong `vitest.config.ts`) vì bản browser cần
`Promise.try` / `Uint8Array#toHex` mà Node chưa có đủ; app thật vẫn dùng bản browser nhẹ hơn.
