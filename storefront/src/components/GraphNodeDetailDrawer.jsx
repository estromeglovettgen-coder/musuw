import { ArrowUpRight } from "@phosphor-icons/react/ArrowUpRight";
import { FileText } from "@phosphor-icons/react/FileText";
import { LinkSimple } from "@phosphor-icons/react/LinkSimple";
import { Tag } from "@phosphor-icons/react/Tag";
import { X } from "@phosphor-icons/react/X";
import { AnimatePresence, motion } from "motion/react";

function localeKey(locale) {
  return String(locale || "zh").toLowerCase().startsWith("zh") ? "zh" : "en";
}

function localized(value, locale, fallback = "") {
  if (value && typeof value === "object") {
    return value[locale] ?? value.zh ?? value.en ?? fallback;
  }
  return value ?? fallback;
}

function nodeIdOf(node) {
  return node?.slug ?? node?.id ?? node?.key ?? "none";
}

function nodeTitleOf(node, locale) {
  return localized(node?.title ?? node?.name ?? node?.label, locale, "未命名节点");
}

function categoryLabelOf(node, locale) {
  return localized(
    node?.categoryLabel ?? node?.category ?? node?.pageTypeLabel,
    locale,
    node?.page_type ?? node?.pageType ?? "知识节点",
  );
}

function defaultSummary(node, locale) {
  const title = nodeTitleOf(node, locale);
  if (locale === "zh") return `${title} 是《小王子》阅读图谱中的一个知识节点。`;
  return `${title} is a knowledge node in the Little Prince reading graph.`;
}

function defaultSectionCopy(locale) {
  return locale === "zh"
    ? {
        overview: "节点概览",
        relations: "相关节点",
        source: "来源",
        sourceValue: "《小王子》阅读图谱",
        noRelations: "暂无相邻节点",
        relationCount: count => `已显示相关节点 ${count} 个`,
      }
    : {
        overview: "Overview",
        relations: "Related nodes",
        source: "Source",
        sourceValue: "The Little Prince reading graph",
        noRelations: "No neighboring nodes",
        relationCount: count => `${count} related ${count === 1 ? "node" : "nodes"} shown`,
      };
}

function normalizeNeighbors(neighbors, locale) {
  if (!Array.isArray(neighbors)) return [];
  return neighbors
    .map((neighbor, index) => {
      if (neighbor && typeof neighbor === "object") {
        return {
          id: nodeIdOf(neighbor) || `neighbor-${index + 1}`,
          title: localized(
            neighbor.title ?? neighbor.name ?? neighbor.label,
            locale,
            `Node ${index + 1}`,
          ),
          relation: localized(
            neighbor.relation ?? neighbor.relationLabel ?? neighbor.kindLabel,
            locale,
            "",
          ),
          color: neighbor.color,
        };
      }
      return {
        id: `neighbor-${index + 1}`,
        title: String(neighbor),
        relation: "",
        color: undefined,
      };
    })
    .filter(neighbor => neighbor.title);
}

/**
 * A static projection of WeKnora's graph-node detail drawer.
 *
 * The production Wiki opens a right-side, full-height document drawer after a
 * graph node is selected. This component intentionally owns no pointer or
 * close handlers: the parent animation supplies `open` and `node` so the
 * storefront can replay that same visual state without turning the demo into
 * an interactive mockup.
 */
export function GraphNodeDetailDrawer({
  open = false,
  node = null,
  locale = "zh",
  neighbors = [],
  sections = [],
  className = "",
}) {
  const language = localeKey(locale);
  const copy = defaultSectionCopy(language);
  const nodeId = nodeIdOf(node);
  const title = nodeTitleOf(node, language);
  const category = categoryLabelOf(node, language);
  const summary = localized(node?.summary ?? node?.description ?? node?.excerpt, language, defaultSummary(node, language));
  const normalizedNeighbors = normalizeNeighbors(neighbors, language);
  const normalizedSections = Array.isArray(sections)
    ? sections
        .map(section => ({
          heading: localized(section?.heading ?? section?.title, language, ""),
          body: localized(section?.body ?? section?.content, language, ""),
        }))
        .filter(section => section.heading || section.body)
    : [];

  return (
    <div
      aria-hidden={!open}
      className={`graph-node-drawer-layer ${className}`.trim()}
      data-graph-drawer-node-id={nodeId}
      data-graph-node-drawer={open ? "open" : "closed"}
    >
      <AnimatePresence initial={false}>
        {open ? (
          <motion.aside
            aria-label={`${title} ${language === "zh" ? "节点详情" : "node details"}`}
            className="graph-node-drawer"
            data-graph-drawer-panel="true"
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="graph-node-drawer-header">
              <div className="graph-node-drawer-heading">
                <span className="graph-node-drawer-icon" aria-hidden="true">
                  <FileText size={20} weight="regular" />
                </span>
                <strong className="graph-node-drawer-title">{title}</strong>
              </div>
              <span className="graph-node-drawer-close" aria-hidden="true">
                <X size={19} weight="regular" />
              </span>
            </header>

            <div className="graph-node-drawer-body">
              <div className="graph-node-drawer-meta">
                <span className="graph-node-drawer-chip">
                  <Tag size={14} weight="regular" />
                  {category}
                </span>
                <span className="graph-node-drawer-version">v1</span>
              </div>

              <p className="graph-node-drawer-relation-count">
                {copy.relationCount(normalizedNeighbors.length)}
              </p>

              <section className="graph-node-drawer-section graph-node-drawer-overview">
                <h2>{copy.overview}</h2>
                <h3>{title}</h3>
                <p>{summary}</p>
              </section>

              {normalizedSections.map((section, index) => (
                <section
                  className="graph-node-drawer-section"
                  data-graph-drawer-section={section.heading || `section-${index + 1}`}
                  key={`${section.heading}-${index}`}
                >
                  {section.heading ? <h2>{section.heading}</h2> : null}
                  {section.body ? <p>{section.body}</p> : null}
                </section>
              ))}

              <section className="graph-node-drawer-section graph-node-drawer-relations">
                <h2>{copy.relations}</h2>
                {normalizedNeighbors.length > 0 ? (
                  <ul className="graph-node-drawer-neighbors">
                    {normalizedNeighbors.map(neighbor => (
                      <li className="graph-node-drawer-neighbor" key={neighbor.id}>
                        <span
                          aria-hidden="true"
                          className="graph-node-drawer-neighbor-dot"
                          style={neighbor.color ? { backgroundColor: neighbor.color } : undefined}
                        />
                        <span className="graph-node-drawer-neighbor-content">
                          <span className="graph-node-drawer-neighbor-title">{neighbor.title}</span>
                          {neighbor.relation ? (
                            <span className="graph-node-drawer-neighbor-relation">
                              <LinkSimple size={13} weight="regular" />
                              {neighbor.relation}
                            </span>
                          ) : null}
                        </span>
                        <ArrowUpRight className="graph-node-drawer-neighbor-arrow" size={15} weight="regular" />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{copy.noRelations}</p>
                )}
              </section>

              <section className="graph-node-drawer-section graph-node-drawer-source">
                <h2>{copy.source}</h2>
                <p>{localized(node?.source ?? node?.sourceLabel, language, copy.sourceValue)}</p>
              </section>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default GraphNodeDetailDrawer;
