import {
  ArrowsClockwise,
  CheckCircle,
  Clock,
  FileText,
  FolderOpen,
  Lightning,
  LockKey,
  PaperPlaneTilt,
  Path,
  PresentationChart,
  ShareNetwork,
  ShieldCheck,
  Sparkle,
  Stack,
  UsersThree
} from "@phosphor-icons/react";

export const navItems = [
  { label: "Features", href: "/#feature" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Security", href: "/security" },
  { label: "Legal", href: "/terms" },
  { label: "Contact", href: "/contact" }
];

export const customerMarks = [
  { name: "Source Vault", icon: FolderOpen },
  { name: "Exact Citations", icon: FileText },
  { name: "Living Wiki", icon: Stack },
  { name: "Knowledge Graph", icon: ShareNetwork },
  { name: "Upload and Parsing", icon: CheckCircle },
  { name: "Private Scope", icon: LockKey },
  { name: "Portable Export", icon: Path },
  { name: "Lifecycle Control", icon: ArrowsClockwise }
];

export const features = [
  {
    label: "Grounded Dialogue",
    title: "Ask naturally. Check every important answer.",
    description:
      "musuw searches the knowledge you authorize, answers in context, and connects important claims to exact source evidence.",
    image: "/images/musuw-query-citation.jpg",
    imageAlt: "musuw grounded answer with exact source citations",
    icon: Sparkle,
    bullets: ["Natural questions", "Bounded source scope", "Exact citations", "Honest uncertainty"]
  },
  {
    label: "Living Knowledge Base",
    title: "Turn saved sources into useful memory.",
    description:
      "Bring in notes and documents, preserve the originals, and let musuw maintain connected Wiki pages without rewriting your raw sources.",
    image: "/images/musuw-wiki-page.jpg",
    imageAlt: "musuw living Wiki generated from preserved sources",
    icon: Stack,
    bullets: ["Source preservation", "Automatic Wiki", "Topic organization", "Version history"]
  },
  {
    label: "Wiki and Graph",
    title: "Explore connected knowledge in one place.",
    description:
      "musuw turns parsed sources into native Wiki pages and shows their relationships as a graph view inside Wiki, with paths back to exact evidence.",
    image: "/images/musuw-wiki-graph.jpg",
    imageAlt: "musuw Wiki graph view with paths back to exact evidence",
    icon: CheckCircle,
    bullets: ["Native Wiki", "Graph inside Wiki", "Linked pages", "Evidence return"]
  },
  {
    label: "Ownership and Control",
    title: "Keep your knowledge portable and under control.",
    description:
      "musuw keeps personal workspaces scoped, model credentials server-side, and data lifecycle actions visible from export through deletion.",
    image: "/images/musuw-knowledge-base.jpg",
    imageAlt: "musuw knowledge base with server-confirmed document states",
    icon: ShieldCheck,
    bullets: ["Personal isolation", "Portable export", "Deletion workflow", "Server-side credentials"]
  }
];

export const workflows = [
  {
    icon: FolderOpen,
    title: "Collect sources without perfect filing",
    body: "Add notes and documents first, then organize them with topics when it helps"
  },
  {
    icon: Stack,
    title: "Let knowledge stay alive",
    body: "Build readable Wiki pages while the original evidence remains unchanged"
  },
  {
    icon: Sparkle,
    title: "Ask across exact sources",
    body: "Use natural dialogue with bounded retrieval and inspectable citations"
  },
  {
    icon: ArrowsClockwise,
    title: "Explore relationships in Wiki",
    body: "Switch to the graph view inside Wiki and open connected pages and their sources"
  },
  {
    icon: LockKey,
    title: "Keep or remove it on your terms",
    body: "Save useful answers, export your workspace, or request deletion with visible status"
  }
];

export const benefits = [
  {
    icon: Lightning,
    title: "Stop starting from scratch",
    body: "Bring prior sources and grounded answers back into the next task"
  },
  {
    icon: FileText,
    title: "Know what supports an answer",
    body: "Open the exact version and region behind important claims"
  },
  {
    icon: Clock,
    title: "Keep history intact",
    body: "Preserve earlier versions instead of replacing the past silently"
  },
  {
    icon: UsersThree,
    title: "Control the knowledge scope",
    body: "Choose the workspace, topic, or source set available to a conversation"
  },
  {
    icon: CheckCircle,
    title: "Follow connected knowledge",
    body: "Move from a Wiki page to its graph neighbors and back to exact source evidence"
  },
  {
    icon: PaperPlaneTilt,
    title: "Take your knowledge with you",
    body: "Use portable export and clear deletion workflows instead of lock-in"
  }
];

export const priceBooks = Object.freeze({
  USD: Object.freeze([
    Object.freeze({ monthly: 0, yearlyTotal: 0 }),
    Object.freeze({ monthly: 5, yearlyTotal: 49 }),
    Object.freeze({ monthly: 10, yearlyTotal: 99 }),
    Object.freeze({ monthly: 20, yearlyTotal: 199 })
  ]),
  CNY: Object.freeze([
    Object.freeze({ monthly: 0, yearlyTotal: 0 }),
    Object.freeze({ monthly: 29, yearlyTotal: 289 }),
    Object.freeze({ monthly: 59, yearlyTotal: 589 }),
    Object.freeze({ monthly: 129, yearlyTotal: 1289 })
  ])
});

export const plans = [
  {
    key: "free",
    label: "Free",
    name: "Free",
    description: "A bounded plan for a personal knowledge base",
    features: [
      "5 GB storage",
      "$1 monthly OpenRouter credit",
      "1 knowledge base · 10 documents",
      "Lowest-cost model set"
    ]
  },
  {
    key: "plus",
    label: "Plus",
    name: "Plus",
    description: "More room and every configured model",
    features: [
      "20 GB storage",
      "$1.25 monthly OpenRouter credit",
      "No plan cap on knowledge bases or documents",
      "All configured models"
    ]
  },
  {
    key: "pro",
    label: "Pro",
    name: "Pro",
    description: "Higher storage and model allowance",
    featured: true,
    features: [
      "40 GB storage",
      "$2.50 monthly OpenRouter credit",
      "No plan cap on knowledge bases or documents",
      "All configured models"
    ]
  },
  {
    key: "max",
    label: "Max",
    name: "Max",
    description: "The largest current personal allowance",
    features: [
      "80 GB storage",
      "$5 monthly OpenRouter credit",
      "No plan cap on knowledge bases or documents",
      "All configured models"
    ]
  }
];

export const comparisonGroups = [
  {
    title: "Knowledge Foundation",
    rows: [
      ["Personal source library", true, true, true, true],
      ["Topics and source history", true, true, true, true],
      ["Shared workspace administration", false, false, false, false]
    ]
  },
  {
    title: "Grounded AI",
    rows: [
      ["Knowledge-scoped dialogue", true, true, true, true],
      ["Exact evidence citations", true, true, true, true],
      ["Advanced knowledge tools", true, true, true, true]
    ]
  },
  {
    title: "Connected Knowledge",
    rows: [
      ["Living Wiki", true, true, true, true],
      ["Knowledge graph", true, true, true, true],
      ["Graph view inside Wiki", true, true, true, true]
    ]
  },
  {
    title: "Ownership and Support",
    rows: [
      ["Portable export and deletion", true, true, true, true],
      ["Priority support", false, false, true, true]
    ]
  }
];

export const testimonials = [
  {
    quote: "Raw sources remain preserved. AI-derived knowledge never silently overwrites the material you saved.",
    name: "Raw stays raw",
    role: "Source integrity",
    avatar: "/images/musuw-logo.png"
  },
  {
    quote: "Important factual claims point to exact evidence, not merely a document that happens to discuss the same topic.",
    name: "Exact evidence",
    role: "Grounded answers",
    avatar: "/images/musuw-logo.png"
  },
  {
    quote: "A historical citation resolves the version used by the answer, even when a newer source version now exists.",
    name: "History stays inspectable",
    role: "Versioned sources",
    avatar: "/images/musuw-logo.png"
  },
  {
    quote: "Source-supported facts, model inference, user assertions, and insufficient evidence remain distinguishable.",
    name: "Uncertainty is visible",
    role: "Evidence semantics",
    avatar: "/images/musuw-logo.png"
  },
  {
    quote: "Uploads show processing, available, or retryable failure while optional background work stays off the core path.",
    name: "Core path stays usable",
    role: "Processing state",
    avatar: "/images/musuw-logo.png"
  },
  {
    quote: "Questions, source evidence, and prior answers stay together in the conversation instead of moving through an extra intermediate workflow.",
    name: "History stays with the answer",
    role: "Conversation history",
    avatar: "/images/musuw-logo.png"
  },
  {
    quote: "Every conversation run is bounded to the workspace, topics, and source versions authorized for that turn.",
    name: "Scope is explicit",
    role: "Private retrieval",
    avatar: "/images/musuw-logo.png"
  },
  {
    quote: "Model credentials stay on the server and provider reasoning is never presented as source evidence.",
    name: "Credentials stay server-side",
    role: "Model boundary",
    avatar: "/images/musuw-logo.png"
  },
  {
    quote: "Personal workspaces are isolated by account and scope, including sources, answers, history, and evidence.",
    name: "Personal means isolated",
    role: "Workspace access",
    avatar: "/images/musuw-logo.png"
  },
  {
    quote: "The Wiki explains maintained knowledge. It does not replace or silently modify the original source vault.",
    name: "Wiki is not raw",
    role: "Knowledge ownership",
    avatar: "/images/musuw-logo.png"
  },
  {
    quote: "The knowledge graph exposes typed, evidence-backed relationships instead of decorative similarity lines.",
    name: "Relationships explain why",
    role: "Knowledge graph",
    avatar: "/images/musuw-logo.png"
  },
  {
    quote: "Export and deletion report their actual completion state instead of treating a submitted request as finished.",
    name: "Lifecycle is accountable",
    role: "Data control",
    avatar: "/images/musuw-logo.png"
  }
];

export const articles = [
  {
    title: "Ask with exact evidence",
    author: "musuw product guide",
    date: "Grounded dialogue",
    image: "/images/musuw-query-citation.jpg",
    alt: "musuw knowledge dialogue with active tools",
    href: "/#feature"
  },
  {
    title: "See how knowledge connects",
    author: "musuw product guide",
    date: "Knowledge graph",
    image: "/images/musuw-wiki-graph.jpg",
    alt: "musuw evidence-backed knowledge graph",
    href: "/#use-cases"
  },
  {
    title: "Keep control of your sources",
    author: "musuw product guide",
    date: "Source library",
    image: "/images/musuw-knowledge-base.jpg",
    alt: "musuw source library and upload workflow",
    href: "/#feature"
  }
];

export const faqs = [
  {
    question: "What is musuw?",
    answer:
      "musuw is an evidence-first personal knowledge base that preserves sources, maintains connected knowledge, and answers questions with inspectable citations."
  },
  {
    question: "Which sources can I add?",
    answer:
      "The current product workflow supports notes and common document formats. Additional source types are part of the broader product direction and will be disclosed only when available."
  },
  {
    question: "Does musuw train on my private knowledge?",
    answer:
      "musuw does not claim ownership of your content. Authorized content may be processed by the model provider shown in the product to answer your request, as described in the Privacy Policy."
  },
  {
    question: "Can I verify an AI answer?",
    answer:
      "Yes. Important claims can link to the exact source version and evidence region used by the answer, while inference and insufficient evidence remain labeled."
  },
  {
    question: "Can I export or delete my knowledge?",
    answer:
      "musuw is designed around portable export and coordinated deletion with visible completion states rather than silent lock-in."
  },
  {
    question: "How does paid access become active?",
    answer:
      "Available upgrades open a secure Paddle checkout. A paid plan becomes active only after musuw verifies Paddle's signed server event; a URL or checkout return never grants access."
  }
];

export const footerGroups = [
  {
    title: "Product",
    links: [
      ["Features", "/#feature"],
      ["Use Cases", "/#use-cases"],
      ["Pricing", "/#pricing"]
    ]
  },
  {
    title: "Trust",
    links: [
      ["FAQ", "/#faq"],
      ["Security", "/security"],
      ["Contact", "/contact"]
    ]
  },
  {
    title: "Legal",
    links: [
      ["Terms", "/terms"],
      ["Privacy", "/privacy"],
      ["Refunds", "/refund-policy"]
    ]
  }
];

export const contentIcons = {
  FileText,
  PresentationChart
};
