import { HOMEPAGE_STORIES } from "./data/knowledgeStories.js";

export const MARKETING_NAVIGATION = Object.freeze([
  Object.freeze({ label: "Features", href: "/#feature" }),
  Object.freeze({ label: "Platform", href: "/#platform" }),
  Object.freeze({ label: "Pricing", href: "/#pricing" }),
  Object.freeze({ label: "Security", href: "/security" }),
  Object.freeze({ label: "Contact", href: "/contact" }),
]);

export const MARKETING_FOOTER_GROUPS = Object.freeze([
  Object.freeze({ title: "Product", links: Object.freeze([Object.freeze(["Features", "/#feature"]), Object.freeze(["Platform", "/#platform"]), Object.freeze(["Pricing", "/#pricing"])]) }),
  Object.freeze({ title: "Trust", links: Object.freeze([Object.freeze(["FAQ", "/#faq"]), Object.freeze(["Security", "/security"]), Object.freeze(["Contact", "/contact"])]) }),
  Object.freeze({ title: "Legal", links: Object.freeze([Object.freeze(["Terms", "/terms"]), Object.freeze(["Privacy", "/privacy"]), Object.freeze(["Refunds", "/refund-policy"]), Object.freeze(["Subscription", "/subscription-policy"]), Object.freeze(["Cookies", "/cookies"])]) }),
]);

const MARKETING_COPY = Object.freeze({
  en: {
    navLabels: ["Features", "Platform", "Pricing", "Security", "Contact"],
    meta: { title: "musuw | Turn source material into intelligent knowledge assets", description: "Retrieve verifiable answers across multiple sources, then organize key information into a connected knowledge system that stays traceable and reusable." },
    hero: HOMEPAGE_STORIES.en.hero,
    features: HOMEPAGE_STORIES.en.features,
    platform: {
      intro: { label: "Platform", title: "A complete workflow from sources to knowledge", body: "Source import, parsing, retrieval, answers, Wiki maintenance, and graph exploration share one traceable context." },
      cards: [
        { title: "Bring your sources together", body: "Turn documents, webpages, images, tables, and Markdown into searchable knowledge" },
        { title: "Find and verify across sources", body: "Bring relevant material into one answer and inspect the evidence behind key claims" },
        { title: "Connected pages and ideas", body: "Keep useful findings in maintained pages with backlinks and traceable relationships" },
        { title: "30+ leading models", body: "Use 30+ managed models and choose the right capability for each task" },
        { title: "One-click web and video import", body: "Turn webpages, YouTube, TikTok, or Douyin links into searchable text or transcripts" },
        { title: "Keep existing knowledge current", body: "Keep pages, relationships, and versions aligned as new material is added" },
      ],
    },
    pricing: {
      intro: { title: "Plans & Pricing", body: "Every plan includes cited answers, an AI-organized Wiki, and a knowledge graph. Paid plans add capacity, video import, and advanced models" },
      descriptions: ["Explore the full workflow", "For a growing knowledge base", "For daily knowledge work", "For intensive knowledge work"],
      features: [
        ["1 GiB storage", "1 knowledge base (10 docs)", "Standard models", "Documents and web links"],
        ["10 GiB storage", "Unlimited knowledge bases", "Advanced models", "Video & link import"],
        ["30 GiB storage", "Unlimited knowledge bases", "Advanced models", "Video & link import"],
        ["100 GiB storage", "Unlimited knowledge bases", "Advanced models", "Video & link import"],
      ],
      yearlyDiscount: "Save ~17%", checkoutNote: "Sign in to confirm localized pricing Annual plans are charged once per year", checkoutAction: "Choose plan",
    },
    comparison: {
      eyebrow: "", title: "Plans and features", description: "", tableAria: "musuw plan differences",
      rows: { Storage: "Storage", "Knowledge bases": "Knowledge bases", "Documents per knowledge base": "Documents / knowledge base", "Video upload": "Video import", "Multi-platform link import": "Multi-platform link import", "Advanced model access": "Advanced models" },
      noPlanCap: "Unlimited",
    },
    faq: {
      label: "FAQ", title: "Questions before you start", body: "The essentials about imports, agents, citations, models, limits, and data control",
      items: [
        { question: "What can I add to musuw?", answer: "Add common documents and webpages. Paid plans also support video links from available YouTube, TikTok, and Douyin integrations" },
        { question: "How do agents and citations work?", answer: "Agents can split a task, search several times, and use enabled tools. Supported claims link to source passages" },
        { question: "Which models can I use?", answer: "Musuw provides 30+ managed models. Availability depends on your plan and the current product catalog" },
        { question: "Is my content used to train models?", answer: "Musuw does not claim ownership of your content. Provider processing follows the model shown in the product and our Privacy Policy" },
        { question: "What happens when I reach a plan limit?", answer: "Your knowledge stays available. You can upgrade, remove content, or wait for eligible limits to reset" },
        { question: "Can I export delete or cancel?", answer: "Musuw provides export and deletion controls. Manage subscription changes through the billing flow in our Subscription Policy" },
      ],
    },
    finalCta: {
      title: "Build your AI knowledge base\nKeep your knowledge growing",
      body: "Bring together documents, webpages, and notes to build your AI knowledge base.\nLet AI organize your knowledge and connect it, so you can ask from your materials anytime and keep knowledge growing and reusable.",
      action: "Build my knowledge base",
    },
    footerGroups: [
      { title: "Product", links: ["Features", "Platform", "Pricing"] },
      { title: "Trust", links: ["FAQ", "Security", "Contact"] },
      { title: "Legal", links: ["Terms", "Privacy", "Refunds", "Subscription & cancellation", "Cookies"] },
    ],
  },
  zh: {
    navLabels: ["功能", "平台", "定价", "安全", "联系"],
    meta: { title: "musuw | 把资料转化为会思考的知识资产", description: "统一检索多种资料，生成可验证、可追溯的回答，并将关键信息组织为可持续更新与复用的知识体系。" },
    hero: HOMEPAGE_STORIES["zh-CN"].hero,
    features: HOMEPAGE_STORIES["zh-CN"].features,
    platform: {
      intro: { label: "平台能力", title: "覆盖从资料到知识的完整链路", body: "资料导入、解析、检索、问答、Wiki 维护与图谱探索，共享同一套可追溯上下文。" },
      cards: [
        { title: "汇集不同形式的资料", body: "文档、网页、图片、表格和 Markdown，统一成为可检索的知识" },
        { title: "跨来源查找与核验", body: "结合多份资料组织回答，让关键结论保留可以检查的依据" },
        { title: "知识页面与关联", body: "将有用发现保留为持续维护的页面、反向链接与可追溯关系" },
        { title: "30+ 主流模型接入", body: "托管接入 30+ 主流模型，同一界面切换，按任务选择能力" },
        { title: "文章与视频一键入库", body: "网页文章、YouTube、TikTok／抖音等链接，转成可检索正文或字幕" },
        { title: "持续更新既有知识", body: "让页面、关系与版本随新增资料保持同步" },
      ],
    },
    pricing: {
      intro: { title: "方案与定价", body: "所有方案含智能体问答、精确引用、AI Wiki 与知识图谱；付费方案增加容量、视频导入、高级模型" },
      descriptions: ["体验完整知识闭环", "适合增长中的知识库", "适合日常知识工作", "适合高强度知识工作"],
      features: [
        ["1 GiB 存储空间", "1 个知识库（10 篇文档）", "标准模型", "文档与网页导入"],
        ["10 GiB 存储空间", "不限知识库与文档数", "高级模型", "视频与多平台导入"],
        ["30 GiB 存储空间", "不限知识库与文档数", "高级模型", "视频与多平台导入"],
        ["100 GiB 存储空间", "不限知识库与文档数", "高级模型", "视频与多平台导入"],
      ],
      yearlyDiscount: "约省 17%", checkoutNote: "登录后确认本地化价格；年付方案一次性扣款", checkoutAction: "选择方案",
    },
    comparison: {
      eyebrow: "", title: "方案与功能", description: "", tableAria: "musuw 套餐差异",
      rows: { Storage: "存储空间", "Knowledge bases": "知识库数量", "Documents per knowledge base": "单个知识库文档数", "Video upload": "视频导入", "Multi-platform link import": "多平台一键链接导入", "Advanced model access": "高级模型" },
      noPlanCap: "不限",
    },
    faq: {
      label: "常见问题", title: "开始前的常见问题", body: "涵盖资料导入、智能体、引用、模型、套餐限制与数据控制。",
      items: [
        { question: "musuw 和普通的 AI 问答有什么不同？", answer: "musuw 的核心不只是回答问题，而是围绕你的资料建立一个可持续积累的 AI 知识库。你可以结合多份资料提问、查看原文依据，也可以通过 AI Wiki 和知识图谱整理内容、探索关联，让知识不只停留在一次对话里。" },
        { question: "哪些资料可以放进我的知识库？", answer: "你可以导入 PDF、Word、Markdown 等文档，以及网页、图片和表格，将分散的资料集中管理、检索和使用。付费方案还支持视频上传及已接入平台的链接导入，具体支持范围以产品内提示为准。" },
        { question: "资料导入后，还需要我自己整理吗？", answer: "不必所有内容都从头手动整理。AI Wiki 可以帮助你将资料组织成知识页面、建立关联；你也可以检查整理结果，修改页面、补充自己的理解，并通过版本历史查看或恢复之前的内容。" },
        { question: "AI Wiki 和我上传的原始文档有什么区别？", answer: "原始文档保留资料本身，AI Wiki 则把资料中的信息整理成相互关联、便于阅读和维护的知识页面。你可以从知识页面查看相关主题、回到原始资料，也可以继续编辑和完善内容。它是建立在资料之上的知识整理层，而不是用来替代原文。" },
        { question: "回答中的结论，能查到原文依据吗？", answer: "对于有来源支持的内容，musuw 会提供引用入口，方便你查看相关原文、核对上下文。引用帮助你判断结论是否有据可依，但不代表 AI 的理解一定正确；重要内容仍建议结合原始资料核验。" },
        { question: "我的资料会被用于训练 AI 吗？", answer: "musuw 默认不将你个人账户中的内容用于训练通用或基础模型，除非你另行明确同意。使用 AI 功能时，必要的提问和资料片段可能会发送给第三方模型服务处理，其数据保留与训练规则取决于具体服务商。详细说明请查看《隐私政策》。" },
      ],
    },
    finalCta: {
      title: "建立你的 AI 知识库\n让知识持续积累",
      body: "汇集文档、网页与笔记，构建你的 AI 知识库。\n让 AI 整理知识、建立关联，随时基于资料提问，让知识持续积累与复用。",
      action: "建立我的知识库",
    },
    footerGroups: [
      { title: "产品", links: ["功能", "平台", "定价"] },
      { title: "信任", links: ["常见问题", "安全", "联系"] },
      { title: "法律", links: ["服务条款", "隐私", "退款", "订阅与取消", "Cookie"] },
    ],
  },
});

function mergeItems(items = [], overrides = []) {
  return items.map((item, index) => ({ ...item, ...(overrides[index] ?? {}) }));
}

export function applyHomepageMarketingRefresh(copy) {
  const localeKey = copy?.pricing?.currencyCode === "CNY" ? "zh" : "en";
  const content = MARKETING_COPY[localeKey];
  return {
    ...copy,
    meta: { ...copy.meta, ...content.meta },
    nav: { ...copy.nav, items: content.navLabels.map((label, index) => ({ ...(copy.nav.items[index] ?? {}), label })) },
    hero: { ...copy.hero, ...content.hero },
    features: { ...copy.features, intro: { ...copy.features.intro, ...content.features.intro }, items: mergeItems(copy.features.items, content.features.items) },
    platform: content.platform,
    pricing: {
      ...copy.pricing, save: content.pricing.yearlyDiscount, yearlyDiscount: content.pricing.yearlyDiscount,
      intro: { ...copy.pricing.intro, ...content.pricing.intro },
      plans: copy.pricing.plans.map((plan, index) => ({ ...plan, description: content.pricing.descriptions[index], features: [...content.pricing.features[index]] })),
      checkout: { ...copy.pricing.checkout, note: content.pricing.checkoutNote, action: content.pricing.checkoutAction },
    },
    comparison: { ...copy.comparison, ...content.comparison, rows: { ...content.comparison.rows } },
    faq: { ...copy.faq, ...content.faq, items: [...content.faq.items] },
    finalCta: { ...copy.finalCta, ...content.finalCta },
    footer: { ...copy.footer, groups: content.footerGroups.map((group) => ({ title: group.title, links: [...group.links] })) },
  };
}
