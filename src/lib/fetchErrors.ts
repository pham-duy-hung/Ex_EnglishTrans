/**
 * Chuẩn hóa lỗi `fetch` (thường là TypeError / "Failed to fetch") thành thông báo có thể hành động.
 */
export function toFriendlyNetworkError(
  service: string,
  err: unknown,
  kind: 'azure' | 'proxy' = 'azure',
): Error {
  const msg = err instanceof Error ? err.message : String(err)
  const isNet =
    err instanceof TypeError ||
    msg === 'Failed to fetch' ||
    /networkerror|load failed|failed to fetch|network request failed/i.test(msg)
  if (isNet) {
    if (kind === 'proxy') {
      return new Error(
        `${service}: không gọi được máy chủ (${msg}). ` +
          `Kiểm tra URL proxy, server có chạy không. Nếu không dùng proxy — xóa trắng ô «Translate proxy» trong Options. ` +
          `Nếu có Azure key, extension sẽ thử Azure sau proxy.`,
      )
    }
    return new Error(
      `${service}: không gọi được máy chủ (${msg}). ` +
        `Kiểm tra internet, VPN, tường lửa, DNS (Pi-hole). ` +
        `Trong Options: Key + Region trùng Azure Portal. ` +
        `Nếu Portal có «Endpoint» dạng https://…cognitiveservices.azure.com — dán **chỉ phần gốc** vào ô «Endpoint gốc (tùy chọn)» rồi Save. ` +
        `Thử mạng khác nếu nhà mạng chặn Microsoft.`,
    )
  }
  return err instanceof Error ? err : new Error(`${service}: ${msg}`)
}