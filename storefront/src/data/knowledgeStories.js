// Public, deterministic marketing fixtures. These are not live customer records.
// A locale selects a pre-authored example, never the visitor's legal jurisdiction.
export const STORY_REVIEW_DATE = "2026-09-06";
export const isChineseStory = (locale) => locale === "zh" || locale === "zh-CN";

export const HERO_STORY = Object.freeze({
  "zh-CN": {
    conversation: "生活法律知识库",
    question: "婚礼摄影师把我们的照片用在广告里了。合同写着版权归他，我们还能要求撤下吗？",
    placeholder: "基于你的知识提问",
    answer: {
      confirmation: "可以先向摄影师及广告投放方提出停止使用和撤下请求；但现有资料不足以判断对方是否必须立即撤下，关键要看合同及另行授权是否明确覆盖广告用途、公开范围和使用期限。",
      findingLead: "应先区分两个法律问题：",
      phrase: "委托摄影作品的著作权归属，可以由合同约定。",
      recordLead: "但即便摄影师取得著作权，",
      recordPhrase: "将你们的肖像用于广告，仍需单独核对肖像许可。",
      recordTail: "如果没有明确的广告授权，应保留合同、付款记录、沟通记录和广告页面，书面要求暂停使用，并请对方说明授权依据。",
      timing: "如肖像许可条款存在歧义，应作有利于肖像权人的解释。",
    },
    citations: ["著作权法 · 第19条", "民法典 · 第1019条", "民法典 · 第1021条"],
    sourceIds: ["cn-copyright", "cn-portrait", "cn-licence"],
    model: "DeepSeek V4 Flash", effort: "关闭",
  },
  en: {
    conversation: "Everyday law library",
    question: "Our wedding photographer used our photos in an ad. The contract says they own the copyright. Can we ask for them to be taken down?",
    placeholder: "Ask across your knowledge",
    answer: {
      confirmation: "You can ask the photographer and advertiser to stop using the images and take the ad down. The cited material does not make removal automatic; the decisive issue is whether the contract or a separate release clearly covered advertising, scope, and duration.",
      findingLead: "The first issue is ownership: ",
      phrase: "copyright in commissioned photographs will usually remain with the photographer.",
      recordLead: "That does not settle permitted use. ",
      recordPhrase: "Privately commissioned photographs have separate protection against public use.",
      recordTail: " Preserve the contract, any release, payment and message records, and the live ad; request the authorization relied on and ask for use to stop while its scope is checked.",
      timing: " Any signed consent or waiver, and the precise acts it covers, still need to be reviewed.",
    },
    citations: ["IPO · Commissioned photos", "CDPA · §85", "CDPA · §87"],
    sourceIds: ["uk-copyright", "uk-private-photos", "uk-consent"],
    model: "DeepSeek V4 Flash", effort: "Off",
  },
});

export const REASONING_STORY = Object.freeze({
  zh: {
    title: "多源检索 · 留存路径诊断",
    question: "最近新用户流失有所上升。结合用户访谈、客服反馈与使用数据，当前最值得优先验证的改进方向是什么？",
    preparation: "正在理解问题…",
    steps: [
      { title: "查询理解与意图识别", summary: "解析用户目标，生成检索改写，并将问题拆成可独立核验的命题" },
      { title: "证据范围锁定", summary: "限定访谈、客服反馈与首次练习漏斗，保留用户群体和时间边界" },
      { title: "混合召回（BM25 + 向量）", summary: "关键词与语义并行召回，经 RRF 融合排序；召回不足时触发 Query Expansion" },
      { title: "Rerank 重排与上下文合并", summary: "按语义相关性重排候选，去重并合并相邻片段，保留来源指针" },
      { title: "关系回溯与证据核验", summary: "核对群体、行为与漏斗关系，保留原始引用，区分交叉印证与待验证因果" },
    ],
    answer: "当前资料更支持先验证注册到完成首次练习的路径，而不是先扩充课程。\n\n访谈与使用漏斗都把阻力指向首次练习之前；客服中关于扩充课程的诉求主要来自持续使用产品的活跃用户，不能直接外推为新用户流失原因。以上是跨来源一致的优先级判断，不是对流失因果的最终证明。\n\n建议先做两项可逆验证：提供默认学习路径，并将首次练习入口前置。以首次练习完成率为首要观察指标，再按同一用户口径检查首周留存；若结果未改善，再回到课程供给与其他阻力假设。",
    citation: "访谈 · 客服反馈 · 使用漏斗",
    sourceIds: ["interviews", "support", "funnel"],
    pipelineStatus: "已完成多源检索与证据核验",
    pipelineSummary: "BM25 + 向量 · RRF 融合 · Rerank · 证据回溯",
    placeholder: "基于你的知识提问", model: "DeepSeek V4 Flash", effort: "关闭",
    copy: "复制回答", save: "添加到知识库", finish: "形成优先级建议", send: "发送", stop: "停止生成",
  },
  en: {
    title: "Hybrid retrieval · Retention path diagnosis",
    question: "New-user drop-off is rising. Based on interviews, support feedback, and usage data, which improvement should we validate first?",
    preparation: "Understanding the question…",
    steps: [
      { title: "Query understanding & intent", summary: "Parse the objective, preserve the original query, and generate independently testable rewrites" },
      { title: "Evidence scope lock", summary: "Limit retrieval to interviews, support feedback, and the first-exercise funnel while retaining cohort and time boundaries" },
      { title: "Hybrid retrieval (BM25 + vector)", summary: "Run lexical and semantic recall in parallel, fuse ranks with RRF, and trigger query expansion only when recall is sparse" },
      { title: "Rerank & context merge", summary: "Rerank candidates by semantic relevance, merge adjacent passages, and retain source pointers" },
      { title: "Relationship trace & evidence check", summary: "Trace cohort, behavior, and funnel relationships back to their sources; separate corroboration from unverified causality" },
    ],
    answer: "The current evidence favors validating the path from sign-up to a completed first exercise before expanding the course catalog.\n\nBoth interviews and the usage funnel place the strongest friction before that first exercise. Requests for more courses come mainly from active users, so they cannot be treated as a direct explanation for new-user drop-off. This is a cross-source priority signal, not a final causal claim.\n\nRun two reversible checks first: provide a default learning path and move the first-exercise entry point forward. Use first-exercise completion as the primary measure, then compare week-one retention on the same cohort definition. If the result does not improve, return to the course-supply and alternative-friction hypotheses.",
    citation: "Interviews · Support · Usage funnel",
    sourceIds: ["interviews", "support", "funnel"],
    pipelineStatus: "Multi-source retrieval and evidence checks complete",
    pipelineSummary: "BM25 + vector · RRF fusion · Rerank · evidence trace",
    placeholder: "Ask across your knowledge", model: "DeepSeek V4 Flash", effort: "Off",
    copy: "Copy answer", save: "Add to knowledge base", finish: "Recommendation ready", send: "Send", stop: "Stop generation",
  },
});

const zhApp = {
  newChat: "新对话", knowledgeBases: "知识库", agents: "智能体", today: "今天", recent: "近7天",
  userName: "Musuw 演示", userMeta: "个人知识空间",
};
const enApp = {
  newChat: "New chat", knowledgeBases: "Knowledge bases", agents: "Agents", today: "Today", recent: "Last 7 days",
  userName: "Musuw Demo", userMeta: "Personal knowledge",
};
const zhTabs = { knowledgeBases: "知识库", wiki: "Wiki", graph: "图谱" };
const enTabs = { knowledgeBases: "Knowledge bases", wiki: "Wiki", graph: "Graph" };

export const KNOWLEDGE_STORIES = Object.freeze({
  zh: {
    wiki: {
      app: { ...zhApp, userMeta: "研究者知识空间", sessions: ["长期记忆应该如何评估？", "LongMemEval 阅读笔记", "LoCoMo 任务设计", "信息更新与时间推理", "整理评估方案", "跨会话推理研究", "比较文献的评价指标", "研究问题与验证计划"] },
      header: { ...zhTabs, current: "AI Agent 记忆研究", description: "围绕长期记忆的研究问题，组织论文、阅读笔记与评估方案", documents: "文档 (3)" },
      content: {
        search: "搜索 Wiki 页面...", loading: "正在整理知识索引…", index: "索引", indexOverview: "AI Agent 记忆研究",
        indexLead: "围绕研究问题组织文献、个人理解与后续验证。", indexHint: "打开页面，查看理解背后的论文与研究笔记。",
        knowledge: "知识 8", summaries: "摘要 1", pageId: "memory-evaluation", back: "记忆系统", pageTitle: "长期记忆评估", type: "研究主题",
        lead: "我目前的理解：长期记忆评估不只看事实召回，还要看跨会话关联、时间变化与信息不足时的回答边界。",
        introBeforeLink: "比较记忆方案时，先对齐 ", inlineLink: "评估任务", introAfterLink: "、资料条件和评价指标，不直接用不同论文的总分排列方法优劣。",
        core: "已有研究提供了什么",
        bullets: ["LongMemEval：分别评估信息提取、跨会话推理、时间推理、知识更新与拒答。", "LoCoMo：通过长跨度、多会话材料，设置问答、事件总结与多模态对话任务。"],
        audienceTitle: "我的研究备注", audience: "区分论文结论与自己的推断；比较结果时，保留任务设置和适用范围。",
        assessmentTitle: "下一步验证", assessment: "在相同资料和查询条件下，分别检查事实召回、信息更新和时间推理，记录方案在哪类问题上失效。",
        linkedFrom: "反向链接", backlinkTitle: "知识更新 · 时间推理 · RAG 评估", sources: "资料来源", sourceTitle: "2 篇论文 · 1 份研究笔记",
        sourceIds: ["longmemeval", "locomo", "research-plan"], updatedAt: "2026/09/06", note: "研究笔记与验证计划为演示内容",
        groups: [
          { label: "研究问题", count: 3, items: ["长期记忆评估", "知识更新", "时间推理"] },
          { label: "文献与方法", count: 3, items: ["LongMemEval", "LoCoMo", "RAG 评估"] },
          { label: "研究笔记", count: 2, items: ["评估任务", "验证计划"] },
        ],
        linkedPage: {
          pageId: "evaluation-tasks", pageTitle: "评估任务", type: "研究笔记", back: "长期记忆评估",
          lead: "评估任务将抽象能力转化为可复现的核验条件，使不同方案的结果具备可比性。",
          introBeforeLink: "本页对照 ", inlineLink: "LongMemEval", introAfterLink: " 与 LoCoMo 的任务设计，统一记录问题类型、资料范围和判定标准。",
          core: "任务维度",
          bullets: ["信息提取：确认系统能否从既有资料中定位并复述关键事实。", "跨会话与时间推理：检查跨轮次关联、时间变化和上下文约束。", "知识更新与拒答：区分资料变更后的更新能力，以及证据不足时的回答边界。"],
          audienceTitle: "使用边界", audience: "结果只对当前资料、查询与评分口径负责；跨数据集或跨版本比较前需先对齐任务设置。",
          assessmentTitle: "验证记录", assessment: "固定资料和查询条件，逐项记录正确性、引用完整性与不确定性，并保留失败样例。",
          linkedFrom: "关联页面", backlinkTitle: "长期记忆评估", sources: "资料来源", sourceTitle: "LongMemEval · LoCoMo · 研究计划",
          sourceIds: ["longmemeval", "locomo", "research-plan"], updatedAt: "2026/09/06",
        },
      },
    },
    graph: {
      app: { ...zhApp, userMeta: "阅读与思考", sessions: ["《小王子》的人物与主题", "狐狸与建立关系", "玫瑰为什么独特？", "第21章阅读笔记", "时间与照料", "责任与驯养", "商人与点灯人", "整理阅读总览"] },
      header: { ...zhTabs, current: "《小王子》阅读笔记", description: "通读全书后，连接人物、章节事件、地点、主题、象征、关系与总结", documents: "文档 (1)" },
      content: {
        search: "搜索整张知识图谱...", overview: "全书阅读图谱", count: "个节点",
        status: "全书章节、事件与阅读关系已关联", playbackRunning: "正在展开全书人物、事件与主题",
      },
    },
  },
  en: {
    wiki: {
      app: { ...enApp, userMeta: "Research workspace", sessions: ["How should long-term memory be evaluated?", "Reading notes: LongMemEval", "LoCoMo task design", "Updates and temporal reasoning", "Draft an evaluation plan", "Cross-session reasoning", "Compare evaluation metrics", "Research questions and next steps"] },
      header: { ...enTabs, current: "Agent Memory Research", description: "Organize papers, reading notes, and evaluation plans around a research question", documents: "Documents (3)" },
      content: {
        search: "Search Wiki pages...", loading: "Building the knowledge index…", index: "Index", indexOverview: "Agent Memory Research",
        indexLead: "Connect the literature, your interpretation, and the questions to test next.", indexHint: "Open a page to inspect the papers and notes behind an understanding.",
        knowledge: "Knowledge 8", summaries: "Summaries 1", pageId: "memory-evaluation", back: "Memory systems", pageTitle: "Memory Evaluation", type: "Research topic",
        lead: "My current understanding: evaluate more than fact recall. Check cross-session connections, changing information, and when the evidence is insufficient.",
        introBeforeLink: "Before comparing systems, align ", inlineLink: "evaluation tasks", introAfterLink: ", source conditions, and metrics. Scores from different papers are not a shared ranking.",
        core: "What the literature contributes",
        bullets: ["LongMemEval tests extraction, cross-session and temporal reasoning, knowledge updates, and abstention.", "LoCoMo uses long, multi-session conversations for question answering, event summarization, and multimodal dialogue."],
        audienceTitle: "My research note", audience: "Separate reported findings from my interpretation. Keep task settings and the scope of each result.",
        assessmentTitle: "What to test next", assessment: "Hold sources and queries constant. Check recall, updates, and temporal reasoning separately, recording where each approach fails.",
        linkedFrom: "Linked from", backlinkTitle: "Knowledge updates · Temporal reasoning · RAG evaluation", sources: "Sources", sourceTitle: "2 papers · 1 research note",
        sourceIds: ["longmemeval", "locomo", "research-plan"], updatedAt: "2026/09/06", note: "Research notes and test plans are illustrative",
        groups: [
          { label: "Research questions", count: 3, items: ["Memory Evaluation", "Knowledge updates", "Temporal reasoning"] },
          { label: "Literature & methods", count: 3, items: ["LongMemEval", "LoCoMo", "RAG evaluation"] },
          { label: "Research notes", count: 2, items: ["Evaluation tasks", "Test plan"] },
        ],
        linkedPage: {
          pageId: "evaluation-tasks", pageTitle: "Evaluation tasks", type: "Research note", back: "Memory Evaluation",
          lead: "Evaluation tasks turn an abstract capability into reproducible checks, so results from different systems remain comparable.",
          introBeforeLink: "This page compares the task design in ", inlineLink: "LongMemEval", introAfterLink: " and LoCoMo, keeping question types, source scope, and decision rules explicit.",
          core: "Task dimensions",
          bullets: ["Information extraction: locate and restate facts already present in the source material.", "Cross-session and temporal reasoning: test links across turns, changing facts, and context constraints.", "Knowledge updates and abstention: separate update behavior after source changes from the boundary where evidence is insufficient."],
          audienceTitle: "Scope", audience: "Results apply only to the current sources, queries, and scoring rules. Align task settings before comparing datasets or versions.",
          assessmentTitle: "Validation record", assessment: "Hold sources and queries constant. Record correctness, citation completeness, uncertainty, and retained failure cases for each task.",
          linkedFrom: "Linked from", backlinkTitle: "Memory Evaluation", sources: "Sources", sourceTitle: "LongMemEval · LoCoMo · Research plan",
          sourceIds: ["longmemeval", "locomo", "research-plan"], updatedAt: "2026/09/06",
        },
      },
    },
    graph: {
      app: { ...enApp, userMeta: "Reading & reflection", sessions: ["The Little Prince: characters and themes", "The fox and forming ties", "What makes the rose unique?", "Chapter 21 reading notes", "Time and care", "Responsibility and taming", "The businessman and the lamplighter", "Organize my reading overview"] },
      header: { ...enTabs, current: "The Little Prince · Reading Notes", description: "A complete-book map of characters, chapter events, places, themes, symbols, relations, and summaries", documents: "Documents (1)" },
      content: {
        search: "Search the knowledge graph...", overview: "Complete reading map", count: "nodes",
        status: "The complete book's chapters, events, and reading connections are linked", playbackRunning: "Revealing the book's characters, events, and themes",
      },
    },
  },
});

export const HOMEPAGE_STORIES = Object.freeze({
  en: {
    hero: {
      eyebrow: "Retrieval · Evidence · Structure · Connections",
      typewriterPhrases: ["Retrieval · Evidence · Structure · Connections", "Trace key claims to their original sources", "Retrieve and verify across multiple sources", "Keep sources, pages, and relationships aligned", "Integrate new material into existing knowledge"],
      titleLine1: "Turn source material into", titleLine2: "intelligent knowledge assets", titleFocusSegments: ["intelligent", "knowledge", "assets"],
      descriptionLine1: "Retrieve across multiple sources to produce verifiable, traceable answers.",
      descriptionLine2: "Organize key information into knowledge that stays current, connected, and reusable.",
      getStarted: "Start free", talkToSales: "Contact", dashboardAlt: "A legal question answered from saved copyright and privacy sources, with inspectable citations",
    },
    features: {
      intro: { label: "Core capabilities", title: "Build a verifiable knowledge system that keeps evolving", body: "Multi-source retrieval, evidence verification, structured organization, and relationship discovery share one traceable context." },
      items: [
        { label: "Multi-source reasoning", title: "Support every conclusion with evidence across sources", description: "Retrieve, compare, and synthesize within a defined source scope. Distinguish source evidence, model inference, and missing information.", bullets: ["Cross-source retrieval", "Scope and version controls", "Precise citation locations", "Evidence, inference, and uncertainty"] },
        {},
        { label: "Knowledge graph", title: "Turn relationships into explorable knowledge paths", description: "Map typed relationships among pages, entities, concepts, and sources. Move from the global structure into local context, then trace each path back to evidence.", bullets: ["Typed relationships", "Cross-source connections", "Node-level context", "Evidence-traceable paths"] },
        { label: "Structured Wiki", title: "Keep knowledge structured as it evolves", description: "Organize sources, findings, and context into linked Wiki pages while preserving provenance and version history through every update.", bullets: ["Structured Wiki pages", "Page links and backlinks", "Traceable sources and versions", "Incremental updates"] },
      ],
    },
  },
  "zh-CN": {
    hero: {
      eyebrow: "多源检索 · 证据核验 · 知识组织 · 关系发现",
      typewriterPhrases: ["多源检索 · 证据核验 · 知识组织 · 关系发现", "关键结论可追溯至原始资料", "多种来源统一检索与交叉核验", "资料、页面与关系持续同步", "新增内容自动接入既有知识"],
      titleLine1: "把资料转化为", titleLine2: "会思考的知识资产", titleFocusSegments: ["会", "思考的", "知识资产"],
      descriptionLine1: "统一检索多种资料来源，生成可验证、可追溯的回答。",
      descriptionLine2: "将关键信息组织为可持续更新、关联与复用的知识体系。",
      getStarted: "免费开始", talkToSales: "联系", dashboardAlt: "从已保存的版权与肖像权资料回答生活法律问题，并展示可核验的引用",
    },
    features: {
      intro: { label: "核心能力", title: "构建可验证、可持续演进的知识体系", body: "多源检索、证据核验、结构化组织与关系发现，共享同一套可追溯上下文。" },
      items: [
        { label: "多源推理", title: "以多源证据支撑判断", description: "在限定资料范围内完成检索、比对与归纳，明确区分原文依据、模型推断与信息缺口。", bullets: ["跨来源检索与聚合", "范围与版本约束", "精确引用定位", "事实、推断与不确定性分层"] },
        {},
        { label: "知识图谱", title: "让关系成为可探索的知识路径", description: "以图谱呈现页面、实体、概念与来源之间的有类型关系，从全局结构进入局部上下文，并沿路径返回证据。", bullets: ["呈现有类型的关系", "发现跨资料关联", "展开节点相关上下文", "沿关系路径追溯证据"] },
        { label: "Wiki 组织", title: "让知识以结构持续演进", description: "将资料、结论与来源组织为相互链接的 Wiki 页面，在持续更新中保留上下文和版本关系。", bullets: ["自动生成结构化页面", "页面互链与反向链接", "来源与版本可追溯", "新增资料增量更新"] },
      ],
    },
  },
});
