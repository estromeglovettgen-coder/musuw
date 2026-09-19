export const NOTEBOOK_COMPARISONS = {
  "en": {
    "title": "Musuw vs. Gemini Notebook",
    "intro": "Choose by what you want to do with your sources next.",
    "note": "NotebookLM is now Gemini Notebook. Both products help you work with your own material; their workflows emphasize different outputs.",
    "tableLabel": "A practical comparison",
    "column": "Your next step",
    "rows": [
      [
        "Ask about sources",
        "Ask across documents and open citations to check the source.",
        "Chat with your notebook’s sources and follow its citations."
      ],
      [
        "Keep using the knowledge",
        "Build connected Wiki pages and explore relationships in a knowledge graph.",
        "Create study and presentation materials, including audio, video, mind maps and quizzes."
      ],
      [
        "Choose a model",
        "Select from the models available in your Musuw plan.",
        "Work with Gemini models through Google’s notebook experience."
      ],
      [
        "Compare plans",
        "Free, Plus, Pro and Max plans, with different capabilities and quotas.",
        "Standard access and upgrades through eligible Google AI, Workspace or Cloud plans."
      ]
    ],
    "musuwTitle": "Choose Musuw for a connected knowledge base",
    "musuwBody": "You return to the same documents, need answers you can check, and want the material to become a reusable Wiki and graph. Start with the actual source-checking walkthrough.",
    "googleTitle": "Explore Gemini Notebook for study formats",
    "googleBody": "Audio and video overviews, quizzes and Google’s notebook workflow may fit better when your main task is reviewing or presenting source material.",
    "evaluationTitle": "Use the same documents to decide",
    "evaluationBody": "Ask a question whose answer you already know. Open the citations. Then compare how easily you can revisit and use what you learned. An output with citations still needs checking.",
    "demo": "Watch Musuw in 40 seconds",
    "pricing": "View Musuw plans",
    "sourcesTitle": "Sources",
    "disclosure": "Prepared by Musuw · Checked September 19, 2026. Google features are based on its official documentation, not a performance test. Availability and limits depend on your plan and region.",
    "locale": "en",
    "path": "/compare/notebooklm",
    "languageLabel": "Page language",
    "meta": {
      "title": "Musuw vs. Gemini Notebook (NotebookLM) | Musuw",
      "description": "Compare source questions, Wiki and graph workflows, and study formats. See official sources and an actual Musuw walkthrough."
    },
    "imageAlt": "Connected Wiki pages in an example Musuw knowledge base",
    "imageCaption": "Example Musuw knowledge base, not customer data.",
    "scrollHint": "Scroll the table horizontally on a small screen.",
    "sourceLabels": [
      "Google’s name update",
      "Google’s notebook features",
      "Google’s plan details"
    ]
  },
  "zh-CN": {
    "title": "Musuw 与 Gemini Notebook 怎么选",
    "intro": "先看你下一步想怎样使用资料。",
    "note": "NotebookLM 已更名为 Gemini Notebook。两款产品都能围绕自己的资料工作，侧重的产出不同。",
    "tableLabel": "按实际用途对照",
    "column": "你要做什么",
    "rows": [
      [
        "围绕资料提问",
        "跨文档提问，点击引用回到来源核对。",
        "围绕笔记本中的来源对话，并查看引用。"
      ],
      [
        "持续使用知识",
        "生成相互关联的 Wiki 页面，通过知识图谱探索关系。",
        "生成音频、视频、思维导图、测验等学习与展示材料。"
      ],
      [
        "选择模型",
        "使用当前 Musuw 套餐开放的模型。",
        "在 Google 的笔记本中使用 Gemini 模型。"
      ],
      [
        "选择套餐",
        "提供免费、Plus、Pro、Max 套餐，功能和额度有所不同。",
        "提供标准访问，以及符合条件的 Google AI、Workspace 或 Cloud 升级方案。"
      ]
    ],
    "musuwTitle": "想积累相互关联的知识，看看 Musuw",
    "musuwBody": "反复查阅同一批文档，需要能核对来源的回答，也想把资料整理成持续复用的 Wiki 和图谱。可以先看下面的实机演示。",
    "googleTitle": "更看重学习形式，看看 Gemini Notebook",
    "googleBody": "如果主要需求是复习、讲解或展示资料，音频与视频概览、测验，以及 Google 的笔记本工作流可能更适合。",
    "evaluationTitle": "拿同一份资料来判断",
    "evaluationBody": "问一个你已经知道答案的问题，打开引用，再看结果是否方便回访和复用。有引用，也仍然需要核对。",
    "demo": "40 秒看 Musuw 实机演示",
    "pricing": "查看 Musuw 套餐",
    "sourcesTitle": "资料来源",
    "disclosure": "Musuw 整理 · 核查于 2026 年 9 月 19 日。Google 功能依据官方文档，未做性能对测；可用功能与限制以套餐和地区为准。",
    "locale": "zh-CN",
    "path": "/zh/compare/notebooklm",
    "languageLabel": "页面语言",
    "meta": {
      "title": "Musuw 与 Gemini Notebook 怎么选 (NotebookLM) | Musuw",
      "description": "对照资料问答、Wiki、知识图谱与学习形式，选择适合自己的工具。附官方资料和 Musuw 实机演示。"
    },
    "imageAlt": "Musuw 示例知识库中相互关联的 Wiki 页面",
    "imageCaption": "Musuw 示例知识库，非客户资料。",
    "scrollHint": "窄屏可横向滑动表格。",
    "sourceLabels": [
      "Google 更名公告",
      "Google 笔记本功能",
      "Google 套餐说明"
    ]
  }
};

export const NOTEBOOK_COMPARISON_SOURCES = [
  "https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/",
  "https://support.google.com/gemininotebook/answer/16206563",
  "https://support.google.com/gemininotebook/answer/16213268?hl=en",
];

export function getNotebookComparison(pathname = "/") {
  const path = pathname.replace(/\/+$/, "") || "/";
  return Object.values(NOTEBOOK_COMPARISONS).find((page) => page.path === path) ?? null;
}
