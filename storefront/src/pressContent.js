export const PRESS_PATH = "/press";
export const PRESS_ARCHIVE = "/media/press/musuw-media-kit.zip";

export const PRESS_VIDEOS = [
  { id: "en-16x9", language: "en", label: "English · 16:9", resolution: "1920 × 1080" },
  { id: "zh-16x9", language: "zh", label: "中文 · 16:9", resolution: "1920 × 1080" },
  { id: "en-4x5", language: "en", label: "English · 4:5", resolution: "1080 × 1350" },
  { id: "zh-4x5", language: "zh", label: "中文 · 4:5", resolution: "1080 × 1350" },
].map((video) => ({
  ...video,
  src: `/media/press/musuw-${video.id}.mp4`,
  poster: `/media/press/musuw-${video.id}-cover.png`,
  captions: `/media/press/${video.language}.vtt`,
  subtitles: `/media/press/${video.language}.srt`,
}));

export const PRESS_IMAGES = [
  { src: "/images/musuw-knowledge-base.jpg", en: "Knowledge base", zh: "知识库" },
  { src: "/images/musuw-query-citation.jpg", en: "Answers with source citations", zh: "带原文引用的回答" },
  { src: "/images/musuw-wiki-page.jpg", en: "AI-organized Wiki", zh: "AI 整理的 Wiki" },
  { src: "/images/musuw-wiki-graph.jpg", en: "Knowledge graph", zh: "知识图谱" },
];

const content = {
  en: {
    meta: { title: "Media kit | musuw", description: "Official Musuw overview, logo, product screenshots, and 33-second feature showcases in English and Chinese. Download videos and captions for coverage." },
    eyebrow: "Musuw media kit",
    title: "From source material to connected knowledge.",
    intro: "Musuw is an AI knowledge base for documents and notes. Ask questions with source citations, organize findings in an AI-assisted Wiki, and explore a knowledge graph. Paid plans also support webpages and supported video links.",
    demo: "View product demo", pricing: "View plans", downloadKit: "Download media kit (ZIP)",
    kitNote: "Includes the logo, four screenshots, four videos, covers, and English / Chinese captions.",
    videoTitle: "A 33-second product overview",
    videoNote: "Edited feature showcases using public product screenshots and an example document. These are not live recordings. English and Chinese titles and captions accompany the English product interface. All four videos are silent.",
    downloadVideo: "Download MP4", captions: "Captions", screenshots: "Product screenshots", screenshotNote: "Public example workspace. Download the original images for a closer look.",
    downloadImage: "Download image", brandTitle: "Logo & contact", logo: "Musuw logo", downloadLogo: "Download logo (PNG)",
    contact: "For product coverage and questions:", usage: "Use these assets to describe Musuw accurately. Keep the product name and example context intact; do not imply an endorsement or present the showcase as a live recording.",
  },
  "zh-CN": {
    meta: { title: "媒体资料 | musuw", description: "Musuw 官方产品介绍、标志、公开产品截图与中英文 33 秒功能演示。下载视频和字幕，了解带引用的问答、Wiki 与知识图谱。" },
    eyebrow: "Musuw 媒体资料",
    title: "从原始资料，到相互关联的知识。",
    intro: "Musuw 是围绕文档与笔记建立的 AI 知识库。结合资料提问并核对原文引用，用 AI 辅助的 Wiki 整理发现，通过知识图谱探索关联。付费方案还支持网页及已接入平台的视频链接导入。",
    demo: "查看产品演示", pricing: "查看方案", downloadKit: "下载媒体素材包（ZIP）",
    kitNote: "包含标志、四张截图、四个视频、封面及中英文字幕。",
    videoTitle: "33 秒了解产品",
    videoNote: "基于公开产品截图与示例文档剪辑的功能展示，并非实机录屏。视频提供中英文标题和字幕，展示的产品界面为英文。四个视频均无音轨。",
    downloadVideo: "下载 MP4", captions: "字幕", screenshots: "产品截图", screenshotNote: "截图来自公开示例空间，可下载原图查看细节。",
    downloadImage: "下载图片", brandTitle: "标志与联系", logo: "Musuw 标志", downloadLogo: "下载标志（PNG）",
    contact: "产品报道与咨询：", usage: "请用这些素材准确介绍 Musuw，保留产品名称与示例语境，勿暗示未经确认的背书，也不要将功能展示描述为实机录屏。",
  },
};

export function getPressContent(locale) {
  return content[locale === "zh-CN" ? "zh-CN" : "en"];
}

export function getPressMeta(locale, pathname) {
  return pathname.replace(/\/+$/, "") === PRESS_PATH ? getPressContent(locale).meta : null;
}
