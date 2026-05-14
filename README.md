# English Lookup & Translation 2026

Extension Chromium (Manifest V3): tra từ điển khi bôi đen **một từ**, dịch khi bôi đen **hai từ trở lên** (Side panel + Azure Translator hoặc proxy tùy chỉnh).

## Yêu cầu

- [Node.js](https://nodejs.org/) **18** trở lên (khuyến nghị bản LTS)
- npm (đi kèm Node)

## Cài đặt môi trường phát triển

1. Clone hoặc tải mã nguồn về máy.
2. Trong thư mục dự án, cài dependency:

   ```bash
   npm install
   ```

3. (Tùy chọn) Chạy bản dev — Vite + CRXJS:

   ```bash
   npm run dev
   ```

   Theo dõi terminal để biết URL/preview; tải extension bản dev theo hướng dẫn [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin) nếu bạn dùng chế độ watch.

## Build sản phẩm (`dist/`)

```bash
npm run build
```

Lệnh chạy `tsc --noEmit` rồi `vite build`. Thư mục **`dist/`** chứa extension đã đóng gói (manifest, service worker, content scripts, options, side panel).

## Cài extension từ bản build (Load unpacked)

1. Mở Chrome hoặc Edge: `chrome://extensions` hoặc `edge://extensions`.
2. Bật **Chế độ nhà phát triển** / **Developer mode**.
3. **Tải extension đã giải nén** / **Load unpacked**.
4. Chọn thư mục **`dist`** trong project (sau khi đã `npm run build`).

Mỗi lần đổi code: chạy lại `npm run build`, rồi nhấn **Tải lại** / **Reload** trên thẻ extension.

## Cấu hình nhanh

- Mở **Options** của extension: cấu hình Azure Translator và/hoặc **Translate proxy**, từ điển (DictionaryAPI.dev mặc định hoặc Custom REST), ngôn ngữ đích, giọng đọc, v.v.

## Tạo bản release (phát hành thủ công)

1. **Đồng bộ phiên bản** (tránh lệch giữa store và gói ZIP):
   - `version` trong [`src/manifest.ts`](src/manifest.ts) (ví dụ `0.1.1`).
   - `version` trong [`package.json`](package.json) cùng số đó.

2. **Build sạch:**

   ```bash
   npm run build
   ```

3. **Kiểm tra** `dist/`: mở Load unpacked trỏ vào `dist`, thử đủ luồng (1 từ, nhiều từ, Options, dịch).

4. **Đóng gói ZIP để nộp Chrome Web Store / Edge Add-ons**  
   File ZIP phải có **`manifest.json` ở thư mục gốc** (không được là `dist/manifest.json` bên trong một lớp thư mục trùng tên sai cấu trúc).

   - **Cách đúng:** nén **toàn bộ tệp và thư mục con bên trong** `dist` (chọn hết nội dung trong `dist` → nén), đặt tên ví dụ `english-lookup-0.1.1.zip`.
   - **Windows (PowerShell)** từ thư mục gốc repo:

     ```powershell
     Compress-Archive -Path dist\* -DestinationPath english-lookup-0.1.1.zip -Force
     ```

5. **Đính kèm bản phát hành trên GitHub (tuỳ chọn):** tạo *Release*, upload file ZIP và ghi chú thay đổi.

6. **Nộp cửa hàng:** dùng file ZIP ở bước 4; làm theo checklist của [Chrome Web Store](https://developer.chrome.com/docs/webstore/publish) hoặc [Partner Center (Edge)](https://learn.microsoft.com/microsoft-edge/extensions-chromium/publish/publish-extension).

## Script có sẵn

| Lệnh            | Mô tả                                      |
|-----------------|--------------------------------------------|
| `npm install`   | Cài dependencies                           |
| `npm run dev`   | Dev server / watch (Vite + CRXJS)        |
| `npm run build` | Kiểm tra TypeScript + build ra `dist/`   |
| `npm run preview` | Xem preview Vite (không thay extension) |

## Cấu trúc gọn

- `src/background/` — service worker (dịch, từ điển, session).
- `src/content/` — script trên trang (bôi đen, popup, panel kết quả).
- `src/sidepanel/`, `src/options/` — UI phụ.
- `src/manifest.ts` — Manifest V3 (CRXJS).

---

Nếu bạn cần ký `.crx` hoặc pipeline CI tự động tạo ZIP mỗi tag, có thể bổ sung sau (repo hiện chưa cấu hình GitHub Actions).
