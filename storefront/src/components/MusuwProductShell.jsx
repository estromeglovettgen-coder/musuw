import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { ChatCenteredText } from "@phosphor-icons/react/ChatCenteredText";
import { DotsThree } from "@phosphor-icons/react/DotsThree";
import { FolderSimple } from "@phosphor-icons/react/FolderSimple";
import { UsersThree } from "@phosphor-icons/react/UsersThree";

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
      <aside className="visual-sidebar is-collapsed musuw-shell-sidebar hero-demo-sidebar" data-product-app-sidebar="true" data-product-app-sidebar-state="collapsed">
        <div className="musuw-shell-collapsed">
          <div className="musuw-shell-logo hero-demo-logo"><img src="/images/musuw-logo.png" alt="" draggable={false} /></div>
          <span className="musuw-shell-collapse hero-demo-collapse"><CaretRight size={13} weight="bold" /></span>
          <span className="musuw-shell-divider hero-demo-side-divider" />
          <span className={`musuw-shell-collapsed-nav ${activeItem === "chat" ? "is-active" : ""}`}><ChatCenteredText size={17} /></span>
          <span className={`musuw-shell-collapsed-nav ${activeItem === "library" ? "is-active" : ""}`}><FolderSimple size={17} /></span>
          <span className="musuw-shell-collapsed-nav"><UsersThree size={17} /></span>
          <span className="musuw-shell-avatar hero-demo-avatar">E</span>
        </div>
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
