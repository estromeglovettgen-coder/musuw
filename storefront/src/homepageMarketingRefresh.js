export const MARKETING_NAVIGATION = Object.freeze([
  Object.freeze({ label: "Features", href: "/#feature" }),
  Object.freeze({ label: "Platform", href: "/#platform" }),
  Object.freeze({ label: "Pricing", href: "/#pricing" }),
  Object.freeze({ label: "Security", href: "/security" }),
  Object.freeze({ label: "Contact", href: "/contact" }),
]);

export const MARKETING_FOOTER_GROUPS = Object.freeze([
  Object.freeze({
    title: "Product",
    links: Object.freeze([
      Object.freeze(["Features", "/#feature"]),
      Object.freeze(["Platform", "/#platform"]),
      Object.freeze(["Pricing", "/#pricing"]),
    ]),
  }),
  Object.freeze({
    title: "Trust",
    links: Object.freeze([
      Object.freeze(["FAQ", "/#faq"]),
      Object.freeze(["Security", "/security"]),
      Object.freeze(["Contact", "/contact"]),
    ]),
  }),
  Object.freeze({
    title: "Legal",
    links: Object.freeze([
      Object.freeze(["Terms", "/terms"]),
      Object.freeze(["Privacy", "/privacy"]),
      Object.freeze(["Refunds", "/refund-policy"]),
      Object.freeze(["Subscription", "/subscription-policy"]),
      Object.freeze(["Cookies", "/cookies"]),
    ]),
  }),
]);

const MARKETING_COPY = Object.freeze({
  en: Object.freeze({
    navLabels: Object.freeze(["Features", "Platform", "Pricing", "Security", "Contact"]),
    meta: Object.freeze({
      title: "musuw | Turn source material into intelligent knowledge assets",
      description:
        "Capture documents, webpages, and video; ask with evidence; keep the results as connected knowledge in a Wiki and graph",
    }),
    hero: Object.freeze({
      eyebrow: "Agents · Wiki · Graph",
      typewriterPhrases: Object.freeze([
        "Agents · Wiki · Graph",
        "Turn documents into a living Wiki",
        "Retrieve precise cited answers",
        "Let agents reason with evidence",
        "Reveal hidden links in the graph",
        "Keep knowledge evolving",
      ]),
      titleLine1: "Turn source material into",
      titleLine2: "intelligent knowledge assets",
      titleFocusSegments: Object.freeze(["intelligent", "knowledge", "assets"]),
      descriptionLine1: "Cited answers, agent reasoning, and a connected Wiki in one system",
      descriptionLine2:
        "Capture documents, webpages, and video, then keep every useful result as knowledge",
      getStarted: "Start free",
      talkToSales: "Contact",
      dashboardAlt:
        "musuw product walkthrough showing agent reasoning exact citations Wiki organization and knowledge graph connections",
    }),
    features: Object.freeze({
      intro: Object.freeze({
        label: "Three core modes",
        title: "RAG agents and connected knowledge—working as one",
        body:
          "Ask with evidence, let agents handle complex work, and keep every Wiki page and graph link tied to its source",
      }),
      items: Object.freeze([
        Object.freeze({
          label: "Agent reasoning",
          title: "Reason through complex work",
          description:
            "Agents break down the task, search your knowledge, and return a cited result you can verify",
          image: "/images/musuw-query-citation.jpg",
          imageAlt:
            "musuw agent working through a complex task with knowledge-base retrieval and exact citations",
          bullets: Object.freeze([
            "Multi-step reasoning",
            "Knowledge-base retrieval",
            "Tool orchestration",
            "Exact citations",
          ]),
        }),
        Object.freeze({}),
        Object.freeze({
          label: "Knowledge Graph",
          title: "Reveal the connections across your knowledge",
          description:
            "Backlinks and shared entities reveal how ideas connect while every path remains traceable",
          image: "/images/musuw-wiki-graph.jpg",
          imageAlt:
            "musuw knowledge graph showing backlinks shared entities and traceable cross-source relationships",
          bullets: Object.freeze([
            "Backlinks",
            "Entity relationships",
            "Cross-source discovery",
            "Traceable evidence",
          ]),
        }),
        Object.freeze({
          label: "AI Wiki",
          title: "Distill raw sources into a living Wiki",
          description:
            "Musuw turns summaries, entities, categories, and source links into pages that stay useful as your library grows",
          image: "/images/musuw-wiki-page.jpg",
          imageAlt:
            "musuw AI Wiki with generated summaries entities categories and source links",
          bullets: Object.freeze([
            "Automatic summaries",
            "Entity extraction",
            "Structured pages",
            "Source links",
          ]),
        }),
      ]),
    }),
    platform: Object.freeze({
      intro: Object.freeze({
        label: "Platform",
        title: "Built for the full knowledge loop",
        body:
          "Parse each source, use leading models, capture the web, and keep your knowledge current",
      }),
      cards: Object.freeze([
        Object.freeze({
          title: "Multimodal source parsing",
          body:
            "Turn documents, webpages, images, tables, and Markdown into searchable knowledge",
        }),
        Object.freeze({
          title: "Agent reasoning",
          body:
            "Plan searches, use enabled tools, and finish complex work with cited results",
        }),
        Object.freeze({
          title: "AI Wiki and graph",
          body:
            "Build summaries, entities, linked pages, and traceable relationships automatically",
        }),
        Object.freeze({
          title: "30+ leading models",
          body:
            "Use 30+ managed models and choose the right capability for each task",
        }),
        Object.freeze({
          title: "One-click web and video import",
          body:
            "Turn webpages, YouTube, TikTok, or Douyin links into searchable text or transcripts",
        }),
        Object.freeze({
          title: "Knowledge that maintains itself",
          body:
            "Save useful answers while AI updates the Wiki, entities, and connections",
        }),
      ]),
    }),
    pricing: Object.freeze({
      intro: Object.freeze({
        title: "Plans & Pricing",
        body:
          "Every plan includes cited answers, an AI-organized Wiki, and a knowledge graph. Paid plans add capacity, video import, and advanced models",
      }),
      descriptions: Object.freeze([
        "Explore the full workflow",
        "For a growing knowledge base",
        "For daily knowledge work",
        "For intensive knowledge work",
      ]),
      features: Object.freeze([
        Object.freeze(["1 GiB storage", "1 knowledge base (10 docs)", "Standard models", "Documents and web links"]),
        Object.freeze(["10 GiB storage", "Unlimited knowledge bases", "Advanced models", "Video & link import"]),
        Object.freeze(["30 GiB storage", "Unlimited knowledge bases", "Advanced models", "Video & link import"]),
        Object.freeze(["100 GiB storage", "Unlimited knowledge bases", "Advanced models", "Video & link import"]),
      ]),
      yearlyDiscount: "Save ~17%",
      checkoutNote: "Sign in to confirm localized pricing Annual plans are charged once per year",
      checkoutAction: "Choose plan",
    }),
    comparison: Object.freeze({
      eyebrow: "",
      title: "Plans and features",
      description: "",
      tableAria: "musuw plan differences",
      rows: Object.freeze({
        Storage: "Storage",
        "Knowledge bases": "Knowledge bases",
        "Documents per knowledge base": "Documents / knowledge base",
        "Video upload": "Video import",
        "Multi-platform link import": "Multi-platform link import",
        "Advanced model access": "Advanced models",
      }),
      noPlanCap: "Unlimited",
    }),
    faq: Object.freeze({
      label: "FAQ",
      title: "Questions before you start",
      body: "The essentials about imports, agents, citations, models, limits, and data control",
      items: Object.freeze([
        Object.freeze({
          question: "What can I add to musuw?",
          answer:
            "Add common documents and webpages. Paid plans also support video links from available YouTube, TikTok, and Douyin integrations",
        }),
        Object.freeze({
          question: "How do agents and citations work?",
          answer:
            "Agents can split a task, search several times, and use enabled tools. Supported claims link to source passages",
        }),
        Object.freeze({
          question: "Which models can I use?",
          answer:
            "Musuw provides 30+ managed models. Availability depends on your plan and the current product catalog",
        }),
        Object.freeze({
          question: "Is my content used to train models?",
          answer:
            "Musuw does not claim ownership of your content. Provider processing follows the model shown in the product and our Privacy Policy",
        }),
        Object.freeze({
          question: "What happens when I reach a plan limit?",
          answer:
            "Your knowledge stays available. You can upgrade, remove content, or wait for eligible limits to reset",
        }),
        Object.freeze({
          question: "Can I export delete or cancel?",
          answer:
            "Musuw provides export and deletion controls. Manage subscription changes through the billing flow in our Subscription Policy",
        }),
      ]),
    }),
    finalCta: Object.freeze({
      title: "Put your knowledge to work",
      body:
        "Start with a document, webpage, or video. Turn scattered sources into connected knowledge you can query, verify, and reuse",
      action: "Start free",
    }),
    footerGroups: Object.freeze([
      Object.freeze({ title: "Product", links: Object.freeze(["Features", "Platform", "Pricing"]) }),
      Object.freeze({ title: "Trust", links: Object.freeze(["FAQ", "Security", "Contact"]) }),
      Object.freeze({ title: "Legal", links: Object.freeze(["Terms", "Privacy", "Refunds", "Subscription", "Cookies"]) }),
    ]),
  }),
  zh: Object.freeze({
    navLabels: Object.freeze(["功能", "平台", "定价", "安全", "联系"]),
    meta: Object.freeze({
      title: "musuw｜把资料转化为会思考的知识资产",
      description: "采集文档、网页与视频，让智能体问答、推理与 Wiki、知识图谱协同工作",
    }),
    hero: Object.freeze({
      eyebrow: "智能体 · Wiki · 图谱",
      typewriterPhrases: Object.freeze([
        "智能体 · Wiki · 图谱",
        "文档变成 Wiki",
        "找到每个精确答案",
        "智能体带证据推理",
        "图谱连接隐藏关系",
        "知识随使用持续进化",
      ]),
      titleLine1: "把资料转化为",
      titleLine2: "会思考的知识资产",
      titleFocusSegments: Object.freeze(["会", "思考的", "知识资产"]),
      descriptionLine1: "智能体问答、推理与 Wiki 图谱一体化",
      descriptionLine2: "采集文档、网页与视频，完成复杂任务，让有用结果沉淀为知识",
      getStarted: "免费开始",
      talkToSales: "联系",
      dashboardAlt: "展示智能体推理、精确引用、Wiki 整理和知识图谱连接的 musuw 操作视频",
    }),
    features: Object.freeze({
      intro: Object.freeze({
        label: "三种核心能力",
        title: "智能体与相互连接的知识 协同工作",
        body: "带证据提问，让智能体完成复杂任务，把资料整理成可追溯的 Wiki 与图谱",
      }),
      items: Object.freeze([
        Object.freeze({
          label: "智能体问答",
          title: "自主编排 完成复杂任务",
          description: "智能体拆解任务，多轮检索知识库，调用允许的工具，组合出可回到原文核验的结果",
          image: "/images/musuw-query-citation.jpg",
          imageAlt: "通过知识库检索和精确引用完成复杂任务的 musuw 智能体",
          bullets: Object.freeze(["多步任务推理", "知识库检索", "工具自主编排", "精确原文引用"]),
        }),
        Object.freeze({}),
        Object.freeze({
          label: "知识图谱",
          title: "发掘隐藏关系 连接每一条知识",
          description: "反向链接、共享实体与跨资料引用，揭示知识联系；每条关系都能回到支持它的资料",
          image: "/images/musuw-wiki-graph.jpg",
          imageAlt: "展示反向链接 共享实体和可追溯跨资料关系的 musuw 知识图谱",
          bullets: Object.freeze(["反向链接", "实体关系", "跨资料发现", "关系证据可追溯"]),
        }),
        Object.freeze({
          label: "AI Wiki",
          title: "文档自动蒸馏 长成结构化 Wiki",
          description: "Musuw 自动提取摘要、实体、分类与资料关联，把内容整理成持续更新的页面",
          image: "/images/musuw-wiki-page.jpg",
          imageAlt: "包含自动摘要 实体 分类和资料关联的 musuw AI Wiki",
          bullets: Object.freeze(["自动摘要", "实体提取", "结构化页面", "资料来源关联"]),
        }),
      ]),
    }),
    platform: Object.freeze({
      intro: Object.freeze({
        label: "平台能力",
        title: "覆盖完整知识闭环",
        body: "解析资料、接入主流模型、采集网页与视频，让知识系统持续更新",
      }),
      cards: Object.freeze([
        Object.freeze({
          title: "多模态全格式解析",
          body: "文档、网页、图片、表格和 Markdown，统一变成可检索知识",
        }),
        Object.freeze({
          title: "智能体多步推理",
          body: "智能体规划检索、调用工具，以带引用的结果完成复杂任务",
        }),
        Object.freeze({
          title: "AI 自动 Wiki 与图谱",
          body: "自动生成摘要、实体、关联页面与可追溯关系，整理原始资料",
        }),
        Object.freeze({
          title: "30+ 主流模型接入",
          body: "托管接入 30+ 主流模型，同一界面切换，按任务选择能力",
        }),
        Object.freeze({
          title: "社媒文章与视频一键入库",
          body: "网页文章、YouTube、TikTok／抖音等链接，一键转成可检索正文或字幕",
        }),
        Object.freeze({
          title: "知识复利与自动维护",
          body: "把有用回答沉淀回知识库，AI 持续更新 Wiki、实体与关系",
        }),
      ]),
    }),
    pricing: Object.freeze({
      intro: Object.freeze({
        title: "方案与定价",
        body: "所有方案含智能体问答、精确引用、AI Wiki 与知识图谱；付费方案增加容量、视频导入、高级模型",
      }),
      descriptions: Object.freeze([
        "体验完整知识闭环",
        "适合增长中的知识库",
        "适合日常知识工作",
        "适合高强度知识工作",
      ]),
      features: Object.freeze([
        Object.freeze(["1 GiB 存储空间", "1 个知识库（10 篇文档）", "标准模型", "文档与网页导入"]),
        Object.freeze(["10 GiB 存储空间", "不限知识库与文档数", "高级模型", "视频与多平台导入"]),
        Object.freeze(["30 GiB 存储空间", "不限知识库与文档数", "高级模型", "视频与多平台导入"]),
        Object.freeze(["100 GiB 存储空间", "不限知识库与文档数", "高级模型", "视频与多平台导入"]),
      ]),
      yearlyDiscount: "约省 17%",
      checkoutNote: "登录后确认本地化价格；年付方案一次性扣款",
      checkoutAction: "选择方案",
    }),
    comparison: Object.freeze({
      eyebrow: "",
      title: "方案与功能",
      description: "",
      tableAria: "musuw 套餐差异",
      rows: Object.freeze({
        Storage: "存储空间",
        "Knowledge bases": "知识库数量",
        "Documents per knowledge base": "单个知识库文档数",
        "Video upload": "视频导入",
        "Multi-platform link import": "多平台一键链接导入",
        "Advanced model access": "高级模型",
      }),
      noPlanCap: "不限",
    }),
    faq: Object.freeze({
      label: "常见问题",
      title: "开始前的常见问题",
      body: "资料导入、智能体、引用、模型与套餐限制，一次说明",
      items: Object.freeze([
        Object.freeze({
          question: "可以向 musuw 添加什么？",
          answer: "可添加常见文档和网页；付费方案支持已接入平台的视频链接，包括 YouTube、TikTok／抖音",
        }),
        Object.freeze({
          question: "智能体和引用如何工作？",
          answer: "智能体会拆解任务，多轮检索并调用工具；有证据时，重要结论会连到原文段落",
        }),
        Object.freeze({
          question: "可以使用哪些模型？",
          answer: "Musuw 托管接入 30+ 主流模型；可用范围取决于套餐和产品目录",
        }),
        Object.freeze({
          question: "我的内容会被用于训练模型吗？",
          answer: "Musuw 不拥有你的内容；数据处理取决于产品显示的服务商与模型，详见隐私政策",
        }),
        Object.freeze({
          question: "达到套餐上限后会怎样？",
          answer: "已有知识仍可访问；你可以升级、删除内容，或在适用时等待额度重置",
        }),
        Object.freeze({
          question: "可以导出 删除或取消订阅吗？",
          answer: "Musuw 提供导出和删除控制；订阅变更与取消按订阅政策的计费流程处理",
        }),
      ]),
    }),
    finalCta: Object.freeze({
      title: "让知识真正为你工作",
      body: "从文档、网页或视频开始，把零散资料变成可提问、可连接的知识系统",
      action: "免费开始",
    }),
    footerGroups: Object.freeze([
      Object.freeze({ title: "产品", links: Object.freeze(["功能", "平台", "定价"]) }),
      Object.freeze({ title: "信任", links: Object.freeze(["常见问题", "安全", "联系"]) }),
      Object.freeze({ title: "法律", links: Object.freeze(["服务条款", "隐私", "退款", "订阅与取消", "Cookie"]) }),
    ]),
  }),
});

function mergeItems(items = [], overrides = []) {
  return items.map((item, index) => ({
    ...item,
    ...(overrides[index] ?? {}),
  }));
}

export function applyHomepageMarketingRefresh(copy) {
  const localeKey = copy?.pricing?.currencyCode === "CNY" ? "zh" : "en";
  const content = MARKETING_COPY[localeKey];

  return {
    ...copy,
    meta: {
      ...copy.meta,
      ...content.meta,
    },
    nav: {
      ...copy.nav,
      items: content.navLabels.map((label, index) => ({
        ...(copy.nav.items[index] ?? {}),
        label,
      })),
    },
    hero: {
      ...copy.hero,
      ...content.hero,
    },
    features: {
      ...copy.features,
      intro: {
        ...copy.features.intro,
        ...content.features.intro,
      },
      items: mergeItems(copy.features.items, content.features.items),
    },
    platform: content.platform,
    pricing: {
      ...copy.pricing,
      save: content.pricing.yearlyDiscount,
      yearlyDiscount: content.pricing.yearlyDiscount,
      intro: {
        ...copy.pricing.intro,
        ...content.pricing.intro,
      },
      plans: copy.pricing.plans.map((plan, index) => ({
        ...plan,
        description: content.pricing.descriptions[index],
        features: [...content.pricing.features[index]],
      })),
      checkout: {
        ...copy.pricing.checkout,
        note: content.pricing.checkoutNote,
        action: content.pricing.checkoutAction,
      },
    },
    comparison: {
      ...copy.comparison,
      ...content.comparison,
      rows: { ...content.comparison.rows },
    },
    faq: {
      ...copy.faq,
      ...content.faq,
      items: [...content.faq.items],
    },
    finalCta: {
      ...copy.finalCta,
      ...content.finalCta,
    },
    footer: {
      ...copy.footer,
      groups: content.footerGroups.map((group) => ({
        title: group.title,
        links: [...group.links],
      })),
    },
  };
}
