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
    ]),
  }),
]);

const MARKETING_COPY = Object.freeze({
  en: Object.freeze({
    navLabels: Object.freeze(["Features", "Platform", "Pricing", "Security", "Contact"]),
    meta: Object.freeze({
      title: "musuw | Turn source material into intelligent knowledge assets",
      description:
        "Capture documents webpages and video reason with agents and organize what matters into a connected Wiki and knowledge graph",
    }),
    hero: Object.freeze({
      eyebrow: "RAG · Agents · Wiki",
      typewriterPhrases: Object.freeze([
        "RAG · Agent · Wiki",
        "Turn documents into a living Wiki",
        "Retrieve precise cited answers",
        "Let agents reason with evidence",
        "Reveal hidden links in the graph",
        "Keep knowledge evolving",
      ]),
      titleLine1: "Turn source material into",
      titleLine2: "intelligent knowledge assets",
      titleFocusSegments: Object.freeze(["intelligent", "knowledge", "assets"]),
      descriptionLine1: "RAG answers agent reasoning and a connected Wiki in one system",
      descriptionLine2:
        "Capture documents webpages and video work through complex tasks and keep every useful result as knowledge",
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
          "Ask with evidence let agents work through complex tasks and turn raw sources into a Wiki and graph that stay connected to the originals",
      }),
      items: Object.freeze([
        Object.freeze({
          label: "RAG + Agent",
          title: "Reason through complex work",
          description:
            "Agents break down the task search across the knowledge base use enabled tools and assemble a cited result you can verify against the source",
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
            "Backlinks shared entities and cross-source references expose how ideas relate while every path remains traceable to supporting material",
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
            "Musuw extracts summaries entities categories and source links turning unstructured material into pages that stay useful as the library grows",
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
          "Parse every source access leading models capture the web and keep the knowledge system maintained as it grows",
      }),
      cards: Object.freeze([
        Object.freeze({
          title: "Multimodal source parsing",
          body:
            "Bring documents webpages images tables and Markdown into one searchable knowledge system",
        }),
        Object.freeze({
          title: "Agent reasoning",
          body:
            "Agents plan searches use enabled tools and work through complex tasks with cited results",
        }),
        Object.freeze({
          title: "AI Wiki and graph",
          body:
            "Turn raw sources into summaries entities linked pages and traceable relationships automatically",
        }),
        Object.freeze({
          title: "30+ leading models",
          body:
            "Access 30+ leading models through managed provider connections then choose the right capability for each task",
        }),
        Object.freeze({
          title: "One-click web and video import",
          body:
            "Send webpages YouTube videos TikTok or Douyin links and other supported sources straight into the knowledge base as searchable text or transcripts",
        }),
        Object.freeze({
          title: "Knowledge that maintains itself",
          body:
            "Save useful answers back to the knowledge base while AI keeps the Wiki entities and connections up to date",
        }),
      ]),
    }),
    pricing: Object.freeze({
      intro: Object.freeze({
        title: "Plans & Pricing",
        body:
          "Every plan includes RAG answers exact citations an AI-organized Wiki and a knowledge graph Paid plans add capacity video import and advanced models",
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
      body: "The essentials about imports agents citations models limits and control of your data",
      items: Object.freeze([
        Object.freeze({
          question: "What can I add to musuw?",
          answer:
            "You can add common document formats and webpages Paid plans also support video links from currently supported platforms including YouTube and TikTok or Douyin where available",
        }),
        Object.freeze({
          question: "How do agents and citations work?",
          answer:
            "Agents can break down a task run multiple searches and use enabled tools Important claims link to supporting passages when evidence is available",
        }),
        Object.freeze({
          question: "Which models can I use?",
          answer:
            "Musuw provides access to 30+ leading models through managed provider connections Available models depend on the plan and the current catalog shown in the product",
        }),
        Object.freeze({
          question: "Is my content used to train models?",
          answer:
            "Musuw does not claim ownership of your content Model-provider processing follows the provider and model shown in the product as described in the Privacy Policy",
        }),
        Object.freeze({
          question: "What happens when I reach a plan limit?",
          answer:
            "Your existing knowledge remains available You can upgrade remove content or wait for usage-based limits to reset where applicable",
        }),
        Object.freeze({
          question: "Can I export delete or cancel?",
          answer:
            "Musuw provides export and deletion controls Subscription changes and cancellation are handled through the billing flow described in the Subscription Policy",
        }),
      ]),
    }),
    finalCta: Object.freeze({
      title: "Put your knowledge to work",
      body:
        "Start with a document a webpage or a video Turn scattered sources into a knowledge system you can ask reason with connect and keep building",
      action: "Start free",
    }),
    footerGroups: Object.freeze([
      Object.freeze({ title: "Product", links: Object.freeze(["Features", "Platform", "Pricing"]) }),
      Object.freeze({ title: "Trust", links: Object.freeze(["FAQ", "Security", "Contact"]) }),
      Object.freeze({ title: "Legal", links: Object.freeze(["Terms", "Privacy", "Refunds"]) }),
    ]),
  }),
  zh: Object.freeze({
    navLabels: Object.freeze(["功能", "平台", "定价", "安全", "联系"]),
    meta: Object.freeze({
      title: "musuw｜把资料转化为会思考的知识资产",
      description: "采集文档 网页与视频 通过 RAG 问答 Agent 推理和 Wiki 图谱 让知识真正参与工作",
    }),
    hero: Object.freeze({
      eyebrow: "RAG · Agent · Wiki",
      typewriterPhrases: Object.freeze([
        "RAG · Agent · Wiki",
        "文档自动长成 Wiki",
        "检索每一个精确答案",
        "Agent 带着证据推理",
        "图谱连接隐藏关系",
        "知识随使用持续进化",
      ]),
      titleLine1: "把资料转化为",
      titleLine2: "会思考的知识资产",
      titleFocusSegments: Object.freeze(["会", "思考的", "知识资产"]),
      descriptionLine1: "RAG 问答 Agent 推理与 Wiki 图谱一体化",
      descriptionLine2: "采集文档 网页与视频 完成复杂任务 并让每个有用结果继续沉淀为知识",
      getStarted: "免费开始",
      talkToSales: "联系",
      dashboardAlt: "展示 Agent 推理 精确引用 Wiki 整理和知识图谱连接的 musuw 产品操作视频",
    }),
    features: Object.freeze({
      intro: Object.freeze({
        label: "三大模式",
        title: "RAG Agent 与相互连接的知识 协同工作",
        body: "带着证据提问 让 Agent 完成复杂任务 再把原始资料整理成始终可追溯的 Wiki 与图谱",
      }),
      items: Object.freeze([
        Object.freeze({
          label: "RAG + Agent",
          title: "自主编排 完成复杂任务",
          description: "Agent 会拆解任务 多轮检索知识库 调用允许的工具 并组合出可以返回原文核验的结果",
          image: "/images/musuw-query-citation.jpg",
          imageAlt: "通过知识库检索和精确引用完成复杂任务的 musuw Agent",
          bullets: Object.freeze(["多步任务推理", "知识库检索", "工具自主编排", "精确原文引用"]),
        }),
        Object.freeze({}),
        Object.freeze({
          label: "知识图谱",
          title: "发掘隐藏关系 连接每一条知识",
          description: "反向链接 共享实体和跨资料引用会揭示知识之间的联系 同时让每条关系都能回到支持它的资料",
          image: "/images/musuw-wiki-graph.jpg",
          imageAlt: "展示反向链接 共享实体和可追溯跨资料关系的 musuw 知识图谱",
          bullets: Object.freeze(["反向链接", "实体关系", "跨资料发现", "关系证据可追溯"]),
        }),
        Object.freeze({
          label: "AI Wiki",
          title: "文档自动蒸馏 长成结构化 Wiki",
          description: "Musuw 自动提取摘要 实体 分类与资料关联 把非结构化内容整理成会随知识库持续更新的页面",
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
        body: "解析每一种资料 接入主流模型 采集网页与视频 并让整个知识系统随着使用持续维护",
      }),
      cards: Object.freeze([
        Object.freeze({
          title: "多模态全格式解析",
          body: "将文档 网页 图片 表格与 Markdown 等资料统一转化为可检索的知识",
        }),
        Object.freeze({
          title: "Agent 渐进式多步推理",
          body: "Agent 自主规划检索 调用允许的工具 并以带引用结果完成复杂任务",
        }),
        Object.freeze({
          title: "AI 自动 Wiki 与图谱",
          body: "自动生成摘要 实体 关联页面和可追溯关系 把原始资料整理成结构化知识",
        }),
        Object.freeze({
          title: "30+ 主流模型接入",
          body: "Musuw 提供 30+ 主流模型的托管接入 在同一界面统一使用与切换 按任务选择合适能力",
        }),
        Object.freeze({
          title: "社媒文章与视频一键入库",
          body: "将网页文章 YouTube TikTok／抖音等支持平台的链接转化为可检索正文或字幕",
        }),
        Object.freeze({
          title: "知识复利与自动维护",
          body: "把有用回答重新沉淀进知识库 并由 AI 持续更新 Wiki 实体和知识关系",
        }),
      ]),
    }),
    pricing: Object.freeze({
      intro: Object.freeze({
        title: "方案与定价",
        body: "所有方案都包含 RAG 问答 精确引用 AI Wiki 与知识图谱 付费方案主要增加容量 视频导入和高级模型",
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
      checkoutNote: "登录后确认本地化价格 年付方案一次性按年扣款",
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
      body: "关于资料导入 Agent 引用 模型 套餐限制和数据控制的必要说明",
      items: Object.freeze([
        Object.freeze({
          question: "可以向 musuw 添加什么？",
          answer: "你可以添加常见文档格式和网页 付费方案也支持当前已接入平台的视频链接 包括可用的 YouTube TikTok／抖音来源",
        }),
        Object.freeze({
          question: "Agent 和引用如何工作？",
          answer: "Agent 可以拆解任务 多轮检索并调用允许的工具 在存在证据时 重要结论会连接到支持它的原文段落",
        }),
        Object.freeze({
          question: "可以使用哪些模型？",
          answer: "Musuw 提供 30+ 主流模型的托管接入 具体可用模型取决于套餐和产品中当前展示的平台目录",
        }),
        Object.freeze({
          question: "我的内容会被用于训练模型吗？",
          answer: "Musuw 不主张拥有你的内容 模型服务商如何处理数据 取决于产品中显示的服务商与模型 具体说明见隐私政策",
        }),
        Object.freeze({
          question: "达到套餐上限后会怎样？",
          answer: "已有知识仍然可以访问 你可以升级套餐 删除部分内容 或在适用时等待按周期计算的额度重置",
        }),
        Object.freeze({
          question: "可以导出 删除或取消订阅吗？",
          answer: "Musuw 提供导出和删除控制 订阅变更与取消通过订阅政策中说明的计费流程完成",
        }),
      ]),
    }),
    finalCta: Object.freeze({
      title: "让知识真正为你工作",
      body: "从一份文档 一个网页或一段视频开始 把零散资料变成可以提问 推理 连接并持续成长的知识系统",
      action: "免费开始",
    }),
    footerGroups: Object.freeze([
      Object.freeze({ title: "产品", links: Object.freeze(["功能", "平台", "定价"]) }),
      Object.freeze({ title: "信任", links: Object.freeze(["常见问题", "安全", "联系"]) }),
      Object.freeze({ title: "法律", links: Object.freeze(["服务条款", "隐私", "退款"]) }),
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
