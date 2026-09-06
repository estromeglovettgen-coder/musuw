// Public, deterministic marketing fixtures. These are not live customer records.
// A locale selects a pre-authored example, never the visitor's legal jurisdiction.
export const STORY_REVIEW_DATE = "2026-09-06";
export const isChineseStory = (locale) => locale === "zh" || locale === "zh-CN";

export const HERO_STORY = Object.freeze({
  "zh-CN": {
    conversation: "生活法律知识库",
    question: "婚礼摄影师把我们的照片用在广告里了。合同写着版权归他，我们还能要求撤下吗？",
    placeholder: "基于你的知识提问",
    summary: { primary: "版权归属", secondary: "肖像使用", tertiary: "中国大陆示例" },
    answer: {
      confirmation: "可以提出撤下要求，但是否有权要求停止使用，还需核对你们是否授权了广告用途。",
      findingLead: "版权归属与广告授权是两回事。",
      phrase: "委托拍摄的照片，版权可以由合同约定归属。",
      recordLead: "即使摄影师拥有版权，",
      recordPhrase: "使用你们的肖像仍需核对相应许可。",
      recordTail: " 不能仅凭版权条款认定广告用途已获授权。",
      timing: " 若肖像许可条款的理解存在争议，应作出有利于肖像权人的解释。",
    },
    citations: ["著作权法 · 第19条", "民法典 · 第1019条", "民法典 · 第1021条"],
    sourceIds: ["cn-copyright", "cn-portrait", "cn-licence"],
    disclaimer: "中国大陆法律信息示例，不替代个案法律意见。",
    model: "DeepSeek V4 Flash", effort: "关闭",
  },
  en: {
    conversation: "Everyday law library",
    question: "Our wedding photographer used our photos in an ad. The contract says they own the copyright. Can we ask for them to be taken down?",
    placeholder: "Ask across your knowledge",
    summary: { primary: "Copyright", secondary: "Permission", tertiary: "UK example" },
    answer: {
      confirmation: "Copyright ownership alone does not settle whether your wedding photos can be used in an ad.",
      findingLead: "The photographer may own the copyright, ",
      phrase: "even when you paid for the shoot.",
      recordLead: "But privately commissioned wedding photos ",
      recordPhrase: "carry separate protection against public use.",
      recordTail: " Consent and any applicable exceptions still matter.",
      timing: " Check any publicity permission or waiver before requesting removal.",
    },
    citations: ["IPO · Commissioned photos", "CDPA · §85", "CDPA · §87"],
    sourceIds: ["uk-copyright", "uk-private-photos", "uk-consent"],
    disclaimer: "UK legal-information example, not advice on an individual case.",
    model: "DeepSeek V4 Flash", effort: "Off",
  },
});

export const REASONING_STORY = Object.freeze({
  zh: {
    title: "学习产品 · 留存复盘",
    question: "最近新用户流失得有点多。结合访谈、客服反馈和使用数据，最值得先改哪里？",
    preparation: "正在查看相关资料",
    steps: [
      { title: "查看用户访谈", summary: "新用户在选课与首次练习前反复犹豫" },
      { title: "核对客服反馈", summary: "扩充课程的诉求主要来自活跃用户" },
      { title: "对照使用数据", summary: "主要流失集中在首次练习之前" },
    ],
    answer: "建议先缩短从注册到完成首次练习的路径，而不是优先扩充课程。\n\n访谈与使用数据都指向首次练习前的阻力；“课程不够”的反馈主要来自活跃用户，不能直接代表新用户流失的原因。\n\n先测试默认学习路径与直接开始练习的入口，观察首次练习完成率，再评估首周留存是否改善。",
    citation: "访谈 · 客服反馈 · 使用漏斗",
    sourceIds: ["interviews", "support", "funnel"],
    searchDone: "已对照三类资料", references: "访谈 · 反馈 · 使用数据",
    placeholder: "基于你的知识提问", model: "DeepSeek V4 Flash", effort: "关闭",
    copy: "复制回答", save: "添加到知识库", finish: "形成优先级建议", send: "发送", stop: "停止生成",
    disclaimer: "在线学习产品示例 · 模拟研究资料",
  },
  en: {
    title: "Learning product · Retention review",
    question: "New users are dropping off. Based on interviews, support feedback, and usage data, what should we improve first?",
    preparation: "Reviewing the relevant sources",
    steps: [
      { title: "Review user interviews", summary: "New users hesitate before their first exercise" },
      { title: "Check support feedback", summary: "Requests for more courses come mainly from active users" },
      { title: "Compare usage data", summary: "The main drop-off is before the first exercise" },
    ],
    answer: "Prioritize the path from sign-up to the first completed exercise, rather than adding courses.\n\nInterviews and usage data point to friction before that first exercise. Requests for more courses mainly come from active users, not those dropping off.\n\nTest a default learning path and a direct start option. Track first-exercise completion, then check whether week-one retention improves.",
    citation: "Interviews · Support · Usage funnel",
    sourceIds: ["interviews", "support", "funnel"],
    searchDone: "Three source sets compared", references: "Interviews · Feedback · Usage",
    placeholder: "Ask across your knowledge", model: "DeepSeek V4 Flash", effort: "Off",
    copy: "Copy answer", save: "Add to knowledge base", finish: "Recommendation ready", send: "Send", stop: "Stop generation",
    disclaimer: "Example learning product · Simulated research",
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
        knowledge: "知识 8", summaries: "摘要 1", back: "记忆系统", pageTitle: "长期记忆评估", type: "研究主题",
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
      },
    },
    graph: {
      app: { ...zhApp, userMeta: "阅读与思考", sessions: ["《小王子》的人物与主题", "狐狸与建立关系", "玫瑰为什么独特？", "第21章阅读笔记", "时间与照料", "责任与驯养", "商人与点灯人", "整理阅读总览"] },
      header: { ...zhTabs, current: "《小王子》阅读笔记", description: "连接人物、章节与主题，梳理关系、时间与责任之间的呼应", documents: "文档 (1)" },
      content: {
        search: "搜索整张知识图谱...", summary: "摘要", entity: "人物与章节", concept: "主题", synthesis: "综合", comparison: "对比",
        overview: "人物与主题", count: "14 / 14 个节点", status: "章节、概念与阅读笔记已关联", playbackRunning: "正在连接人物、章节与主题",
        labels: { index: "《小王子》", interviews: "狐狸", retention: "责任", onboarding: "玫瑰", activation: "第21章", time_to_value: "时间", plg: "关系", support: "商人", analytics: "第20章", competitors: "点灯人", friction: "照料", aha: "驯养", adoption: "独特性", summary: "阅读总览" },
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
        knowledge: "Knowledge 8", summaries: "Summaries 1", back: "Memory systems", pageTitle: "Memory Evaluation", type: "Research topic",
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
          { label: "Research notes", count: 2, items: ["evaluation tasks", "Test plan"] },
        ],
      },
    },
    graph: {
      app: { ...enApp, userMeta: "Reading & reflection", sessions: ["The Little Prince: characters and themes", "The fox and forming ties", "What makes the rose unique?", "Chapter 21 reading notes", "Time and care", "Responsibility and taming", "The businessman and the lamplighter", "Organize my reading overview"] },
      header: { ...enTabs, current: "The Little Prince · Reading Notes", description: "Connect characters and chapters with themes of relationships, time, and responsibility", documents: "Documents (1)" },
      content: {
        search: "Search the knowledge graph...", summary: "Summaries", entity: "Characters & chapters", concept: "Themes", synthesis: "Synthesis", comparison: "Comparisons",
        overview: "Characters & themes", count: "14 / 14 nodes", status: "Chapters, ideas, and reading notes connected", playbackRunning: "Connecting characters, chapters, and themes",
        labels: { index: "The Little Prince", interviews: "The fox", retention: "Responsibility", onboarding: "The rose", activation: "Chapter 21", time_to_value: "Time", plg: "Relationships", support: "The businessman", analytics: "Chapter 20", competitors: "The lamplighter", friction: "Care", aha: "Taming", adoption: "Uniqueness", summary: "Reading overview" },
      },
    },
  },
});

export const HOMEPAGE_STORIES = Object.freeze({
  en: {
    hero: {
      eyebrow: "Evidence · Insight · Understanding · Discovery",
      typewriterPhrases: ["Evidence · Insight · Understanding · Discovery", "Answers grounded in your own sources", "Put your knowledge to work", "Build a connected understanding", "Discover relationships across what you read"],
      titleLine1: "Turn source material into", titleLine2: "intelligent knowledge assets", titleFocusSegments: ["intelligent", "knowledge", "assets"],
      descriptionLine1: "Get answers you can trace back to the knowledge you have collected.",
      descriptionLine2: "Build on what you read, research, and discover in a knowledge base that keeps evolving.",
      getStarted: "Start free", talkToSales: "Contact", dashboardAlt: "A legal question answered from saved copyright and privacy sources, with inspectable citations",
    },
    features: {
      intro: { label: "Knowledge at work", title: "Bring what you know into every question", body: "Evidence for decisions. Structure for research. Connections for deeper reading." },
      items: [
        { label: "Decision insight", title: "Find the signals that should shape your next decision", description: "Compare interviews, support feedback, and usage data to distinguish surface requests from the problems worth solving first.", bullets: ["Bring different sources together", "Compare requests with actual behavior", "Identify what deserves priority", "Inspect the evidence behind each recommendation"] },
        {},
        { label: "Connected reading", title: "Discover connections across what you know", description: "Connect characters, events, and themes across chapters. Turn separate reading notes into a deeper understanding.", bullets: ["Connect characters with themes", "Follow ideas across chapters", "Include your own reading notes", "Trace connections back to the text"] },
        { label: "Research knowledge", title: "Turn scattered learning into a connected body of knowledge", description: "Organize papers, research notes, and evaluation plans around a question. Keep findings, evidence, and open questions together.", bullets: ["Organize literature around questions", "Keep findings in context", "Connect methods and evaluation criteria", "Trace ideas to papers and research notes"] },
      ],
    },
  },
  "zh-CN": {
    hero: {
      eyebrow: "多源研判 · 决策洞察 · 知识沉淀 · 关联发现",
      typewriterPhrases: ["多源研判 · 决策洞察 · 知识沉淀 · 关联发现", "从自己的资料中，得到有依据的回答", "让积累的知识，参与每一次思考", "围绕研究问题，形成自己的理解", "在阅读与笔记之间，发现新的关联"],
      titleLine1: "把资料转化为", titleLine2: "会思考的知识资产", titleFocusSegments: ["会", "思考的", "知识资产"],
      descriptionLine1: "从你积累的资料中，得到有依据、可追溯的回答。",
      descriptionLine2: "让阅读、研究与工作中的发现，沉淀为持续完善的知识体系。",
      getStarted: "免费开始", talkToSales: "联系", dashboardAlt: "从已保存的版权与肖像权资料回答生活法律问题，并展示可核验的引用",
    },
    features: {
      intro: { label: "知识的价值", title: "让积累的知识，参与每一次思考", body: "为工作提供依据，为研究形成体系，为阅读发现关联。" },
      items: [
        { label: "决策洞察", title: "从信息噪声中，找到真正影响决策的信号", description: "综合用户访谈、客服反馈与使用数据，区分表面诉求和关键阻力，为下一步行动建立依据。", bullets: ["综合不同来源的反馈", "对照诉求与实际行为", "明确值得优先解决的问题", "关键建议可回到原文核验"] },
        {},
        { label: "关联发现", title: "让隐藏在知识中的关联自然浮现", description: "连接人物、情节与主题，发现分散在不同章节中的呼应，让阅读不止于零散摘录。", bullets: ["连接人物与核心主题", "发现跨章节的线索", "将阅读笔记纳入关联", "沿着关系回到原文"] },
        { label: "研究沉淀", title: "让零散积累，逐渐形成完整的知识体系", description: "围绕研究问题组织论文、文献笔记与实验思路，让结论、依据和待验证的问题保留在同一套知识体系中。", bullets: ["围绕研究问题组织文献", "保留结论与适用范围", "连接方法、概念与评估指标", "追溯论文与研究笔记"] },
      ],
    },
  },
});
