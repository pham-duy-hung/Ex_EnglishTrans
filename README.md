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

## Thông tin tạo release

### File và trường cần khớp nhau

| Mục | File | Ghi chú |
|-----|------|---------|
| Phiên bản extension | [`src/manifest.ts`](src/manifest.ts) → `version` | Chrome/Edge đọc từ `manifest.json` sau build |
| Phiên bản npm / tag | [`package.json`](package.json) → `version` | Nên trùng với manifest để dễ quản lý |

**Định dạng `version` (Manifest V3):** chuỗi tối đa bốn nhóm số, cách nhau bằng dấu chấm, mỗi nhóm 0–65535 (ví dụ `1.2.3`, `0.1.10`). Tránh tiền tố `v` trong manifest.

### Checklist trước khi đóng gói

1. Cập nhật `version` ở **cả hai** chỗ trên (cùng một số).
2. (Khuyến nghị) Ghi **changelog** ngắn: file `CHANGELOG.md` hoặc mô tả trong GitHub Release / cửa hàng (tính năng mới, sửa lỗi, breaking change nếu có).
3. Chạy `npm run build` — không lỗi TypeScript / Vite.
4. Load unpacked thư mục `dist/`, kiểm tra nhanh: **1 từ** (popup + IPA nếu có), **≥2 từ** (dịch + side panel / ô kết quả), **Options** (lưu cấu hình), trang HTTPS bất kỳ.

### Build và tạo file ZIP nộp cửa hàng

```bash
npm run build
```

**Yêu cầu cấu trúc ZIP:** trong file nén, **`manifest.json` phải nằm ở thư mục gốc** (cùng cấp với thư mục `assets/`, v.v.), không được bọc thêm một lớp thư mục rỗng sai kiểu `release/dist/manifest.json`.

- **Đúng:** nén *nội dung* bên trong `dist` (mọi file và folder con của `dist`).
- **Windows (PowerShell)** từ thư mục gốc repo (đổi tên file theo version):

  ```powershell
  Compress-Archive -Path dist\* -DestinationPath english-lookup-0.1.1.zip -Force
  ```

**Kiểm tra nhanh:** giải nén ZIP ra một thư mục tạm → mở `manifest.json` ngay tại đó → bật Developer mode → Load unpacked vào thư mục đã giải nén.

### Git tag (tuỳ chọn, cho GitHub Release)

```bash
git add -A
git commit -m "Release v0.1.1"
git tag v0.1.1
git push origin main
git push origin v0.1.1
```

Trên GitHub: **Releases → Draft a new release** → chọn tag `v0.1.1` → đính kèm `english-lookup-0.1.1.zip` → mô tả thay đổi.

### Nộp Chrome Web Store / Microsoft Edge Add-ons

- **Chrome:** tài khoản nhà phát triển, phí đăng ký một lần; làm theo [Hướng dẫn xuất bản](https://developer.chrome.com/docs/webstore/publish). Lần đầu có thể cần **chính sách quyền riêng tư** (URL) vì extension có `host_permissions` rộng (`http(s)://*/*`) — chuẩn bị URL trang mô tả cách dùng dữ liệu.
- **Edge:** [Xuất bản extension Chromium](https://learn.microsoft.com/microsoft-edge/extensions-chromium/publish/publish-extension) qua Partner Center; có thể dùng cùng gói ZIP nếu manifest tương thích.

Lưu ý: **không** đưa subscription key Azure hoặc URL proxy chứa bí mật vào repo hoặc vào ZIP; người dùng tự điền trong Options sau khi cài.

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
