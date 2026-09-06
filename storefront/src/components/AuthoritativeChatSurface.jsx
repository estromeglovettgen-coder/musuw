import { At } from "@phosphor-icons/react/At";
import { CaretDown } from "@phosphor-icons/react/CaretDown";
import { ImageSquare } from "@phosphor-icons/react/ImageSquare";
import { Paperclip } from "@phosphor-icons/react/Paperclip";
import { PaperPlaneTilt } from "@phosphor-icons/react/PaperPlaneTilt";
import { MusuwProductShell } from "./MusuwProductShell";
import "./authoritative-chat-surface.css";

/**
 * The public product demos use one read-only chat surface.  This is the
 * authoritative seam for the shell, the collapsed navigation, the centered
 * conversation column, and the responsive composer.  Individual demos only
 * provide their fixture messages and timing state.
 */
export function AuthoritativeChatSurface({
  children,
  composer,
  className = "",
  messages,
  shellRef,
  title,
  welcome = null,
  ...rootProps
}) {
  return (
    <MusuwProductShell
      {...rootProps}
      className={`authoritative-chat-surface ${className}`.trim()}
      data-authoritative-chat-surface="true"
      shellRef={shellRef}
      title={title}
    >
      <div className="authoritative-chat-body">
        <div className="authoritative-chat-messages visual-chat-messages">
          {welcome ? <div className="authoritative-chat-welcome" aria-hidden="true">{welcome}</div> : null}
          {messages ?? children}
        </div>
        <div className="authoritative-chat-composer-slot">{composer}</div>
      </div>
    </MusuwProductShell>
  );
}

export function AuthoritativeChatComposer({
  className = "",
  effort,
  isReplying = false,
  model,
  placeholder,
  query = "",
  stopLabel = "Stop",
  sendLabel = "Send",
}) {
  return (
    <div
      className={`authoritative-chat-composer visual-chat-composer ${className}`.trim()}
      data-authoritative-chat-composer="true"
    >
      <div className="authoritative-chat-composer__surface visual-chat-composer__surface">
        <textarea
          className="authoritative-chat-composer__textarea visual-chat-composer__textarea"
          aria-label={placeholder}
          placeholder={placeholder}
          rows="2"
          value={query}
          readOnly
          tabIndex="-1"
        />
        <div className="authoritative-chat-composer__toolbar visual-chat-composer__toolbar">
          <div className="authoritative-chat-composer__tools visual-chat-composer__tools" aria-hidden="true">
            <span className="authoritative-chat-composer__tool visual-chat-composer__tool"><At size={18} weight="bold" /></span>
            <span className="authoritative-chat-composer__tool visual-chat-composer__tool"><ImageSquare size={18} /></span>
            <span className="authoritative-chat-composer__tool visual-chat-composer__tool"><Paperclip size={18} /></span>
          </div>
          <div className="authoritative-chat-composer__actions visual-chat-composer__actions">
            <span className="authoritative-chat-composer__model visual-chat-composer__combined-picker" aria-label={model}>
              <span>{model}</span><small>{effort}</small><CaretDown size={13} />
            </span>
            <span
              className={`authoritative-chat-composer__send visual-chat-composer__send${isReplying ? " is-stop" : query.trim() ? "" : " is-disabled"}`}
              aria-label={isReplying ? stopLabel : sendLabel}
            >
              {isReplying ? <span className="authoritative-chat-composer__stop-square visual-chat-composer__stop-square" /> : <PaperPlaneTilt size={16} weight="fill" />}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
