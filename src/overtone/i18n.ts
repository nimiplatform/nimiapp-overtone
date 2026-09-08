import i18n, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';

export const OVERTONE_LOCALES = ['en', 'zh'] as const;
export type OvertoneLocale = typeof OVERTONE_LOCALES[number];

const OVERTONE_LOCALE_STORAGE_KEY = 'nimi.overtone:locale.v1';

export const overtoneI18nResources = {
  en: {
    translation: {
      Overtone: {
        configuration: { title: 'AI configuration', configured: 'Configured', empty: 'Not configured', text: 'Text generation', music: 'Music generation', textHint: 'Help write song briefs and lyrics.', musicHint: 'Create audio takes from a brief and lyrics.' },
        language: {
          ariaLabel: 'Language',
          english: 'English',
          chinese: '中文',
        },
        common: {
          readiness: {
            runtime: 'Runtime',
            realm: 'Realm',
            music: 'Music',
            text: 'Text',
          },
          status: {
            ready: 'ready',
          },
          takeOrigins: {
            prompt: 'prompt',
            extend: 'extend',
            remix: 'remix',
            reference: 'reference',
          },
          sourceModes: {
            'prompt-only': 'prompt-only',
            'uploaded-audio': 'uploaded-audio',
            'derived-take': 'derived-take',
          },
        },
        workspace: {
          composeAria: 'Compose',
          takesAria: 'Takes',
          runtimeUnavailableTitle: 'Runtime Unavailable',
          runtimeUnavailableFallback: 'Could not reach the nimi runtime daemon.',
          retryRuntimeCheck: 'Retry Runtime Check',
          songProject: 'Song Project',
          closeProject: 'Close Project',
          noTakesCompose: 'No takes yet. Generate your first take from the Compose column.',
          readiness: {
            degraded: 'Runtime is degraded; some app capabilities may be unavailable.',
            musicUnavailable: 'Music generation is not configured for this app.',
            textUnavailable: 'Text generation is not configured for this app.',
          },
        },
        empty: {
          tagline: 'AI music creation studio · Brief -> Lyrics -> Generate -> Compare -> Publish',
          startSession: 'Start New Session',
        },
        brief: {
          title: 'Song Brief',
          ideaLabel: 'Idea',
          ideaPlaceholder: 'Describe your song idea...',
          generating: 'Generating...',
          generate: 'AI Generate Brief',
          manual: 'Manual Brief',
          noTextRoute: 'Text generation is not configured. Use Manual Brief or configure the app text capability.',
          fields: {
            title: 'Title',
            genre: 'Genre',
            mood: 'Mood',
            tempo: 'Tempo',
            description: 'Description',
          },
          errors: {
            nonJson: 'Assistant returned non-JSON brief content.',
          },
        },
        lyrics: {
          title: 'Lyrics',
          writing: 'Writing...',
          generate: 'Generate Lyrics',
          regenerate: 'Regenerate Lyrics',
          briefRequired: 'Write a brief description first; the assistant uses it to shape lyrics.',
          placeholder: 'Write or paste lyrics here. Manual edits always win over regenerated text.',
          sources: {
            assistant: 'assistant',
            manual: 'manual',
            mixed: 'mixed',
          },
        },
        generate: {
          styleTags: 'Style tags',
          stylePlaceholder: 'indie, dreamy, acoustic',
          duration: 'Duration',
          durationSecondsAria: 'Duration seconds',
          instrumental: 'Instrumental',
          title: 'Generation',
          runtimeLabel: 'Music route',
          runtimeNotConfigured: 'not configured',
          appAccessUnavailable: 'Music generation is not configured for this app.',
          requiredInput: 'Configure music generation and provide a brief and lyrics first.',
          cancel: 'Cancel generation',
          cancelRequested: 'Cancellation requested; no take was added.',
          submit: 'Generate Song',
          submitting: 'Generating...',
          untitled: 'Untitled',
          takeTitle: '{{title}} - Take {{number}}',
          errors: {
            projectNotReady: 'Song project is not ready.',
          },
        },
        iteration: {
          title: 'Iteration',
          sourceTake: 'Source take',
          noSourceTakes: 'No source takes',
          mode: 'Mode',
          styleOverride: 'Style override',
          referenceAudio: 'Reference audio',
          trimStart: 'Trim start',
          trimEnd: 'Trim end',
          sourceBufferMissing: 'The selected take has no decoded audio buffer in memory, so it cannot be used for iteration.',
          referenceRequired: 'Reference mode requires an uploaded audio file.',
          trimInvalid: 'Trim end must be greater than trim start.',
          appAccessUnavailable: 'Audio extension, remix, and references are not supported yet. Edit the brief or lyrics to generate another take.',
          submit: 'Create Child Take',
          submitting: 'Iterating...',
          childTitle: '{{title}} - {{mode}}',
          errors: {
            sourceNotReady: 'Iteration source is not ready.',
            sourceTakeNotReady: 'Iteration source take is not ready.',
            referenceMustBeAudio: 'Reference file must be an audio file.',
            referenceEmpty: 'Reference file is empty.',
          },
        },
        takes: {
          empty: 'No takes yet. Use Generate to produce your first take.',
          title: 'Takes ({{count}})',
          exitCompare: 'Exit Compare',
          compareTitle: 'A/B Compare',
          compareCount: '{{count}} takes',
          comparePartial: 'Select both A and B slots to compare takes.',
          generating: 'Generating...',
          awaitingRuntime: 'Awaiting runtime...',
          fromParent: 'from {{title}}',
          favoriteActive: '★ Favorite',
          favoriteInactive: '☆ Favorite',
          rename: 'Rename',
          save: 'Save',
          cancel: 'Cancel',
          discard: 'Discard',
          publish: 'Publish...',
        },
        player: {
          play: 'Play',
          pause: 'Pause',
          loadingAudio: 'Loading audio…',
          audioUnavailable: 'Audio unavailable: {{message}}',
          retryAudio: 'Retry audio',
          trimStartAria: 'Trim start',
          trimEndAria: 'Trim end',
          invalidTrim: 'Invalid trim',
        },
        publish: {
          title: 'Publish to Realm',
          cancel: 'Cancel',
          uploading: 'Uploading...',
          creatingPost: 'Creating post...',
          publishedButton: 'Published',
          publishNow: 'Publish Now',
          proxyRequiredError: 'Realm publishing requires an admitted App Access publish operation. Overtone cannot publish through raw Realm access tokens.',
          proxyUnavailable: 'Realm publishing is unavailable until an App Access publish operation is admitted.',
          publishedPostId: 'Published. Post id:',
          sourceMode: 'Source mode:',
          provenanceConfirm: 'I confirm the source material is original or I have the right to publish it.',
          fields: {
            title: 'Title',
            description: 'Description',
            tags: 'Tags (comma separated)',
          },
        },
        runtime: {
          status: {
            submitted: 'Submitted to runtime',
            queued: 'Queued by runtime',
            running: 'Generating audio',
            completed: 'Completed',
            timeout: 'Timed out',
            canceled: 'Canceled',
            failed: 'Failed',
          },
        },
      },
    },
  },
  zh: {
    translation: {
      Overtone: {
        configuration: { title: 'AI 配置', configured: '已配置', empty: '未配置', text: '文本生成', music: '音乐生成', textHint: '辅助创作歌曲简报与歌词。', musicHint: '根据简报与歌词生成音频版本。' },
        language: {
          ariaLabel: '语言',
          english: 'English',
          chinese: '中文',
        },
        common: {
          readiness: {
            runtime: 'Runtime',
            realm: 'Realm',
            music: '音乐',
            text: '文本',
          },
          status: {
            ready: '就绪',
          },
          takeOrigins: {
            prompt: '提示词生成',
            extend: '延展',
            remix: '混音',
            reference: '参考音频',
          },
          sourceModes: {
            'prompt-only': '仅提示词',
            'uploaded-audio': '上传音频',
            'derived-take': '派生版本',
          },
        },
        workspace: {
          composeAria: '创作',
          takesAria: '版本',
          runtimeUnavailableTitle: 'Runtime 不可用',
          runtimeUnavailableFallback: '无法连接 nimi runtime daemon。',
          retryRuntimeCheck: '重试 Runtime 检查',
          songProject: '歌曲项目',
          closeProject: '关闭项目',
          noTakesCompose: '还没有版本。请先在创作栏生成第一个版本。',
          readiness: {
            degraded: 'Runtime 处于降级状态，部分应用能力可能不可用。',
            musicUnavailable: '当前应用尚未配置音乐生成能力。',
            textUnavailable: '当前应用尚未配置文本生成能力。',
          },
        },
        empty: {
          tagline: 'AI 音乐创作工作室 · 简报 -> 歌词 -> 生成 -> 对比 -> 发布',
          startSession: '开始新会话',
        },
        brief: {
          title: '歌曲简报',
          ideaLabel: '想法',
          ideaPlaceholder: '描述你的歌曲想法...',
          generating: '生成中...',
          generate: 'AI 生成简报',
          manual: '手动简报',
          noTextRoute: '尚未配置文本生成能力。请使用手动简报，或配置应用的文本能力。',
          fields: {
            title: '标题',
            genre: '曲风',
            mood: '情绪',
            tempo: '速度',
            description: '描述',
          },
          errors: {
            nonJson: '助手返回了非 JSON 简报内容。',
          },
        },
        lyrics: {
          title: '歌词',
          writing: '写作中...',
          generate: '生成歌词',
          regenerate: '重新生成歌词',
          briefRequired: '请先填写简报描述；助手会用它来塑造歌词。',
          placeholder: '在这里写入或粘贴歌词。手动编辑始终优先于重新生成的文本。',
          sources: {
            assistant: '助手',
            manual: '手动',
            mixed: '混合',
          },
        },
        generate: {
          styleTags: '风格标签',
          stylePlaceholder: 'indie, dreamy, acoustic',
          duration: '时长',
          durationSecondsAria: '时长秒数',
          instrumental: '纯音乐',
          title: '生成',
          runtimeLabel: '音乐路由',
          runtimeNotConfigured: '未配置',
          appAccessUnavailable: '当前应用尚未配置音乐生成能力。',
          requiredInput: '请先配置音乐生成，并填写歌曲简报和歌词。',
          cancel: '取消生成',
          cancelRequested: '已请求取消，本次未添加新版本。',
          submit: '生成歌曲',
          submitting: '生成中...',
          untitled: '未命名',
          takeTitle: '{{title}} - 版本 {{number}}',
          errors: {
            projectNotReady: '歌曲项目尚未就绪。',
          },
        },
        iteration: {
          title: '迭代',
          sourceTake: '来源版本',
          noSourceTakes: '没有来源版本',
          mode: '模式',
          styleOverride: '风格覆盖',
          referenceAudio: '参考音频',
          trimStart: '裁剪起点',
          trimEnd: '裁剪终点',
          sourceBufferMissing: '所选版本在内存中没有已解码音频，无法用于迭代。',
          referenceRequired: '参考模式需要上传音频文件。',
          trimInvalid: '裁剪终点必须大于裁剪起点。',
          appAccessUnavailable: '暂不支持音频续写、混音和参考音频。可编辑简报或歌词后生成另一个版本。',
          submit: '创建子版本',
          submitting: '迭代中...',
          childTitle: '{{title}} - {{mode}}',
          errors: {
            sourceNotReady: '迭代来源尚未就绪。',
            sourceTakeNotReady: '迭代来源版本尚未就绪。',
            referenceMustBeAudio: '参考文件必须是音频文件。',
            referenceEmpty: '参考文件为空。',
          },
        },
        takes: {
          empty: '还没有版本。使用生成能力创建第一个版本。',
          title: '版本（{{count}}）',
          exitCompare: '退出对比',
          compareTitle: 'A/B 对比',
          compareCount: '{{count}} 个版本',
          comparePartial: '请选择 A 和 B 两个槽位来对比版本。',
          generating: '生成中...',
          awaitingRuntime: '等待 Runtime...',
          fromParent: '来自 {{title}}',
          favoriteActive: '★ 已收藏',
          favoriteInactive: '☆ 收藏',
          rename: '重命名',
          save: '保存',
          cancel: '取消',
          discard: '丢弃',
          publish: '发布...',
        },
        player: {
          play: '播放',
          pause: '暂停',
          loadingAudio: '加载音频…',
          audioUnavailable: '音频暂不可用：{{message}}',
          retryAudio: '重试音频',
          trimStartAria: '裁剪起点',
          trimEndAria: '裁剪终点',
          invalidTrim: '裁剪无效',
        },
        publish: {
          title: '发布到 Realm',
          cancel: '取消',
          uploading: '上传中...',
          creatingPost: '创建帖子中...',
          publishedButton: '已发布',
          publishNow: '立即发布',
          proxyRequiredError: '发布到 Realm 需要已准入的 App Access 发布操作。Overtone 不能通过原始 Realm 访问令牌发布。',
          proxyUnavailable: 'App Access 发布操作准入前，Realm 发布不可用。',
          publishedPostId: '已发布。帖子 ID：',
          sourceMode: '来源模式：',
          provenanceConfirm: '我确认来源材料为原创，或我拥有发布它的权利。',
          fields: {
            title: '标题',
            description: '描述',
            tags: '标签（逗号分隔）',
          },
        },
        runtime: {
          status: {
            submitted: '已提交到 Runtime',
            queued: 'Runtime 已排队',
            running: '正在生成音频',
            completed: '已完成',
            timeout: '已超时',
            canceled: '已取消',
            failed: '失败',
          },
        },
      },
    },
  },
} satisfies Resource;

export function normalizeOvertoneLocale(value: string | null | undefined): OvertoneLocale {
  const normalized = String(value || '').toLowerCase();
  return normalized.startsWith('zh') ? 'zh' : 'en';
}

export function resolveInitialOvertoneLocale(): OvertoneLocale {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem(OVERTONE_LOCALE_STORAGE_KEY);
    if (stored === 'en' || stored === 'zh') return stored;
  } catch {
    // The locale is a renderer-local display preference; failure falls back to browser language.
  }
  const languages = window.navigator.languages?.length ? window.navigator.languages : [window.navigator.language];
  return normalizeOvertoneLocale(languages.find(Boolean));
}

export function persistOvertoneLocale(locale: OvertoneLocale): void {
  if (typeof window === 'undefined') return;
  try {
    // App-owned UI preference only: not Runtime/Realm truth and not shared business state.
    window.localStorage.setItem(OVERTONE_LOCALE_STORAGE_KEY, locale);
  } catch {
    // Display preference persistence is best-effort and must not block product usage.
  }
}

export function applyOvertoneDocumentLocale(locale: OvertoneLocale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
}

export function registerOvertoneI18nResources(): void {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      lng: resolveInitialOvertoneLocale(),
      fallbackLng: 'en',
      resources: overtoneI18nResources,
      interpolation: { escapeValue: false },
    });
    return;
  }

  for (const locale of OVERTONE_LOCALES) {
    i18n.addResourceBundle(
      locale,
      'translation',
      overtoneI18nResources[locale].translation,
      true,
      true,
    );
  }
}

registerOvertoneI18nResources();
