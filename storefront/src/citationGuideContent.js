import { normalizePathname } from "./seoMetadata.js";

export const CITATION_GUIDE_SOURCE = "https://gist.github.com/estromeglovettgen-coder/9ffbe863d4c176d0499627d364566128";
export const CITATION_GUIDE_IMAGE = "/images/guides/cedar-cited-answer.jpg";
export const CITATION_GUIDE_DOCUMENTS = ["01-project-brief.md", "02-source-register.md", "03-review-note.md"];

export const CITATION_GUIDES = {
  en: {
    locale: "en",
    path: "/guides/citation-checks",
    title: "Three checks for cited answers",
    meta: {
      title: "Three checks for cited answers | Musuw",
      description: "Check source dates, preserve conditions, and leave missing facts unresolved. A practical example for reviewing AI answers with citations.",
    },
    languageLabel: "Article language",
    video: "/media/press/musuw-cedar-live-en-16x9.mp4",
    videoPoster: "/media/press/musuw-cedar-live-en-cover.jpg",
    captions: "/media/press/cedar-live-en.vtt",
    videoLabel: "Cedar: a 40-second Musuw walkthrough",
    videoCaption: "40-second recording. Fictional sources, Chinese interface; waiting time edited.",
    videoDownload: "Download video",
    sourceSummary: "Read the example documents",
    sourceMirror: "Also available on GitHub Gist",
    intro: "A cited answer gives you a place to start checking. Before using it in a research note, project update, or decision, open the supporting passage and check its date, conditions, and gaps. A link to a real document does not establish that every part of the answer follows from it.",
    exampleBefore: "Consider Cedar, a fictional planning example with ",
    sourceLabel: "three short source documents",
    exampleAfter: ". The initial brief targets September 24, 2026. A review dated September 18 replaces that target with October 1, subject to four checks. Musuw’s answer preserved that distinction, cited the initial brief and review note, and identified the final approver as unknown. The useful part is that a reader can inspect the passages behind those statements. Here is the checking order:",
    checks: [
      { title: "Check which version governs.", body: "Open the citation beside the date. The review explicitly supersedes September 24; it does not merely mention another date. Record both the document’s date and the event date. A newer document is useful only if it actually updates the claim you are checking." },
      { title: "Keep the conditions attached.", body: "October 1 remains a conditional plan. Approval is not established. The review requires a complete source register, a distinction between assumptions and tested results, permission to publish, and resolution of version conflicts. Dropping these conditions would change the meaning, even if the date remained correct." },
      { title: "Leave missing facts unresolved.", body: "Neither the brief nor the review names the final approver or supplies an actual project cost. “Unknown from these sources” is the supported answer. For your own documents, ask: “What is the current plan, what conditions apply, and what remains unknown? Cite a supporting passage for each claim.” Then open those citations." },
    ],
    imageAlt: "Musuw answer with source citations showing the revised October 1 plan, its conditions, and the unknown final approver.",
    imageCaption: "Cedar fictional example: answer with citations to the initial brief and the revised review note.",
    cta: "Explore Musuw’s cited-answer workflow and plans",
    disclosure: "Published by Musuw; prepared with AI assistance and checked against the example source documents.",
  },
  "zh-CN": {
    locale: "zh-CN",
    path: "/zh/guides/citation-checks",
    title: "核验引用的三个步骤",
    meta: {
      title: "核验引用的三个步骤 | Musuw",
      description: "通过一个虚构规划示例，核对回答中的来源版本、适用条件和未知信息，并逐条打开引用检查原文。",
    },
    languageLabel: "文章语言",
    video: "/media/press/musuw-cedar-live-zh-16x9.mp4",
    videoPoster: "/media/press/musuw-cedar-live-zh-cover.jpg",
    captions: "/media/press/cedar-live-zh.vtt",
    videoLabel: "Cedar：40 秒 Musuw 实机演示",
    videoCaption: "40 秒实录。使用虚构资料，等待过程已剪辑。",
    videoDownload: "下载视频",
    sourceSummary: "查看示例资料",
    sourceMirror: "也可在 GitHub Gist 查看",
    intro: "带有引用的回答，提供了回到原文检查的入口。在把结论写进研究笔记、项目更新或决策材料之前，应核对来源版本、适用条件和资料没有说明的事实。引用指向真实文档，并不代表回答中的每个判断都已得到支持。",
    exampleBefore: "Cedar 是一个虚构的规划示例，并非客户案例。",
    sourceLabel: "三份原始文档",
    exampleAfter: "记录了日期变更：初稿以 2026 年 9 月 24 日为目标，9 月 18 日的复核说明改为计划 10 月 1 日发布，并附有四项条件。Musuw 的回答保留了这一区别，引用初稿与复核说明，并将最终批准人标为未知。核对时，可以按以下顺序进行：",
    checks: [
      { title: "核对生效版本。", body: "打开日期旁的引用，确认复核说明是否明确替代旧计划。同时记录文档日期和计划发生的日期，避免混淆。“更新”本身不足以证明某项结论已被修订，还要检查相应原文。" },
      { title: "保留条件。", body: "10 月 1 日仍是有条件的计划，资料没有证实最终批准。前置检查包括完善来源登记、区分假设与验证结果、确认发布权限，以及解决版本冲突。只摘取日期、删去条件，会改变原文含义。" },
      { title: "把未知留为未知。", body: "初稿与复核说明都未提供最终批准人或实际费用，不能从时间安排推断。处理自己的资料时，可以问：“当前计划是什么，有哪些条件，哪些事实仍未知？请为每项结论引用支持段落。”随后逐条打开引用检查。" },
    ],
    imageAlt: "Musuw 的带引用回答，展示修订后的 10 月 1 日计划、前置条件以及未知的最终批准人。",
    imageCaption: "Cedar 虚构示例：回答引用初稿与后续复核说明。",
    cta: "查看 Musuw 的资料问答演示与方案",
    disclosure: "由 Musuw 发布，经 AI 辅助整理并对照示例原文核验。",
  },
};

export function getCitationGuide(pathname = "/") {
  const path = normalizePathname(pathname);
  return Object.values(CITATION_GUIDES).find((guide) => guide.path === path) ?? null;
}
