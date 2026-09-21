# Nimi Overtone

Overtone is a music playground in the Nimi ecosystem. Start with a scene or an improbable combination, explore three AI musical directions, choose an arrangement and lyric sketch, and make an actual recording. Each new recording remains a separate take.

The workspace supports editable sound notes and lyrics, text-based reinterpretations of a selected take, immediate audition and A/B selection, loop and speed controls, trim preview, original-audio download and trimmed WAV export. Playback speed changes the listening pitch and duration; downloads retain the source speed and pitch. Text reinterpretations use a take's words and do not preserve or remix its audio melody.

The app opens directly into the creative workspace. Drag the sound-coordinate point horizontally for energy and vertically for surprise, or use its arrow keys and equivalent sliders. These controls express intent for the next AI request; the graphic score is not an audio waveform. Browse the three proposals in place, then use the contextual action to explore, apply a direction or generate music. Editable sound notes and lyrics open in the inline notebook.

The recording shelf remains beside the creative stage on desktop. Its A/B controls switch at the current listening position, returning to the beginning when a shorter recording cannot contain that position. Favorites and per-take actions remain directly accessible. English and Chinese interfaces use an Overtone graphic-score visual system on Nimi Kit controls, with light and dark themes.

Projects, adopted audio and score documents are saved through protected Nimi App storage. Reopening a recording reads its owned App asset independently of Runtime Job retention. Browser storage holds only device preferences and retired draft metadata retained for explicit one-time recovery. Downloads happen only on an explicit export action.

## Development

```bash
pnpm install
pnpm dev -- --cdp-port 9222
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run validate
pnpm run pack
```

`pnpm dev` asks the running Nimi Desktop supervisor to build the Electron main/preload, start the Vite renderer on `127.0.0.1:1507`, and launch the protected Local App carrier. Use `pnpm dev -- --cdp-port <port>` for loopback CDP inspection.

The renderer uses the host-injected `NimiLocalAppClient` session. AI settings configure the text and music capabilities through the protected App AIConfig surface. The app records an author submission identity before invoking the protected music Scenario Job through the SDK adapter and Kit runner. It uses the selected resource input profile, adopts the complete typed output, verifies asset metadata, decodes the audio and saves its project version. Recovery observes the original submission or Job and never resubmits it. Model routing, identity, permission and execution remain Nimi-owned. Unconfigured capabilities and failed requests preserve the draft and show an actionable failure.

Reference-audio remix, extend and Realm publication remain unavailable in the current Overtone workflow. Local listening edits and file downloads are separate from those capabilities.

For Nimi listing review, keep `nimi.app.yaml`, `.nimi/admission/submission.yaml`, the build profile and `ADMISSION.md` in sync with the product behavior under `src/shell/routes/product-area.tsx`. These files and local checks are developer-submitted inputs, not platform admission truth.

Upstream Platform/Runtime review produces release descriptors, ordinary visibility, install truth, and App Access authorization. This scaffold does not mint those outcomes.

## Windows package and release

The production target is Windows x86_64 using Desktop-supervised Electron.
Build and inspect the package from this repository:

```bash
pnpm run sync
pnpm exec nimi-app check --production
pnpm exec nimi-app test
pnpm exec nimi-app build --target windows-x86_64 --production
pnpm exec nimi-app pack --target windows-x86_64 --production
```

Before tagging, follow the [GitHub release setup guide](https://github.com/nimiplatform/nimi/blob/main/app-tools/README.md#publishing-on-github), including the `NIMI_REPOSITORY_ADMIN_TOKEN` Actions secret.
A protected annotated version tag on the repository default branch runs the managed build, provenance and immutable Release workflow.
The publisher then submits the immutable Release to [Nimi App Registry](https://github.com/nimiplatform/nimi-app-registry). Registry admission is a separate human review; local builds and GitHub Releases do not create admission or installed state.

### 完成一首歌

试听版本旁的“完成这首歌”会锁定这段录音的文字方向，打开独立的成曲草稿。选 1 分半、2 分钟或 3 分钟，点击“展开完整编排”，编辑每个段落的编曲意图和歌词，再点击“生成完整歌曲”。提交前需补全歌名和每段编排，且至少四段各有三行或更多歌词；未完成的草稿会保留并显示补全提示。结果保留实际时长；明显短于目标的音频会标为短版结果。原试听可随时对照，成曲可用播放器下载。这里重新创作音乐，不保证延续试听中的旋律。

本次音乐迭代从 https://github.com/nimiplatform/nimiapp-overtone 的 cb9debb2fa56cad3af8a78663fa02bec62de831a 开始，保留 MIT 许可证、音乐探索机制和既定视觉系统。当前开发组合为 SDK 0.16.0、Kit/native 0.12.0、App Tools 0.8.0、nimi-coding 0.6.3；完整本地 tarball 放在 .nimi/local/music-cohort-2026-09-21，由 pnpm-workspace.yaml 的显式 overrides 和 lockfile 固定，不依赖源码链接。新检出需先取得同一候选包组合，不能把本机通过当作公开发布安装证明。

候选版本尚未发布；生产构建仍需已发布依赖与合同预检，本次不执行发布或部署。打包、安装、启动与 Registry 准入分别验收，本地构建通过不代表安装或准入通过。运行中的开发会话需要保留时，可在独立源目录执行生产构建，避免改写开发载体。

### 审计修复行为

- Submit 前保存作者输入和 clientSubmissionId，收到后补上真实 jobId。若响应丢失、采纳、解码或项目保存失败，录音区可查询原任务并恢复已有结果，不重新生成。完整结果采纳为 App 资产后保存版本，按真实 jobId 去重。项目 schemaVersion 2 不自动读取旧 workspace.v1；旧草稿保留给明确的一次性备份和导入。
- 文字协作使用受保护 text.streamTurn 和 cancel，90 秒等待上限；取消、超时或不完整的文字不会覆盖草稿。AI 歌词统一使用独占一行的段落标签，手工歌词不会在提交时被改写。
- Renderer 音频缓存总预算 256 MiB，单个解码缓冲上限 128 MiB；播放与波形共享解码结果，淘汰音频后保留轻量波形。临时解码峰值不等于缓存驻留预算。
- 当前没有发布菜单和发布表单。音乐可下载原文件或导出裁剪 WAV。高频声音坐标使用独立订阅，不广播给播放器与录音列表。
- 样式门禁检查 src/overtone 的真实 CSS，按 48 KiB UTF-8 字节预算计量，禁止私有 Kit 类选择器和无作用域的原生控件样式。

## 音乐迭代验证进展（2026-09-21）

同一候选包已在 Desktop 监督的独立 App Tools 参考项目中跑通 YuE2 音频与 ABC 条件路径。Overtone 自身通过 CDP 验证了本地 Music3 短段生成、原任务恢复、受保护资产采纳、播放与项目重开，以及 YuE2 生成音频和计划谱、选择 Vocal 声部、修改音符、保存派生谱、按谱生成新录音的完整短段流程。两次 YuE2 结果均为 48 kHz 双声道、959936 帧、约20秒，seed=42；达到预算的结果明确提示歌曲可能未结束。音色、歌词和自然度没有听音验收。整曲与其余编辑/演唱合同仍在实现，不能据此承诺全部功能。

谱面核心固定 abcjs 6.7.0 与 @tonejs/midi 2.0.28。真实 YuE2/SheetSage2 ABC 的四个单声部派生结果保留了独立 MIDI 解析得到的音高、起点和时值；原谱保留，省略声部、MIDI 量化和控制器等损失必须显式呈现。ABC 转 MIDI、再选择 MIDI 旋律轨转为 ABC 已经通过真实界面保存；保存前显示转换损失。abcjs MIDI 导出不会完整保留途中拍号、速度和调号，不能宣称通用无损转换。本地合成音仅用于比较旋律草稿，不是 AI 人声或最终编配试听。MuScriptor 原生 MIDI、复杂多声部编辑和主观演唱精度仍未验收。
