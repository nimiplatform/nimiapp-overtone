# Nimi Overtone

Overtone is a music playground in the Nimi ecosystem. Start with a scene or an improbable combination, explore three AI musical directions, choose an arrangement and lyric sketch, and make an actual recording. Each new recording remains a separate take.

The workspace supports editable sound notes and lyrics, text-based reinterpretations of a selected take, immediate audition and A/B selection, loop and speed controls, trim preview, original-audio download and trimmed WAV export. Playback speed changes the listening pitch and duration; downloads retain the source speed and pitch. Text reinterpretations use a take's words and do not preserve or remix its audio melody.

The app opens directly into the creative workspace. Drag the sound-coordinate point horizontally for energy and vertically for surprise, or use its arrow keys and equivalent sliders. These controls express intent for the next AI request; the graphic score is not an audio waveform. Browse the three proposals in place, then use the contextual action to explore, apply a direction or generate music. Editable sound notes and lyrics open in the inline notebook.

The recording shelf remains beside the creative stage on desktop. Its A/B controls switch at the current listening position, returning to the beginning when a shorter recording cannot contain that position. Favorites and per-take actions remain directly accessible. English and Chinese interfaces use an Overtone graphic-score visual system on Nimi Kit controls, with light and dark themes.

Draft metadata stays on this device; audio is read from the original Runtime artifact when a retained take is reopened. Audio is not kept in browser storage. Downloads happen only on an explicit export action.

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

The renderer uses the host-injected `NimiLocalAppClient` session. AI settings configure the text and music capabilities through the protected App AIConfig surface. The app submits prompt, lyrics and the requested duration budget to the protected music Scenario Job via the SDK adapter and Kit runner. It verifies artifact metadata and decodes the returned audio before adding a take. Model routing, identity, permission and execution remain Nimi-owned. Unconfigured capabilities and failed requests preserve the draft and show an actionable failure.

Reference-audio remix, extend and Realm publication remain unavailable on this protected contract. Local listening edits and file downloads are separate from those capabilities.

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

当前使用公开发布的 SDK 0.11.0 与 Kit 0.7.0，已移除兄弟仓库链接；冻结安装可独立完成。开发入口仍为 pnpm dev -- --cdp-port 9222，原生开发载体由 Desktop/Runtime 管理。

App Tools 0.5.1 采用 SDK ^0.11.0 / Kit ^0.7.0 的正式组合，生产构建先执行依赖与合同预检。打包、安装、启动与 Registry 准入分别验收，本地构建通过不代表安装或准入通过。运行中的开发会话需要保留时，可在独立源目录执行生产构建，避免改写开发载体。

### 审计修复行为

- Runtime 确认生成完成后，先保存用户提交内容与完成任务的引用。若读取或解码失败，录音区显示“恢复试听”，只重新获取同一任务的产物，不重新生成。仅解码成功后创建可播放版本，按 jobId 去重。
- 文字协作使用受保护 text.streamTurn 和 cancel，90 秒等待上限；取消、超时或不完整的文字不会覆盖草稿。AI 歌词统一使用独占一行的段落标签，手工歌词不会在提交时被改写。
- Renderer 音频缓存总预算 256 MiB，单个解码缓冲上限 128 MiB；播放与波形共享解码结果，淘汰音频后保留轻量波形。临时解码峰值不等于缓存驻留预算。
- 当前没有发布菜单和发布表单。音乐可下载原文件或导出裁剪 WAV。高频声音坐标使用独立订阅，不广播给播放器与录音列表。
- 样式门禁检查 src/overtone 的真实 CSS，按 48 KiB UTF-8 字节预算计量，禁止私有 Kit 类选择器和无作用域的原生控件样式。
