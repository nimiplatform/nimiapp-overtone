# Nimi Overtone

## Published dependency and Catalog acceptance (2026-10-13)

Current public release: [0.1.8](https://github.com/nimiplatform/nimiapp-overtone/releases/tag/v0.1.8); [Registry admission #81](https://github.com/nimiplatform/nimi-app-registry/pull/81) is merged for macOS arm64 and Windows x64. Frozen locks use published SDK 0.21.0, Kit/native 0.19.3, App Tools 0.12.1 and nimi-coding 0.6.5; no local Nimi archive or source-link resolution is required.

Repository checks and managed production builds, package provenance and immutable Release checks passed for both declared targets. Actual Catalog download, installation and AI acceptance ran on macOS arm64 through source Nimi Home and its matching protected Runtime (Nimi main 35498102b). Runtime identity and App Access checks remain enforced.

Real text generation returned three musical directions. The adopted direction generated a 30.772-second music asset through the configured music resource, played to the end, survived a full Home stop/launch and exported a separate WAV through the actual UI. The description-only resource rejected retained lyrics until they were explicitly cleared.

**NOT-VERIFIED:** Windows GUI installation and AI use. Full-song generation, transcription, separation and voice conversion were not rerun; this verifies a sketch rather than a complete song.

Adjacent Home observation: background CDP automation of Show window returned `runtime-service-untrusted` for this already-running Catalog package. Native process activation uses this generic error; that focus operation does not call Runtime identity validation. On 2026-10-13, the user confirmed that bringing Nimi Home to the foreground and manually clicking Show window displays Overtone normally. This foreground journey passed by manual confirmation. Computer Use could not bind the source Home window; the background automation error does not establish a Runtime identity failure. Launch, stop, App Access, actual AI, playback, export and saved-data reopening passed.

Overtone is a music playground in the Nimi ecosystem. Start with a scene or an improbable combination, explore three AI musical directions, choose an arrangement and lyric sketch, and make an actual recording. Each new recording remains a separate take.

The workspace supports editable sound notes and lyrics, text-based reinterpretations of a selected take, immediate audition and A/B selection, loop and speed controls, trim preview, original-audio download and trimmed WAV export. Playback speed changes the listening pitch and duration; downloads retain the source speed and pitch. Text reinterpretations use a take's words and do not preserve or remix its audio melody.

The app opens directly into the creative workspace. Drag the sound-coordinate point horizontally for energy and vertically for surprise, or use its arrow keys and equivalent sliders. These controls express intent for the next AI request; the graphic score is not an audio waveform. Browse the three proposals in place, then use the contextual action to explore, apply a direction or generate music. Editable sound notes and lyrics open in the inline notebook.

The recording shelf remains beside the creative stage on desktop. Its A/B controls switch at the current listening position, returning to the beginning when a shorter recording cannot contain that position. Favorites and per-take actions remain directly accessible. English and Chinese interfaces use an Overtone graphic-score visual system on Nimi Kit controls, with light and dark themes.

Projects, adopted audio and score documents are saved through protected Nimi App storage. Reopening a recording reads its owned App asset independently of Runtime Job retention. Browser storage holds only device preferences; prior unlaunched development projects are not preserved or automatically migrated. Downloads happen only on an explicit export action.

## Development

当前冻结锁文件直接解析 npm 发布版 SDK 0.21.0、Kit/native 0.19.3、App Tools 0.12.1 和 nimi-coding 0.6.5。新检出可直接安装，不需要取得本地 Nimi archive。

```bash
pnpm install --frozen-lockfile
pnpm exec nimi-app sync
pnpm dev -- --cdp-port 9222
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run validate
pnpm run pack
```

本项目的当前验证环境是 Nimi 源码仓库中先运行 `pnpm dev:runtime`、再运行对应的 `pnpm dev:desktop`。复用这一 source Runtime／Desktop 配对，确认启动器发现的 Desktop PID 属于源码开发实例；安装的 `/Applications/Nimi.app` 不作为本轮开发验收载体。开发者模式、项目注册和具体操作授权仍分别由平台处理。

`pnpm dev` asks the running Nimi Desktop supervisor to build the Electron main/preload, start the Vite renderer on `127.0.0.1:1507`, and launch the protected Local App carrier. Use `pnpm dev -- --cdp-port <port>` for loopback CDP inspection.

The renderer uses the host-injected `NimiLocalAppClient` session. AI settings configure the text and music capabilities through the protected App AIConfig surface. The app records an author submission identity before invoking the protected music Scenario Job through the SDK adapter and Kit runner. It uses the selected resource input profile, adopts the complete typed output, verifies asset metadata, decodes the audio and saves its project version. Recovery observes the original submission or Job and never resubmits it. Model routing, identity, permission and execution remain Nimi-owned. Unconfigured capabilities and failed requests preserve the draft and show an actionable failure.

Reference-audio remix, extend and Realm publication remain unavailable in the current Overtone workflow. Local listening edits and file downloads are separate from those capabilities.

For Nimi listing review, keep `nimi.app.yaml`, `.nimi/admission/submission.yaml`, the build profile and `ADMISSION.md` in sync with the product behavior under `src/shell/routes/product-area.tsx`. These files and local checks are developer-submitted inputs, not platform admission truth.

Upstream Platform/Runtime review produces release descriptors, ordinary visibility, install truth, and App Access authorization. This scaffold does not mint those outcomes.

## macOS and Windows package and release

The declared production targets are macOS arm64 and Windows x86_64, using Desktop-supervised Electron.
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

以下为 2026-09-30 前音乐迭代的历史说明；当前发行和验收以本页发布版记录为准。

该次音乐迭代从 cb9debb2fa56cad3af8a78663fa02bec62de831a 开始，保留 MIT 许可证、音乐探索机制和既定视觉系统。当前开发组合为 SDK 0.19.0、Kit/native 0.16.0、App Tools 0.11.4、nimi-coding 0.6.3；完整 archive 放在 `.nimi/local/packages` 的已锁定组合目录（本轮 `current`／`current-sdk`），由 `pnpm-workspace.yaml` 和 lockfile 固定，不依赖源码链接。该目录不入库，新检出必须先准备完全相同的候选包字节，之后可用 frozen lockfile 安装。公开发行仍需相应依赖发布到 registry 并通过 production preflight。

候选版本尚未发布，本轮不执行发布、部署或 Registry 提交。打包、安装、启动与准入分别验收；本机检查通过不代表这些结果。

### 2026-09-30 修复与迭代范围

按四步推进：恢复候选依赖及可复现准备命令；统一完成结果的持久化提交、项目容量与清理；同步能力、存储、发行输入和 authority；修复已确认的交互与无障碍问题并验证正式载体。保留单工作区、受保护 SDK/Kit 消费和现有五项能力；不增加通用 remix、续写、Realm 发布或历史兼容层。

Schema 3 以受保护资产保存完整项目 JSON，`workspace/projects.json` 保存全部项目 head，`workspace/current.json` 只选择当前项目。head 目录是 App 创作文档引用的唯一目录，不承载平台身份、路由或任务状态；项目提交与移除 head 均原子更新该目录。16 MiB 是本 App 新选择的文档预算，用于约束整文档编码、散列与解析的内存和等待成本，并非 Runtime 配额；它约为原 240 KiB 预算的 68 倍，音频和乐谱字节仍另存。80% 时提示导出需要的录音后开始新探索，超限不会继续提交生成。每次成功提交后清退被替换的文档快照，清退失败与创作保存结果分别报告。

确认后的存储清理永久删除已替换且没有待恢复操作的探索，失败提示中的重试同样需要确认。当前项目、App 在途操作、待恢复项目、待提交的本地导入及被保留项目引用的资产会保留；明确导出的音频不清理。任一待恢复项目可能已有未提交的有效结果，此时不扫描清退孤儿媒体。清理只处理 App 数据，不取消或推断 Runtime Job。项目全集来自 head 目录，先完成所有文档及引用读取再删除；缺失、未知或损坏的目录和文档会使清理停止。删除 head 后才清退其文档，部分失败可重试。用户已确认旧开发创作无需保留，旧 schema、此前独立 head 与浏览器草稿均硬切，不提供自动迁移；残留通过产品外的一次性工具处理。

本轮新增回归覆盖转录与音乐保存失败、并发编辑、同 Job 去重、重开、丢失提交响应、超过旧 JSON 预算的项目、共享资产及待恢复结果保护、在途操作互斥和部分清理失败。真实生成、播放、转谱、分轨、换声、正式载体 UI 和生产安装需分别验收；本轮实际覆盖结果见下方“当前修复验收”，不能由这些隔离测试代替。

### 审计修复行为

- Submit 前保存作者输入和 clientSubmissionId，收到后补上真实 jobId。音乐生成、转谱和换声在响应丢失、采纳或保存失败时可查询原提交并恢复已有结果，不重新生成；分轨仅能观察已捕获的 Job。完整结果采纳为 App 资产后保存版本，按真实 jobId 去重。项目 schemaVersion 3 不读取旧 inline JSON 或 workspace.v1；旧开发创作不保留。
- 文字协作使用受保护 text.streamTurn 和 cancel，90 秒等待上限；取消、超时或不完整的文字不会覆盖草稿。AI 歌词统一使用独占一行的段落标签，手工歌词不会在提交时被改写。
- Renderer 只缓存格式与小波形，预算4 MiB；通过受保护媒体 URL 播放，不在 App 缓存整首解码 PCM。波形、裁剪与混音使用 Kit 的16384帧窗口及专用 Worker，编辑坐标来自 Runtime canonical audio。播放句柄在到期前更新；更新只恢复试听位置，不重新生成音乐。
- 当前没有发布菜单和发布表单。可打开原音频的文件位置，或保存独立 float32 裁剪 WAV 后打开导出文件的位置。受保护媒体 URL 是播放入口，不能当作浏览器下载合同。高频声音坐标使用独立订阅，不广播给播放器与录音列表。
- 样式门禁检查 src/overtone 的真实 CSS，按 48 KiB UTF-8 字节预算计量，禁止私有 Kit 类选择器和无作用域的原生控件样式。

## 历史候选验证进展（2026-09-21 至 2026-09-22）

以下记录对应当时的候选包与存储实现，保留作历史证据；不能作为 2026-09-30 schema 3 与清理实现的验收结果。

同一候选包已在 Desktop 监督的独立 App Tools 参考项目中跑通 YuE2 音频与 ABC 条件路径。Overtone 自身通过 CDP 验证了本地 Music3 短段生成、原任务恢复、受保护资产采纳、播放与项目重开，以及 YuE2 生成音频和计划谱、选择 Vocal 声部、修改音符、保存派生谱、按谱生成新录音的完整短段流程。两次 YuE2 结果均为 48 kHz 双声道、959936 帧、约20秒，seed=42；达到预算的结果明确提示歌曲可能未结束。音色、歌词和自然度没有听音验收。整曲与其余编辑/演唱合同仍在实现，不能据此承诺全部功能。

谱面核心固定 abcjs 6.7.0 与 @tonejs/midi 2.0.28。真实 YuE2/SheetSage2 ABC 的四个单声部派生结果保留了独立 MIDI 解析得到的音高、起点和时值；原谱保留，省略声部、MIDI 量化和控制器等损失必须显式呈现。ABC 转 MIDI、再选择 MIDI 旋律轨转为 ABC 已经通过真实界面保存；保存前显示转换损失。abcjs MIDI 导出不会完整保留途中拍号、速度和调号，不能宣称通用无损转换。本地合成音仅用于比较旋律草稿，不是 AI 人声或最终编配试听。MuScriptor 原生 MIDI、复杂多声部编辑和主观演唱精度仍未验收。

2026-09-22 续测：受保护媒体 URL 实际播放到末尾；通过真实裁剪控件保存3.000–7.999秒 WAV，239952帧，逐字节等于源文件对应帧。两份实际 YuE2 音频经浏览器 Worker 与 protected assets 流式混合，全部1919872个声道样本符合各0.5增益之和；取消中途写入未留下成功资产。这些结果不证明原生文件管理器的“打开位置”交互、完整混音界面、整首重唱或音色质量。此前浏览器 download 属性未成功处理受保护播放 URL，现已硬切到保存资产与正式 reveal，不绕过导航约束。

“导入歌曲或录音”已通过真实 MP3 输入验收：191.6355秒、48kHz双声道，保留3071616B原文件及73588090B规范音频，项目重开和尾段播放通过。导入版本没有伪造Job、歌词或文字方向。音频准备期间点击放弃后不新增版本，并清理本次App副本；当前unary准备接口只能在返回后停止采纳，不能从App中断codec。连续受保护流配合Kit每源1MiB预读，将同一整曲的完整波形处理测到约0.79秒；每个DSP块仍不超过16384帧。十分钟上限是Runtime准入界限，不代表十分钟重唱已经通过。

## head 目录修复前的验收（2026-09-30）

以下真实验收使用此前独立 head 的存储实现，不能作为完整 head 目录及本次重试修复的验收结果。

最终开发组合为 SDK 0.19.0、Kit/native 0.16.0、App Tools 0.11.4、nimi-coding 0.6.3。SDK、Kit 和 App Tools 使用当前平台源码的完整打包结果，App 仍仅依赖 tarball overrides，不导入平台源码；平台仓库没有产品源文件改动。归档同版本包缺少当前发现协议、字节载体或弹窗退出修复时，版本号相同不代表同一可用组合，必须重新锁定实际 archive integrity。

本轮通过 frozen-lockfile 安装、无 node_modules 的包准备命令、110 个测试、App 检查、样式门禁、renderer/Electron 构建、authority fmt/check/diff/impact 和 managed sync 检查。检查是提交前自检，不构成平台准入。

真实 source Runtime／开发 Desktop 监督的 Overtone 已验证：受保护会话、4 秒 WAV 导入与规范化（48 kHz、双声道、192000 帧）、资产播放到末尾、项目重开；601712 字节项目文档完整保存、校验与重开；确认清理旧项目后当前项目与两份共享媒体仍存在且哈希一致；Demucs 真实分轨得到 vocals／background 两个 44.1 kHz、176400 帧的新版本，已保存且清除待恢复记录。之后通过实际歌词输入框编辑，校验受保护文档内容并刷新重开，歌词与四个录音版本均保留。它不证明分轨听感、真实演唱精度或音色质量。

中文／英文、深色界面、弹窗关闭与后台退出、波形标签和快捷键提示已查看。现有本机文字模型已实际调用，但本次未返回三个符合合同的方向，产品正确拒绝并保留草稿；这不是成功的方向探索验收。音乐生成、转谱、换声当前没有可选的本机配置，成功模型旅程为 NOT-VERIFIED；本轮不安装新模型或自动选择其他提供方。Windows、生产打包安装、公开发行与 Registry 准入为 NOT-VERIFIED。开发 CSP 提示与较大 bundle 提示仍存在。

## 历史修复验收（2026-09-30，存储审计修复）

修复了清理重试绕过确认、导入录音与手工乐谱保存失败后无法重试原结果，以及通过存活资产推断项目全集导致的误删。完整 head 目录取代此前独立 head，沿用未发布项目的硬切约定。待提交的本地结果只在当前窗口保留，保存成功后才显示；关闭未保存的窗口仍不能保证恢复。

118 项测试全部通过，新增覆盖导入失败后的真实保存重试与并发编辑、待提交结果保护、清理重试确认及取消、缺失文档、缺失目录和清理提交响应丢失。测试夹具明确等待持久化队列完成后再注入故障或断言。renderer／Electron 构建、App／样式检查、authority fmt／check／compile／diff／impact、managed sync check 和 diff 格式检查通过；这些检查仍是提交前自检。

在 source Runtime／Desktop 监督的独立 Overtone 0.1.7 开发注册中，用真实控件导入 4 秒 WAV（48 kHz、192000 帧）及 ABC 乐谱，刷新后两个结果均从新的受保护 head 目录及文档重开。随后开始新探索，仅在该测试注册中移除旧项目的文档资产以制造缺失：通过界面确认清理后，产品显示失败，其余四份资产及两个 head 均保留。按原字节和摘要恢复文档后，点击“重试清理”出现删除确认；取消保留两个项目及全部五份资产，再次确认后只剩当前项目及其文档。该过程使用真实受保护存储，没有替换平台返回。

保存写入失败及自动快照清退失败由隔离故障测试覆盖，未在真实磁盘上制造这些故障。本轮没有重跑真实 AI 生成、转谱、分轨或换声；新目录下这些模型旅程、Windows 及生产打包安装为 NOT-VERIFIED。前一阶段的模型能力证据保留在上节，不扩展为新存储格式的验收。
