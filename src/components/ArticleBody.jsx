const unescapeMarkdown = (text) =>
  text.replace(/\\([\\`*{}\[\]()#+\-.!_>])/g, "$1");

function renderInlineTokens(text, keyPrefix, noteIds) {
  const normalizedText = unescapeMarkdown(text);
  const parts = normalizedText.split(
    /(\[\^[a-z0-9-]+\]|\[[^\]]+\]\((?:https?:\/\/|\/|#)[^)\s]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g
  );

  return parts.filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    const note = part.match(/^\[\^([a-z0-9-]+)\]$/);
    if (note && noteIds.includes(note[1])) {
      return <sup key={key}><a role="doc-noteref" href={`#note-${note[1]}`} aria-label={`Nota ${note[1]}`}>[{note[1]}]</a></sup>;
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }

    const linkMatch = part.match(
      /^\[([^\]]+)\]\(((?:https?:\/\/|\/|#)[^)\s]+)\)$/
    );
    if (linkMatch) {
      const isExternal = linkMatch[2].startsWith("http");
      return (
        <a
          key={key}
          href={linkMatch[2]}
          target={isExternal ? "_self" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
        >
          {linkMatch[1]}
        </a>
      );
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }

    return part;
  });
}

function renderArticleBody(source, noteIds) {
  const renderInline = (text, key) => renderInlineTokens(text, key, noteIds);
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const promoteHeadings = !lines.slice(1).some(line => /^##\s|^\*\*[^*]+\*\*$/.test(line.trim()));
  const headingIds = new Map();
  const headingId = text => {
    const base = `section-${text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    const count = (headingIds.get(base) || 0) + 1;
    headingIds.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  };
  const blocks = [];
  let paragraph = [];
  let list = [];
  let orderedList = [];
  let quote = [];

  if (/^\*\*[^*]+\*\*$/.test((lines[0] || "").trim())) {
    lines.shift();
  }

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    blocks.push(
      <p key={`paragraph-${blocks.length}`}>
        {renderInline(text, `paragraph-${blocks.length}`)}
      </p>
    );
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {list.map((item, index) => (
          <li key={`list-item-${index}`}>
            {renderInline(item, `list-${blocks.length}-${index}`)}
          </li>
        ))}
      </ul>
    );
    list = [];
  };

  const flushOrderedList = () => {
    if (!orderedList.length) return;
    blocks.push(
      <ol key={`ordered-list-${blocks.length}`}>
        {orderedList.map((item, index) => (
          <li key={`ordered-list-item-${index}`}>
            {renderInline(item, `ordered-list-${blocks.length}-${index}`)}
          </li>
        ))}
      </ol>
    );
    orderedList = [];
  };

  const flushQuote = () => {
    if (!quote.length) return;
    blocks.push(
      <blockquote key={`quote-${blocks.length}`}>
        {quote.map((item, index) => (
          <p key={`quote-paragraph-${index}`}>
            {renderInline(item, `quote-${blocks.length}-${index}`)}
          </p>
        ))}
      </blockquote>
    );
    quote = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
    flushOrderedList();
    flushQuote();
  };

  lines.forEach((line) => {
    const trimmed = unescapeMarkdown(line.trim());

    if (!trimmed) {
      flushAll();
      return;
    }

    if (/^!\[[^\]]*\]\[[^\]]+\]$/.test(trimmed)) {
      return;
    }

    if (trimmed.startsWith("### ")) {
      flushAll();
      const Heading = promoteHeadings ? "h2" : "h3";
      blocks.push(
        <Heading class={promoteHeadings ? "article-body__legacy-heading" : undefined} id={headingId(trimmed.slice(4))} key={`heading-${blocks.length}`}>
          {renderInline(trimmed.slice(4), `heading-${blocks.length}`)}
        </Heading>
      );
      return;
    }

    if (trimmed.startsWith("## ")) {
      flushAll();
      blocks.push(
        <h2 id={headingId(trimmed.slice(3))} key={`heading-${blocks.length}`}>
          {renderInline(trimmed.slice(3), `heading-${blocks.length}`)}
        </h2>
      );
      return;
    }

    const boldHeading = trimmed.match(/^\*\*([^*]+)\*\*$/);
    if (boldHeading) {
      flushAll();
      blocks.push(
        <h2 id={headingId(boldHeading[1])} key={`heading-${blocks.length}`}>
          {renderInline(boldHeading[1], `heading-${blocks.length}`)}
        </h2>
      );
      return;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      flushParagraph();
      flushOrderedList();
      flushQuote();
      list.push(trimmed.slice(2));
      return;
    }

    const orderedItem = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedItem) {
      flushParagraph();
      flushList();
      flushQuote();
      orderedList.push(orderedItem[1]);
      return;
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph();
      flushList();
      flushOrderedList();
      quote.push(trimmed.slice(2));
      return;
    }

    flushList();
    flushOrderedList();
    flushQuote();
    paragraph.push(trimmed);
  });

  flushAll();
  return blocks;
}

/** @param {{ source: string, noteIds?: string[] }} props */
export default function ArticleBody({ source, noteIds = [] }) {
  return <div class="article-body">{renderArticleBody(source, noteIds)}</div>;
}
