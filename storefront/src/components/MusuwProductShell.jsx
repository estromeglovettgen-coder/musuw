import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { ChatCentered } from "@phosphor-icons/react/ChatCentered";
import { DotsThree } from "@phosphor-icons/react/DotsThree";
import { FolderSimple } from "@phosphor-icons/react/FolderSimple";
import { Plus } from "@phosphor-icons/react/Plus";

export function MusuwProductShell({
  activeItem = "chat",
  ariaHidden = false,
  children,
  className = "",
  shellRef,
  title,
  ...rootProps
}) {
  return (
    <div
      {...rootProps}
      className={`musuw-product-shell ${className}`.trim()}
      data-musuw-product-shell="true"
      ref={shellRef}
      aria-hidden={ariaHidden ? "true" : undefined}
    >
      <aside className="musuw-shell-sidebar hero-demo-sidebar">
        <div className="musuw-shell-logo hero-demo-logo">
          <img src="/images/musuw-logo.png" alt="" draggable={false} />
        </div>
        <span className="musuw-shell-collapse hero-demo-collapse">
          <CaretRight size={13} weight="bold" />
        </span>
        <span className="musuw-shell-divider hero-demo-side-divider" />
        <div className="musuw-shell-actions hero-demo-side-actions">
          <span className={activeItem === "chat" ? "is-active" : ""}>
            <span className="musuw-shell-chat-new hero-demo-chat-new">
              <ChatCentered size={16} weight="regular" />
              <Plus size={7} weight="bold" />
            </span>
          </span>
          <span className={activeItem === "library" ? "is-active" : ""}>
            <FolderSimple size={16} weight="regular" />
          </span>
        </div>
        <span className="musuw-shell-avatar hero-demo-avatar">E</span>
      </aside>

      <div className="musuw-shell-workspace hero-demo-workspace">
        <div className="musuw-shell-title hero-demo-title">
          <strong>{title}</strong>
          <DotsThree size={13} weight="bold" />
        </div>
        {children}
      </div>
    </div>
  );
}
