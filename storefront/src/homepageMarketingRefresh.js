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
      eyebrow: "Ask · Reason · Organize · Discover",
      typewriterPhrases: Object.freeze([
        "Ask · Reason · Organize · Discover",
        "Find the pattern across dozens of sources",
        "Compare evidence before making a decision",
        "Let what you learn grow into a living Wiki",
        "Connect ideas you saved months apart",
        "Reuse old knowledge in the next question",
      ]),
      titleLine1: "Turn source material into",
      titleLine2: "intelligent knowledge assets",
      titleFocusSegments: Object.freeze(["intelligent", "knowledge", "assets"]),
      descriptionLine1: "Get answers and decisions you can trace back to the source",
      descriptionLine2:
        "Then keep the useful parts as a living Wiki and knowledge graph that get better as your library grows",
      getStarted: "Start free",
      talkToSales: "Contact",
      dashboardAlt:
        "musuw product walkthrough showing cited synthesis agent reasoning a maintained Wiki and a growing knowledge graph",
    }),
    features: Object.freeze({
      intro: Object.freeze({
        label: "Three core modes",
        title: "RAG agents and connected knowledge—working as one",
        body:
          "Move from a hard question to a traceable decision, then keep what you learned as knowledge you can use again",
      }),
      items: Object.freeze([
        Object.freeze({
          label: "Agent reasoning",
          title: "Compare the evidence before you decide",
          description:
            "Musuw searches across the sources you already have, checks competing signals, and returns a recommendation you can inspect",
          image: "/images/musuw-query-citation.jpg",
          imageAlt:
            "musuw comparing interviews support feedback and usage evidence before returning a cited recommendation",
          bullets: Object.freeze([
            "Search across multiple source sets",
            "Compare conflicting signals",
            "Make a recommendation with evidence",
            "Open the source behind each claim",
          ]),
        }),
        Object.freeze({}),
        Object.freeze({
          label: "Knowledge Graph",
          title: "See when separate notes are really about the same problem",
          description:
            "Musuw connects concepts that appear across interviews, research, notes, and prior answers so useful relationships do not stay hidden",
          image: "/images/musuw-wiki-graph.jpg",
          imageAlt:
            "musuw knowledge graph connecting concepts found across product research and prior notes",
          bullets: Object.freeze([
            "Cross-source relationships",
            "Backlinks that explain the connection",
            "Concepts that grow with new material",
            "Paths back to supporting evidence",
          ]),
        }),
        Object.freeze({
          label: "AI Wiki",
          title: "Let what you learn grow into your own Wiki",
          description:
            "Papers, videos, articles, and notes become maintained pages with definitions, related concepts, backlinks, and source history",
          image: "/images/musuw-wiki-page.jpg",
          imageAlt:
            "musuw AI Wiki organizing learning material into maintained pages with backlinks and sources",
          bullets: Object.freeze([
            "Pages synthesized from several sources",
            "Definitions and concepts stay organized",
            "Backlinks preserve context",
            "New sources keep the page current",
          ]),
        }),
      ]),
    }),
    platform: Object.freeze({
      intro: Object.freeze({
        label: "Platform",
        title: "Built for the full knowledge loop",
        body:
          "Bring in the material you already use, reason across it, and keep the useful result instead of starting over next time",
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
            "Search several times, compare evidence, use enabled tools, and finish complex work with citations",
        }),
        Object.freeze({
          title: "AI Wiki and graph",
          body:
            "Keep useful conclusions as maintained pages, backlinks, entities, and traceable relationships",
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
            "Reuse prior answers while the Wiki, entities, backlinks, and relationships keep evolving",
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
        "Start with a document, webpage, or video. Ask better questions now, then keep the useful answer as knowledge you can use again",
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
      description: "采集文档、网页与视频，从资料中得到可核验的答案，并把有用结果沉淀成持续生长的知识",
    }),
    hero: Object.freeze({
      eyebrow: "提问 · 推理 · 沉淀 · 发现",
      typewriterPhrases: Object.freeze([
        "提问 · 推理 · 沉淀 · 发现",
        "从几十份资料里找出真正重复的问题",
        "先比较证据，再给出可核验的判断",
        "让学过的内容长成自己的 Wiki",
        "连接几个月前后保存的同一个概念",
        "让旧知识在新问题里再次被用上",
      ]),
      titleLine1: "把资料转化为",
      titleLine2: "会思考的知识资产",
      titleFocusSegments: Object.freeze(["会", "思考的", "知识资产"]),
      descriptionLine1: "从分散资料中得到可核验的答案和判断",
      descriptionLine2: "再把有用结论沉淀成持续更新的 Wiki 与知识图谱，下一次不必重新开始",
      getStarted: "免费开始",
      talkToSales: "联系",
      dashboardAlt: "展示跨资料综合、智能体推理、精确引用、Wiki 沉淀和知识图谱连接的 musuw 产品演示",
    }),
    features: Object.freeze({
      intro: Object.freeze({
        label: "三种核心能力",
        title: "智能体与相互连接的知识 协同工作",
        body: "从一个难问题出发，先得到可核验的判断，再把学到的内容保留下来，下一次继续使用",
      }),
      items: Object.freeze([
        Object.freeze({
          label: "智能体问答",
          title: "先比较证据，再做出判断",
          description: "musuw 会跨用户访谈、客服反馈、研究资料等多组来源检索和比对，再给出能回到原文核验的建议",
          image: "/images/musuw-query-citation.jpg",
          imageAlt: "musuw 跨用户访谈 客服反馈和使用数据比较证据后给出带引用的产品建议",
          bullets: Object.freeze(["跨多组资料检索", "比较相互冲突的信号", "基于证据形成建议", "关键结论可回到原文"]),
        }),
        Object.freeze({}),
        Object.freeze({
          label: "知识图谱",
          title: "发现不同资料里，其实在讲同一个问题",
          description: "访谈、研究、笔记和旧回答里的概念会被连接起来，让原本分散的线索逐渐形成一张可追溯的知识网络",
          image: "/images/musuw-wiki-graph.jpg",
          imageAlt: "musuw 知识图谱连接产品研究 用户访谈和历史笔记中的相关概念",
          bullets: Object.freeze(["跨资料发现关系", "反向链接解释为什么相关", "新资料加入后关系继续生长", "每条路径可回到证据"]),
        }),
        Object.freeze({
          label: "AI Wiki",
          title: "让学过的内容，自动长成自己的 Wiki",
          description: "论文、视频、文章和笔记被整理成持续维护的页面，定义、相关概念、反向链接和来源都保留在一起",
          image: "/images/musuw-wiki-page.jpg",
          imageAlt: "musuw AI Wiki 把论文 视频 文章和个人笔记整理成带来源与反向链接的知识页面",
          bullets: Object.freeze(["多份资料共同生成页面", "概念与定义持续整理", "反向链接保留上下文", "新来源自动补充页面"]),
        }),
      ]),
    }),
    platform: Object.freeze({
      intro: Object.freeze({
        label: "平台能力",
        title: "覆盖完整知识闭环",
        body: "把你本来就在看的资料放进来，跨资料推理，再把有用结果留下来，而不是下一次从头开始",
      }),
      cards: Object.freeze([
        Object.freeze({
          title: "多模态全格式解析",
          body: "文档、网页、图片、表格和 Markdown，统一变成可检索知识",
        }),
        Object.freeze({
          title: "智能体多步推理",
          body: "多轮检索、比较证据、调用允许的工具，以带引用结果完成复杂任务",
        }),
        Object.freeze({
          title: "AI 自动 Wiki 与图谱",
          body: "把有用结论保留成持续维护的页面、实体、反向链接与可追溯关系",
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
          body: "旧回答可以继续复用，Wiki、实体、反向链接与关系也会随着新资料持续更新",
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
      body: "从一份文档、一个网页或一段视频开始。先问出更好的答案，再把有用结果留下来，下一次继续用",
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
