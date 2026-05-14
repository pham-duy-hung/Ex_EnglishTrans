import { useEffect, useMemo, useState } from 'react'
import type { AppSettings, DictionaryProviderId } from '../types/storage'
import { DEFAULT_SETTINGS } from '../types/storage'
import { loadSettings, saveSettings } from '../lib/dictionary/factory'
import { isLikelyDictionaryUrlNotTranslateProxy } from '../lib/settingsSanitize'
import { DEFAULT_DICTIONARY_CUSTOM_URL_TEMPLATE } from '../lib/defaults'

export function OptionsApp() {
  const [s, setS] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)

  const translateProxyWarning = useMemo(
    () => (s.translateProxyUrl?.trim() ? isLikelyDictionaryUrlNotTranslateProxy(s.translateProxyUrl) : false),
    [s.translateProxyUrl],
  )

  const dictTemplateWarning = useMemo(() => {
    const t = s.customDictionaryUrlTemplate ?? ''
    if (!t.trim()) return false
    return t.includes('<word>') || /^\s*\(/.test(t)
  }, [s.customDictionaryUrlTemplate])

  useEffect(() => {
    void loadSettings().then(setS)
  }, [])

  const patch = (p: Partial<AppSettings>) => setS((x) => ({ ...x, ...p }))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveSettings(s)
    const reloaded = await loadSettings()
    setS(reloaded)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }
  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-semibold">English Lookup — Settings</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        <strong>Nhấn icon extension</strong> trên thanh công cụ → chuột thành kính lúp → <strong>bôi đen</strong> văn
        bản, thả chuột. <strong>1 từ</strong> → popup từ điển (tiếng Anh) + bản dịch theo ngôn ngữ đích nếu đã cấu hình
        Azure/proxy; <strong>từ 2 từ trở lên</strong> → dịch trong side panel (cần{' '}
        <strong>Microsoft Translator (Azure)</strong> — subscription key — hoặc proxy tùy chọn).
      </p>
      <p className="text-xs text-slate-500">
        Mở trang cài đặt: <strong>chuột phải vào icon</strong> extension → &quot;Cài đặt (Options)&quot;.
      </p>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <label className="block text-sm space-y-1">
          <div className="font-medium">Theme</div>
          <select
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 py-2"
            value={s.theme}
            onChange={(e) => patch({ theme: e.target.value as AppSettings['theme'] })}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <label className="block text-sm space-y-1">
          <div className="font-medium">Dictionary provider</div>
          <select
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 py-2"
            value={s.dictionaryProvider}
            onChange={(e) => {
              const v = e.target.value as DictionaryProviderId
              if (v === 'custom-rest' && !(s.customDictionaryUrlTemplate ?? '').trim()) {
                patch({
                  dictionaryProvider: v,
                  customDictionaryUrlTemplate: DEFAULT_DICTIONARY_CUSTOM_URL_TEMPLATE,
                })
              } else {
                patch({ dictionaryProvider: v })
              }
            }}
          >
            <option value="dictionarypi-dev">DictionaryAPI.dev (free)</option>
            <option value="custom-rest">Custom REST (JSON → WordEntry)</option>
          </select>
        </label>

        {s.dictionaryProvider === 'custom-rest' ? (
          <label className="block text-sm space-y-1">
            <div className="font-medium">Custom URL template</div>
            <input
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 py-2 font-mono text-xs"
              placeholder="https://api.dictionaryapi.dev/api/v2/entries/en/{{word}}"
              value={s.customDictionaryUrlTemplate ?? ''}
              onChange={(e) => patch({ customDictionaryUrlTemplate: e.target.value })}
            />
            <div className="text-xs text-slate-500">
              Mặc định nếu để trống khi chọn Custom:{' '}
              <span className="font-mono break-all">{DEFAULT_DICTIONARY_CUSTOM_URL_TEMPLATE}</span>
            </div>
            {dictTemplateWarning ? (
              <div className="text-xs text-amber-700 dark:text-amber-300">
                Gợi ý: bỏ ngoặc <span className="font-mono">()</span> quanh URL; dùng{' '}
                <span className="font-mono">{'{{word}}'}</span> thay cho <span className="font-mono">&lt;word&gt;</span>.
                Nút Save sẽ tự bỏ ngoặc ngoài cùng nếu có.
              </div>
            ) : null}
          </label>
        ) : null}
        <label className="block text-sm space-y-1">
          <div className="font-medium">Translate proxy base URL</div>
          <input
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 py-2 font-mono text-xs"
            placeholder="https://your-server.com/api  (POST /translate)"
            value={s.translateProxyUrl ?? ''}
            onChange={(e) => patch({ translateProxyUrl: e.target.value })}
          />
          {translateProxyWarning ? (
            <div className="text-xs text-red-600 dark:text-red-400 font-medium">
              URL này là API từ điển (GET), không dùng để dịch. Để trống nếu chỉ tra từ; dịch cụm (2+ từ) dùng Azure
              Translator bên dưới hoặc server proxy của bạn (<span className="font-mono">POST .../translate</span>).
            </div>
          ) : (
            <div className="text-xs text-slate-500 space-y-1">
              <p>
                <strong>Ưu tiên:</strong> nếu có cả <strong>Azure key</strong> và <strong>proxy</strong>, extension gọi{' '}
                <strong>Azure trước</strong> (tránh proxy dev/sai URL làm «Failed to fetch»); Azure lỗi mới thử proxy. Chỉ
                dùng Azure: để trống ô proxy.
              </p>
              <p>
                Contract proxy: POST JSON{' '}
                <span className="font-mono">{'{ text, sourceLang?, targetLang }'}</span> →{' '}
                <span className="font-mono">{'{ translatedText, detectedSourceLang? }'}</span>.
              </p>
            </div>
          )}
        </label>

        <fieldset className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
          <legend className="text-sm font-medium px-1">Microsoft Translator (Azure Cognitive Services)</legend>
          <p className="text-xs text-slate-500">
            Tạo resource <strong>Translator</strong> trên Azure Portal → copy <strong>Key 1</strong> và{' '}
            <strong>Region / Location</strong>. Gói F0 có hạn mức ký tự miễn phí theo tháng (xem Azure). Key lưu trong{' '}
            <span className="font-mono">chrome.storage.sync</span> — chỉ nên dùng extension cá nhân.
          </p>
          <p className="text-xs text-slate-500">
            Tài liệu:{' '}
            <a
              className="text-blue-600 dark:text-blue-400 underline"
              href="https://learn.microsoft.com/en-us/azure/ai-services/translator/reference/v3-0-translate"
              target="_blank"
              rel="noreferrer"
            >
              Translator REST v3 — translate
            </a>
            .
          </p>
          <label className="block text-sm space-y-1">
            <div className="font-medium">Subscription key (Ocp-Apim-Subscription-Key)</div>
            <input
              type="password"
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 py-2 font-mono text-xs"
              placeholder="Dán key từ Azure Portal"
              value={s.azureTranslatorKey ?? ''}
              onChange={(e) => patch({ azureTranslatorKey: e.target.value })}
            />
          </label>
          <label className="block text-sm space-y-1">
            <div className="font-medium">Region / Location (Azure)</div>
            <input
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 py-2 font-mono text-xs"
              placeholder="eastus — copy từ Portal (Keys and Endpoint → Location)"
              value={s.azureTranslatorRegion ?? ''}
              onChange={(e) => patch({ azureTranslatorRegion: e.target.value })}
            />
            <div className="text-[11px] text-slate-500">
              Nếu gặp lỗi <span className="font-mono">401 / 401001</span>: gần như luôn cần điền đúng Location (vd.{' '}
              <span className="font-mono">eastus</span>) để gửi header{' '}
              <span className="font-mono">Ocp-Apim-Subscription-Region</span>. Có thể dùng giá trị{' '}
              <span className="font-mono">global</span> nếu resource của bạn yêu cầu.
            </div>
          </label>
          <label className="block text-sm space-y-1">
            <div className="font-medium">Endpoint gốc (tùy chọn)</div>
            <input
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 py-2 font-mono text-xs"
              placeholder="https://ten-resource.cognitiveservices.azure.com"
              value={s.azureTranslatorEndpoint ?? ''}
              onChange={(e) => patch({ azureTranslatorEndpoint: e.target.value })}
            />
            <div className="text-[11px] text-slate-500">
              Chỉ dán phần gốc từ Portal (Keys and Endpoint → Endpoint), <strong>không</strong> thêm path. Bắt buộc nếu
              resource của bạn dùng tên miền <span className="font-mono">*.cognitiveservices.azure.com</span> — khi đó
              extension gọi đúng path <span className="font-mono">/translator/text/v3.0/translate</span>. Nếu để trống
              vẫn dùng endpoint Translator công cộng (api.cognitive…).
            </div>
          </label>
        </fieldset>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm space-y-1">
            <div className="font-medium">Source language</div>
            <input
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 py-2 font-mono text-xs"
              value={s.sourceLanguage}
              onChange={(e) => patch({ sourceLanguage: e.target.value })}
            />
            <div className="text-[11px] text-slate-500">
              <span className="font-mono">auto</span> = Azure tự nhận diện ngôn ngữ nguồn (không gửi tham số{' '}
              <span className="font-mono">from</span>).
            </div>
          </label>
          <label className="block text-sm space-y-1">
            <div className="font-medium">Target language</div>
            <input
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 py-2 font-mono text-xs"
              value={s.targetLanguage}
              onChange={(e) => patch({ targetLanguage: e.target.value })}
            />
          </label>
        </div>

        <label className="block text-sm space-y-1">
          <div className="font-medium">Default pronunciation (popup presets)</div>
          <select
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 py-2"
            value={s.defaultVoice}
            onChange={(e) => patch({ defaultVoice: e.target.value as AppSettings['defaultVoice'] })}
          >
            <option value="en-US">en-US</option>
            <option value="en-GB">en-GB</option>
          </select>
        </label>

        <button
          type="submit"
          className="rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-4 py-2 text-sm font-medium"
        >
          Save
        </button>
        {saved ? <span className="ml-2 text-sm text-green-600">Đã lưu</span> : null}
      </form>

      <section className="text-xs text-slate-500 space-y-1">
        <div className="font-semibold text-slate-700 dark:text-slate-200">Permissions (MV3)</div>
        <ul className="list-disc pl-4">
          <li>
            <span className="font-mono">storage</span> — settings (sync), wordbook (sync), history (local)
          </li>
          <li>
            <span className="font-mono">sidePanel</span> — mở panel dịch
          </li>
          <li>
            <span className="font-mono">tabs</span> — tabId cho sidePanel.open
          </li>
          <li>
            <span className="font-mono">contextMenus</span> — menu chuột phải trên icon (mở Options)
          </li>
          <li>
            <span className="font-mono">scripting</span> — nhắc F5 nếu tab chưa có content script
          </li>
          <li>
            <span className="font-mono">host_permissions</span> — DictionaryAPI, Azure Translator (api.cognitive…, *.cognitiveservices.azure.com), http(s) cho content
            script + HTTPS chung
          </li>
        </ul>
      </section>
    </div>
  )
}
