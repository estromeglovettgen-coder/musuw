const en = {
  meta: {
    title: "musuw | Answers you can verify",
    description:
      "Turn documents, notes, and webpages into answers you can verify, then keep reliable knowledge in a connected Wiki.",
  },
  hero: {
    eyebrow: "Personal knowledge, grounded in your sources",
    titleLine1: "Make what you save useful.",
    titleLine2: "See what supports every answer.",
    description:
      "Add documents and notes. Ask across them, open the source behind important claims, and keep reliable answers in a living Wiki.",
    primaryAction: "Start free",
    secondaryAction: "See how it works",
    trustItems: ["No card required", "Private by default", "Export and deletion controls"],
    scene: {
      mainLabel: "Answer with exact evidence",
      mainMeta: "Open any citation to inspect the source passage.",
      sourcesLabel: "12 sources selected",
      sourcesMeta: "PDFs and notes",
      wikiLabel: "Saved to Wiki",
      wikiMeta: "6 sources · 3 related pages",
      mainAlt: "musuw answer with exact citations and the source passage open",
      sourcesAlt: "musuw source library with selected documents",
      wikiAlt: "musuw Wiki page created from a reliable answer",
    },
  },
  journey: {
    ariaLabel: "How musuw turns sources into reusable knowledge",
    items: [
      { step: "01", title: "Sources", body: "Add what matters" },
      { step: "02", title: "Ask", body: "Ask in a clear scope" },
      { step: "03", title: "Verify", body: "Open the evidence" },
      { step: "04", title: "Keep", body: "Reuse what you learned" },
    ],
  },
  features: {
    intro: {
      label: "Why musuw",
      title: "A knowledge system that keeps the trail intact.",
      body: "Musuw does more than answer questions. It preserves the material, shows what supports each claim, and turns reliable results into knowledge you can return to.",
    },
    items: [
      {
        label: "Grounded answers",
        title: "Ask naturally. Verify every important claim.",
        body: "Musuw answers within the sources you choose. Open any citation to see the exact passage behind the claim.",
        bullets: [
          "Only the sources you select",
          "Exact source passages",
          "Visible uncertainty",
          "Reusable conversation history",
        ],
        image: "/images/musuw-query-citation.jpg",
        imageAlt: "musuw answer with an exact source passage open",
        sceneLabel: "Answer → citation → source",
      },
      {
        label: "Source integrity",
        title: "Keep the original source intact and in context.",
        body: "AI-generated knowledge never silently replaces the material you uploaded. The source, version, and processing state remain inspectable.",
        bullets: [
          "Originals remain unchanged",
          "Source-version history",
          "Visible processing status",
          "Clear ownership",
        ],
        image: "/images/musuw-knowledge-base.jpg",
        imageAlt: "musuw source library preserving original documents and processing state",
        sceneLabel: "Original source remains available",
      },
      {
        label: "Living knowledge",
        title: "Turn reliable answers into knowledge you can reuse.",
        body: "Save useful conclusions as structured Wiki pages, connect related topics, and return to the evidence whenever you need it.",
        bullets: [
          "Structured Wiki pages",
          "Related topics and entities",
          "Evidence-backed relationships",
          "Source return at any time",
        ],
        image: "/images/musuw-wiki-page.jpg",
        insetImage: "/images/musuw-wiki-graph.jpg",
        imageAlt: "musuw Wiki page with related sources and knowledge relationships",
        insetAlt: "musuw graph view inside Wiki",
        sceneLabel: "Reliable answer → living Wiki",
      },
    ],
  },
  workflow: {
    intro: {
      label: "How it works",
      title: "From a source to reusable knowledge—without losing the trail.",
      body: "Add what you already have, ask within a clear scope, inspect the evidence, and keep the result for later.",
    },
    largeItems: [
      {
        title: "Add what you already have.",
        body: "Upload documents and notes. See what is ready, what is processing, and what needs attention.",
        image: "/images/musuw-knowledge-base.jpg",
        imageAlt: "musuw source library with ready and processing documents",
        badge: "Sources and processing",
      },
      {
        title: "Ask within a clear source scope.",
        body: "Choose a knowledge base, topic, or source set before asking, so you always know what the answer was allowed to use.",
        image: "/images/musuw-query-citation.jpg",
        imageAlt: "musuw question asked within a selected source scope",
        badge: "Scope before answer",
      },
    ],
    smallItems: [
      {
        title: "Open the evidence",
        body: "Click a citation and go directly to the source version and passage.",
      },
      {
        title: "Save what matters",
        body: "Keep the conclusion, citations, and related sources together in Wiki.",
      },
      {
        title: "Return, export, or remove",
        body: "Revisit useful knowledge and keep data controls visible throughout its lifecycle.",
      },
    ],
  },
  useCases: {
    intro: {
      label: "Use cases",
      title: "Built for work where the answer—and the source—both matter.",
      body: "Use Musuw when you need a useful conclusion now and a trustworthy trail you can return to later.",
    },
    items: [
      {
        category: "Research and literature",
        title: "Compare complex material without losing the citations.",
        body: "Ask across papers and reports, compare findings, and open the source behind every conclusion.",
        outcome: "From many papers to one inspectable synthesis.",
        image: "/images/musuw-query-citation.jpg",
        imageAlt: "musuw comparing research sources with exact citations",
      },
      {
        category: "Product and user research",
        title: "Turn interviews into insights that still link to the original words.",
        body: "Find recurring themes across transcripts and keep every insight connected to the people who said it.",
        outcome: "From interviews to a cited insight Wiki.",
        image: "/images/musuw-wiki-page.jpg",
        imageAlt: "musuw Wiki page organizing interview insights and sources",
      },
      {
        category: "Long-term learning",
        title: "Build a living map of what you learn.",
        body: "Connect books, notes, and articles into knowledge you can revisit and extend over time.",
        outcome: "From scattered notes to connected understanding.",
        image: "/images/musuw-wiki-graph.jpg",
        imageAlt: "musuw knowledge graph connecting learning topics and sources",
      },
    ],
  },
  trust: {
    intro: {
      label: "Accountable by design",
      title: "Useful without hiding the evidence.",
      body: "Answers, source history, knowledge scope, and data controls stay connected in the same workflow.",
    },
    items: [
      {
        title: "Exact source passages",
        body: "Important claims link to the specific passage, not only the document title.",
      },
      {
        title: "Originals stay unchanged",
        body: "Wiki pages and AI outputs do not silently overwrite your source material.",
      },
      {
        title: "History stays inspectable",
        body: "Earlier source versions and the evidence used at the time remain traceable.",
      },
      {
        title: "Scope stays explicit",
        body: "Every question uses only the knowledge base, topic, or sources you selected.",
      },
      {
        title: "Personal workspaces stay isolated",
        body: "Sources, answers, and history remain separated by account and workspace.",
      },
      {
        title: "Data controls show real status",
        body: "Export and deletion report whether work is requested, processing, or complete.",
      },
    ],
  },
  pricing: {
    intro: {
      label: "Pricing",
      title: "Choose by how much you use—not by which core features you get.",
      body: "Every plan includes grounded answers, exact citations, source preservation, Wiki, graph, and data controls. Upgrade for more capacity, higher usage, broader model access, or video ingestion.",
    },
    monthly: "Monthly",
    yearly: "Yearly",
    save: "Save with annual billing",
    perMonth: "/month",
    perYear: "/year",
    recommended: "Recommended",
    includes: "Designed for",
    currencySymbol: "$",
    note: "Core evidence and knowledge features are included in every plan.",
    plans: [
      {
        name: "Free",
        description: "Try the complete Musuw workflow.",
        fit: "Best for occasional use",
        details: ["5 GiB personal source library", "Standard model access", "Documents and notes"],
        action: "Start free",
      },
      {
        name: "Plus",
        description: "For a growing personal knowledge library.",
        fit: "Best for regular use",
        details: ["20 GiB source capacity", "Expanded model access", "Video ingestion"],
        action: "Choose Plus",
      },
      {
        name: "Pro",
        description: "For daily research, learning, and writing.",
        fit: "Best for daily use",
        details: ["40 GiB source capacity", "Higher AI usage", "Expanded models and video"],
        action: "Choose Pro",
      },
      {
        name: "Max",
        description: "For intensive personal knowledge work.",
        fit: "Best for intensive use",
        details: ["80 GiB source capacity", "Highest current AI usage", "Widest current model access"],
        action: "Choose Max",
      },
    ],
  },
  included: {
    intro: {
      label: "Included in every plan",
      title: "The complete evidence loop is never paywalled.",
      body: "Plans only change source capacity, AI usage, model access, and video ingestion.",
    },
    items: [
      { title: "Grounded answers", body: "Ask within the source scope you choose." },
      { title: "Exact citations", body: "Open the passage behind important claims." },
      { title: "Source preservation", body: "Keep original material unchanged and inspectable." },
      { title: "Living Wiki", body: "Turn useful conclusions into reusable pages." },
      { title: "Knowledge graph", body: "Explore related pages without losing the evidence." },
      { title: "Data controls", body: "Use visible export and deletion workflows." },
    ],
    differencesLabel: "Plans differ only in",
    differences: ["Source capacity", "AI usage", "Model access", "Video ingestion"],
  },
  faq: {
    label: "FAQ",
    title: "Questions before you start",
    body: "Clear answers about sources, citations, model processing, plan limits, and data control.",
    items: [
      {
        question: "What files and sources can I add?",
        answer: "The current workflow supports notes and common document formats. Musuw shows processing state and discloses additional source types only when they are available.",
      },
      {
        question: "How does Musuw generate and verify citations?",
        answer: "Musuw retrieves from the source scope you choose and connects important claims to the specific source version and passage used. You can open a citation and inspect the text yourself.",
      },
      {
        question: "Is my content used to train AI models?",
        answer: "Musuw does not claim ownership of your content. Authorized excerpts may be processed by the configured model provider to answer your request, as described in the Privacy Policy.",
      },
      {
        question: "What content is sent to model providers?",
        answer: "Only the context needed for an authorized request is sent through the configured model path. Model credentials remain server-side; provider and retention details are described in the Privacy and Security pages.",
      },
      {
        question: "What happens when I reach my plan limits?",
        answer: "Your workspace remains available while Musuw shows the applicable limit and upgrade path. Exact current limits and localized checkout details are confirmed after sign-in.",
      },
      {
        question: "Can I export, delete, or cancel at any time?",
        answer: "Export and deletion controls report their actual progress. Paid customers use the hosted billing portal for invoices, payment methods, and cancellation when billing is configured.",
      },
    ],
  },
  finalCta: {
    title: "Start with one source. Keep every useful answer.",
    body: "Add a document, ask your first question, and inspect the evidence yourself.",
    action: "Start free",
    secondaryAction: "See how it works",
    fileName: "aurora-observation-guide.pdf",
    fileStatus: "1 source ready",
    prompt: "Ask your first question",
    imageAlt: "musuw source library ready for a first question",
  },
};

const zhCN = {
  meta: {
    title: "musuw | 每个答案都可核验",
    description: "把文档、笔记和网页变成可核验的答案，并将可靠知识沉淀到相互连接的 Wiki。",
  },
  hero: {
    eyebrow: "基于原始资料的个人知识空间",
    titleLine1: "让保存的资料真正有用。",
    titleLine2: "也看见每个答案由什么支持。",
    description:
      "加入文档和笔记，在明确资料范围内自然提问，打开重要结论背后的原文，并把可靠答案沉淀到持续更新的 Wiki。",
    primaryAction: "免费开始",
    secondaryAction: "看看如何工作",
    trustItems: ["无需绑卡", "默认私密", "支持导出与删除"],
    scene: {
      mainLabel: "带精确证据的回答",
      mainMeta: "打开任意引用，查看支持结论的原文段落。",
      sourcesLabel: "已选择 12 份资料",
      sourcesMeta: "PDF 与笔记",
      wikiLabel: "已保存到 Wiki",
      wikiMeta: "6 个来源 · 3 个关联页面",
      mainAlt: "musuw 回答及已打开的精确原文引用",
      sourcesAlt: "musuw 已选择资料的来源库",
      wikiAlt: "由可靠答案生成的 musuw Wiki 页面",
    },
  },
  journey: {
    ariaLabel: "musuw 如何把资料变成可持续复用的知识",
    items: [
      { step: "01", title: "资料", body: "加入重要内容" },
      { step: "02", title: "提问", body: "限定资料范围" },
      { step: "03", title: "核验", body: "打开原文证据" },
      { step: "04", title: "沉淀", body: "持续复用结论" },
    ],
  },
  features: {
    intro: {
      label: "为什么选择 musuw",
      title: "一套不会丢失证据链的知识系统。",
      body: "musuw 不只是回答问题。它保留原始资料，说明每个结论由什么支持，并把可靠结果变成以后还能继续使用的知识。",
    },
    items: [
      {
        label: "有依据的回答",
        title: "自然提问，核验每一个重要结论。",
        body: "musuw 只在你选择的资料范围内回答。打开任意引用，就能查看支持该结论的精确原文。",
        bullets: ["只使用你选择的资料", "定位到精确原文", "如实显示不确定性", "保留可复用的对话历史"],
        image: "/images/musuw-query-citation.jpg",
        imageAlt: "已打开精确原文引用的 musuw 回答",
        sceneLabel: "回答 → 引用 → 原文",
      },
      {
        label: "原始资料完整性",
        title: "保留原始资料，也保留它出现时的上下文。",
        body: "AI 生成的知识不会悄悄替换你上传的内容。资料本身、版本与处理状态始终可以查看。",
        bullets: ["原始内容保持不变", "保留资料版本历史", "处理状态清晰可见", "资料归属明确"],
        image: "/images/musuw-knowledge-base.jpg",
        imageAlt: "保留原始文档和处理状态的 musuw 资料库",
        sceneLabel: "原始资料始终可查看",
      },
      {
        label: "持续生长的知识",
        title: "把可靠答案变成可以反复使用的知识。",
        body: "将有用结论保存为结构化 Wiki 页面，连接相关主题，并在需要时随时返回原始证据。",
        bullets: ["结构化 Wiki 页面", "关联主题与实体", "由证据支持的关系", "随时返回资料来源"],
        image: "/images/musuw-wiki-page.jpg",
        insetImage: "/images/musuw-wiki-graph.jpg",
        imageAlt: "包含关联来源和知识关系的 musuw Wiki 页面",
        insetAlt: "musuw Wiki 内的图谱视图",
        sceneLabel: "可靠答案 → 持续更新的 Wiki",
      },
    ],
  },
  workflow: {
    intro: {
      label: "如何工作",
      title: "从一份资料，到可持续复用的知识，同时保留完整来路。",
      body: "加入已有资料，在明确范围内提问，查看证据，并把结果留给以后继续使用。",
    },
    largeItems: [
      {
        title: "加入你已经拥有的资料。",
        body: "上传文档和笔记，清楚看见哪些已经可用、哪些仍在处理、哪些需要重试。",
        image: "/images/musuw-knowledge-base.jpg",
        imageAlt: "显示已就绪和处理中文档的 musuw 资料库",
        badge: "资料与处理状态",
      },
      {
        title: "在明确资料范围内提问。",
        body: "提问前选择知识库、主题或资料集合，因此你始终知道回答被允许使用什么。",
        image: "/images/musuw-query-citation.jpg",
        imageAlt: "在已选择资料范围内提问的 musuw 界面",
        badge: "先限定范围，再得到答案",
      },
    ],
    smallItems: [
      { title: "打开原文证据", body: "点击引用，直接进入对应资料版本和原文段落。" },
      { title: "保存重要结论", body: "把结论、引用与相关资料一起留在 Wiki 中。" },
      { title: "重新查看、导出或移除", body: "持续使用有价值的知识，并在整个生命周期中看见数据状态。" },
    ],
  },
  useCases: {
    intro: {
      label: "使用场景",
      title: "适合那些答案重要、来源也同样重要的工作。",
      body: "当你既需要现在得到结论，也希望以后能够回到可靠来路时，使用 musuw。",
    },
    items: [
      {
        category: "研究与文献",
        title: "比较复杂材料，也不丢失引用。",
        body: "跨论文与报告提问、比较发现，并打开每个结论背后的资料来源。",
        outcome: "从多篇资料，得到一份可核验的综合结论。",
        image: "/images/musuw-query-citation.jpg",
        imageAlt: "使用精确引用比较研究资料的 musuw 页面",
      },
      {
        category: "产品与用户研究",
        title: "把访谈变成仍能回到原话的洞察。",
        body: "跨访谈寻找反复出现的主题，并让每条洞察始终连接到最初的表达。",
        outcome: "从访谈资料，形成有引用的洞察 Wiki。",
        image: "/images/musuw-wiki-page.jpg",
        imageAlt: "组织访谈洞察和来源的 musuw Wiki 页面",
      },
      {
        category: "长期学习",
        title: "建立持续生长的学习地图。",
        body: "把书籍、笔记和文章连接成可以反复查看、继续扩展的知识。",
        outcome: "从零散笔记，形成相互连接的理解。",
        image: "/images/musuw-wiki-graph.jpg",
        imageAlt: "连接学习主题与资料来源的 musuw 知识图谱",
      },
    ],
  },
  trust: {
    intro: {
      label: "可追溯地设计",
      title: "让知识有用，也不隐藏证据。",
      body: "答案、资料历史、知识范围和数据控制始终留在同一套工作流中。",
    },
    items: [
      { title: "定位到精确原文", body: "重要结论连接到具体段落，而不只是文档标题。" },
      { title: "原始资料保持不变", body: "Wiki 页面和 AI 结果不会悄悄覆盖原始内容。" },
      { title: "历史始终可查看", body: "早期资料版本与当时使用的证据仍然可以追踪。" },
      { title: "知识范围始终明确", body: "每个问题只使用你选择的知识库、主题或资料。" },
      { title: "个人空间相互隔离", body: "资料、答案和历史按账号与工作空间分离。" },
      { title: "数据控制显示真实状态", body: "导出和删除会显示已请求、处理中或已完成。" },
    ],
  },
  pricing: {
    intro: {
      label: "价格",
      title: "按使用强度选择，而不是按核心功能选择。",
      body: "每个套餐都包含有依据的回答、精确引用、原始资料保留、Wiki、图谱和数据控制。升级只影响容量、使用强度、模型范围与视频导入。",
    },
    monthly: "月付",
    yearly: "年付",
    save: "按年付费更省",
    perMonth: "/月",
    perYear: "/年",
    recommended: "推荐",
    includes: "适合",
    currencySymbol: "¥",
    note: "每个套餐都包含完整的证据与知识工作流。",
    plans: [
      {
        name: "免费版",
        description: "体验完整的 musuw 工作流。",
        fit: "适合偶尔使用",
        details: ["5 GiB 个人资料空间", "标准模型权限", "文档与笔记"],
        action: "免费开始",
      },
      {
        name: "Plus",
        description: "适合持续增长的个人知识库。",
        fit: "适合规律使用",
        details: ["20 GiB 资料容量", "扩展模型权限", "支持视频导入"],
        action: "选择 Plus",
      },
      {
        name: "Pro",
        description: "适合日常研究、学习与写作。",
        fit: "适合每天使用",
        details: ["40 GiB 资料容量", "更高 AI 使用强度", "扩展模型与视频"],
        action: "选择 Pro",
      },
      {
        name: "Max",
        description: "适合高强度个人知识工作。",
        fit: "适合高频使用",
        details: ["80 GiB 资料容量", "当前最高 AI 使用强度", "当前最广模型范围"],
        action: "选择 Max",
      },
    ],
  },
  included: {
    intro: {
      label: "所有套餐均包含",
      title: "完整的证据闭环不会被拆开收费。",
      body: "套餐之间只区分资料容量、AI 使用强度、模型范围与视频导入。",
    },
    items: [
      { title: "有依据的回答", body: "只在你选择的资料范围内提问。" },
      { title: "精确引用", body: "打开重要结论背后的具体原文。" },
      { title: "保留原始资料", body: "让原始内容保持不变并始终可查看。" },
      { title: "持续更新的 Wiki", body: "把有用结论变成可复用页面。" },
      { title: "知识图谱", body: "探索相关页面，同时保留证据来路。" },
      { title: "数据控制", body: "使用状态清晰的导出与删除流程。" },
    ],
    differencesLabel: "套餐只在以下方面不同",
    differences: ["资料容量", "AI 使用强度", "模型范围", "视频导入"],
  },
  faq: {
    label: "常见问题",
    title: "开始之前，你可能会问",
    body: "清楚说明资料类型、引用方式、模型处理、套餐限制与数据控制。",
    items: [
      {
        question: "我可以加入哪些文件和资料？",
        answer: "当前工作流支持笔记和常见文档格式。musuw 会显示处理状态，并只在其他资料类型真正可用后对外说明。",
      },
      {
        question: "musuw 如何生成并核验引用？",
        answer: "musuw 在你选择的资料范围内检索，并把重要结论连接到实际使用的资料版本与原文段落。你可以打开引用并自行检查。",
      },
      {
        question: "我的内容会被用于训练 AI 模型吗？",
        answer: "musuw 不主张拥有你的内容。为了回答请求，授权片段可能由已配置的模型提供商处理，具体边界以隐私政策为准。",
      },
      {
        question: "哪些内容会发送给模型提供商？",
        answer: "只有完成授权请求所需的上下文会经过已配置的模型路径。模型凭证保留在服务器端；提供商与保留规则见隐私和安全页面。",
      },
      {
        question: "达到套餐限制后会发生什么？",
        answer: "你的工作空间仍可访问，musuw 会显示对应限制和升级路径。当前精确限制与本地化结账信息会在登录后确认。",
      },
      {
        question: "我可以随时导出、删除或取消吗？",
        answer: "导出和删除会报告实际处理进度。配置支付后，付费用户通过托管计费门户管理账单、付款方式和取消。",
      },
    ],
  },
  finalCta: {
    title: "从一份资料开始，留下每个有用答案。",
    body: "加入一份文档，提出第一个问题，并亲自查看支持答案的证据。",
    action: "免费开始",
    secondaryAction: "看看如何工作",
    fileName: "aurora-observation-guide.pdf",
    fileStatus: "1 份资料已就绪",
    prompt: "提出第一个问题",
    imageAlt: "已准备好开始提问的 musuw 资料库",
  },
};

export function getHomeJourney(locale = "en") {
  return locale === "zh-CN" ? zhCN : en;
}
