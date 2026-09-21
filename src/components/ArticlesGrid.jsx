import { ARTICLES_ITEMS } from "../config/home";

const ARTICLE_IMAGE_SIZES =
  "(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) calc((100vw - 48px) / 2), calc((min(100vw, 1440px) - 64px) / 3)";

function ArticleCardContent({ article }) {
  return (
    <>
      <div class={`article-card__image${article.wordmarkSrc ? " article-card__image--brand" : ""}`}>
        {article.imageAvifSrcSet ? (
          <picture>
            <source
              type="image/avif"
              srcSet={article.imageAvifSrcSet}
              sizes={ARTICLE_IMAGE_SIZES}
            />
            <source
              type="image/webp"
              srcSet={article.imageWebpSrcSet}
              sizes={ARTICLE_IMAGE_SIZES}
            />
            <img
              class="article-card__cover"
              src={article.imageSrc}
              alt={article.imageAlt}
              width={article.imageWidth}
              height={article.imageHeight}
              sizes={ARTICLE_IMAGE_SIZES}
              loading="lazy"
              decoding="async"
              fetchpriority="low"
            />
          </picture>
        ) : (
          <img
            class="article-card__brand-symbol"
            src={article.imageSrc}
            alt={article.imageAlt}
            width={article.imageWidth}
            height={article.imageHeight}
            loading="lazy"
            decoding="async"
          />
        )}
        {article.wordmarkSrc && (
          <img
            class="article-card__brand-wordmark"
            src={article.wordmarkSrc}
            alt="Imperio Español"
            width="633"
            height="162"
            loading="lazy"
            decoding="async"
          />
        )}
      </div>
      <h3>{article.title}</h3>
    </>
  );
}

export default function ArticlesGrid() {
  return (
    <section class="articles-section home-section bg-white" aria-labelledby="articles-title">
      <div class="home-shell">
        <header class="articles-section__header">
          <h2 id="articles-title">Artículos</h2>
        </header>

        <div class="articles-grid">
          {ARTICLES_ITEMS.map((article) => (
            <article
              class={`article-card fade-in-up${article.href ? " article-card--published" : ""}`}
              key={article.title}
            >
              {article.href ? (
                <a
                  class="article-card__link"
                  href={article.href}
                  target="_self"
                  rel="noopener noreferrer"
                  aria-label={`Abrir ${article.title}`}
                >
                  <ArticleCardContent article={article} />
                </a>
              ) : (
                <ArticleCardContent article={article} />
              )}
            </article>
          ))}
        </div>
      </div>

      <style>{`
        .articles-section__header {
          margin-bottom: var(--space-8);
        }

        .articles-section__header h2 {
          margin: 0;
          font-size: clamp(3rem, 5.5vw, 5.5rem);
          font-weight: 700;
          line-height: 0.95;
          letter-spacing: 0;
        }

        .articles-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: var(--space-4);
        }

        .article-card {
          min-width: 0;
        }

        .article-card__link {
          display: block;
          color: inherit;
          text-decoration: none;
        }

        .article-card__link:focus-visible {
          outline: 3px solid var(--color-red-accent);
          outline-offset: 5px;
        }

        .article-card__image {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
          overflow: hidden;
          margin-bottom: var(--space-3);
          background: #f2f0eb;
        }

        .article-card__cover {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 500ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .article-card__image picture {
          display: contents;
        }

        .article-card--published:hover .article-card__cover {
          transform: scale(1.025);
        }

        .article-card__image--brand {
          display: grid;
          grid-template-rows: minmax(0, 1fr) auto;
          place-items: center;
          gap: clamp(0.5rem, 1.2vw, 1rem);
          padding: clamp(1.5rem, 4vw, 3.5rem);
          background: #fff;
          border: 1px solid rgb(0 0 0 / 12%);
        }

        .article-card__brand-symbol {
          width: min(42%, 11rem);
          height: auto;
          min-height: 0;
          object-fit: contain;
        }

        .article-card__brand-wordmark {
          width: min(82%, 24rem);
          height: auto;
          filter: brightness(0);
        }

        .article-card h3 {
          margin: 0;
          max-width: 34ch;
          font-size: clamp(1.2rem, 1.7vw, 1.75rem);
          font-weight: 700;
          line-height: 1.08;
          letter-spacing: 0;
        }

        @media (max-width: 1023px) {
          .articles-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 767px) {
          .articles-section {
            padding-block: var(--space-8);
          }

          .articles-section__header {
            margin-bottom: var(--space-5);
          }

          .articles-section__header h2 {
            font-size: clamp(2.65rem, 14vw, 4rem);
          }

          .articles-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: var(--space-6);
          }

          .article-card__image {
            margin-bottom: var(--space-2);
            max-height:240px;
          }
          .article-card h3 { font-size:1.5rem; line-height:1.25; }
        }

        @media (prefers-reduced-motion: reduce) {
          .article-card__cover {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}
